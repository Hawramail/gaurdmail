// server/scrapers/bahrain.js
// Selenium scraper for bahrain.bh — Vehicle Registration Renewal + Vehicle Record Enquiry PDF
//
// What this file does:
//   Two jobs:
//     1. Vehicle Registration Renewal — fills the first form on bahrain.bh, scrapes vehicle data, takes a screenshot
//     2. Vehicle Record Enquiry — fills a second form, gets the PDF report
//   Both run automatically using Selenium — a real Firefox browser controlled by code.
//
// Full chain:
//   Vue clicks "Bahrain Traffic Lookup"
//       → POST localhost:3001/api/scrape
//       → searchTrafficRecord() launches Firefox
//       → fills Registration Renewal form → scrapes vehicle data
//       → takes screenshot → uploads to Firebase Storage
//       → fills Vehicle Record Enquiry form → clicks Export
//       → fetches PDF → uploads to Firebase Storage
//       → saves to Firestore traffic_records
//       → returns { vehicleData, screenshotData, pdfData }
//       → Vue converts to File objects → adds to attachments
//       → form fields auto-fill with vehicle data

const { Builder, By, until } = require("selenium-webdriver");

// xcomment: timeout() — thin Promise wrapper around setTimeout, used throughout for explicit waits
// when Selenium's built-in until.* conditions aren't enough (e.g. after AJAX reloads, after modal open)
function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// xcomment: formatDate() — converts portal date strings ("DD/MM/YYYY HH:MM:SS") to ISO "YYYY-MM-DD"
// The portal returns dates like "15/03/2025 00:00:00" — we strip the time and reorder the parts
function formatDate(dateString) {
  if (!dateString) return null;
  const datePart = dateString.split(" ")[0];
  const parts = datePart.split("/");
  if (parts.length === 3) {
    const day   = parts[0].padStart(2, "0");
    const month = parts[1].padStart(2, "0");
    const year  = parts[2];
    return `${year}-${month}-${day}`;
  }
  return null;
}

