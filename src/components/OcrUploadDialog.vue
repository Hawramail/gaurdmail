<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="val => $emit('update:modelValue', val)"
    persistent
    style="max-width: 97vw"
  >
    <q-card class="ocr-dlg">

      <!-- ── HEADER ── -->
      <div class="dlg-hdr">
        <div class="dlg-hdr-icon">
          <q-icon name="document_scanner" size="18px" />
        </div>
        <div class="dlg-hdr-text">
          <div class="dlg-hdr-title">Document Scanner</div>
          <div class="dlg-hdr-sub">Upload documents · OCR extracts fields automatically</div>
        </div>
        <q-btn flat round dense icon="close" size="sm" @click="$emit('update:modelValue', false)" />
      </div>

      <q-separator style="opacity:0.5" />

      <!-- ── BODY ── -->
      <div class="dlg-body">

        <!-- ═══ LEFT: Document Upload Cards ═══ -->
        <div class="dlg-left">
          <div class="docs-scroll">

            <div
              v-for="doc in documents"
              :key="doc.id"
              class="doc-card"
              :class="{ 'doc-card--active': doc.id === activeDocId }"
              @click="activeDocId = doc.id"
            >
              <!-- Card top row -->
              <div class="dc-toprow">
                <span class="s-dot" :class="statusDotClass(doc)" />
                <span class="dc-name">{{ doc.type ? DOC_SCHEMAS[doc.type].label : 'New Document' }}</span>
                <q-badge
                  v-if="docStatus(doc) === 'done' || docStatus(doc) === 'partial'"
                  :color="totalUnmatchedDoc(doc) > 0 ? 'amber-8' : 'teal-7'"
                  :label="fieldSummary(doc)"
                  dense class="dc-badge"
                />
                <q-btn flat round dense icon="close" size="xs" class="dc-rm"
                  @click.stop="removeDocument(doc.id)" />
              </div>

              <!-- Document type selector -->
              <div class="dc-type-pills">
                <div
                  v-for="(schema, key) in DOC_SCHEMAS"
                  :key="key"
                  class="dc-pill"
                  :class="{ 'dc-pill--on': doc.type === key }"
                  @click.stop="activeDocId = doc.id; onSetType(key)"
                >
                  <q-icon :name="DOC_ICONS[key]" size="10px" style="margin-right:3px" />
                  {{ schema.label }}
                </div>
              </div>

              <!-- Upload zones (shown once type is selected) -->
              <div v-if="doc.type">

                <!-- Two-sided: front + back photo cards -->
                <div v-if="hasSides(doc.type)" class="photo-pair">
                  <div v-for="side in ['front','back']" :key="side" class="photo-col">
                    <div class="photo-side-lbl">
                      <q-icon :name="side === 'front' ? 'flip_to_front' : 'flip_to_back'" size="10px" />
                      {{ side === 'front' ? 'Front' : 'Back' }}
                    </div>
                    <label
                      class="photo-zone"
                      :class="{
                        'photo-zone--filled': doc[side].file,
                        'photo-zone--scanning': doc[side].status === 'ocr_running',
                        'photo-zone--err': doc[side].status === 'error',
                      }"
                      @click.stop
                    >
                      <input type="file" accept=".jpg,.jpeg,.png,.pdf" class="upload-input"
                        @change="e => { activeDocId = doc.id; onFileChange(e, side) }" />
                      <template v-if="!doc[side].file">
                        <q-icon name="add_a_photo" size="24px" color="blue-4" />
                        <span class="pz-hint">Add photo</span>
                      </template>
                      <template v-else>
                        <img v-if="doc[side].previewUrl" :src="doc[side].previewUrl" class="pz-thumb" />
                        <q-icon v-else name="picture_as_pdf" size="26px" color="positive" />
                        <div v-if="doc[side].status === 'ocr_running'" class="pz-scanning">
                          <q-circular-progress indeterminate size="22px" color="white" track-color="transparent" />
                          <span class="pz-scan-txt">Scanning…</span>
                        </div>
                        <div class="pz-hover">
                          <q-icon name="photo_camera" size="13px" />
                          Replace
                        </div>
                      </template>
                    </label>
                    <div v-if="doc[side].status === 'error'" class="pz-err">
                      <q-icon name="error_outline" size="11px" /> OCR failed
                    </div>
                    <!-- Field results for this side -->
                    <div v-if="doc[side].status === 'done'" class="side-fields">
                      <div v-for="f in (DOC_SCHEMAS[doc.type]?.[(side==='front'?'frontFields':'backFields')] || [])" :key="f" class="sf-row">
                        <span class="sf-lbl">{{ FIELD_LABELS[f] || f }}</span>
                        <span v-if="doc[side].extracted[f]" class="sf-val sf-ok">{{ doc[side].extracted[f] }}</span>
                        <span v-else class="sf-val sf-miss">—</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Single-sided: one large photo zone -->
                <div v-else class="photo-single">
                  <label
                    class="photo-zone photo-zone--wide"
                    :class="{
                      'photo-zone--filled': doc.front.file,
                      'photo-zone--scanning': doc.front.status === 'ocr_running',
                      'photo-zone--err': doc.front.status === 'error',
                    }"
                    @click.stop
                  >
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" class="upload-input"
                      @change="e => { activeDocId = doc.id; onFileChange(e, 'front') }" />
                    <template v-if="!doc.front.file">
                      <q-icon name="add_a_photo" size="30px" color="blue-4" />
                      <span class="pz-hint">Click or drag to upload</span>
                      <span class="pz-sub">JPG · PNG · PDF</span>
                    </template>
                    <template v-else>
                      <img v-if="doc.front.previewUrl" :src="doc.front.previewUrl" class="pz-thumb pz-thumb--wide" />
                      <q-icon v-else name="picture_as_pdf" size="32px" color="positive" />
                      <div v-if="doc.front.status === 'ocr_running'" class="pz-scanning">
                        <q-circular-progress indeterminate size="26px" color="white" track-color="transparent" />
                        <span class="pz-scan-txt">Scanning…</span>
                      </div>
                      <div class="pz-hover">
                        <q-icon name="photo_camera" size="15px" />
                        Replace
                      </div>
                    </template>
                  </label>
                  <div v-if="doc.front.status === 'error'" class="pz-err pz-err--banner">
                    <q-icon name="error_outline" size="13px" /> OCR failed — try a clearer image
                  </div>
                  <div v-if="doc.front.status === 'done'" class="side-fields">
                    <div v-for="f in (DOC_SCHEMAS[doc.type]?.frontFields || [])" :key="f" class="sf-row">
                      <span class="sf-lbl">{{ FIELD_LABELS[f] || f }}</span>
                      <span v-if="doc.front.extracted[f]" class="sf-val sf-ok">{{ doc.front.extracted[f] }}</span>
                      <span v-else class="sf-val sf-miss">—</span>
                    </div>
                  </div>
                </div>

              </div>
              <div v-else class="dc-empty-hint">← Select a document type above to begin</div>
            </div>

          </div>

          <!-- Add document button -->
          <div class="add-doc-row">
            <q-btn flat no-caps icon="add_circle_outline" label="Add another document"
              class="add-doc-btn" @click="addDocument" />
          </div>
        </div>

        <!-- ═══ RIGHT: Analysis Panel ═══ -->
        <div class="dlg-right">

          <!-- ── CASE DETECTION CARD ── -->
          <div
            class="case-card"
            :class="'case-card--' + detectedCase.type"
            :style="{ background: detectedCase.bg, borderColor: detectedCase.border }"
          >
            <div class="cc-top">
              <div class="cc-icon" :style="{ background: detectedCase.color + '20', color: detectedCase.color }">
                <q-icon :name="detectedCase.icon" size="22px" />
              </div>
              <div class="cc-title-block">
                <div class="cc-label">POLICY CASE DETECTED</div>
                <div class="cc-title" :style="{ color: detectedCase.color }">{{ detectedCase.title }}</div>
                <div class="cc-subtitle">{{ detectedCase.subtitle }}</div>
              </div>
            </div>

            <template v-if="detectedCase.type !== 'none'">
              <div class="cc-badges">
                <div class="cc-badge" :style="{ background: detectedCase.color + '18', color: detectedCase.color, border: '1px solid ' + detectedCase.color + '40' }">
                  <q-icon :name="detectedCase.paymentIcon" size="11px" />
                  {{ detectedCase.payment === 'installment' ? 'Installment / أقساط'
                   : detectedCase.payment === 'cash' ? 'Cash / نقدي' : 'Payment Unknown' }}
                </div>
                <div class="cc-badge cc-badge--grey">
                  <q-icon name="person_outline" size="11px" />
                  {{ detectedCase.ownerType }}
                </div>
              </div>

              <div class="cc-grid">
                <div class="cc-row">
                  <span class="cc-lbl">Customer Name</span>
                  <span class="cc-val cc-val--strong">{{ detectedCase.customerName || '—' }}</span>
                </div>
                <div class="cc-row">
                  <span class="cc-lbl">CPR / CR No.</span>
                  <span class="cc-val cc-val--mono">{{ detectedCase.customerCPR || '—' }}</span>
                </div>
                <div v-if="mergedFields.vehicle_reg_number" class="cc-row">
                  <span class="cc-lbl">Plate No.</span>
                  <span class="cc-val cc-val--mono">{{ mergedFields.vehicle_reg_number }}</span>
                </div>
                <div v-if="mergedFields.registration_type" class="cc-row">
                  <span class="cc-lbl">Reg. Type</span>
                  <span class="cc-val">{{ mergedFields.registration_type }}</span>
                </div>
                <div v-if="mergedFields.make || mergedFields.model" class="cc-row">
                  <span class="cc-lbl">Vehicle</span>
                  <span class="cc-val">{{ [mergedFields.make, mergedFields.model, mergedFields.year_of_make].filter(Boolean).join(' · ') }}</span>
                </div>
              </div>
            </template>
          </div>

          <!-- ── ALL EXTRACTED FIELDS ── -->
          <div class="fields-panel">
            <div class="fp-hdr">
              <q-icon name="list_alt" size="13px" />
              All Extracted Fields
              <span v-if="Object.keys(mergedFields).length" class="fp-count">{{ Object.keys(mergedFields).length }} fields</span>
            </div>
            <div class="fp-scroll">
              <div v-if="!Object.keys(mergedFields).length" class="fp-empty">
                Scan documents above to see extracted values here
              </div>
              <div v-else class="fp-grid">
                <div v-for="(val, key) in mergedFields" :key="key" class="fp-row">
                  <span class="fp-lbl">{{ FIELD_LABELS[key] || key }}</span>
                  <span class="fp-val">{{ val }}</span>
                  <q-icon name="check_circle" color="teal-6" size="10px" style="flex-shrink:0" />
                </div>
              </div>
            </div>
          </div>

          <!-- Selenium note -->
          <div v-if="activeDocReg" class="selenium-note">
            <q-icon name="travel_explore" size="12px" color="blue-6" />
            Reg. <strong>{{ activeDocReg }}</strong> → Bahrain Traffic Lookup ready
          </div>

        </div>
      </div>

      <q-separator style="opacity:0.5" />

      <!-- ── FOOTER ── -->
      <div class="dlg-footer">
        <div class="footer-warn">
          <template v-if="totalUnmatched > 0">
            <q-icon name="warning_amber" color="amber-8" size="14px" />
            <span>{{ totalUnmatched }} field{{ totalUnmatched !== 1 ? 's' : '' }} not found — fill manually after confirming</span>
          </template>
          <template v-else-if="Object.keys(mergedFields).length">
            <q-icon name="check_circle" color="teal-6" size="14px" />
            <span style="color:#0f766e">All fields extracted successfully</span>
          </template>
        </div>
        <div class="footer-btns">
          <q-btn flat no-caps dense label="Cancel" @click="$emit('update:modelValue', false)" />
          <q-btn
            flat no-caps dense color="primary" icon="refresh" label="Re-scan"
            :disable="!activeDoc?.front?.file && !activeDoc?.back?.file || !activeDoc?.type"
            @click="reRunOcr"
          />
          <q-btn
            unelevated no-caps color="primary"
            label="Apply to Form"
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
import { useQuasar } from 'quasar'
import { logSiemEvent } from 'src/composables/useSeim'
import { getSiemUserId } from 'src/composables/useZoho'
import { validateFile } from 'src/composables/useFileValidation'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'fields-confirmed'])

