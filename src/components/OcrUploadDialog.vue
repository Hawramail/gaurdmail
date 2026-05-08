<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="val => $emit('update:modelValue', val)"
    persistent
    style="width: 740px; max-width: 95vw"
  >
    <q-card class="ocr-dlg" style="max-height: 90vh; display: flex; flex-direction: column">

      <!-- ── HEADER ── -->
      <div class="ocr-dlg-hdr">
        <div class="ocr-icon-wrap">
          <q-icon name="document_scanner" size="18px" />
        </div>
        <div style="flex: 1">
          <div class="ocr-dlg-title">Upload &amp; Extract Documents</div>
          <div class="ocr-dlg-sub">OCR extracts fields to pre-fill the email template</div>
        </div>
        <q-btn flat round dense icon="close" size="sm" @click="$emit('update:modelValue', false)" />
      </div>

      <q-separator style="opacity: 0.5" />

      <!-- ── BODY ── -->
      <div class="ocr-dlg-body">

        <!-- LEFT: tray -->
        <div class="ocr-tray">
          <div class="tray-list">
            <div
              v-for="doc in documents"
              :key="doc.id"
              class="tray-slot"
              :class="{ 'tray-slot--on': doc.id === activeDocId }"
              @click="activeDocId = doc.id"
            >
              <div class="tray-row1">
                <span class="s-dot" :class="statusDotClass(doc)" />
                <span class="tray-lbl">{{ docTypeLabel(doc.type) }}</span>
              </div>
              <div class="tray-row2">
                <span v-if="doc.type && hasSides(doc.type) && doc.side !== 'na'" class="tray-side">
                  {{ doc.side }}
                </span>
                <q-badge
                  v-if="doc.status === 'done'"
                  :color="unmatchedCount(doc) > 0 ? 'amber-8' : 'green-7'"
                  :label="fieldSummary(doc)"
                  outline
                  class="tray-badge"
                />
              </div>
            </div>
          </div>
          <div style="padding: 0 8px 8px">
            <q-btn
              flat dense no-caps
              icon="add" label="Add document"
              class="add-doc-btn"
              style="width: 100%"
              @click="addDocument"
            />
          </div>
        </div>

        <!-- RIGHT: editor -->
        <div class="ocr-editor">
          <template v-if="activeDoc">

            <!-- Step 1: type picker -->
            <div class="ed-block">
              <div class="ed-lbl">Document type</div>
              <div class="type-pills">
                <div
                  v-for="(schema, key) in DOC_SCHEMAS"
                  :key="key"
                  class="type-pill"
                  :class="{ 'type-pill--on': activeDoc.type === key }"
                  @click="onSetType(key)"
                >{{ schema.label }}</div>
              </div>
            </div>

            <!-- Step 2: side toggle -->
            <div v-if="activeDoc.type && DOC_SCHEMAS[activeDoc.type]?.hasSides" class="ed-block">
              <div class="ed-lbl">Side</div>
              <div class="side-pills">
                <div
                  v-for="s in ['front', 'back', 'na']"
                  :key="s"
                  class="side-pill"
                  :class="{ 'side-pill--on': activeDoc.side === s }"
                  @click="activeDoc.side = s"
                >{{ s === 'na' ? 'N/A' : s.charAt(0).toUpperCase() + s.slice(1) }}</div>
              </div>
            </div>

            <!-- Step 3: upload zone -->
            <div class="ed-block">
              <div class="ed-lbl">
                Upload
                <span v-if="activeDoc.type" class="ed-expecting"> — expecting {{ uploadExpecting }}</span>
              </div>
              <label class="upload-zone" :class="{ 'upload-zone--done': activeDoc.file }">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  class="upload-input"
                  @change="onFileChange"
                />
                <template v-if="!activeDoc.file">
                  <q-icon name="cloud_upload" size="26px" color="blue-3" />
                  <div class="uz-hint">Click or drag to upload</div>
                  <div class="uz-types">JPG · PNG · PDF &nbsp;·&nbsp; max 5 MB</div>
                </template>
                <template v-else>
                  <q-icon name="check_circle" size="22px" color="positive" />
                  <div class="uz-filename">{{ activeDoc.file.name }}</div>
                  <div class="uz-types">Click to replace</div>
                </template>
              </label>
            </div>

            <!-- OCR running -->
            <div v-if="activeDoc.status === 'ocr_running'" class="ocr-spin-row">
              <q-circular-progress indeterminate size="16px" color="primary" />
              <span>Running OCR…</span>
            </div>

            <!-- Step 4: preview + fields -->
            <template v-if="activeDoc.status === 'done' || activeDoc.status === 'error'">
              <div v-if="activeDoc.status === 'error'" class="ocr-err-banner">
                <q-icon name="error_outline" color="negative" size="15px" />
                <span>OCR failed — try a clearer scan or re-upload</span>
              </div>
              <div v-else class="ed-block preview-row">
                <div class="preview-thumb">
                  <img
                    v-if="activeDoc.previewUrl && activeDoc.file?.type !== 'application/pdf'"
                    :src="activeDoc.previewUrl"
                    class="preview-img"
                    alt="doc preview"
                  />
                  <div v-else class="pdf-thumb">
                    <q-icon name="picture_as_pdf" size="30px" color="red-5" />
                    <div class="pdf-fname">{{ activeDoc.file?.name }}</div>
                  </div>
                </div>
                <div class="fields-list">
                  <div
                    v-for="f in (activeDocSchema?.fields || [])"
                    :key="f"
                    class="f-row"
                  >
                    <span class="f-lbl">{{ FIELD_LABELS[f] || f }}</span>
                    <span v-if="activeDoc.extractedFields[f]" class="f-val">
                      {{ activeDoc.extractedFields[f] }}
                      <q-icon name="check_circle" color="positive" size="11px" />
                    </span>
                    <span v-else class="f-val f-val--miss">— not found</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- Selenium note -->
            <div v-if="activeDocReg" class="selenium-note">
              <q-icon name="info_outline" size="13px" color="blue-6" />
              Reg. no. <strong>{{ activeDocReg }}</strong> will be passed to Selenium for Bahrain.bh lookup
            </div>

          </template>
        </div>
      </div>

      <q-separator style="opacity: 0.5" />

      <!-- ── FOOTER ── -->
      <div class="ocr-dlg-footer">
        <div class="footer-warn">
          <template v-if="totalUnmatched > 0">
            <q-icon name="warning_amber" color="amber-8" size="14px" />
            <span>{{ totalUnmatched }} unmatched field{{ totalUnmatched !== 1 ? 's' : '' }} — fill manually after confirming</span>
          </template>
        </div>
        <div class="footer-btns">
          <q-btn flat no-caps dense label="Cancel" @click="$emit('update:modelValue', false)" />
          <q-btn
            flat no-caps dense
            color="primary" icon="refresh" label="Re-run OCR"
            :disable="!activeDoc?.file || activeDoc?.status === 'ocr_running' || !activeDoc?.type"
            @click="runOcr(activeDoc)"
          />
          <q-btn
            unelevated no-caps
            color="primary"
            label="Confirm & fill template"
            icon-right="arrow_forward"
            class="confirm-btn"
            @click="confirm"
          />
        </div>
      </div>

    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'fields-confirmed'])