// ── searchTrafficRecord() ─────────────────────────────────────────────────────────────────────────
// The main function. Called by server/index.js when Vue hits /api/scrape.
//   { cpr, plateno, company, regTypeID = "01" } — CPR/CR number, plate, company flag, registration type code
//   bucket — Firebase Storage instance (passed from server/index.js) for uploading screenshots and PDFs
//   db     — Firestore instance (passed from server/index.js) for saving the traffic record document
async function searchTrafficRecord({ cpr, plateno, company, regTypeID = "01" }, bucket, db) {
  const timestamp   = Date.now();
  const results = { screenshots: [], screenshotData: [], pdfUrl: null, pdfData: null, vehicleData: null, firestoreDocId: null };

  // Step 1 — Open bahrain.bh
  // Launches a real Firefox window, navigates to the GDT portal, waits up to 100 seconds for the
  // page to load. until.elementLocated means "don't continue until this element exists on the page."
  const driver = await new Builder()
    .forBrowser("firefox")
    .build();

  try {
    console.log("[Scraper] Opening bahrain.bh...");
    await driver.get("https://services.bahrain.bh/wps/portal/gdt_en");
    await driver.wait(until.elementLocated(By.className("row-fluid")), 100000);

    // Step 2 — Click Vehicle Registration Renewal
    // Finds the link by its title attribute and clicks it via JavaScript.
    // executeScript is used instead of .click() because some portals block Selenium's native click —
    // a JS click bypasses that restriction.
    await driver.wait(until.elementLocated(By.css('[title="Vehicle Registration Renewal"]')), 100000);
    const renewalLink = await driver.findElement(By.css('[title="Vehicle Registration Renewal"]'));
    await driver.executeScript("arguments[0].click();", renewalLink);
    console.log("[Scraper] Clicked Vehicle Registration Renewal");

    // Step 3 — Fill Identity Type (CR for company, CPR for personal)
    // Sets the dropdown to CR (company registration) or CPR (personal ID) then manually fires a
    // change event — just setting .value doesn't trigger the page's JS listeners that show/hide
    // the subsequent fields.
    await driver.wait(until.elementLocated(By.css('[title="Owner Identity Type"]')), 100000);
    const identityTypeSelect = await driver.findElement(By.css('[title="Owner Identity Type"]'));
    await driver.executeScript(`arguments[0].value = '${company ? "CR" : "CPR"}';`, identityTypeSelect);
    await timeout(1000);
    await driver.executeScript(`const e = new Event('change',{bubbles:true}); arguments[0].dispatchEvent(e);`, identityTypeSelect);
    console.log(`[Scraper] Identity type: ${company ? "CR" : "CPR"}`);
    await timeout(2000);

    // Step 4 — Select Registration Type by text content (not by index or value)
    // The portal uses different internal values across environments, but the option text is always
    // consistent. REG_KEYWORD_MAP maps our regTypeID codes to keywords in the option text,
    // then we loop options and select the first one whose text includes the keyword.
    await driver.wait(until.elementLocated(By.css('[title="Registration Type"]')), 100000);
    const regTypeSelect = await driver.findElement(By.css('[title="Registration Type"]'));

    const allOptions = await driver.executeScript(
      `return Array.from(arguments[0].options).map(o => o.text.trim() + ' | value=' + o.value)`,
      regTypeSelect
    );
    console.log("[Scraper] Registration Type options:", allOptions);

    const REG_KEYWORD_MAP = {
      "01": "PRIVATE",  "02": "PVT GOODS",       "03": "PVT D/C",
      "04": "PVT TRANSPORT", "05": "FOR HIRE",    "06": "PUBLIC D/C",
      "07": "PUBLIC TRANSPORT", "08": "TOURIST",  "09": "MOTORCYCLE",
      "10": "CONTRACTORS", "11": "SPECIAL",        "12": "ROYAL",
      "13": "DIPLOMATIC",   "14": "SEMI",          "15": "TRAILER",
    };
    const keyword = REG_KEYWORD_MAP[regTypeID] || "PRIVATE";

    const selected = await driver.executeScript(`
      const select = arguments[0];
      const keyword = arguments[1];
      for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].text.toUpperCase().includes(keyword)) {
          select.selectedIndex = i;
          select.value = select.options[i].value;
          const e = new Event('change', { bubbles: true });
          select.dispatchEvent(e);
          return select.options[i].text;
        }
      }
      return null;
    `, regTypeSelect, keyword);
    console.log(`[Scraper] Reg type selected: "${selected}" (keyword: ${keyword})`);
    await timeout(500);

    // Step 5 — Fill plate number and identity number
    // Sets field values directly via JS rather than typing character by character — faster and reliable.
    // xcomment: Company vehicles use the "Commercial Registration Number" field;
    //           personal vehicles use "Identity Number" — different title attributes, same idea.
    const vehicleInput = await driver.findElement(By.css('[title="Vehicle Number"]'));
    await driver.executeScript(`arguments[0].value = '${plateno}';`, vehicleInput);

    if (company) {
      const crInput = await driver.findElement(By.css('[title="Commercial Registration Number"]'));
      await driver.executeScript(`arguments[0].value = '${cpr}';`, crInput);
    } else {
      const cprInput = await driver.findElement(By.css('[title="Identity Number"]'));
      await driver.executeScript(`arguments[0].value = '${cpr}';`, cprInput);
    }
    console.log(`[Scraper] ${company ? "CR" : "CPR"}: ${cpr}`);

    await timeout(2000);

    // Step 6 — Click Continue → then Details to open the vehicle data modal
    // Scrolls to the button before clicking to avoid any overlap issues, then waits for the
    // Details button to appear (portal renders it after server-side validation passes).
    await driver.wait(until.elementLocated(By.css('[value*="Continue"]')), 10000);
    const continueBtn = await driver.findElement(By.css('[value*="Continue"]'));
    await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
    await timeout(500);
    await driver.executeScript('arguments[0].scrollIntoView({behavior:"smooth",block:"end"});', continueBtn);
    await timeout(800);
    await driver.executeScript("arguments[0].click();", continueBtn);
    console.log("[Scraper] Clicked Continue");

    await driver.wait(until.elementLocated(By.css('[title="Details"]')), 100000);
    const detailsBtn = await driver.findElement(By.css('[title="Details"]'));
    await driver.executeScript("arguments[0].click();", detailsBtn);
    console.log("[Scraper] Clicked Details");

    await timeout(3000); // wait for modal to load

    // Step 7 — Scrape the vehicle data from the modal
    // Runs JS inside the browser to grab all .form-control-block.block-full elements and return
    // their text — car model, chassis, plate, registration type, insurance, etc.
    await driver.wait(until.elementLocated(By.className("form-control-block block-full")), 100000);
    await driver.wait(until.elementLocated(By.className("modal-body")), 100000);

    const elementData = await driver.executeScript(() => {
      const elements = document.getElementsByClassName("form-control-block block-full");
      const data = [];
      for (let i = 0; i < elements.length; i++) {
        data.push({ innerHTML: elements[i].innerHTML, text: elements[i].innerText || elements[i].textContent });
      }
      return data;
    });

    console.log(`[Scraper] Found ${elementData.length} elements`);

    // Index offset logic — the portal sometimes renders an extra <input> at position 0 depending
    // on vehicle type. If element[0] contains "<input>" HTML → shift all indices by 2.
    // Otherwise use base indices. Discovered by testing — one of the trickiest parts of the scraper.
    let ocrSmart = null;
    if (elementData && elementData.length > 5) {
      const firstElement = elementData[0].innerHTML;
      if (firstElement && firstElement.toLowerCase().includes("<input")) {
        console.log("[Scraper] Condition met — using offset indices");
        ocrSmart = {
          carModel:   elementData[2].text.trim(),
          chassisNo:  elementData[6].text.trim(),
          insCompany: elementData[8].text.trim(),
          insExpiry:  formatDate(elementData[9].text.trim()),
          plateNo:    elementData[3].text.trim(),
          regType:    elementData[4].text.trim(),
          regExpiry:  formatDate(elementData[7].text.trim()),
          vehWeight:  elementData[5].text.trim(),
        };
      } else {
        console.log("[Scraper] Using base indices");
        await timeout(3000);
        ocrSmart = {
          carModel:   elementData[0].text.trim(),
          chassisNo:  elementData[4].text.trim(),
          insCompany: elementData[6].text.trim(),
          insExpiry:  formatDate(elementData[7].text.trim()),
          plateNo:    elementData[1].text.trim(),
          regType:    elementData[2].text.trim(),
          regExpiry:  formatDate(elementData[5].text.trim()),
          vehWeight:  elementData[3].text.trim(),
        };
      }
      results.vehicleData = { ...ocrSmart, scrapedAt: new Date().toISOString() };
      console.log("[Scraper] Vehicle data:", results.vehicleData);
    } else {
      console.warn("[Scraper] Not enough elements:", elementData?.length);
    }

    // xcomment: Expand the modal's max-height before taking the screenshot so all vehicle data
    // rows are visible in the image — the default CSS clips the modal at a shorter height.
    await driver.executeScript(`
      const elements = document.getElementsByClassName('modal-body');
      if (elements.length > 0) elements[0].style.maxHeight = '900px';
    `);

    // Step 8 — Take screenshot and upload to Firebase Storage
    // takeAndUpload() captures a base64 PNG, saves it to results.screenshotData (for Vue),
    // uploads the PNG to Firebase Storage, and pushes the signed URL to results.screenshots.
    await timeout(1000);
    await takeAndUpload(driver, bucket, `traffic_renewal${timestamp}.png`, "trafficWebsiteRenewalAttFromGenie", results);

    // Step 9 — Vehicles Record Enquiry PDF (second form)
    // Navigates back to the GDT portal and fills a second form using the plate number and chassis
    // number scraped above. See scrapeVehicleEnquiryPdf() below.
    const chassisNo = results.vehicleData?.chassisNo;
    const plateNo   = results.vehicleData?.plateNo || plateno;
    await scrapeVehicleEnquiryPdf(driver, bucket, plateNo, chassisNo, regTypeID, timestamp, results);

    // Step 10 — Save to Firestore traffic_records and return
    // Document ID is plateno_timestamp so it's unique and identifiable.
    // Returns results to server/index.js which sends it to Vue. Vue converts the base64
    // screenshots and PDF into File objects and adds them to the email attachments.
    if (db) {
      const docRef = db.collection("traffic_records").doc(`${plateno}_${timestamp}`);
      await docRef.set({
        cpr, plateno, company: !!company, regTypeID,
        screenshotUrls: results.screenshots,
        pdfUrl:         results.pdfUrl,
        vehicleData:    results.vehicleData || {},
        createdAt:      new Date(),
      });
      results.firestoreDocId = docRef.id;
      console.log("[Scraper] Saved to Firestore:", docRef.id);
    }

    return results;
  } finally {
    await driver.quit();
    console.log("[Scraper] Browser closed");
  }
}