const $q = useQuasar()

// ── Doc type icons ─────────────────────────────────────────────────────────
const DOC_ICONS = {
  smart_card:       'badge',
  vehicle_ownership:'directions_car',
  driving_license:  'drive_eta',
  cr_certificate:   'store',
}

// ── Schemas ────────────────────────────────────────────────────────────────
const DOC_SCHEMAS = {
  smart_card:       { label: 'Smart Card (CPR)',    hasSides: true,
    frontFields: ['full_name','personal_id_number','nationality'],
    backFields:  ['gender','date_of_birth','expiry_date'] },
  vehicle_ownership:{ label: 'Vehicle Ownership',   hasSides: true,
    frontFields: ['owner_name','cr_number','cpr_number','vehicle_reg_number','registration_type','bank_name'],
    backFields:  ['ownership_status','chassis_number','make','model','year_of_make','engine_capacity_cc','number_of_seats','cylinders'] },
  driving_license:  { label: 'Driving License',     hasSides: true,
    frontFields: ['owner_name','license_number'],
    backFields:  ['license_issue_date','expiry_date','vehicle_categories'] },
  cr_certificate:   { label: 'CR Certificate',      hasSides: false,
    frontFields: ['cr_number','company_name','personal_id_number'],
    backFields:  [] },
}