// ── Schemas ────────────────────────────────────────────────────────────────
const DOC_SCHEMAS = {
  smart_card:       { label: 'Smart Card',           hasSides: true,
    frontFields: ['owner_name','cpr_number','nationality'],
    backFields:  ['gender','date_of_birth'] },
  vehicle_ownership:{ label: 'Vehicle Ownership',    hasSides: true,
    frontFields: ['owner_name','cpr_number','vehicle_reg_number','registration_type','nationality'],
    backFields:  ['engine_capacity_cc','chassis_number','make','model','year_of_make','number_of_seats','cylinders'] },
  driving_license:  { label: 'Driving License',      hasSides: true,
    frontFields: ['owner_name','cpr_number','license_number','license_issue_date','expiry_date'],
    backFields:  ['vehicle_categories','restrictions'] },
  record_enquiry_vre: { label: 'Record Enquiry (VRE)', hasSides: false,
    frontFields: ['policy_number','insurer_name','policy_start_date','policy_end_date','vehicle_reg_number','owner_name'],
    backFields:  [] },
  renewal_report_vrv: { label: 'Renewal Report (VRV)', hasSides: false,
    frontFields: ['vehicle_reg_number','renewal_date','owner_name','policy_number'],
    backFields:  [] },
}

const FIELD_LABELS = {
  owner_name:'Owner Name', cpr_number:'CPR No.', nationality:'Nationality',
  date_of_birth:'Date of Birth', gender:'Gender',
  address:'Address', building:'Building', road:'Road', block:'Block', flat:'Flat', area:'Area',
  vehicle_reg_number:'Reg. No.', registration_type:'Reg. Type',
  engine_capacity_cc:'Engine CC', chassis_number:'Chassis No.', make:'Make', model:'Model',
  year_of_make:'Year', number_of_seats:'Seats', cylinders:'Cylinders',
  license_number:'License No.', license_issue_date:'Issue Date', expiry_date:'Expiry Date',
  vehicle_categories:'Categories', restrictions:'Restrictions',
  policy_number:'Policy No.', insurer_name:'Insurer',
  policy_start_date:'Start Date', policy_end_date:'End Date', renewal_date:'Renewal Date',
}

