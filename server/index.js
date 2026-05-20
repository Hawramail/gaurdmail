// server/index.js
// GuardMail — Genie (Selenium) Server
// Runs as a separate Node.js process on http://localhost:3001
// Vue app calls POST /api/scrape to trigger the bahrain.bh lookup

// ── Dependencies ───────────────────────────────────────────────────────────
// express: HTTP server framework
// cors: allows the Vue dev server (port 5173) to call this server without browser CORS errors
// body-parser: parses incoming JSON and URL-encoded request bodies
// firebase-admin: privileged server-side SDK for Firestore (database) and Storage (files)
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const path = require("path");

// The Selenium-based scraper that opens a real browser and fetches vehicle data from bahrain.bh
const { searchTrafficRecord } = require("./scrapers/bahrain");

const app = express();
app.use(cors()); // allow cross-origin requests from the Vue frontend
app.use(bodyParser.json()); // parse application/json bodies
app.use(bodyParser.urlencoded({ extended: false })); // parse form-encoded bodies

// ── Firebase Admin init ────────────────────────────────────────────────────
// Place  Firebase service account key at server/firebase-service-account.json
// This gives the server admin-level access to Firestore and Cloud Storage without user auth
const serviceAccount = require("./firebase-service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount), // authenticate using the service account
  storageBucket: "mailgaurd-2d6dc.firebasestorage.app", // default bucket for screenshot/PDF uploads
});

const db = admin.firestore(); // Firestore database instance (stores scrape results & events)
const bucket = admin.storage().bucket(); // Cloud Storage bucket (stores screenshots and PDFs)

// ── POST /api/scrape ───────────────────────────────────────────────────────
// Body: { cpr, plateno, company (bool), regTypeID }
// Returns: { success, vehicleData, screenshots, pdfUrl, firestoreDocId }
// Called by the Vue app when the user submits the vehicle lookup form.
// Delegates to the Selenium scraper, which opens a headless browser, fills the
// bahrain.bh traffic portal form, captures screenshots and a PDF, then uploads
// everything to Firebase. Returns the Firestore doc ID and download URLs.
app.post("/api/scrape", async (req, res) => {
  const { cpr, plateno, company, regTypeID } = req.body;

  // Both CPR (civil ID) and plate number are required to identify a vehicle record
  if (!cpr || !plateno) {
    return res.status(400).json({ error: "cpr and plateno are required" });
  }

  console.log(
    `[Genie] Scraping — plateno: ${plateno}, cpr: ${cpr}, company: ${!!company}`,
  );

  try {
    // searchTrafficRecord launches Selenium, fills the form, scrapes results,
    // uploads screenshots/PDF to Cloud Storage, and saves a Firestore document
    const result = await searchTrafficRecord(
      {
        cpr,
        plateno,
        company: !!company, // coerce to boolean in case it arrives as a string
        regTypeID: regTypeID || "01", // default to private vehicle registration type
      },
      bucket, // passed in so the scraper can upload files directly
      db, // passed in so the scraper can write the result document
    );

    console.log("[Genie] Scrape complete:", result.firestoreDocId);
    res.json({ success: true, ...result }); // spread includes vehicleData, screenshots, pdfUrl, firestoreDocId
  } catch (err) {
    console.error("[Genie] Scrape error:", err.message);
    res.status(500).json({ error: err.message || "Scrape failed" });
  }
});

// ── Health check ───────────────────────────────────────────────────────────
// Used by monitoring tools or the Vue app to confirm this server is alive
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "guardmail-genie" });
});

// ── SIEM anomaly detection ─────────────────────────────────────────────────
// Runs every 60 seconds. Checks 6 rules against recent Firestore events
// and writes alerts when thresholds are exceeded. Deduplicates against
// open alerts created in the last 15 minutes to avoid spam.

// Helper: returns a Firestore Timestamp for N minutes ago, used in .where() queries
function minutesAgo(mins) {
  return admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - mins * 60_000),
  );
}