const FIELD_LABELS = {
  full_name:'Full Name', owner_name:'Owner Name', cpr_number:'CPR No.', personal_id_number:'Personal ID', nationality:'Nationality',
  date_of_birth:'Date of Birth', gender:'Gender',
  address:'Address', building:'Building', road:'Road', block:'Block', flat:'Flat', area:'Area',
  vehicle_reg_number:'Reg. No.', registration_type:'Reg. Type',
  ownership_status:'Ownership Type', bank_name:'Bank / Finance',
  engine_capacity_cc:'Engine CC', chassis_number:'Chassis No.', make:'Make', model:'Model',
  year_of_make:'Year', number_of_seats:'Seats', cylinders:'Cylinders',
  license_number:'License No.', license_issue_date:'Issue Date', expiry_date:'Expiry Date',
  vehicle_categories:'Categories', restrictions:'Restrictions',
  policy_number:'Policy No.', insurer_name:'Insurer',
  policy_start_date:'Start Date', policy_end_date:'End Date', renewal_date:'Renewal Date',
  cr_number:'CR No.', company_name:'Company Name', personal_id_number:'Personal ID',
}

// ── State ──────────────────────────────────────────────────────────────────
function mkSlot () {
  return { file: null, previewUrl: null, status: 'empty', extracted: {}, rawText: null }
}
function mkDoc (id) {
  return { id, type: null, sideMode: 'both', front: mkSlot(), back: mkSlot() }
}

let nextId = 2
const documents   = ref([mkDoc(1)])
const activeDocId = ref(1)

// ── Computed ───────────────────────────────────────────────────────────────
const activeDoc = computed(() => documents.value.find(d => d.id === activeDocId.value))

const activeDocReg = computed(() => {
  const doc = activeDoc.value
  if (!doc) return null
  return doc.front.extracted?.vehicle_reg_number || doc.back.extracted?.vehicle_reg_number || null
})

const totalUnmatched = computed(() =>
  documents.value.reduce((sum, d) => sum + totalUnmatchedDoc(d), 0)
)

const mergedFields = computed(() => {
  const PRIO = { smart_card: 1, driving_license: 1, vehicle_ownership: 3, cr_certificate: 2 }
  const sorted = [...documents.value]
    .filter(d => d.type && (docStatus(d) === 'done' || docStatus(d) === 'partial'))
    .sort((a, b) => (PRIO[a.type] || 0) - (PRIO[b.type] || 0))
  const m = {}
  for (const doc of sorted) {
    for (const [k, v] of Object.entries(doc.front.extracted || {})) { if (v != null) m[k] = v }
    for (const [k, v] of Object.entries(doc.back.extracted  || {})) { if (v != null) m[k] = v }
  }
  return m
})

const detectedCase = computed(() => {
  const f = mergedFields.value
  const ownerName = f.owner_name || f.full_name || ''
  const cprNumber = f.cpr_number || ''
  const crNumber  = f.cr_number  || ''
  const companyName    = f.company_name  || ''
  const bankName       = f.bank_name     || ''
  const ownershipStatus = f.ownership_status

  if (!ownerName && !cprNumber && !crNumber && !companyName) return {
    type:'none', icon:'manage_search', color:'#94a3b8', bg:'#f8faff', border:'#e2e8f0',
    title:'SCAN DOCUMENTS TO DETECT CASE', subtitle:'Upload and scan documents to identify the policy holder',
    payment:null, paymentIcon:'help_outline', ownerType:'—', customerName:'', customerCPR:''
  }

  const BANK_KW   = ['BANK','FINANCE','FINANCIAL','CREDIT','FACILITIES','FINANCING','NBB','BBK','AUB','GIB','KFH','BISB','KHCB','FAB','BCF']
  const CO_SFX    = ['WLL','BSC','SPC','LLC','LTD','LIMITED','B.S.C','W.L.L','S.P.C']
  const ownerIsBank    = ownerName && BANK_KW.some(k => ownerName.toUpperCase().includes(k))
  const ownerIsCompany = ownerName && CO_SFX.some(s => ownerName.toUpperCase().includes(s))
  const isCompany      = !!(crNumber || companyName || ownerIsCompany)
  const isInstallment  = ownershipStatus === 'installment' || (!!bankName && !ownerIsBank) || ownerIsBank
  const effectiveBank  = bankName || (ownerIsBank ? ownerName : '')

  if (isCompany) return {
    type:'company', icon:'business', color:'#7c3aed', bg:'#f5f3ff', border:'#c4b5fd',
    title:'COMPANY-OWNED VEHICLE', subtitle:'Vehicle registered under a company name',
    payment:null, paymentIcon:'apartment', ownerType:'Company / شركة',
    customerName: companyName || ownerName, customerCPR: crNumber
  }
  if (isInstallment && effectiveBank && ownerName && !ownerIsBank) return {
    type:'joint', icon:'group', color:'#d97706', bg:'#fffbeb', border:'#fcd34d',
    title:'JOINT NAME · INSTALLMENT', subtitle:`Owner & ${effectiveBank}`,
    payment:'installment', paymentIcon:'account_balance', ownerType:'Individual + Bank',
    customerName:`${ownerName} & ${effectiveBank}`, customerCPR: cprNumber
  }
  if (isInstallment && (ownerIsBank || effectiveBank)) return {
    type:'bank_owner', icon:'account_balance', color:'#0284c7', bg:'#f0f9ff', border:'#7dd3fc',
    title:'BANK-OWNED · INSTALLMENT', subtitle:'Finance company is the registered owner',
    payment:'installment', paymentIcon:'account_balance', ownerType:'Bank / Finance',
    customerName: effectiveBank || ownerName, customerCPR: cprNumber
  }
  return {
    type:'individual', icon:'person', color:'#059669', bg:'#f0fdf4', border:'#6ee7b7',
    title:'INDIVIDUAL · CASH OWNERSHIP', subtitle:ownerName || 'Personal ownership confirmed',
    payment:'cash', paymentIcon:'payments', ownerType:'Individual / شخص',
    customerName: ownerName, customerCPR: cprNumber
  }
})

// ── Helpers ────────────────────────────────────────────────────────────────
function hasSides (type) { return !!DOC_SCHEMAS[type]?.hasSides }
function docTypeLabel (type) { return type ? DOC_SCHEMAS[type]?.label : 'No type selected' }

function docStatus (doc) {
  if (!doc.type) return 'empty'
  const slots = hasSides(doc.type) ? [doc.front, doc.back] : [doc.front]
  if (slots.some(s => s.status === 'ocr_running')) return 'ocr_running'
  if (slots.some(s => s.status === 'error'))       return 'error'
  if (slots.every(s => s.status === 'done'))        return 'done'
  if (slots.some(s => s.status === 'done'))         return 'partial'
  return 'empty'
}

function statusDotClass (doc) {
  const st = docStatus(doc)
  if (st === 'ocr_running') return 'dot--blue'
  if (st === 'error')       return 'dot--red'
  if (st === 'done')        return 'dot--green'
  if (st === 'partial')     return 'dot--amber'
  return 'dot--gray'
}

