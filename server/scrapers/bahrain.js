// server/scrapers/bahrain.js
// Selenium scraper for bahrain.bh Vehicle Registration Renewal

const { Builder, By, until } = require("selenium-webdriver");

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDate(dateString) {
  if (!dateString) return null;
  const datePart = dateString.split(" ")[0];
  const parts = datePart.split("/");
  if (parts.length === 3) {
    const day = parts[0].padStart(2, "0");
    const month = parts[1].padStart(2, "0");
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return null;
}

async function searchTrafficRecord({ cpr, plateno, company, regTypeID = "01" }, bucket, db) {
  const timestamp = Date.now();
  const results = { screenshots: [], pdfUrl: null, vehicleData: null, firestoreDocId: null };
  const driver = await new Builder().forBrowser("firefox").build();

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

    // Registration Type — select by TEXT not by value
    await driver.wait(until.elementLocated(By.css('[title="Registration Type"]')), 100000);
    const regTypeSelect = await driver.findElement(By.css('[title="Registration Type"]'));

    // First log all options so we know what's available
    const allOptions = await driver.executeScript(
      `return Array.from(arguments[0].options).map(o => o.text.trim() + ' | value=' + o.value)`,
      regTypeSelect
    );
    console.log("[Scraper] Registration Type options:", allOptions);

    // Map our regTypeID to a keyword to search in the option text
    const REG_KEYWORD_MAP = {
      "01": "PRIVATE",
      "02": "PVT GOODS",
      "03": "PVT D/C",
      "04": "PVT TRANSPORT",
      "05": "FOR HIRE",
      "06": "PUBLIC D/C",
      "07": "PUBLIC TRANSPORT",
      "08": "TOURIST",
      "09": "MOTORCYCLE",
      "10": "CONTRACTORS",
      "11": "SPECIAL",
      "12": "ROYAL",
      "13": "DIPLOMATIC",
      "14": "SEMI",
      "15": "TRAILER",
    };
    const keyword = REG_KEYWORD_MAP[regTypeID] || "PRIVATE";

    // Select by matching option text
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
    console.log(`[Scraper] Plate: ${plateno}`);

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
    await uploadPdf(driver, bucket, `traffic_record${timestamp}.pdf`, results);

    if (db) {
      const docRef = db.collection("traffic_records").doc(`${plateno}_${timestamp}`);
      await docRef.set({
        cpr, plateno, company: !!company, regTypeID,
        screenshotUrls: results.screenshots,
        pdfUrl: results.pdfUrl,
        vehicleData: results.vehicleData || {},
        createdAt: new Date(),
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

async function takeAndUpload(driver, bucket, fileName, folder, results) {
  try {
    const screenshot = await driver.takeScreenshot();
    const buffer = Buffer.from(screenshot, "base64");
    // Pass bucket name explicitly to avoid 404
    const b = bucket.storage ? bucket : bucket.storage().bucket('mailgaurd-2d6dc.firebasestorage.app');
    const file = b.file(`${folder}/${fileName}`);
    await file.save(buffer, { contentType: "image/png" });
    const [url] = await file.getSignedUrl({ action: "read", expires: "03-02-2800" });
    results.screenshots.push(url);
    console.log(`[Scraper] Screenshot uploaded: ${fileName}`);
  } catch (err) {
    console.error("[Scraper] Screenshot failed:", err.message);
  }
}

async function uploadPdf(driver, bucket, fileName, results) {
  try {
    const pdfData = await driver.executeScript(() => {
      return fetch("/wps/PA_GDTDhBoardServices/Vehicle_enquiry_report?locale=en")
        .then(r => r.arrayBuffer())
        .then(ab => Array.from(new Uint8Array(ab)));
    });
    const buffer = Buffer.from(pdfData);
    const b = bucket.storage ? bucket : bucket.storage().bucket('mailgaurd-2d6dc.firebasestorage.app');
    const file = b.file(`trafficWebsiteAttFromGenie/${fileName}`);
    await file.save(buffer, { contentType: "application/pdf" });
    const [url] = await file.getSignedUrl({ action: "read", expires: "03-02-2800" });
    results.pdfUrl = url;
    console.log(`[Scraper] PDF uploaded: ${fileName}`);
  } catch (err) {
    console.error("[Scraper] PDF upload failed (non-fatal):", err.message);
  }
}

module.exports = { searchTrafficRecord };