// server/index.js
// GuardMail — Genie (Selenium) Server
// Runs as a separate Node.js process on http://localhost:3001
// Vue app calls POST /api/scrape to trigger the bahrain.bh lookup

const express    = require('express')
const cors       = require('cors')
const bodyParser = require('body-parser')
const admin      = require('firebase-admin')
const path       = require('path')

const { searchTrafficRecord } = require('./scrapers/bahrain')

const app = express()
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

// ── Firebase Admin init ────────────────────────────────────────────────────
// Place your Firebase service account key at server/firebase-service-account.json
// Download it from: Firebase Console → Project Settings → Service Accounts → Generate new private key
const serviceAccount = require('./firebase-service-account.json')

admin.initializeApp({
  credential:    admin.credential.cert(serviceAccount),
  storageBucket: 'mailgaurd-2d6dc.firebasestorage.app',
})

const db     = admin.firestore()
const bucket = admin.storage().bucket()

// ── POST /api/scrape ───────────────────────────────────────────────────────
// Body: { cpr, plateno, company (bool), regTypeID }
// Returns: { success, vehicleData, screenshots, pdfUrl, firestoreDocId }
app.post('/api/scrape', async (req, res) => {
  const { cpr, plateno, company, regTypeID } = req.body

  if (!cpr || !plateno) {
    return res.status(400).json({ error: 'cpr and plateno are required' })
  }

  console.log(`[Genie] Scraping — plateno: ${plateno}, cpr: ${cpr}, company: ${!!company}`)

  try {
    const result = await searchTrafficRecord(
      {
        cpr,
        plateno,
        company:   !!company,
        regTypeID: regTypeID || '01',
      },
      bucket,
      db
    )

    console.log('[Genie] Scrape complete:', result.firestoreDocId)
    res.json({ success: true, ...result })

  } catch (err) {
    console.error('[Genie] Scrape error:', err.message)
    res.status(500).json({ error: err.message || 'Scrape failed' })
  }
})

// ── Health check ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'guardmail-genie' })
})

// ── SIEM anomaly detection ─────────────────────────────────────────────────
// Runs every 60 seconds. Checks 6 rules against recent Firestore events
// and writes alerts when thresholds are exceeded. Deduplicates against
// open alerts created in the last 15 minutes to avoid spam.

function minutesAgo (mins) {
  return admin.firestore.Timestamp.fromDate(new Date(Date.now() - mins * 60_000))
}

async function runAnomalyDetection () {
  try {
    const recentSnap = await db.collection('security_events')
      .where('timestamp', '>', minutesAgo(15))
      .get()
    const recentEvents = recentSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    const triggered = []

    // Rule 1: Email burst — >5 EMAIL_SENT from same user in 10 min
    const emails10m = recentEvents.filter(e =>
      e.eventType === 'EMAIL_SENT' &&
      e.timestamp?.toDate?.() > new Date(Date.now() - 10 * 60_000)
    )
    const emailsByUser = {}
    emails10m.forEach(e => { emailsByUser[e.userId] = (emailsByUser[e.userId] || 0) + 1 })
    for (const [userId, count] of Object.entries(emailsByUser)) {
      if (count > 5) {
        triggered.push({ rule: 'email_burst', severity: 'critical', userId,
          description: `${count} emails sent in 10 minutes by ${userId}` })
      }
    }

    // Rule 2: Unusual send time — EMAIL_SENT between 11 PM–5 AM Bahrain time (UTC+3)
    const unusualTime = recentEvents.filter(e => {
      if (e.eventType !== 'EMAIL_SENT') return false
      const d = e.timestamp?.toDate?.()
      if (!d) return false
      const bahrainHour = (d.getUTCHours() + 3) % 24
      return bahrainHour >= 23 || bahrainHour < 5
    })
    if (unusualTime.length > 0) {
      triggered.push({ rule: 'unusual_send_time', severity: 'high',
        userId: unusualTime[0].userId ?? 'unknown',
        description: `Email sent at unusual hour (11 PM–5 AM Bahrain time)` })
    }

    // Rule 3: Repeated file rejections — >3 FILE_REJECTED in 15 min
    const rejections = recentEvents.filter(e => e.eventType === 'FILE_REJECTED')
    if (rejections.length > 3) {
      triggered.push({ rule: 'repeated_file_rejections', severity: 'high',
        userId: rejections[0]?.userId ?? 'unknown',
        description: `${rejections.length} file rejections in 15 minutes` })
    }

    // Rule 4: Admin config tampering — >2 ADMIN_CONFIG_CHANGED in 5 min
    const adminChanges = recentEvents.filter(e =>
      e.eventType === 'ADMIN_CONFIG_CHANGED' &&
      e.timestamp?.toDate?.() > new Date(Date.now() - 5 * 60_000)
    )
    if (adminChanges.length > 2) {
      triggered.push({ rule: 'admin_config_tampering', severity: 'critical',
        userId: adminChanges[0]?.userId ?? 'unknown',
        description: `${adminChanges.length} admin config changes in 5 minutes` })
    }

    // Rule 5: Zoho token failure spike — >3 ZOHO_TOKEN_FAILURE in 10 min
    const zohoFails = recentEvents.filter(e =>
      e.eventType === 'ZOHO_TOKEN_FAILURE' &&
      e.timestamp?.toDate?.() > new Date(Date.now() - 10 * 60_000)
    )
    if (zohoFails.length > 3) {
      triggered.push({ rule: 'zoho_token_failure_spike', severity: 'high',
        userId: 'system',
        description: `${zohoFails.length} Zoho auth failures in 10 minutes` })
    }

    // Rule 6: Abnormally large upload — FILE_UPLOAD with totalSizeBytes > 15 MB
    const largeUploads = recentEvents.filter(e =>
      e.eventType === 'FILE_UPLOAD' &&
      (e.metadata?.totalSizeBytes ?? 0) > 15 * 1024 * 1024
    )
    if (largeUploads.length > 0) {
      const latest = largeUploads[largeUploads.length - 1]
      const mb     = ((latest.metadata?.totalSizeBytes ?? 0) / 1024 / 1024).toFixed(1)
      triggered.push({ rule: 'large_file_upload', severity: 'medium',
        userId: latest.userId ?? 'unknown',
        description: `Abnormally large upload: ${mb} MB` })
    }

    // Write alerts, deduplicating against open alerts in the last 15 min
    for (const alert of triggered) {
      const existingSnap = await db.collection('alerts')
        .where('rule',   '==', alert.rule)
        .where('status', '==', 'open')
        .where('timestamp', '>', minutesAgo(15))
        .get()

      if (existingSnap.empty) {
        await db.collection('alerts').add({
          ...alert,
          status:    'open',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        })
        console.log(`[SIEM] Alert — ${alert.rule}: ${alert.description}`)
      }
    }
  } catch (err) {
    console.error('[SIEM] Anomaly detection error:', err.message)
  }
}

// Start anomaly detection loop
runAnomalyDetection()
setInterval(runAnomalyDetection, 60_000)

const PORT = 3001
app.listen(PORT, () => {
  console.log(`Genie server running on http://localhost:${PORT}`)
  console.log('Waiting for scrape requests from Vue app...')
})