// ── State ──────────────────────────────────────────────────────────────────
let nextId = 2
function mkDoc (id) {
  return { id, type: null, side: 'front', file: null, previewUrl: null, ocrRawText: null, extractedFields: {}, status: 'empty' }
}
const documents   = ref([mkDoc(1)])
const activeDocId = ref(1)

// ── Computed ───────────────────────────────────────────────────────────────
const activeDoc = computed(() => documents.value.find(d => d.id === activeDocId.value))

const activeDocSchema = computed(() => {
  const doc = activeDoc.value
  if (!doc?.type) return null
  const schema = DOC_SCHEMAS[doc.type]
  const fields = doc.side === 'back' ? (schema.backFields || []) : (schema.frontFields || [])
  return { ...schema, fields }
})

const uploadExpecting = computed(() => {
  const doc = activeDoc.value
  if (!doc?.type) return ''
  const s = DOC_SCHEMAS[doc.type]
  if (!s.hasSides || doc.side === 'na') return s.label
  return `${s.label.split('—')[0].trim()} — ${doc.side.charAt(0).toUpperCase() + doc.side.slice(1)}`
})

const activeDocReg = computed(() => {
  const doc = activeDoc.value
  return (doc?.status === 'done' && doc.extractedFields.vehicle_reg_number) || null
})

const totalUnmatched = computed(() =>
  documents.value.reduce((sum, d) => sum + unmatchedCount(d), 0)
)

// ── Helpers ────────────────────────────────────────────────────────────────
function hasSides (type) { return !!DOC_SCHEMAS[type]?.hasSides }
function docTypeLabel (type) { return type ? DOC_SCHEMAS[type]?.label : 'No type selected' }

function statusDotClass (doc) {
  if (doc.status === 'ocr_running') return 'dot--blue'
  if (doc.status === 'error')       return 'dot--red'
  if (doc.status === 'done')        return unmatchedCount(doc) > 0 ? 'dot--amber' : 'dot--green'
  return 'dot--gray'
}

function schemaFields (doc) {
  if (!doc.type) return []
  const schema = DOC_SCHEMAS[doc.type]
  return doc.side === 'back' ? (schema.backFields || []) : (schema.frontFields || [])
}

function unmatchedCount (doc) {
  if (!doc.type || doc.status !== 'done') return 0
  return schemaFields(doc).filter(f => !doc.extractedFields[f]).length
}

function fieldSummary (doc) {
  const fields = schemaFields(doc)
  const found  = fields.filter(f => doc.extractedFields[f]).length
  const miss   = fields.length - found
  return miss > 0 ? `${found} fields · ${miss} unmatched` : `${found} fields`
}

// ── Actions ────────────────────────────────────────────────────────────────
function addDocument () {
  const doc = mkDoc(nextId++)
  documents.value.push(doc)
  activeDocId.value = doc.id
}

