// src/composables/useOcr.js
//
// Calls OCR.space directly from the browser — no backend, no Web Workers.
// Supports images (JPG, PNG, BMP, TIFF, WebP) and PDFs.

import { ref } from 'vue'

const OCR_API_KEY = 'K82551922288957'
const OCR_API_URL = 'https://api.ocr.space/parse/image'

const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'image/bmp', 'image/tiff', 'image/webp',
  'application/pdf',
]
const MAX_SIZE_MB = 5

export function useOcr () {
  const ocrLoading  = ref(false)
  const ocrError    = ref(null)
  const ocrFields   = ref(null)
  const ocrRawText  = ref(null)
  const ocrFileName = ref(null)
  const ocrProgress = ref(0)

  function validateFile (file) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `Unsupported type "${file.type}". Upload a JPG, PNG, BMP, TIFF, WebP, or PDF.`
    }
    const sizeMB = file.size / (1024 * 1024)
    if (sizeMB > MAX_SIZE_MB) return `File is ${sizeMB.toFixed(1)} MB — maximum is ${MAX_SIZE_MB} MB.`
    return null
  }

  async function uploadAndExtract (file) {
    ocrError.value    = null
    ocrFields.value   = null
    ocrRawText.value  = null
    ocrFileName.value = null
    ocrProgress.value = 0

    const validationError = validateFile(file)
    if (validationError) { ocrError.value = validationError; return null }

    ocrLoading.value  = true
    ocrFileName.value = file.name
    ocrProgress.value = 15

    try {
      const body = new FormData()
      body.append('file', file)
      body.append('apikey', OCR_API_KEY)
      body.append('language', 'eng')
      body.append('isOverlayRequired', 'false')
      body.append('OCREngine', '1')
      body.append('scale', 'true')
      body.append('isTable', 'false')

      ocrProgress.value = 30

      const response = await fetch(OCR_API_URL, { method: 'POST', body })

      ocrProgress.value = 70

      if (!response.ok) throw new Error(`OCR.space returned HTTP ${response.status}`)

      const json = await response.json()

      console.group('[OCR] OCR.space response')
      console.log(json)
      console.groupEnd()

      if (json.IsErroredOnProcessing) {
        throw new Error(json.ErrorMessage?.[0] || json.ErrorDetails || 'OCR.space processing error')
      }

      const rawText = (json.ParsedResults || [])
        .map(r => r.ParsedText || '')
        .join('\n')
        .trim()

      ocrProgress.value = 90
      ocrRawText.value  = rawText

      if (!rawText) {
        ocrError.value = 'No text could be extracted. Try a higher-resolution or clearer image.'
        return null
      }

      const fields = parseInsuranceFields(rawText)
      ocrFields.value = fields

      const found = Object.values(fields).filter(v => v !== null).length

      console.group('[OCR] Result')
      console.log('Raw text:\n', rawText)
      console.log('Fields found:', found, fields)
      console.groupEnd()

      ocrProgress.value = 100
      return { fields, rawText, foundCount: found }

    } catch (err) {
      console.error('[OCR] Error:', err)
      ocrError.value = 'OCR failed: ' + (err.message || 'Unknown error')
      return null
    } finally {
      ocrLoading.value = false
    }
  }

  function resetOcr () {
    ocrLoading.value  = false
    ocrError.value    = null
    ocrFields.value   = null
    ocrRawText.value  = null
    ocrFileName.value = null
    ocrProgress.value = 0
  }

  function fieldLabel (key) {
    const labels = {
      insuredName: 'Insured Name', cprNumber: 'CPR Number', crNumber: 'CR Number',
      policyNumber: 'Policy Number', certificateNumber: 'Certificate Number',
      coverType: 'Cover Type', effectiveDate: 'Effective Date', expiryDate: 'Expiry Date',
      vehicleMake: 'Vehicle Make', vehicleModel: 'Vehicle Model', vehicleYear: 'Vehicle Year',
      plateNumber: 'Plate Number', chassisNumber: 'Chassis Number', engineNumber: 'Engine Number',
      sumInsured: 'Sum Insured', premium: 'Premium', phone: 'Phone', email: 'Email',
    }
    return labels[key] || key
  }

  return { ocrLoading, ocrError, ocrFields, ocrRawText, ocrFileName, ocrProgress, uploadAndExtract, resetOcr, fieldLabel }
}

// ── Field extraction ──────────────────────────────────────────────────────────

const NAME_BLOCKLIST = [
  'kingdom of bahrain', 'ministry of interior', 'general directorate of traffic',
  'general directorate', 'directorate of traffic', 'bahrain', 'insurance company',
  'insurance co', 'towergate', 'gig gulf', 'solidarity', 'arab insurance', 'batelco',
]

function matchPattern (text, patterns) {
  for (const re of patterns) {
    const m = text.match(re)
    if (m && m[1] && m[1].trim()) return m[1].trim()
  }
  return null
}