// ── scrapeVehicleEnquiryPdf() ─────────────────────────────────────────────────────────────────────
// Step 9 detail — fills the second GDT form "Vehicles Record Enquiry" using plate + chassis scraped
// in step 7, clicks Export, then fetches the PDF report via fetch() inside the browser session.
//
// The PDF is fetched inside the browser (not from Node.js) because the URL only works in the context
// of the authenticated browser session — Node.js cannot access it directly.
// PDF bytes are returned as an array → converted to Buffer → uploaded to Firebase Storage →
// converted to base64 → sent back to Vue.
//
// xcomment: This form also has a Registration Type dropdown (same REG_KEYWORD_MAP logic as step 4).
// xcomment: The Export button finder uses a broad search across title/alt/innerText and skips hidden
//           elements because JSF portlet buttons often carry ViewState in their value attribute,
//           making value-based selectors unreliable. Falls back to any visible submit in the form.
async function scrapeVehicleEnquiryPdf(driver, bucket, plateNo, chassisNo, regTypeID, timestamp, results) {
  if (!plateNo || !chassisNo) {
    console.warn("[Scraper] Vehicle enquiry PDF skipped — missing plateNo or chassisNo");
    return;
  }

  try {
    console.log("[Scraper] Navigating back to GDT portal for Vehicles Record Enquiry...");
    await driver.get("https://services.bahrain.bh/wps/portal/gdt_en");
    await driver.wait(until.elementLocated(By.className("row-fluid")), 60000);

    // Find the "Vehicles Record Enquiry" service link
    await driver.wait(until.elementLocated(By.css('[title*="Record Enquiry"]')), 30000);
    const enquiryLink = await driver.findElement(By.css('[title*="Record Enquiry"]'));
    const linkTitle   = await driver.executeScript("return arguments[0].title", enquiryLink);
    console.log(`[Scraper] Clicking enquiry link: "${linkTitle}"`);
    await driver.executeScript("arguments[0].click();", enquiryLink);

    // Wait for the form fields
    await driver.wait(until.elementLocated(By.css('[id*="vehicleNo"]')), 30000);
    await timeout(1000);

    // Registration Type dropdown (same keyword-match approach as the first form)
    const regSelect = await driver.findElement(By.css('[id*="cprvehicletypelist"]'));
    const REG_KEYWORD_MAP = {
      "01": "PRIVATE",  "02": "PVT GOODS",    "03": "PVT D/C",
      "04": "PVT TRANSPORT", "05": "FOR HIRE", "06": "PUBLIC D/C",
      "07": "PUBLIC TRANSPORT", "08": "TOURIST", "09": "MOTORCYCLE",
      "10": "CONTRACTORS", "11": "SPECIAL",     "12": "ROYAL",
      "13": "DIPLOMATIC",  "14": "SEMI",        "15": "TRAILER",
    };
    const keyword    = REG_KEYWORD_MAP[regTypeID] || "PRIVATE";
    const selectedReg = await driver.executeScript(`
      const s = arguments[0], kw = arguments[1].toUpperCase();
      for (let i = 0; i < s.options.length; i++) {
        if (s.options[i].text.toUpperCase().includes(kw)) {
          s.selectedIndex = i;
          s.value = s.options[i].value;
          s.dispatchEvent(new Event('change', { bubbles: true }));
          return s.options[i].text;
        }
      }
      return null;
    `, regSelect, keyword);
    console.log(`[Scraper] Enquiry reg type: "${selectedReg}"`);

    // Vehicle Number
    const vehicleNoInput = await driver.findElement(By.css('[id*="vehicleNo"]'));
    await driver.executeScript(
      `arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('change',{bubbles:true}));`,
      vehicleNoInput, plateNo
    );

    // Chassis Number
    const chassisInput = await driver.findElement(By.css('[id*="chasisnumber"]'));
    await driver.executeScript(
      `arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('change',{bubbles:true}));`,
      chassisInput, chassisNo
    );
    console.log(`[Scraper] Enquiry form filled — plate: ${plateNo}, chassis: ${chassisNo}`);

    await timeout(500);

    // Prefer the "View" button; fall back to the first visible submit in the form
    const viewBtn = await driver.executeScript(function() {
      var inp = document.querySelector('[id*="vehicleNo"]');
      if (!inp) return null;
      var form = inp.closest("form");
      if (!form) return null;
      var all = Array.from(form.querySelectorAll(
        'input[type="submit"], input[type="button"], input[type="image"], button'
      ));
      // Try to find a button explicitly labelled "View"
      var view = all.find(function(el) {
        var label = (el.value || el.title || el.innerText || el.textContent || "").trim().toUpperCase();
        return label === "VIEW" || label.indexOf("VIEW") !== -1;
      });
      return view || all[0] || null;
    });
    if (!viewBtn) throw new Error("Could not find View button in enquiry form");
    await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
    await timeout(300);
    await driver.executeScript("arguments[0].click();", viewBtn);
    console.log("[Scraper] Clicked View on enquiry form");

    // Wait up to 30 s for results — JSF portlet reloads via AJAX
    await timeout(3000);
    await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
    await timeout(1000);

    // Wait up to 30 s for Export/PDF button to appear after results load.
    // Check title independently from value — JSF buttons often carry ViewState in value.
    let exportBtnEl = null;
    const findExportBtn = function() {
      return Array.from(document.querySelectorAll(
        'input[type="button"], input[type="submit"], input[type="image"], button, a'
      )).find(function(el) {
        var style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        var title = (el.getAttribute("title") || "").trim();
        if (title.length > 0 && title.length < 100) {
          var t = title.toUpperCase();
          if (t.indexOf("EXPORT") !== -1 || t.indexOf("PDF") !== -1 || t.indexOf("PRINT") !== -1) return true;
        }
        var label = (el.getAttribute("alt") || el.innerText || el.textContent || "").trim();
        return label.length > 0 && label.length < 100 &&
               (label.toUpperCase().indexOf("EXPORT") !== -1 ||
                label.toUpperCase().indexOf("PDF") !== -1 ||
                label.toUpperCase().indexOf("PRINT") !== -1);
      }) || null;
    };
    try {
      await driver.wait(async function() {
        exportBtnEl = await driver.executeScript(findExportBtn);
        return exportBtnEl !== null;
      }, 30000);
      console.log("[Scraper] Export button appeared");
    } catch (e) {
      console.warn("[Scraper] Export button did not appear within 30 s");
    }

    if (exportBtnEl) {
      const label = await driver.executeScript(
        "return (arguments[0].getAttribute('title') || arguments[0].getAttribute('alt') || arguments[0].innerText || arguments[0].textContent || '').trim()",
        exportBtnEl
      );
      console.log(`[Scraper] Clicking export button: "${label}"`);
      await driver.executeScript("arguments[0].scrollIntoView({block:'center'});", exportBtnEl);
      await timeout(500);
      await driver.executeScript("arguments[0].click();", exportBtnEl);
      await timeout(5000); // wait for the PDF to be generated server-side before fetching
    }

    // Fetch the PDF report — URL serves the PDF generated by clicking Export above.
    // fetch() runs inside the browser (not Node.js) because the endpoint is session-authenticated;
    // returns bytes as a plain array so Selenium can pass them back to Node.js.
    let pdfBuffer = null;
    try {
      const pdfBytes = await driver.executeScript(function() {
        return fetch("/wps/PA_GDTDhBoardServices/Vehicle_enquiry_report?locale=en")
          .then(function(r) { return r.arrayBuffer(); })
          .then(function(buf) { return Array.from(new Uint8Array(buf)); });
      });
      if (Array.isArray(pdfBytes) && pdfBytes.length > 100) {
        pdfBuffer = Buffer.from(pdfBytes);
        console.log("[Scraper] Vehicle record PDF fetched (" + pdfBytes.length + " bytes)");
      } else {
        console.warn("[Scraper] PDF URL returned empty response:", pdfBytes?.length);
      }
    } catch (e) {
      console.warn("[Scraper] PDF URL fetch failed:", e.message);
    }

    // Upload PDF to Firebase Storage — signed URL set to never expire (year 2800)
    if (pdfBuffer) {
      try {
        const file = bucket.file(`trafficWebsiteAttFromGenie/traffic_record${timestamp}.pdf`);
        await file.save(pdfBuffer, { contentType: "application/pdf" });
        const [url] = await file.getSignedUrl({ action: "read", expires: "03-02-2800" });
        results.pdfUrl  = url;
        results.pdfData = pdfBuffer.toString("base64");
        console.log("[Scraper] Vehicle record PDF uploaded to Firebase");
      } catch (err) {
        console.error("[Scraper] PDF Firebase upload failed (non-fatal):", err.message);
      }
    }
  } catch (err) {
    console.error("[Scraper] Vehicle record enquiry failed (non-fatal):", err.message);
  }
}

// ── takeAndUpload() ───────────────────────────────────────────────────────────────────────────────
// Takes a screenshot → saves base64 to results.screenshotData (for Vue) →
// uploads PNG to Firebase Storage → gets a signed URL that never expires (year 2800) →
// pushes URL to results.screenshots.
// Non-fatal: upload errors are caught so a Firebase hiccup doesn't abort the whole scrape.
async function takeAndUpload(driver, bucket, fileName, folder, results) {
  const screenshot = await driver.takeScreenshot(); // returns base64 PNG
  results.screenshotData.push(screenshot);          // saved for sending back to Vue
  try {
    const buffer = Buffer.from(screenshot, "base64");
    const file   = bucket.file(`${folder}/${fileName}`);
    await file.save(buffer, { contentType: "image/png" });
    const [url] = await file.getSignedUrl({ action: "read", expires: "03-02-2800" });
    results.screenshots.push(url);                  // Firebase Storage URL saved
    console.log(`[Scraper] Screenshot uploaded: ${fileName}`);
  } catch (err) {
    console.error("[Scraper] Screenshot Firebase upload failed (non-fatal):", err.message);
  }
}

module.exports = { searchTrafficRecord };