function totalUnmatchedDoc (doc) {
  if (!doc.type) return 0
  const s = DOC_SCHEMAS[doc.type]
  const frontMiss = (s.frontFields || []).filter(f => doc.front.status === 'done' && !doc.front.extracted[f]).length
  const backMiss  = (s.backFields  || []).filter(f => doc.back.status  === 'done' && !doc.back.extracted[f]).length
  return frontMiss + backMiss
}

function fieldSummary (doc) {
  if (!doc.type) return ''
  const s = DOC_SCHEMAS[doc.type]
  const all    = [...(s.frontFields || []), ...(s.backFields || [])]
  const found  = all.filter(f =>
    doc.front.extracted[f] != null || doc.back.extracted[f] != null
  ).length
  const miss   = all.length - found
  return miss > 0 ? `${found} fields · ${miss} miss` : `${found} fields`
}

// ── Actions ────────────────────────────────────────────────────────────────
function addDocument () {
  const doc = mkDoc(nextId++)
  documents.value.push(doc)
  activeDocId.value = doc.id
}

function removeDocument (id) {
  const idx = documents.value.findIndex(d => d.id === id)
  if (idx === -1) return
  // Revoke object URLs
  const doc = documents.value[idx]
  if (doc.front.previewUrl) URL.revokeObjectURL(doc.front.previewUrl)
  if (doc.back.previewUrl)  URL.revokeObjectURL(doc.back.previewUrl)
  documents.value.splice(idx, 1)
  // Keep at least one slot
  if (documents.value.length === 0) {
    documents.value.push(mkDoc(nextId++))
  }
  // Move active selection
  if (activeDocId.value === id) {
    activeDocId.value = documents.value[Math.min(idx, documents.value.length - 1)].id
  }
}

function setSideMode (mode) {
  const doc = activeDoc.value
  if (!doc) return
  doc.sideMode = mode
}

function onSetType (key) {
  const doc = activeDoc.value
  if (!doc) return
  doc.type = key
  // Re-run OCR if files already present
  if (doc.front.file && doc.front.status !== 'ocr_running') runOcr(doc, 'front')
  if (doc.back.file  && doc.back.status  !== 'ocr_running') runOcr(doc, 'back')
}

function onFileChange (e, side) {
  const file = e.target.files?.[0]
  if (!file || !activeDoc.value) return
  e.target.value = ''

  const validation = validateFile(file, 'ocr')
  if (!validation.ok) {
    logSiemEvent('FILE_REJECTED', getSiemUserId(), {
      filename: file.name,
      fileSize: file.size,
      reason:   validation.reason,
      docType:  activeDoc.value.type,
    }, 'medium').catch(() => {})
    $q.notify({ type: 'negative', message: `${file.name} rejected — ${validation.reason}`, icon: 'block', timeout: 5000 })
    return
  }

  const slot = activeDoc.value[side]
  if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl)
  slot.file       = file
  slot.previewUrl = URL.createObjectURL(file)
  slot.status     = 'uploaded'
  slot.extracted  = {}
  slot.rawText    = null
  if (activeDoc.value.type) runOcr(activeDoc.value, side)
}

function clearSide (side) {
  const doc = activeDoc.value
  if (!doc) return
  const slot = doc[side]
  if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl)
  Object.assign(slot, mkSlot())
}