function onSetType (key) {
  const doc = activeDoc.value
  if (!doc) return
  doc.type = key
  if (!DOC_SCHEMAS[key].hasSides) doc.side = 'na'
  else if (doc.side === 'na') doc.side = 'front'
  if (doc.file && doc.status !== 'ocr_running') runOcr(doc)
}

function onFileChange (e) {
  const file = e.target.files?.[0]
  if (!file || !activeDoc.value) return
  e.target.value = ''
  const doc = activeDoc.value
  if (doc.previewUrl) URL.revokeObjectURL(doc.previewUrl)
  doc.file          = file
  doc.previewUrl    = URL.createObjectURL(file)
  doc.status        = 'uploaded'
  doc.extractedFields = {}
  doc.ocrRawText    = null
  if (doc.type) runOcr(doc)
}

async function runOcr (doc) {
  if (!doc?.file || !doc.type) return
  doc.status        = 'ocr_running'
  doc.extractedFields = {}
  try {
    const body = new FormData()
    body.append('file', doc.file)
    body.append('apikey', (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OCR_SPACE_KEY) || 'K82551922288957')
    body.append('language', 'eng')
    body.append('isOverlayRequired', 'false')
    body.append('OCREngine', '1')
    body.append('scale', 'true')
    body.append('isTable', 'false')

    const res  = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (json.IsErroredOnProcessing) throw new Error(json.ErrorMessage?.[0] || 'OCR error')

    const raw = (json.ParsedResults || []).map(r => r.ParsedText || '').join('\n').trim()
    doc.ocrRawText      = raw
    console.log('[OCR raw]', raw)
    doc.extractedFields = raw ? parseFields(raw, doc.type, doc.side) : {}
    console.log('[OCR fields]', doc.extractedFields)
    doc.status          = 'done'
  } catch (err) {
    console.error('[OCR]', err)
    doc.status = 'error'
  }
}

function confirm () {
  const PRIO = {
    smart_card: 1,
    driving_license: 1,
    record_enquiry_vre: 2, renewal_report_vrv: 2,
    vehicle_ownership: 3,
  }
  const sorted = [...documents.value]
    .filter(d => d.status === 'done')
    .sort((a, b) => (PRIO[a.type] || 0) - (PRIO[b.type] || 0))

  const merged = {}
  for (const doc of sorted) {
    for (const [k, v] of Object.entries(doc.extractedFields)) {
      if (v != null) merged[k] = v
    }
  }
  emit('fields-confirmed', merged)
  emit('update:modelValue', false)
}

// ── OCR field parsing ──────────────────────────────────────────────────────
function matchP (text, patterns) {
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]?.trim()) return m[1].trim()
  }
  return null
}

function fmtDate (raw) {
  if (!raw) return null
  const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (m) return `${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[3]}`
  return raw
}

function parseFields (rawText, docType, side) {
  const schema = DOC_SCHEMAS[docType]
  if (!schema) return {}
  const fields = side === 'back' ? (schema.backFields || []) : (schema.frontFields || [])
  const text   = rawText.replace(/\r\n|\r/g, '\n').replace(/[ \t]+/g, ' ')
  const result = {}
  for (const field of fields) result[field] = extractField(text, field)
  return result
}