async function runAnomalyDetection() {
  try {
    // Fetch all security events logged in the last 15 minutes from Firestore.
    // All 6 rules operate on this shared snapshot to avoid repeated DB reads.
    const recentSnap = await db
      .collection("security_events")
      .orderBy("timestamp", "desc")
      .limit(200)
      .get();

    const cutoff = new Date(Date.now() - 15 * 60_000);

    const recentEvents = recentSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((e) => {
        const ts = e.timestamp;
        if (!ts) return false;
        // handle both Firestore Timestamp and ISO string
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date > cutoff;
      });

    console.log(`[SIEM] Found ${recentEvents.length} events in last 15 min`);

    // Collect all alerts that fire this cycle; written to Firestore at the end
    const triggered = [];

    // Rule 1: Email burst — >5 EMAIL_SENT from same user in 10 min
    // Indicates a compromised account or misconfigured bulk-send automation
    const emails10m = recentEvents.filter((e) => {
      if (e.eventType !== "EMAIL_SENT") return false;
      const ts = e.timestamp;
      const date = ts?.toDate ? ts.toDate() : new Date(ts);
      return date > new Date(Date.now() - 10 * 60_000);
    });

    const emailsByUser = {};
    // Count how many emails each user sent in the window
    emails10m.forEach((e) => {
      emailsByUser[e.userId] = (emailsByUser[e.userId] || 0) + 1;
    });
    for (const [userId, count] of Object.entries(emailsByUser)) {
      if (count > 10) {
        triggered.push({
          rule: "email_burst",
          severity: "critical",
          userId,
          description: `${count} emails sent in 10 minutes by ${userId}`,
        });
      }
    }

    // Rule 2: Unusual send time — EMAIL_SENT between 11 PM–5 AM Bahrain time (UTC+3)
    // Off-hours sending is a common indicator of account takeover or automated spam
    const unusualTime = recentEvents.filter((e) => {
      if (e.eventType !== "EMAIL_SENT") return false;
      const ts = e.timestamp;
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      if (!d || isNaN(d)) return false;
      const bahrainHour = (d.getUTCHours() + 3) % 24;
      return bahrainHour >= 23 || bahrainHour < 5;
    });
    if (unusualTime.length > 0) {
      triggered.push({
        rule: "unusual_send_time",
        severity: "high",
        userId: unusualTime[0].userId ?? "unknown",
        description: `Email sent at unusual hour (11 PM–5 AM Bahrain time)`,
      });
    }

    // Rule 3: Repeated file rejections — >3 FILE_REJECTED in 15 min
    // Could indicate someone probing the system with malicious files or a broken client
    const rejections = recentEvents.filter(
      (e) => e.eventType === "FILE_REJECTED",
    );
    if (rejections.length > 3) {
      triggered.push({
        rule: "repeated_file_rejections",
        severity: "high",
        userId: rejections[0]?.userId ?? "unknown",
        description: `${rejections.length} file rejections in 15 minutes`,
      });
    }

    // Rule 4: Admin config tampering — >2 ADMIN_CONFIG_CHANGED in 5 min
    // Rapid config changes may indicate an attacker modifying security settings
    const adminChanges = recentEvents.filter((e) => {
      if (e.eventType !== "ADMIN_CONFIG_CHANGED") return false;
      const ts = e.timestamp;
      const date = ts?.toDate ? ts.toDate() : new Date(ts);
      return date > new Date(Date.now() - 5 * 60_000);
    });
    if (adminChanges.length > 2) {
      triggered.push({
        rule: "admin_config_tampering",
        severity: "critical",
        userId: adminChanges[0]?.userId ?? "unknown",
        description: `${adminChanges.length} admin config changes in 5 minutes`,
      });
    }

    // Rule 5: Zoho token failure spike — >3 ZOHO_TOKEN_FAILURE in 10 min
    // Repeated auth failures suggest expired credentials or a token rotation problem
    const zohoFails = recentEvents.filter((e) => {
      if (e.eventType !== "ZOHO_TOKEN_FAILURE") return false;
      const ts = e.timestamp;
      const date = ts?.toDate ? ts.toDate() : new Date(ts);
      return date > new Date(Date.now() - 10 * 60_000);
    });
    if (zohoFails.length > 3) {
      triggered.push({
        rule: "zoho_token_failure_spike",
        severity: "high",
        userId: "system", // token failures are system-level, not tied to a specific user
        description: `${zohoFails.length} Zoho auth failures in 10 minutes`,
      });
    }

    // Rule 6: Abnormally large upload — FILE_UPLOAD with totalSizeBytes > 15 MB
    // Large uploads can signal data exfiltration attempts or accidental bulk uploads
    const largeUploads = recentEvents.filter(
      (e) =>
        e.eventType === "FILE_UPLOAD" &&
        (e.metadata?.totalSizeBytes ?? 0) > 15 * 1024 * 1024,
    );
    if (largeUploads.length > 0) {
      const latest = largeUploads[largeUploads.length - 1]; // alert on the most recent large upload
      const mb = ((latest.metadata?.totalSizeBytes ?? 0) / 1024 / 1024).toFixed(
        1,
      );
      triggered.push({
        rule: "large_file_upload",
        severity: "medium",
        userId: latest.userId ?? "unknown",
        description: `Abnormally large upload: ${mb} MB`,
      });
    }

    // Write alerts to Firestore, skipping any rule that already has an open alert
    // from the last 15 minutes (prevents duplicate alerts for the same ongoing issue)
    for (const alert of triggered) {
      const existingSnap = await db
        .collection("alerts")
        .where("rule", "==", alert.rule)
        .where("status", "==", "open")
        .where("timestamp", ">", minutesAgo(15))
        .get();

      if (existingSnap.empty) {
        // No recent duplicate — safe to write a new alert
        await db.collection("alerts").add({
          ...alert,
          status: "open",
          timestamp: admin.firestore.FieldValue.serverTimestamp(), // use server time for consistency
        });
        // ADD THIS — so the anomalies counter goes up
        await db.collection("security_events").add({
          eventType: "ANOMALY_DETECTED",
          userId: "system",
          severity: alert.severity,
          metadata: { rule: alert.rule, description: alert.description },
          anomalyRuleTriggered: alert.rule,
          timestamp: new Date().toISOString(), 
        });

        console.log(`[SIEM] Alert — ${alert.rule}: ${alert.description}`);
      }
    }
  } catch (err) {
    console.error("[SIEM] Anomaly detection error:", err.message);
  }
}

// Run once immediately on startup, then every 60 seconds thereafter
runAnomalyDetection();
setInterval(runAnomalyDetection, 60_000);

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Genie server running on http://localhost:${PORT}`);
  console.log("Waiting for scrape requests from Vue app...");
});