function downloadFile (slot) {
  if (!slot?.file || !slot?.previewUrl) return
  const a = document.createElement('a')
  a.href     = slot.previewUrl
  a.download = slot.file.name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function reRunOcr () {
  const doc = activeDoc.value
  if (!doc?.type) return
  if (doc.front.file) runOcr(doc, 'front')
  if (doc.back.file)  runOcr(doc, 'back')
}

async function runOcr (doc, side) {
  const slot = doc[side]
  if (!slot?.file || !doc.type) return
  slot.status    = 'ocr_running'
  slot.extracted = {}
  try {
    const body = new FormData()
    body.append('file', slot.file)
    body.append('apikey', (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OCR_SPACE_KEY) || 'K82551922288957')
    body.append('language', 'eng')
    body.append('isOverlayRequired', 'false')
    body.append('OCREngine', ['cr_certificate', 'vehicle_ownership'].includes(doc.type) ? '2' : '1')
    body.append('scale', 'true')
    body.append('isTable', 'false')

    const res  = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (json.IsErroredOnProcessing) throw new Error(json.ErrorMessage?.[0] || 'OCR error')

    const raw = (json.ParsedResults || []).map(r => r.ParsedText || '').join('\n').trim()
    slot.rawText   = raw
    console.log(`[OCR ${side} raw]`, raw)
    slot.extracted = raw ? parseFields(raw, doc.type, side) : {}
    console.log(`[OCR ${side} fields]`, slot.extracted)
    slot.status    = 'done'
    logSiemEvent('FILE_UPLOAD', getSiemUserId(), {
      filename: slot.file.name,
      fileSize: slot.file.size,
      docType:  doc.type,
      side,
    }, 'low').catch(() => {})
  } catch (err) {
    console.error('[OCR]', err)
    slot.status = 'error'
    logSiemEvent('FILE_REJECTED', getSiemUserId(), {
      filename: slot.file.name,
      reason:   err.message || 'OCR processing failed',
      docType:  doc.type,
    }, 'medium').catch(() => {})
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
    .filter(d => d.type && (docStatus(d) === 'done' || docStatus(d) === 'partial'))
    .sort((a, b) => (PRIO[a.type] || 0) - (PRIO[b.type] || 0))

  const merged = {}
  for (const doc of sorted) {
    for (const [k, v] of Object.entries(doc.front.extracted || {})) {
      if (v != null) merged[k] = v
    }
    for (const [k, v] of Object.entries(doc.back.extracted || {})) {
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
    case 'full_name':
    case 'owner_name': {
      const NOT_A_NAME = [
        'DRIVING LICENSE','VEHICLE OWNERSHIP','OWNERSHIP CERTIFICATE','KINGDOM OF BAHRAIN',
        'MINISTRY OF INTERIOR','GENERAL DIRECTORATE','IDENTITY CARD','CERTIFICATE',
        'INSURANCE','POLYTECHNIC','PVT GOODS','PRIVATE GOODS','GOODS VEH',
        'PICKUP','SALOON','SEDAN','HATCHBACK','SUV','TRUCK',
      ]
      const blocked = (v) => NOT_A_NAME.some(b => v.toUpperCase().includes(b))
      const ownerM = text.match(/\bOwner\b[^A-Z\n]{0,5}\n?\s*([A-Z][A-Z\- ]{5,60})(?=\s*(?:\n|$))/m)
      if (ownerM?.[1] && !blocked(ownerM[1])) return ownerM[1].trim()
      const nameSame = text.match(/\bName\b[^A-Z\n]{0,10}([A-Z][A-Z\- ]{5,60})(?=\s*(?:\n|$))/m)
      if (nameSame?.[1] && !blocked(nameSame[1])) return nameSame[1].trim()
      const nameNext = text.match(/\bName\b\s*\n\s*([A-Z][A-Z\- ]{5,60})/m)
      if (nameNext?.[1] && !blocked(nameNext[1])) return nameNext[1].trim()
      for (const line of text.split('\n')) {
        const t = line.trim()
        if (/^[A-Z]{3,}(\s+[A-Z]{3,}){2,}$/.test(t) && !blocked(t)) return t
      }
      return null
    }
    case 'cpr_number': {
      const cprRaw = matchP(text, [
        /(?:CPR|C\.P\.R\.?)\s*[:\-#.\s]*\n?\s*(\d{8,10})/im,
        /Civil\s*(?:ID|No\.?)\s*[:\-#]?\s*\n?\s*(\d{8,10})/im,
        /(?:PERSONAL\s*NO|National\s*(?:ID|No\.?))\s*[:\-\/]?\s*\n?\s*(\d{8,10})/im,
        /\b(\d{9})\b/,
        /\b((?:19|20)\d{7,8})\b/,
        // Company-owned vehicle: CR number format e.g. "181226 - 2"
        /\b(\d{5,7}\s*-\s*\d{1,3})\b/,
      ])
      return cprRaw ? cprRaw.replace(/\s*-\s*/g, '-').trim() : null
    }
    case 'nationality': {
      // Arabic nationality keywords (OCR of هندي → "HINDI" = Indian, etc.)
      const NAT_MAP = [
        ['INDIAN','Indian'],    ['هندي','Indian'],   ['HINDI','Indian'],
        ['PAKISTANI','Pakistani'], ['باكستاني','Pakistani'],
        ['BANGLADESHI','Bangladeshi'], ['بنغلاديشي','Bangladeshi'],
        ['FILIPINO','Filipino'], ['FILIPIN','Filipino'], ['فلبيني','Filipino'],
        ['BAHRAINI','Bahraini'], ['بحريني','Bahraini'],
        ['SAUDI ARABIAN','Saudi Arabian'], ['SAUDI','Saudi'], ['سعودي','Saudi'],
        ['EGYPTIAN','Egyptian'], ['مصري','Egyptian'],
        ['JORDANIAN','Jordanian'], ['أردني','Jordanian'],
        ['LEBANESE','Lebanese'], ['لبناني','Lebanese'],
        ['SUDANESE','Sudanese'], ['سوداني','Sudanese'],
        ['INDONESIAN','Indonesian'], ['اندونيسي','Indonesian'],
        ['AUSTRALIAN','Australian'], ['أسترالي','Australian'],
        ['KUWAITI','Kuwaiti'], ['كويتي','Kuwaiti'],
        ['EMIRATI','Emirati'], ['إماراتي','Emirati'],
        ['QATARI','Qatari'], ['قطري','Qatari'],
        ['BRITISH','British'], ['بريطاني','British'],
        ['OMANI','Omani'], ['عماني','Omani'],
        ['SYRIAN','Syrian'], ['سوري','Syrian'],
        ['IRAQI','Iraqi'], ['عراقي','Iraqi'],
        ['NEPALI','Nepali'], ['نيبالي','Nepali'],
        ['IRANIAN','Iranian'], ['إيراني','Iranian'],
        ['YEMENI','Yemeni'], ['يمني','Yemeni'],
        ['THAI','Thai'], ['تايلاندي','Thai'],
        ['CHINESE','Chinese'], ['صيني','Chinese'],
        ['AMERICAN','American'], ['أمريكي','American'],
        ['SRILANKAN','Sri Lankan'], ['SRI LANKAN','Sri Lankan'],
      ]
      const idx = text.indexOf('NATIONALITY') !== -1 ? text.indexOf('NATIONALITY')
              : text.indexOf('Nationality') !== -1 ? text.indexOf('Nationality')
              : text.indexOf('nationality')
      if (idx !== -1) {
        const win = text.slice(idx, idx + 300)
        const hit = NAT_MAP.find(([kw]) => win.includes(kw))
        if (hit) return hit[1]
      }
      // Fallback: search full text but skip generic country names
      const hit = NAT_MAP.find(([kw]) => kw.length >= 5 && text.includes(kw))
      return hit ? hit[1] : null
    }
    case 'date_of_birth': {
      const iso = text.match(/\b((19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))\b/)
      if (iso) return iso[1]
      return fmtDate(matchP(text, [
        /(?:date\s*of\s*birth|d\.?o\.?b\.?|birth\s*date)\s*[:\-]?\s*\n?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/im,
        /\b((?:0[1-9]|[12]\d|3[01])[\/\-\.]\d{2}[\/\-\.]\d{2,4})\b/,
      ]))
    }
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
    case 'vehicle_reg_number': {
      const regPatterns = [
        /(?:reg(?:istration)?\.?\s*(?:no\.?|number|#)|vehicle\s*no\.?|plate\s*(?:no\.?|number))\s*[:\-]?\s*([A-Z]?\s*\d{3,6}[A-Z]?)/i,
        /\b(\d{5,6})\b/,
      ]
      const regHit = matchP(text, regPatterns)
      if (regHit) return regHit
      const regClean = text.replace(/[؀-ۿ]+/g, ' ')
      const regCleanHit = matchP(regClean, regPatterns)
      if (regCleanHit) return regCleanHit
      // Backward scan: value precedes label in bilingual tables
      const regLabelIdx = regClean.search(/\b(?:reg(?:istration)?\.?\s*no\.?|vehicle\s*no\.?|plate\s*(?:no\.?|number))\b/i)
      if (regLabelIdx !== -1) {
        const before = regClean.slice(Math.max(0, regLabelIdx - 300), regLabelIdx)
        const lines = before.split('\n')
        for (let i = lines.length - 1; i >= 0; i--) {
          const t = lines[i].trim()
          if (!t) continue
          const m = t.match(/\b([A-Z]?\s*\d{3,6}[A-Z]?)\b/i)
          if (m) return m[1].trim()
        }
      }
      return null
    }
    case 'registration_type':
      return matchP(text, [
        /(?:plate\s*type|registration\s*type|reg\.?\s*type)\s*[:\-]?\s*(PVT[^\n]{0,20}|PRIVATE[^\n]{0,10}|private|commercial|government)/i,
        /\b(PVT\s+GOODS\s+VEH|PVT\s+D\/C|private|commercial|government)\b/i,
      ])
    case 'engine_capacity_cc':
      return matchP(text, [/(?:engine\s*(?:cap\.?|capacity)?)\s*[:\-]?\s*(\d{3,5})/i, /(\d{3,5})\s*cc/i, /(?:engine\s*cap\.?|c\.?c\.?)\s*[:\-]?\s*(\d{3,5})/i])
    case 'chassis_number': {
      const labeled = matchP(text, [/(?:chasis|chassis|VIN)\s*(?:no\.?|num\.?|number|#)?\s*[:\-\.\s]*\n?\s*([A-Z0-9]{10,17})/i])
      if (labeled) return labeled
      const vinMatch = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i)
      if (vinMatch) return vinMatch[1].toUpperCase()
      return matchP(text, [/No\.\s*([A-Z0-9]{10,17})/i])
    }
    case 'make': {
      const BRANDS = ['NISSAN','TOYOTA','HONDA','HYUNDAI','KIA','FORD','BMW','MERCEDES',
        'SKODA','MITSUBISHI','SUZUKI','ISUZU','CHEVROLET','GMC','VOLKSWAGEN','AUDI',
        'LEXUS','MAZDA','JEEP','DODGE','LAND ROVER','VOLVO','PEUGEOT','RENAULT',
        'RAM','INFINITI','SUBARU','PORSCHE','JAGUAR','BENTLEY']
      const labeled = matchP(text, [
        /\bMake\b\s*[:\-]?\s*\n?\s*([A-Z][A-Za-z]{2,15})(?!\s*of)/im,
        /(?:manufacturer|brand)\s*[:\-]?\s*([A-Za-z]{2,20})/i,
      ])
      if (labeled && !['MODEL','COLOR','YEAR','TYPE','MAKE','VEHICLE','WEIGHT'].includes(labeled.toUpperCase())) return labeled
      const upper = text.toUpperCase()
      const hit = BRANDS.find(b => upper.includes(b))
      return hit || null
    }
    case 'model': {
      const MODEL_BRANDS = new Set(['NISSAN','TOYOTA','HONDA','HYUNDAI','KIA','FORD','BMW',
        'MERCEDES','SKODA','MITSUBISHI','SUZUKI','ISUZU','CHEVROLET','GMC','VOLKSWAGEN',
        'AUDI','LEXUS','MAZDA','JEEP','DODGE','LAND ROVER','VOLVO','PEUGEOT','RENAULT',
        'RAM','INFINITI','SUBARU','PORSCHE','JAGUAR','BENTLEY'])
      const ccModel = matchP(text, [/\b(\d{3,4}\s*CC)\b/i])
      if (ccModel) return ccModel
      const isValid = v => v && !MODEL_BRANDS.has(v.trim().toUpperCase()) && v.trim().length >= 2
      const tryForward = (src) => {
        const raw = matchP(src, [
          /\bModel\b\s*[:\-]?\s*\n?\s*([A-Za-z0-9][A-Za-z0-9 ]{1,15})(?=\s*(?:\n|Color|Make|Year|Chassis|Engine|$))/im,
        ])
        return isValid(raw) ? raw.trim() : null
      }
      const fwd = tryForward(text) || tryForward(text.replace(/[؀-ۿ]+/g, ' '))
      if (fwd) return fwd
      // Backward scan: value precedes label in bilingual tables
      const modelClean = text.replace(/[؀-ۿ]+/g, ' ')
      const modelLabelIdx = modelClean.search(/\bModel\b/i)
      if (modelLabelIdx !== -1) {
        const before = modelClean.slice(Math.max(0, modelLabelIdx - 200), modelLabelIdx)
        const lines = before.split('\n')
        for (let i = lines.length - 1; i >= 0; i--) {
          const t = lines[i].trim()
          if (!t || t.length < 2 || t.length > 20) continue
          if (/\b(chassis|ownership|status|make|year|engine|capacity|seats?|cylinders?|color|type)\b/i.test(t)) continue
          if (/^[A-Z0-9][A-Z0-9 \-]{0,14}$/i.test(t) && isValid(t)) return t
        }
      }
      return null
    }
    case 'year_of_make':
      return matchP(text, [
        /(?:year\s*of\s*(?:make|manufacture)|model\s*year)\s*[:\-]?\s*(20\d{2}|19\d{2})/i,
        /\b(20[012]\d|199\d)\b/,
      ])
    case 'number_of_seats':
      return matchP(text, [
        /(?:number\s*of\s*seats?|no\.?\s*of\s*seats?|seats?)\s*[:\-]?\s*(\d{1,2})/i,
        /\b([2-9])\s*(?:seats?|seater)/i,
      ])
    case 'cylinders':
      return matchP(text, [/(?:number\s*of\s*cylinders?|cylinders?|cyl\.?)\s*[:\-]?\s*(\d{1,2})/i])
    case 'license_number':
      return matchP(text, [
        /(?:licen[sc]e)\s*(?:no\.?|num\.?|number|#)?\s*[:\-]?\s*\n?\s*(\d{7,10})/i,
        /\b(\d{9})\b/,
      ])
    case 'license_issue_date':
      return fmtDate(matchP(text, [
        /(?:first\s*issue|issue\s*date|date\s*of\s*issue|issued)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      ]))
    case 'expiry_date':
      return fmtDate(matchP(text, [
        /(?:expiry\s*date|exp(?:iry|ires)?\s*(?:date)?|valid\s*(?:until|to)|date\s*of\s*expiry)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      ]))
    case 'vehicle_categories':
      return matchP(text, [
        /(Private\s+Saloon[^\n]*)/i,
        /(Private\s+(?:less|Conveyance|Goods)[^\n]*)/i,
        /(?:license\s*type|categor(?:y|ies)|class)\s*[:\-]?\s*([A-Za-z ,\/]{5,50})/i,
      ])
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
    case 'ownership_status': {
      if (/أقساط/.test(text)) return 'installment'
      if (/ملكية\s*شخصية/.test(text)) return 'cash'
      if (/\b(?:instalment|installment|hire\s*purchase|financed?\s*by|mortgag)/i.test(text)) return 'installment'
      if (/\b(?:personal\s*ownership|cash\s*ownership)/i.test(text)) return 'cash'
      return null
    }
    case 'bank_name': {
      const BANKS = [
        'BAHRAIN CREDIT FACILITIES','NATIONAL BANK OF BAHRAIN','BANK OF BAHRAIN AND KUWAIT',
        'AHLI UNITED BANK','GULF INTERNATIONAL BANK',
        'ARAB BANKING CORPORATION','KHALEEJI COMMERCIAL BANK',
        'KUWAIT FINANCE HOUSE','BAHRAIN ISLAMIC BANK',
        'ITHMAAR BANK','AL BARAKA BANKING','FIRST ABU DHABI BANK',
        'STANDARD CHARTERED','HSBC','CITIBANK','MASHREQ',
        'NBB','BBK','AUB','GIB','KFH','BISB','KHCB','FAB','BCF',
      ]
      const labeled = matchP(text, [
        /(?:financ(?:ed)?\s*by|mortgag(?:ee|ed\s*to)|lienholder)\s*[:\-]?\s*\n?\s*([A-Z][A-Za-z\s&\.]{3,50})/im,
      ])
      if (labeled) return labeled.trim()
      const upper = text.toUpperCase()
      return [...BANKS].sort((a, b) => b.length - a.length).find(b => upper.includes(b)) || null
    }
    case 'cr_number': {
      const crPatterns = [
        /(?:C\.?R\.?\s*(?:no\.?|number|#)|commercial\s*reg(?:istration)?\.?\s*no\.?)\s*[:\-]?\s*(\d{5,10})/im,
        /\bCR\s*No\.?\s*[:\-]?\s*(\d{5,10})\b/im,
      ]
      const crRaw = matchP(text, crPatterns)
      if (crRaw) return crRaw.trim()
      const crClean = text.replace(/[؀-ۿ]+/g, ' ')
      const crCleanRaw = matchP(crClean, crPatterns)
      if (crCleanRaw) return crCleanRaw.trim()
      // Backward scan: value precedes label in bilingual tables
      const crLabelIdx = crClean.search(/\bCR\s*No\.?/i)
      if (crLabelIdx !== -1) {
        const before = crClean.slice(Math.max(0, crLabelIdx - 300), crLabelIdx)
        const lines = before.split('\n')
        for (let i = lines.length - 1; i >= 0; i--) {
          const t = lines[i].trim()
          if (!t) continue
          const m = t.match(/\b(\d{5,10})\b/)
          if (m) return m[1]
        }
      }
      return null
    }
    case 'company_name': {
      // Standard: label immediately before value (some OCR reading orders)
      const labeled = matchP(text, [
        /(?:commercial\s*name|company\s*name|business\s*name|trading\s*(?:as|name)|name\s*of\s*(?:company|business))[ \t]*[:\-]?[ \t]*\n?[ \t]*([A-Z][A-Za-z0-9 \t&\.,\-]{2,59})/im,
      ])
      if (labeled && labeled.trim().split(/\s+/).length >= 2) return labeled.trim()

      // Backward scan: OCR sometimes outputs the value BEFORE its label (bilingual table column order).
      // Find "Commercial Name" in the text, then look at the lines just above it.
      const labelIdx = text.search(/commercial\s*name/im)
      if (labelIdx !== -1) {
        const before = text.slice(Math.max(0, labelIdx - 400), labelIdx)
        const lines = before.split('\n')
        for (let i = lines.length - 1; i >= 0; i--) {
          const t = lines[i].trim()
          if (t.length < 5) continue
          const words = t.split(' ').filter(Boolean)
          if (words.length >= 2 && words.length <= 5 && /^[A-Z][A-Z ]{4,}$/.test(t)) return t
        }
      }

      // Forward scan: value after label (other OCR reading orders)
      const labelMatch = text.match(/commercial\s*name[^\n]*/im)
      if (labelMatch) {
        const rest = text.slice(labelMatch.index + labelMatch[0].length)
        for (const line of rest.split('\n').slice(0, 5)) {
          const latin = line.replace(/[؀-ۿ]/g, '').replace(/\s+/g, ' ').trim()
          if (latin.length >= 5 && /^[A-Z][A-Z0-9 &\-\.]{4,}$/.test(latin)) return latin
        }
      }

      // Last resort: WLL / BSC / SPC suffix
      for (const line of text.split('\n')) {
        const t = line.trim()
        if (t.length > 5 && t.length < 80 && /\b(W\.?L\.?L\.?|B\.?S\.?C\.?|S\.?P\.?C\.?|LLC|LTD|LIMITED)\b/i.test(t)) return t
      }
      return null
    }
    case 'personal_id_number':
      return matchP(text, [
        /(?:personal\s*(?:id(?:\s*no\.?)?|no\.?|number|#)|owner(?:'s)?\s*(?:id|cpr))\s*[:\-]?\s*(\d{8,10})/im,
        /الرقم\s*الشخصي\s*[:\-]?\s*(\d{8,10})/,
        /\b(\d{9})\b/,
      ])
    default: return null
  }
}
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════
   BASE CARD
   ═══════════════════════════════════════════════════════ */
.ocr-dlg {
  border-radius: 18px !important;
  background: #f8faff !important;
  display: flex; flex-direction: column;
  width: 95vw !important;
  max-width: 1400px !important;
  max-height: 92vh;
}

/* ═══════════════════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════════════════ */
.dlg-hdr {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px 12px;
  background: #fff; flex-shrink: 0;
}
.dlg-hdr-icon {
  width: 34px; height: 34px; border-radius: 10px;
  background: linear-gradient(135deg,#0d9488,#0891b2);
  color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.dlg-hdr-text { flex: 1; }
.dlg-hdr-title { font-size: 14px; font-weight: 800; color: #0f1f3d; }
.dlg-hdr-sub   { font-size: 11px; color: #94a3b8; margin-top: 1px; }

/* ═══════════════════════════════════════════════════════
   BODY
   ═══════════════════════════════════════════════════════ */
.dlg-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  flex: 1; min-height: 480px; overflow: hidden;
}

/* ═══════════════════════════════════════════════════════
   LEFT PANEL — Document Cards
   ═══════════════════════════════════════════════════════ */
.dlg-left {
  display: flex; flex-direction: column;
  border-right: 1px solid rgba(0,0,0,0.07);
  background: #f0f4fb;
  overflow: hidden; min-width: 0;
}
.docs-scroll {
  flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px;
}
.docs-scroll::-webkit-scrollbar       { width: 4px; }
.docs-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 4px; }

/* ── Document Card ── */
.doc-card {
  background: #fff;
  border-radius: 13px;
  border: 1.5px solid rgba(0,0,0,0.07);
  padding: 11px 12px 10px;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  overflow: hidden;
  min-width: 0;
}
.doc-card:hover    { border-color: #93c5fd; box-shadow: 0 2px 8px rgba(37,99,235,0.1); }
.doc-card--active  { border-color: #2563eb !important; box-shadow: 0 2px 12px rgba(37,99,235,0.18) !important; }

.dc-toprow {
  display: flex; align-items: center; gap: 7px; margin-bottom: 8px;
}
.dc-name  { font-size: 12px; font-weight: 700; color: #0f1f3d; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dc-badge { font-size: 9px !important; border-radius: 6px !important; }
.dc-rm    { opacity: 0; transition: opacity 0.15s; flex-shrink: 0; }
.doc-card:hover .dc-rm { opacity: 1; }

/* ── Type Pills ── */
.dc-type-pills { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
.dc-pill {
  display: flex; align-items: center;
  padding: 4px 9px; border-radius: 20px;
  font-size: 10px; font-weight: 600; color: #4b5a7a;
  background: #f0f4fb; border: 1.5px solid rgba(37,99,235,0.12);
  cursor: pointer; transition: all 0.12s; white-space: nowrap;
}
.dc-pill:hover { border-color: #93c5fd; color: #2563eb; }
.dc-pill--on   { border-color: #2563eb !important; background: #eff6ff !important; color: #2563eb !important; }

/* ── Photo Pair (two-sided) ── */
.photo-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.photo-col  { display: flex; flex-direction: column; gap: 4px; }
.photo-side-lbl {
  display: flex; align-items: center; gap: 3px;
  font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280;
}

/* ── Photo Zone ── */
.photo-zone {
  position: relative; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 5px;
  border-radius: 10px; cursor: pointer; overflow: hidden;
  border: 1.5px dashed rgba(59,130,246,0.35);
  background: #f8faff; min-height: 96px;
  transition: all 0.15s;
}
.photo-zone:hover { border-color: #3b82f6; background: #eff6ff; }
.photo-zone--filled  { border-style: solid; border-color: #10b981; background: #f0fdf4; padding: 0; }
.photo-zone--scanning{ border-color: #3b82f6 !important; }
.photo-zone--err     { border-color: #ef4444 !important; background: #fff5f5 !important; }
.photo-zone--wide    { min-height: 114px; }

.upload-input { display: none; }
.pz-hint { font-size: 11px; font-weight: 600; color: #4b5a7a; }
.pz-sub  { font-size: 10px; color: #9ca3af; }

.pz-thumb { width: 100%; height: 94px; object-fit: cover; display: block; border-radius: 8px; }
.pz-thumb--wide { height: 112px; }

.pz-scanning {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  background: rgba(15,31,61,0.55); border-radius: 8px;
}
.pz-scan-txt { font-size: 11px; color: #fff; font-weight: 600; }

.pz-hover {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center; gap: 5px;
  background: rgba(15,31,61,0.5); color: #fff; font-size: 11px; font-weight: 600;
  opacity: 0; transition: opacity 0.15s; border-radius: 8px; cursor: pointer;
}
.photo-zone--filled:hover .pz-hover { opacity: 1; }

.pz-err { font-size: 10px; color: #dc2626; display: flex; align-items: center; gap: 3px; }
.pz-err--banner {
  padding: 7px 10px; border-radius: 8px;
  background: #fef2f2; border: 1px solid #fca5a5; font-size: 11px;
}

/* ── Single photo ── */
.photo-single { display: flex; flex-direction: column; gap: 6px; }

/* ── Extracted fields (per side, compact) ── */
.side-fields {
  display: flex; flex-direction: column; gap: 2px;
  background: #f8faff; border-radius: 7px; padding: 5px 7px;
  border: 1px solid rgba(37,99,235,0.08);
}
.sf-row  { display: flex; align-items: center; gap: 5px; min-width: 0; overflow: hidden; }
.sf-lbl  { font-size: 8.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.4px; width: 66px; flex-shrink: 0; }
.sf-val  { font-size: 10px; font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sf-ok   { color: #0f766e; }
.sf-miss { color: #d97706; font-style: italic; }

.dc-empty-hint { font-size: 11px; color: #94a3b8; font-style: italic; padding: 4px 2px; }

/* ── Add Document ── */
.add-doc-row { padding: 6px 12px 10px; }
.add-doc-btn {
  width: 100%; font-size: 12px !important; color: #2563eb !important;
  border: 1.5px dashed rgba(37,99,235,0.3) !important; border-radius: 9px !important;
}

/* ── Status dot ── */
.s-dot       { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dot--gray   { background: #d1d5db; }
.dot--green  { background: #10b981; }
.dot--amber  { background: #f59e0b; }
.dot--red    { background: #ef4444; }
.dot--blue   { background: #3b82f6; }

/* ═══════════════════════════════════════════════════════
   RIGHT PANEL — Analysis
   ═══════════════════════════════════════════════════════ */
.dlg-right {
  display: flex; flex-direction: column; gap: 12px;
  padding: 14px; overflow-y: auto; background: #fff;
  min-width: 0; overflow-x: hidden;
}
.dlg-right::-webkit-scrollbar       { width: 4px; }
.dlg-right::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }

/* ── Case Card ── */
.case-card {
  border-radius: 14px; border: 2px solid; padding: 14px 16px;
  transition: all 0.2s;
}
.cc-top {
  display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;
}
.cc-icon {
  width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.cc-title-block { flex: 1; min-width: 0; overflow: hidden; }
.cc-label  { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 3px; }
.cc-title  { font-size: 13px; font-weight: 800; line-height: 1.3; margin-bottom: 3px; overflow-wrap: break-word; }
.cc-subtitle { font-size: 11px; color: #64748b; overflow-wrap: break-word; }

.cc-badges { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 12px; }
.cc-badge  {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;
}
.cc-badge--grey { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

.cc-grid { display: flex; flex-direction: column; gap: 6px; }
.cc-row  { display: flex; align-items: baseline; gap: 8px; min-width: 0; overflow: hidden; }
.cc-lbl  { font-size: 10px; font-weight: 600; color: #64748b; width: 70px; flex-shrink: 0; }
.cc-val  { font-size: 12px; color: #0f1f3d; font-weight: 500; flex: 1; min-width: 0; overflow-wrap: break-word; }
.cc-val--strong { font-weight: 700; font-size: 13px; overflow-wrap: break-word; }
.cc-val--mono   { font-family: monospace; font-size: 12px; letter-spacing: 0.5px; font-weight: 600; overflow-wrap: break-word; }

/* ── Fields Panel ── */
.fields-panel {
  flex: 1; display: flex; flex-direction: column; min-height: 0;
  border: 1px solid rgba(37,99,235,0.1); border-radius: 12px; overflow: hidden;
  background: #f8faff;
}
.fp-hdr {
  display: flex; align-items: center; gap: 6px;
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px;
  color: #4b5a7a; padding: 9px 12px; background: #fff;
  border-bottom: 1px solid rgba(37,99,235,0.08); flex-shrink: 0;
}
.fp-count { margin-left: auto; background: #eff6ff; color: #2563eb; border-radius: 20px; padding: 1px 7px; font-size: 9px; }
.fp-scroll { flex: 1; overflow-y: auto; padding: 8px 10px; }
.fp-scroll::-webkit-scrollbar       { width: 3px; }
.fp-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }
.fp-empty { font-size: 11px; color: #94a3b8; font-style: italic; padding: 10px 4px; text-align: center; }
.fp-grid  { display: flex; flex-direction: column; gap: 3px; }
.fp-row   { display: flex; align-items: center; gap: 6px; padding: 3px 4px; border-radius: 5px; }
.fp-row:hover { background: rgba(37,99,235,0.04); }
.fp-lbl   { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.4px; width: 78px; flex-shrink: 0; }
.fp-val   { font-size: 11px; color: #0f1f3d; font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── Selenium note ── */
.selenium-note {
  display: flex; align-items: center; gap: 6px; flex-shrink: 0;
  font-size: 11px; color: #1d4ed8;
  padding: 8px 11px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 9px;
}

/* ═══════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════ */
.dlg-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px; flex-shrink: 0; gap: 8px;
  background: #fff;
}
.footer-warn { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #92400e; flex: 1; min-width: 0; }
.footer-btns { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.confirm-btn { border-radius: 9px !important; font-weight: 700 !important; font-size: 12px !important; min-height: 36px !important; }

/* ── Ocr-dlg-hdr compatibility (unused selectors removed) ── */
</style>