function extractField (text, field) {
  switch (field) {
    case 'owner_name':
      return matchP(text, [
        // "Name: HUSAIN..." or "Name  HUSAIN..." same line (Smart Card / Ownership)
        /\bName\b[^A-Z\n]{0,60}([A-Z][A-Z\- ]{5,60})(?=\s*(?:\n|$))/m,
        // "Name" on its own line, name on next line
        /\bName\b\s*\n\s*([A-Z][A-Z\- ]{5,60})/m,
        /(?:owner\s*name|name\s*of\s*owner|insured\s*name)\s*[:\-]?\s*\n?\s*([A-Z][A-Za-z\s.\-']{2,50})/im,
        /\bname\s*:\s*([A-Z][A-Za-z\s.\-']{2,50})/im,
        // Smart Card fallback: standalone all-caps line with 3+ words all ≥3 chars (excludes "OF", "ID" etc.)
        /^([A-Z]{3,}(?:\s+[A-Z]{3,}(?:-[A-Z]{3,})*){2,})$/m,
      ])
    case 'cpr_number':
      return matchP(text, [
        // Label + optional newline + value
        /(?:CPR|C\.P\.R\.?)\s*[:\-#.\s]*\n?\s*(\d{8,10})/im,
        /Civil\s*(?:ID|No\.?)\s*[:\-#]?\s*\n?\s*(\d{8,10})/im,
        /(?:PERSONAL\s*NO|National\s*(?:ID|No\.?))\s*[:\-\/]?\s*\n?\s*(\d{8,10})/im,
        // Bahrain CPR is exactly 9 digits (not always starting with 19/20)
        /\b(\d{9})\b/,
        /\b((?:19|20)\d{7,8})\b/,
      ])
    case 'nationality':
      return matchP(text, [
        /(?:nationality|nat\.?)\s*[:\-]?\s*\n?\s*([A-Za-z]{4,20})/im,
      ])
    case 'date_of_birth':
      return fmtDate(matchP(text, [
        /(?:date\s*of\s*birth|d\.?o\.?b\.?|birth\s*date)\s*[:\-]?\s*\n?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/im,
        /\b((?:0[1-9]|[12]\d|3[01])[\/\-\.]\d{2}[\/\-\.]\d{2,4})\b/,
      ]))
    case 'gender': {
      const m = text.match(/\b(male|female)\b/i) || text.match(/\bsex\s*[:\-]?\s*(M|F)\b/i)
      if (!m) return null
      const v = m[1]
      if (v.length === 1) return v.toUpperCase() === 'M' ? 'Male' : 'Female'
      return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()
    }
    case 'address':    return matchP(text, [/(?:address)\s*[:\-]?\s*([^\n]{5,60})/i])
    case 'building':   return matchP(text, [/(?:building|bldg)\.?\s*(?:no\.?)?\s*[:\-]?\s*(\w+)/i])
    case 'road':       return matchP(text, [/road\s*(?:no\.?)?\s*[:\-]?\s*(\w+)/i])
    case 'block':      return matchP(text, [/block\s*(?:no\.?)?\s*[:\-]?\s*(\w+)/i])
    case 'flat':       return matchP(text, [/(?:flat|apt|apartment)\s*(?:no\.?)?\s*[:\-]?\s*(\w+)/i])
    case 'area':       return matchP(text, [/area\s*[:\-]?\s*([A-Za-z][A-Za-z\s]{2,30})/i])
    case 'vehicle_reg_number':
      return matchP(text, [
        /(?:reg(?:istration)?\.?\s*(?:no\.?|number|#)|vehicle\s*no\.?|plate\s*(?:no\.?|number))\s*[:\-]?\s*([A-Z]?\s*\d{4,6}[A-Z]?)/i,
        /\b(\d{5,6})\b/,
      ])
    case 'registration_type':
      return matchP(text, [
        /(?:registration\s*type|reg\.?\s*type)\s*[:\-]?\s*(private|commercial|government)/i,
        /\b(private|commercial|government)\b/i,
      ])
    case 'engine_capacity_cc':
      return matchP(text, [/(?:engine\s*(?:capacity)?|c\.?c\.?)\s*[:\-]?\s*(\d{3,5})\s*(?:cc)?/i, /(\d{3,5})\s*cc/i])
    case 'chassis_number':
      return matchP(text, [
        /(?:chassis|VIN|frame)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-HJ-NPR-Z0-9]{17})/i,
        /(?:chassis|frame)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9]{8,17})/i,
      ])
    case 'make':       return matchP(text, [/(?:make|manufacturer|brand)\s*[:\-]?\s*([A-Za-z]{2,20})/i])
    case 'model':      return matchP(text, [/(?:model)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\s\-]{1,25})/i])
    case 'year_of_make':
      return matchP(text, [
        /(?:year\s*of\s*(?:make|manufacture)|model\s*year)\s*[:\-]?\s*(20\d{2}|19\d{2})/i,
        /\b(20[012]\d|199\d)\b/,
      ])
    case 'number_of_seats':
      return matchP(text, [/(?:seats?|no\.?\s*of\s*seats?|seating\s*capacity)\s*[:\-]?\s*(\d{1,2})/i])
    case 'cylinders':
      return matchP(text, [/(?:cylinders?|cyl\.?)\s*[:\-]?\s*(\d{1,2})/i])
    case 'license_number':
      return matchP(text, [/(?:licen[sc]e\s*(?:no\.?|number|#))\s*[:\-]?\s*([A-Z0-9][\w\-]{2,15})/i])
    case 'license_issue_date':
      return fmtDate(matchP(text, [/(?:issue\s*date|date\s*of\s*issue|issued)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i]))
    case 'expiry_date':
      return fmtDate(matchP(text, [/(?:expiry\s*date|exp(?:iry|ires)?\s*(?:date)?|valid\s*(?:until|to)|date\s*of\s*expiry)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i]))
    case 'vehicle_categories':
      return matchP(text, [/(?:categor(?:y|ies)|class(?:es)?)\s*[:\-]?\s*([A-Za-z,\s\/]{1,30})/i])
    case 'restrictions':
      return matchP(text, [/(?:restrictions?)\s*[:\-]?\s*([^\n]{3,60})/i])
    case 'policy_number':
      return matchP(text, [/(?:policy\s*(?:no\.?|number|#)|pol\.?\s*no\.?)\s*[:\-]?\s*([A-Z0-9][\w\-\/]{3,24})/i])
    case 'insurer_name':
      return matchP(text, [/(?:insurer|insurance\s*company|insurance\s*co\.?)\s*[:\-]?\s*([A-Za-z][A-Za-z\s&\.]{3,40})/i])
    case 'policy_start_date':
      return fmtDate(matchP(text, [/(?:start\s*date|effective\s*date|inception\s*date|from\s*date|commencement)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i]))
    case 'policy_end_date':
      return fmtDate(matchP(text, [/(?:end\s*date|expiry\s*date|to\s*date|valid\s*(?:until|to))\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i]))
    case 'renewal_date':
      return fmtDate(matchP(text, [/(?:renewal\s*date|renew(?:al|ed)?)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i]))
    default: return null
  }
}
</script>

<style scoped>
/* ── Card ── */
.ocr-dlg {
  border-radius: 16px !important;
  background: #ffffff !important;
}

/* ── Header ── */
.ocr-dlg-hdr {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px 12px;
  flex-shrink: 0;
}
.ocr-icon-wrap {
  width: 32px; height: 32px;
  border-radius: 9px;
  background: #f0fdfa;
  color: #0d9488;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.ocr-dlg-title { font-size: 14px; font-weight: 700; color: #0f1f3d; }
.ocr-dlg-sub   { font-size: 11px; color: #8492a6; margin-top: 1px; }

/* ── Body ── */
.ocr-dlg-body {
  display: flex;
  height: 480px;
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

/* ── Tray ── */
.ocr-tray {
  width: 195px;
  flex-shrink: 0;
  border-right: 1px solid rgba(0,0,0,0.07);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.tray-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 8px 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tray-list::-webkit-scrollbar       { width: 3px; }
.tray-list::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }

.tray-slot {
  padding: 9px 10px;
  border-radius: 9px;
  cursor: pointer;
  border: 1.5px solid transparent;
  background: #f8faff;
  transition: all 0.12s;
}
.tray-slot:hover    { border-color: #93c5fd; }
.tray-slot--on      { border-color: #2563eb !important; background: #eff6ff !important; }

.tray-row1          { display: flex; align-items: center; gap: 6px; }
.tray-lbl           { font-size: 11px; font-weight: 600; color: #0f1f3d; line-height: 1.3; }
.tray-row2          { display: flex; align-items: center; gap: 5px; margin-top: 4px; flex-wrap: wrap; }
.tray-side          { font-size: 10px; color: #6b7280; background: #f3f4f6; border-radius: 4px; padding: 1px 5px; text-transform: capitalize; }
.tray-badge         { font-size: 9px !important; }

.s-dot              { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dot--gray          { background: #d1d5db; }
.dot--green         { background: #10b981; }
.dot--amber         { background: #f59e0b; }
.dot--red           { background: #ef4444; }
.dot--blue          { background: #3b82f6; }

.add-doc-btn {
  font-size: 12px !important;
  color: #4b5a7a !important;
  border: 1.5px dashed rgba(37,99,235,0.25) !important;
  border-radius: 8px !important;
}

/* ── Editor ── */
.ocr-editor {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ocr-editor::-webkit-scrollbar       { width: 4px; }
.ocr-editor::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }

.ed-block    { display: flex; flex-direction: column; gap: 7px; }
.ed-lbl      { font-size: 10px; font-weight: 700; color: #4b5a7a; text-transform: uppercase; letter-spacing: 0.6px; }
.ed-expecting { font-weight: 400; text-transform: none; color: #8492a6; }

/* ── Type pills ── */
.type-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.type-pill {
  padding: 5px 11px;
  border-radius: 20px;
  font-size: 11px; font-weight: 600;
  color: #4b5a7a;
  background: #f8faff;
  border: 1.5px solid rgba(37,99,235,0.15);
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}
.type-pill:hover  { border-color: #93c5fd; color: #2563eb; }
.type-pill--on    { border-color: #2563eb !important; background: #eff6ff !important; color: #2563eb !important; }

/* ── Side pills ── */
.side-pills { display: flex; gap: 6px; }
.side-pill {
  padding: 4px 16px;
  border-radius: 20px;
  font-size: 11px; font-weight: 600;
  color: #4b5a7a;
  background: #f8faff;
  border: 1.5px solid rgba(37,99,235,0.15);
  cursor: pointer;
  transition: all 0.12s;
}
.side-pill:hover { border-color: #93c5fd; color: #2563eb; }
.side-pill--on   { border-color: #2563eb !important; background: #eff6ff !important; color: #2563eb !important; }

/* ── Upload zone ── */
.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 16px;
  border: 1.5px dashed rgba(37,99,235,0.3);
  border-radius: 10px;
  background: #f8faff;
  cursor: pointer;
  transition: all 0.15s;
  min-height: 80px;
}
.upload-zone:hover    { border-color: #2563eb; background: #eff6ff; }
.upload-zone--done    { border-color: #10b981 !important; border-style: solid !important; background: #f0fdf4 !important; }
.upload-input         { display: none; }
.uz-hint              { font-size: 12px; font-weight: 600; color: #4b5a7a; }
.uz-types             { font-size: 10px; color: #9ca3af; }
.uz-filename          { font-size: 12px; font-weight: 600; color: #065f46; }

/* ── OCR running ── */
.ocr-spin-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #6b7280; }

/* ── Error ── */
.ocr-err-banner {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px;
  border: 1px solid #fca5a5; border-radius: 8px;
  background: #fff5f5; font-size: 12px; color: #dc2626;
}

/* ── Preview + fields ── */
.preview-row     { flex-direction: row !important; gap: 12px; align-items: flex-start; }
.preview-thumb {
  width: 90px; flex-shrink: 0;
  border-radius: 8px; overflow: hidden;
  border: 1px solid rgba(0,0,0,0.08);
  background: #f8faff;
  display: flex; align-items: center; justify-content: center;
  min-height: 80px;
}
.preview-img  { width: 100%; height: auto; display: block; }
.pdf-thumb    { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px; }
.pdf-fname    { font-size: 9px; color: #9ca3af; text-align: center; word-break: break-all; }

.fields-list  { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.f-row        { display: flex; align-items: baseline; gap: 6px; }
.f-lbl        { width: 90px; flex-shrink: 0; font-size: 9px; font-weight: 700; color: #4b5a7a; text-transform: uppercase; letter-spacing: 0.03em; }
.f-val        { display: flex; align-items: center; gap: 3px; font-size: 11px; color: #111827; font-weight: 500; }
.f-val--miss  { color: #d97706; font-style: italic; font-weight: 400; }

/* ── Selenium note ── */
.selenium-note {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: #1d4ed8;
  padding: 8px 10px;
  background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;
}

/* ── Footer ── */
.ocr-dlg-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px;
  flex-shrink: 0; gap: 8px;
}
.footer-warn { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #92400e; flex: 1; min-width: 0; }
.footer-btns { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.confirm-btn { border-radius: 9px !important; font-weight: 700 !important; font-size: 12px !important; }
</style>