function extractName (text) {
  // Insurance / certificate formats — label with colon or keyword
  const patterns = [
    /(?:insured\s*name|name\s*of\s*insured|name\s*of\s*owner|owner\s*name|client\s*name|customer\s*name|policyholder)\s*[:\-]?\s*([A-Z][A-Za-z\s.\-']{2,60})/im,
    /(?:insured\s*name|name\s*of\s*insured|owner\s*name)\s*[:\-]?\s*\n\s*([A-Z][A-Za-z\s.\-']{2,60})/im,
    /\bowner\b\s*[:\-]?\s*([A-Z][A-Za-z\s.\-']{2,60})/im,
    /(?<!\w)name\s*[:\-]\s*([A-Z][A-Za-z\s.\-']{2,60})/im,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (!m) continue
    let value = m[1].trim().replace(/\s*[\d:]+.*$/, '').trim()
    if (value.length < 3) continue
    const lower = value.toLowerCase()
    if (NAME_BLOCKLIST.some(b => lower.includes(b))) continue
    return value
  }

  // Passport / ID card format: "NAME HAWRA" (no colon), surname on preceding lines
  // e.g.   A. MOHAMED\nMURTADHA\nNAME HAWRA  →  "HAWRA A. MOHAMED MURTADHA"
  const PASSPORT_SKIP = /NATIONALITY|KINGDOM|BAHRAIN|DATE|PASSPORT|PLACE|AUTHORITY|PERSONAL|TYPE|CODE|SEX/i
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const nameIdx = lines.findIndex(l => /^name\s+[A-Z][A-Za-z]/i.test(l))
  if (nameIdx !== -1) {
    const givenMatch = lines[nameIdx].match(/^name\s+([A-Z][A-Za-z .\-']+)/i)
    if (givenMatch) {
      const given = givenMatch[1].trim()
      const surnameParts = []
      for (let i = nameIdx - 1; i >= Math.max(0, nameIdx - 4); i--) {
        const ln = lines[i]
        const isNameLike = /^[A-Z][A-Za-z.\- ]{1,35}$/.test(ln)
        const isBlocked  = PASSPORT_SKIP.test(ln) || NAME_BLOCKLIST.some(b => ln.toLowerCase().includes(b))
        if (isNameLike && !isBlocked) {
          surnameParts.unshift(ln)
        } else {
          break
        }
      }
      const full = surnameParts.length > 0
        ? `${given} ${surnameParts.join(' ')}`
        : given
      if (full.length >= 3) return full
    }
  }

  return null
}

function extractDate (text, patterns) {
  const raw = matchPattern(text, patterns)
  if (!raw) return null
  const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (m) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`
  return raw
}

function parseInsuranceFields (text) {
  text = text.replace(/\r\n|\r/g, '\n').replace(/[ \t]+/g, ' ')

  return {
    insuredName: extractName(text),

    cprNumber: matchPattern(text, [
      /(?:CPR|C\.P\.R\.?|Civil\s*(?:ID|No\.?))\s*[:\-#]?\s*(\d{8,10})/i,
      /(?:CPR|C\.P\.R\.?|Civil\s*(?:ID|No\.?))\s*[:\-#]?\s*\n\s*(\d{8,10})/im,
      // passport: "PERSONAL NO / 041002130" or label then next line
      /(?:PERSONAL\s*NO|Personal\s*Number|National\s*(?:ID|No\.?))\s*[:\-\/]?\s*\n?\s*(\d{8,10})/im,
      /\b((?:19|20)\d{7,8})\b/,
    ]),

    crNumber: matchPattern(text, [
      /(?:C\.?R\.?\s*(?:No\.?|Number|#)|Commercial\s+Reg(?:istration)?(?:\s*No\.?)?)\s*[:\-]?\s*(\d{4,10})/i,
      /(?:C\.?R\.?\s*(?:No\.?|Number|#)|Commercial\s+Reg(?:istration)?(?:\s*No\.?)?)\s*[:\-]?\s*\n\s*(\d{4,10})/im,
    ]),

    policyNumber: matchPattern(text, [
      /(?:policy\s*(?:no\.?|number|#)|pol\.?\s*no\.?)\s*[:\-]?\s*([A-Z0-9][\w\-\/]{3,24})/i,
      /(?:policy\s*(?:no\.?|number|#)|pol\.?\s*no\.?)\s*[:\-]?\s*\n\s*([A-Z0-9][\w\-\/]{3,24})/im,
      /(?:certificate|cert\.?)\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9][\w\-\/]{3,24})/i,
    ]),

    certificateNumber: matchPattern(text, [
      /(?:certificate|cert\.?)\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9][\w\-\/]{3,24})/i,
      /(?:certificate|cert\.?)\s*(?:no\.?|number|#)\s*[:\-]?\s*\n\s*([A-Z0-9][\w\-\/]{3,24})/im,
    ]),

    coverType: matchPattern(text, [
      /\b(comprehensive|third[\s\-]party(?:\s+only)?|fire\s+(?:and|&)\s+theft|TP\s+only)\b/i,
      /\b(comp|tpl|tpo)\b/i,
    ]),

    effectiveDate: extractDate(text, [
      /(?:effective\s*date|inception\s*date|commencement\s*date|start\s*date|from\s*date|issue\s*date|date\s*of\s*issue)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
      /(?:effective\s*date|inception\s*date|start\s*date|date\s*of\s*issue)\s*[:\-]?\s*\n\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/im,
      // passport: "DATE OF ISSUE\n02.05.2023"
      /DATE\s+OF\s+ISSUE\s*[:\-\/]?\s*\n?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/im,
      /\bfrom\b\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
      /period\s*(?:of\s*insurance)?\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    ]),

    expiryDate: extractDate(text, [
      /(?:expiry\s*date|expiration\s*date|exp(?:iry|ires)?\s*(?:date)?|valid\s*(?:until|to)|to\s*date|date\s*of\s*expiry)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
      /(?:expiry\s*date|expiration\s*date|exp(?:iry|ires)?\s*(?:date)?|date\s*of\s*expiry)\s*[:\-]?\s*\n\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/im,
      // passport: "DATE OF EXPIRY\n01.05-2028"
      /DATE\s+OF\s+EXPIRY\s*[:\-\/]?\s*\n?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/im,
      /\bto\b\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
      /period\s*(?:of\s*insurance)?\s*[:\-]?\s*\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\s*[-–to]+\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    ]),

    vehicleMake: matchPattern(text, [
      /(?:make|manufacturer|brand|type\s*of\s*vehicle|vehicle\s*make)\s*[:\-]?\s*([A-Za-z]{2,20})/i,
      /(?:make|manufacturer|brand)\s*[:\-]?\s*\n\s*([A-Za-z]{2,20})/im,
    ]),

    vehicleModel: matchPattern(text, [
      /(?:model)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\s\-]{1,28})/i,
      /(?:model)\s*[:\-]?\s*\n\s*([A-Za-z0-9][A-Za-z0-9\s\-]{1,28})/im,
    ]),

    vehicleYear: matchPattern(text, [
      /(?:year\s*of\s*(?:make|manufacture|mfg)|model\s*year|m\.?y\.?|year)\s*[:\-]?\s*(20\d{2}|19\d{2})/i,
      /(?:year\s*of\s*(?:make|manufacture|mfg)|model\s*year)\s*[:\-]?\s*\n\s*(20\d{2}|19\d{2})/im,
      /^(20[012]\d|199\d)\s*$/m,
    ]),

    plateNumber: matchPattern(text, [
      /(?:plate\s*(?:no\.?|number|#)|registration\s*(?:no\.?|number)|reg\.?\s*no\.?|licence\s*plate)\s*[:\-]?\s*([A-Z]?\s*\d{4,6}[A-Z]?)/i,
      /(?:plate\s*(?:no\.?|number|#)|reg\.?\s*no\.?)\s*[:\-]?\s*\n\s*([A-Z]?\s*\d{4,6}[A-Z]?)/im,
      /\bplate\b[\s\S]*?(\d{4,6})/i,
    ]),

    chassisNumber: matchPattern(text, [
      /(?:chassis|VIN|frame)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-HJ-NPR-Z0-9]{17})/i,
      /(?:chassis|VIN|frame)\s*(?:no\.?|number|#)?\s*[:\-]?\s*\n\s*([A-HJ-NPR-Z0-9]{17})/im,
      /(?:chassis|frame)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9]{8,17})/i,
    ]),

    engineNumber: matchPattern(text, [
      /(?:engine)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9]{5,20})/i,
      /(?:engine)\s*(?:no\.?|number|#)?\s*[:\-]?\s*\n\s*([A-Z0-9]{5,20})/im,
    ]),

    sumInsured: matchPattern(text, [
      /(?:sum\s+insured|insured\s+value|vehicle\s+value|agreed\s+value|market\s+value)\s*[:\-]?\s*(?:BD|BHD|USD)?\s*([\d,]+(?:\.\d{1,3})?)/i,
      /(?:sum\s+insured|insured\s+value|vehicle\s+value)\s*[:\-]?\s*\n\s*(?:BD|BHD|USD)?\s*([\d,]+(?:\.\d{1,3})?)/im,
    ]),

    premium: matchPattern(text, [
      /(?:(?:total\s+)?premium|net\s+premium|gross\s+premium)\s*[:\-]?\s*(?:BD|BHD|USD)?\s*([\d,]+(?:\.\d{1,3})?)/i,
      /(?:(?:total\s+)?premium|net\s+premium|gross\s+premium)\s*[:\-]?\s*\n\s*(?:BD|BHD|USD)?\s*([\d,]+(?:\.\d{1,3})?)/im,
    ]),

    phone: matchPattern(text, [
      /(?:tel(?:ephone)?|mobile|mob\.?|phone|contact\s*(?:no\.?)?)\s*[:\-]?\s*(\+?[\d\s\-(]{7,16})/i,
      /(?:tel(?:ephone)?|mobile|mob\.?|phone)\s*[:\-]?\s*\n\s*(\+?[\d\s\-(]{7,16})/im,
      /\b(\+?973[\s\-]?\d{4}[\s\-]?\d{4})\b/,
    ]),

    email: matchPattern(text, [
      /\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/,
    ]),
  }
}
