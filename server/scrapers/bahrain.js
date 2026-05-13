// server/scrapers/bahrain.js
// Selenium scraper for bahrain.bh — Vehicle Registration Renewal + Vehicle Record Enquiry PDF

const { Builder, By, until } = require("selenium-webdriver");

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function searchTrafficRecord({ cpr, plateno, company, regTypeID = "01" }, bucket, db) {
  const timestamp   = Date.now();
  const results = { screenshots: [], screenshotData: [], pdfUrl: null, pdfData: null, vehicleData: null, firestoreDocId: null };

  const driver = await new Builder()
    .forBrowser("firefox")
    .build();

  try {
    console.log("[Scraper] Opening bahrain.bh...");
    await driver.get("https://services.bahrain.bh/wps/portal/gdt_en");
    await driver.wait(until.elementLocated(By.className("row-fluid")), 100000);

    await driver.wait(until.elementLocated(By.css('[title="Vehicle Registration Renewal"]')), 100000);
    const renewalLink = await driver.findElement(By.css('[title="Vehicle Registration Renewal"]'));
    await driver.executeScript("arguments[0].click();", renewalLink);
    console.log("[Scraper] Clicked Vehicle Registration Renewal");

    // Identity Type
    await driver.wait(until.elementLocated(By.css('[title="Owner Identity Type"]')), 100000);
    const identityTypeSelect = await driver.findElement(By.css('[title="Owner Identity Type"]'));
    await driver.executeScript(`arguments[0].value = '${company ? "CR" : "CPR"}';`, identityTypeSelect);
    await timeout(1000);
    await driver.executeScript(`const e = new Event('change',{bubbles:true}); arguments[0].dispatchEvent(e);`, identityTypeSelect);
    console.log(`[Scraper] Identity type: ${company ? "CR" : "CPR"}`);
    await timeout(2000);

    // Registration Type
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

    // Vehicle Number
    const vehicleInput = await driver.findElement(By.css('[title="Vehicle Number"]'));
    await driver.executeScript(`arguments[0].value = '${plateno}';`, vehicleInput);

    // CPR / CR
    if (company) {
      const crInput = await driver.findElement(By.css('[title="Commercial Registration Number"]'));
      await driver.executeScript(`arguments[0].value = '${cpr}';`, crInput);
    } else {
      const cprInput = await driver.findElement(By.css('[title="Identity Number"]'));
      await driver.executeScript(`arguments[0].value = '${cpr}';`, cprInput);
    }
    console.log(`[Scraper] ${company ? "CR" : "CPR"}: ${cpr}`);

    await timeout(2000);

    // Continue
    await driver.wait(until.elementLocated(By.css('[value*="Continue"]')), 10000);
    const continueBtn = await driver.findElement(By.css('[value*="Continue"]'));
    await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
    await timeout(500);
    await driver.executeScript('arguments[0].scrollIntoView({behavior:"smooth",block:"end"});', continueBtn);
    await timeout(800);
    await driver.executeScript("arguments[0].click();", continueBtn);
    console.log("[Scraper] Clicked Continue");

    // Details
    await driver.wait(until.elementLocated(By.css('[title="Details"]')), 100000);
    const detailsBtn = await driver.findElement(By.css('[title="Details"]'));
    await driver.executeScript("arguments[0].click();", detailsBtn);
    console.log("[Scraper] Clicked Details");

    await timeout(3000);

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

    await driver.executeScript(`
      const elements = document.getElementsByClassName('modal-body');
      if (elements.length > 0) elements[0].style.maxHeight = '900px';
    `);

    await timeout(1000);
    await takeAndUpload(driver, bucket, `traffic_renewal${timestamp}.png`, "trafficWebsiteRenewalAttFromGenie", results);

    // Navigate to Vehicles Record Enquiry and download the PDF
    const chassisNo = results.vehicleData?.chassisNo;
    const plateNo   = results.vehicleData?.plateNo || plateno;
    await scrapeVehicleEnquiryPdf(driver, bucket, plateNo, chassisNo, regTypeID, timestamp, results);

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

// ── Vehicles Record Enquiry — fills the second form, fetches the report PDF ──
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

    // Registration Type dropdown
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
      await timeout(2000);
    }

    // Fetch the PDF report — URL serves the PDF generated by clicking Export to PDF above
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

    // Upload to Firebase Storage
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

async function takeAndUpload(driver, bucket, fileName, folder, results) {
  const screenshot = await driver.takeScreenshot();
  results.screenshotData.push(screenshot);
  try {
    const buffer = Buffer.from(screenshot, "base64");
    const file   = bucket.file(`${folder}/${fileName}`);
    await file.save(buffer, { contentType: "image/png" });
    const [url] = await file.getSignedUrl({ action: "read", expires: "03-02-2800" });
    results.screenshots.push(url);
    console.log(`[Scraper] Screenshot uploaded: ${fileName}`);
  } catch (err) {
    console.error("[Scraper] Screenshot Firebase upload failed (non-fatal):", err.message);
  }
}

module.exports = { searchTrafficRecord };
