<template>
  <!--
    ╔══════════════════════════════════════════════════════════════════╗
    ║  OcrUploadDialog.vue — Document Scanner Dialog                  ║
    ║                                                                  ║
    ║  PURPOSE:                                                        ║
    ║    A full-screen modal dialog that lets staff upload photos of   ║
    ║    physical documents (CPR, vehicle ownership, driving license,  ║
    ║    CR certificate). Each image is sent to a backend OCR proxy,  ║
    ║    which extracts text. The component then parses the text into  ║
    ║    named fields, detects the insurance case type, cross-checks   ║
    ║    documents for mismatches, and finally emits all fields back   ║
    ║    to the parent form when the user clicks "Apply to Form".      ║
    ║                                                                  ║
    ║  FLOW OVERVIEW:                                                  ║
    ║    1. Parent opens dialog  → modelValue = true                   ║
    ║    2. User picks doc type  → onSetType()                         ║
    ║    3. User uploads image   → onFileChange()                      ║
    ║         → useFileValidation.js  (validateFile)  ← returns ok/err ║
    ║         → useSeim.js           (logSiemEvent)   ← fire-and-return║
    ║         → runOcr()                                               ║
    ║              → useZoho.js      (getSanctumToken) ← returns token ║
    ║              → normaliseImageOrientation()  ← returns File       ║
    ║              → fetch /api/ocr/extract       ← returns JSON       ║
    ║              → parseFields() → extractField() ← returns fields   ║
    ║    4. Reactive computed properties update automatically          ║
    ║    5. User clicks "Apply to Form" → confirm()                    ║
    ║         → emits 'fields-confirmed' to parent (IndexPage.vue)     ║
    ║         → emits 'update:modelValue' false → dialog closes        ║
    ╚══════════════════════════════════════════════════════════════════╝
  -->

  <!-- STEP 1 ─────────────────────────────────────────────────────────
       The parent (IndexPage.vue) controls visibility via :modelValue.
       When the user closes the dialog (X button or Cancel), we emit
       'update:modelValue' = false back to the parent to hide it.
       `persistent` prevents accidental closes by clicking outside.
  ──────────────────────────────────────────────────────────────────-->
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
        <!-- X button → emits false → parent hides dialog -->
        <q-btn flat round dense icon="close" size="sm" @click="$emit('update:modelValue', false)" />
      </div>

      <q-separator style="opacity:0.5" />

      <!-- ── BODY ── -->
      <div class="dlg-body">

        <!-- ═══ LEFT: Document Upload Cards ═══
             STEP 2 ──────────────────────────────────────────────────
             The `documents` array (reactive ref) holds one or more
             document slots. Each slot has: id, type, front, back.
             The user can add more cards with "Add another document".
        ──────────────────────────────────────────────────────────── -->
        <div class="dlg-left">
          <div class="docs-scroll">

            <!-- Loop over every document card in the documents[] array -->
            <div
              v-for="doc in documents"
              :key="doc.id"
              class="doc-card"
              :class="{ 'doc-card--active': doc.id === activeDocId }"
              @click="activeDocId = doc.id"
            >
              <!-- Card top row: status dot, doc name, field summary badge, remove button -->
              <div class="dc-toprow">
                <!-- statusDotClass() → returns a CSS class (gray/green/amber/red/blue)
                     based on docStatus() which checks front/back slot statuses -->
                <span class="s-dot" :class="statusDotClass(doc)" />
                <span class="dc-name">{{ doc.type ? DOC_SCHEMAS[doc.type].label : 'New Document' }}</span>
                <!-- fieldSummary() → returns e.g. "5 fields · 2 miss" -->
                <q-badge
                  v-if="docStatus(doc) === 'done' || docStatus(doc) === 'partial'"
                  :color="totalUnmatchedDoc(doc) > 0 ? 'amber-8' : 'teal-7'"
                  :label="fieldSummary(doc)"
                  dense class="dc-badge"
                />
                <!-- removeDocument() → revokes blob URLs, splices array, resets activeDocId -->
                <q-btn flat round dense icon="close" size="xs" class="dc-rm"
                  @click.stop="removeDocument(doc.id)" />
              </div>

              <!-- STEP 3 ────────────────────────────────────────────
                   Document type selector pills.
                   Clicking a pill calls onSetType(key) which sets
                   doc.type and immediately re-runs OCR if files are
                   already present (doc.front.file / doc.back.file).
              ──────────────────────────────────────────────────────-->
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

              <!-- Upload zones — only rendered after a type is chosen -->
              <div v-if="doc.type">

                <!-- STEP 4a ──────────────────────────────────────────
                     TWO-SIDED documents (Smart Card, Vehicle Ownership,
                     Driving License): render a front and back photo zone.
                     Each zone has a hidden <input type="file"> that is
                     triggered by triggerFileInput() when the zone is clicked.
                ────────────────────────────────────────────────────────-->
                <div v-if="hasSides(doc.type)" class="photo-pair">
                  <div v-for="side in ['front','back']" :key="side" class="photo-col">
                    <div class="photo-side-lbl">
                      <q-icon :name="side === 'front' ? 'flip_to_front' : 'flip_to_back'" size="10px" />
                      {{ side === 'front' ? 'Front' : 'Back' }}
                    </div>
                    <div
                      class="photo-zone"
                      :class="{
                        'photo-zone--filled': doc[side].file,
                        'photo-zone--scanning': doc[side].status === 'ocr_running',
                        'photo-zone--err': doc[side].status === 'error',
                      }"
                      @click.stop="!doc[side].file && triggerFileInput(doc.id, side)"
                    >
                      <!-- Hidden file input. setInputRef stores a ref so we can
                           programmatically click it via triggerFileInput(). -->
                      <input type="file" accept=".jpg,.jpeg,.png,.pdf" class="upload-input"
                        :ref="el => setInputRef(doc.id, side, el)"
                        @change="e => { activeDocId = doc.id; onFileChange(e, side) }" />

                      <!-- Empty state: prompt to add a photo -->
                      <template v-if="!doc[side].file">
                        <q-icon name="add_a_photo" size="24px" color="blue-4" />
                        <span class="pz-hint">Add photo</span>
                      </template>

                      <!-- Filled state: show thumbnail or PDF icon -->
                      <template v-else>
                        <!-- openPreview() sets previewImgUrl and opens the lightbox dialog -->
                        <img v-if="doc[side].previewUrl" :src="doc[side].previewUrl" class="pz-thumb"
                          @click.stop="openPreview(doc[side].previewUrl)" />
                        <q-icon v-else name="picture_as_pdf" size="26px" color="positive" />

                        <!-- Scanning overlay: shown while OCR is in progress -->
                        <div v-if="doc[side].status === 'ocr_running'" class="pz-scanning">
                          <q-circular-progress indeterminate size="22px" color="white" track-color="transparent" />
                          <span class="pz-scan-txt">Scanning…</span>
                        </div>

                        <!-- Hover overlay: Preview / Replace actions -->
                        <div class="pz-hover">
                          <span class="pz-action" @click.stop="openPreview(doc[side].previewUrl)">
                            <q-icon name="visibility" size="13px" /> Preview
                          </span>
                          <span class="pz-action-sep">|</span>
                          <!-- triggerFileInput() programmatically clicks the hidden <input> -->
                          <span class="pz-action" @click.stop="triggerFileInput(doc.id, side)">
                            <q-icon name="photo_camera" size="13px" /> Replace
                          </span>
                        </div>
                      </template>
                    </div>

                    <!-- Error message shown below zone if OCR failed -->
                    <div v-if="doc[side].status === 'error'" class="pz-err">
                      <q-icon name="error_outline" size="11px" /> OCR failed
                    </div>

                    <!-- STEP 8 ──────────────────────────────────────
                         After OCR completes (status === 'done'),
                         extracted fields are displayed inline under
                         each photo zone. Missing fields shown as "—".
                    ────────────────────────────────────────────────-->
                    <div v-if="doc[side].status === 'done'" class="side-fields">
                      <div v-for="f in (DOC_SCHEMAS[doc.type]?.[(side==='front'?'frontFields':'backFields')] || [])" :key="f" class="sf-row">
                        <span class="sf-lbl">{{ FIELD_LABELS[f] || f }}</span>
                        <span v-if="doc[side].extracted[f]" class="sf-val sf-ok">{{ doc[side].extracted[f] }}</span>
                        <span v-else class="sf-val sf-miss">—</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- STEP 4b ──────────────────────────────────────────
                     SINGLE-SIDED documents (CR Certificate): one wide
                     photo zone, only using doc.front.
                ────────────────────────────────────────────────────-->
                <div v-else class="photo-single">
                  <div
                    class="photo-zone photo-zone--wide"
                    :class="{
                      'photo-zone--filled': doc.front.file,
                      'photo-zone--scanning': doc.front.status === 'ocr_running',
                      'photo-zone--err': doc.front.status === 'error',
                    }"
                    @click.stop="!doc.front.file && triggerFileInput(doc.id, 'front')"
                  >
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" class="upload-input"
                      :ref="el => setInputRef(doc.id, 'front', el)"
                      @change="e => { activeDocId = doc.id; onFileChange(e, 'front') }" />
                    <template v-if="!doc.front.file">
                      <q-icon name="add_a_photo" size="30px" color="blue-4" />
                      <span class="pz-hint">Click or drag to upload</span>
                      <span class="pz-sub">JPG · PNG · PDF</span>
                    </template>
                    <template v-else>
                      <img v-if="doc.front.previewUrl" :src="doc.front.previewUrl" class="pz-thumb pz-thumb--wide"
                        @click.stop="openPreview(doc.front.previewUrl)" />
                      <q-icon v-else name="picture_as_pdf" size="32px" color="positive" />
                      <div v-if="doc.front.status === 'ocr_running'" class="pz-scanning">
                        <q-circular-progress indeterminate size="26px" color="white" track-color="transparent" />
                        <span class="pz-scan-txt">Scanning…</span>
                      </div>
                      <div class="pz-hover">
                        <span class="pz-action" @click.stop="openPreview(doc.front.previewUrl)">
                          <q-icon name="visibility" size="15px" /> Preview
                        </span>
                        <span class="pz-action-sep">|</span>
                        <span class="pz-action" @click.stop="triggerFileInput(doc.id, 'front')">
                          <q-icon name="photo_camera" size="15px" /> Replace
                        </span>
                      </div>
                    </template>
                  </div>
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

          <!-- addDocument() appends a fresh mkDoc() slot and makes it active -->
          <div class="add-doc-row">
            <q-btn flat no-caps icon="add_circle_outline" label="Add another document"
              class="add-doc-btn" @click="addDocument" />
          </div>
        </div>

        <!-- ═══ RIGHT: Analysis Panel ═══
             STEP 9 ──────────────────────────────────────────────────
             These three sections are all driven by computed properties
             that re-evaluate automatically whenever documents[] changes.
             No user interaction is needed — they update in real time.
        ──────────────────────────────────────────────────────────── -->
        <div class="dlg-right">

          <!-- ── CASE DETECTION CARD ──
               detectedCase computed property reads mergedFields and
               returns one of four objects: none / individual /
               installment_individual / installment_company.
               Colors and icons change automatically based on result. -->
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

            <!-- Detail rows — only shown once at least one field is detected -->
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

          <!-- ── Cross-Validation Warning ──
               crossValidation computed compares Smart Card vs Driving
               License — if the CPR personal ID doesn't match the
               license number, a conflict card appears here. -->
          <div v-if="crossValidation.length" class="cv-card">
            <div class="cv-hdr">
              <q-icon name="warning_amber" size="13px" />
              Document Mismatch Detected
            </div>
            <div v-for="(c, i) in crossValidation" :key="i" class="cv-row">
              <span class="cv-field">{{ c.field }}</span>
              <div class="cv-detail">
                <div><span class="cv-doc">{{ c.docA }}</span>: {{ c.valA }}</div>
                <div><span class="cv-doc">{{ c.docB }}</span>: {{ c.valB }}</div>
              </div>
            </div>
          </div>

          <!-- ── ALL EXTRACTED FIELDS ──
               mergedFields computed merges front+back extracted objects
               from all scanned documents, with identity docs taking
               priority over vehicle docs (PRIO sort). -->
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

          <!-- Shown when a vehicle reg number has been extracted,
               indicating the Bahrain traffic lookup is available. -->
          <div v-if="activeDocReg" class="selenium-note">
            <q-icon name="travel_explore" size="12px" color="blue-6" />
            Reg. <strong>{{ activeDocReg }}</strong> → Bahrain Traffic Lookup ready
          </div>

        </div>
      </div>

      <q-separator style="opacity:0.5" />

      <!-- ── FOOTER ──
           STEP 10 ────────────────────────────────────────────────────
           Three buttons:
           • Cancel → emits false → parent hides the dialog
           • Re-scan → reRunOcr() → runs runOcr() on existing files
           • Apply to Form → confirm() → emits 'fields-confirmed'
                              with merged fields → parent receives them
      ──────────────────────────────────────────────────────────────-->
      <div class="dlg-footer">
        <div class="footer-warn">
          <!-- totalUnmatched computed = sum of missing fields across all docs -->
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
          <!-- Re-scan is only enabled if the active doc has a file AND a type selected -->
          <q-btn
            flat no-caps dense color="primary" icon="refresh" label="Re-scan"
            :disable="!activeDoc?.front?.file && !activeDoc?.back?.file || !activeDoc?.type"
            @click="reRunOcr"
          />
          <!-- "Apply to Form" → confirm() merges fields and emits them to the parent -->
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

  <!-- ── Image Preview Lightbox ──
       A second full-screen dialog rendered outside the main card.
       openPreview() sets previewImgUrl and flips previewOpen = true.
       Clicking outside the image or the X closes it. -->
  <q-dialog v-model="previewOpen" maximized>
    <div class="ocr-lightbox" @click.self="previewOpen = false">
      <div class="ocr-lb-topbar">
        <span class="ocr-lb-title">Image Preview</span>
        <q-btn flat round dense icon="close" color="white" size="sm" @click="previewOpen = false" />
      </div>
      <div class="ocr-lb-body">
        <img :src="previewImgUrl" class="ocr-lb-img" />
      </div>
    </div>
  </q-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'

// ── External composables (other files) ────────────────────────────────────────
// useZoho.js → getSanctumToken()
//   GOES TO: src/composables/useZoho.js
//   RETURNS: string | null — the Laravel Sanctum Bearer token stored in memory,
//            or null if the user has not authorised with Zoho yet.
import { getSanctumToken } from 'src/composables/useZoho'

// useFileValidation.js → validateFile()
//   GOES TO: src/composables/useFileValidation.js
//   RETURNS: { ok: boolean, reason?: string }
//            ok=true  → file is safe to process
//            ok=false → reason explains why it was rejected (size, type, etc.)
import { validateFile } from 'src/composables/useFileValidation'

// useSeim.js → logSiemEvent()
//   GOES TO: src/composables/useSeim.js
//   RETURNS: void (fire-and-forget — just writes a security log entry)
import { logSiemEvent } from 'src/composables/useSeim'

const props = defineProps({ modelValue: Boolean })
// 'update:modelValue' → tells parent to open/close the dialog (v-model pattern)
// 'fields-confirmed'  → passes the merged field object to the parent form
const emit = defineEmits(['update:modelValue', 'fields-confirmed'])

const $q = useQuasar()

// ── Doc type icons ─────────────────────────────────────────────────────────
// Maps each document type key → a Material icon name used in the type pills.
const DOC_ICONS = {
  smart_card:       'badge',
  vehicle_ownership:'directions_car',
  driving_license:  'drive_eta',
  cr_certificate:   'store',
}

// ── Schemas ────────────────────────────────────────────────────────────────
// Each schema declares:
//   label       — human-readable name shown in the UI
//   hasSides    — true if the doc has a front AND back side
//   frontFields — ordered list of field keys expected on the front image
//   backFields  — ordered list of field keys expected on the back image
// These arrays drive: which upload zones to show, which fields to parse
// after OCR, and which fields to list in the side-fields panel.
const DOC_SCHEMAS = {
  smart_card:       { label: 'Smart Card (CPR)',    hasSides: true,
    frontFields: ['full_name','personal_id_number','nationality'],
    backFields:  ['gender','date_of_birth','expiry_date'] },
  vehicle_ownership:{ label: 'Vehicle Ownership',   hasSides: true,
    frontFields: ['owner_name','cr_number','cpr_number','vehicle_reg_number','registration_type'],
    backFields:  ['ownership_status','chassis_number','make','model','year_of_make'] },
  driving_license:  { label: 'Driving License',     hasSides: true,
    frontFields: ['owner_name','license_number'],
    backFields:  ['license_issue_date','expiry_date','vehicle_categories'] },
  cr_certificate:   { label: 'CR Certificate',      hasSides: false,
    frontFields: ['reg_number','company_name','personal_id_number'],
    backFields:  [] },
}

// Maps internal field keys → display labels shown in the UI panels.
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
  cr_number:'CR No.', reg_number:'Company Reg. No.', company_name:'Company Name', personal_id_number:'Personal ID',
}

// ── State ──────────────────────────────────────────────────────────────────
// mkSlot() creates the initial state for one image upload slot (front or back).
// Each slot tracks: the File object, a blob URL for preview, OCR status,
// the extracted key-value fields, and the raw OCR text.
function mkSlot () {
  return { file: null, previewUrl: null, status: 'empty', extracted: {}, rawText: null }
}

// mkDoc() creates a new document card with a unique id, no type yet selected,
// and empty front/back slots.
function mkDoc (id) {
  return { id, type: null, sideMode: 'both', front: mkSlot(), back: mkSlot() }
}

let nextId = 2
// documents: reactive array of all document cards in the left panel.
// Starts with one empty card (id=1).
const documents   = ref([mkDoc(1)])
// activeDocId: which card is currently highlighted/selected.
const activeDocId = ref(1)

// ── Computed ───────────────────────────────────────────────────────────────

// activeDoc → the currently selected document object from the array.
const activeDoc = computed(() => documents.value.find(d => d.id === activeDocId.value))

// activeDocReg → vehicle registration number from the active doc's extracted fields.
// Used to show the "Bahrain Traffic Lookup ready" hint.
const activeDocReg = computed(() => {
  const doc = activeDoc.value
  if (!doc) return null
  return doc.front.extracted?.vehicle_reg_number || doc.back.extracted?.vehicle_reg_number || null
})

// totalUnmatched → sum of expected fields that returned null across all documents.
// Drives the footer warning message.
const totalUnmatched = computed(() =>
  documents.value.reduce((sum, d) => sum + totalUnmatchedDoc(d), 0)
)

// mergedFields → single flat object of all extracted key-value pairs.
// Priority order: smart_card=1, driving_license=1, cr_certificate=2, vehicle_ownership=3.
// Lower number = higher priority: if the same key appears in two docs, the
// higher-priority doc wins (earlier in the sorted array).
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

// detectedCase → reads mergedFields and classifies the insurance case:
//   'none'                  → no fields scanned yet
//   'installment_company'   → bank or company is the registered owner
//   'installment_individual'→ vehicle is under finance but owned by a person
//   'individual'            → straightforward cash / personal ownership
// Returns a display object with: type, icon, color, bg, border, title,
// subtitle, payment, paymentIcon, ownerType, customerName, customerCPR.
const detectedCase = computed(() => {
  const f = mergedFields.value
  const ownerName      = f.owner_name || f.full_name || ''
  const cprNumber      = f.cpr_number || ''
  const crNumber       = f.cr_number  || ''
  const ownershipStatus = f.ownership_status

  if (!ownerName && !cprNumber && !crNumber) return {
    type:'none', icon:'manage_search', color:'#94a3b8', bg:'#f8faff', border:'#e2e8f0',
    title:'SCAN DOCUMENTS TO DETECT CASE', subtitle:'Upload and scan documents to identify the policy holder',
    payment:null, paymentIcon:'help_outline', ownerType:'—', customerName:'', customerCPR:''
  }

  const BANK_KW = ['BANK','FINANCE','FINANCIAL','CREDIT','FACILITIES','FINANCING','NBB','BBK','AUB','GIB','KFH','BISB','KHCB','FAB','BCF']
  const CO_SFX  = ['WLL','BSC','SPC','LLC','LTD','LIMITED','B.S.C','W.L.L','S.P.C']
  const ownerIsBank    = ownerName && BANK_KW.some(k => ownerName.toUpperCase().includes(k))
  const ownerIsCompany = ownerName && CO_SFX.some(s => ownerName.toUpperCase().includes(s))
  const isInstallment  = ownershipStatus === 'installment'
  const personalId     = f.personal_id_number || ''
  const cprDigits      = cprNumber.replace(/\D/g, '')
  // CR number: not exactly 9 digits, OR doesn't match the civil ID personal ID number
  const cprIsCompany   = cprDigits.length > 0 && cprDigits.length !== 9
  const cprMismatch    = !!(personalId && cprNumber && personalId !== cprNumber)
  const ownerIsEntity  = ownerIsBank || ownerIsCompany || !!crNumber || cprIsCompany || cprMismatch

  // Case 3: company / bank is the registered owner (entity signals alone are sufficient)
  if (ownerIsEntity) return {
    type:'installment_company', icon:'account_balance', color:'#0284c7', bg:'#f0f9ff', border:'#7dd3fc',
    title:'INSTALLMENT · COMPANY / BANK OWNER', subtitle:'Finance company or bank is the registered owner',
    payment:'installment', paymentIcon:'account_balance', ownerType:'Bank / Finance',
    customerName: ownerName, customerCPR: crNumber || cprNumber,
  }

  // Case 2: installment + individual customer name
  if (isInstallment) return {
    type:'installment_individual', icon:'person', color:'#d97706', bg:'#fffbeb', border:'#fcd34d',
    title:'INSTALLMENT · INDIVIDUAL OWNER', subtitle:'Vehicle registered under the customer name with financing',
    payment:'installment', paymentIcon:'account_balance', ownerType:'Individual / شخص',
    customerName: ownerName, customerCPR: cprNumber,
  }

  // Case 1: cash / individual
  return {
    type:'individual', icon:'person', color:'#059669', bg:'#f0fdf4', border:'#6ee7b7',
    title:'INDIVIDUAL · CASH OWNERSHIP', subtitle: ownerName || 'Personal ownership confirmed',
    payment:'cash', paymentIcon:'payments', ownerType:'Individual / شخص',
    customerName: ownerName, customerCPR: cprNumber,
  }
})

// ── Cross-document validation ──────────────────────────────────────────────
// Only validates between Smart Card (CPR) and Driving License:
// the personal_id_number on the CPR must equal the license_number on the
// driving license (in Bahrain they are the same number).
const crossValidation = computed(() => {
  const scanned = documents.value.filter(d =>
    d.type && (docStatus(d) === 'done' || docStatus(d) === 'partial')
  )

  const cpr = scanned.find(d => d.type === 'smart_card')
  const dl  = scanned.find(d => d.type === 'driving_license')
  if (!cpr || !dl) return []

  const norm = s => (s || '').trim().toUpperCase().replace(/\s+/g, ' ')

  const cprId   = norm(cpr.front.extracted.personal_id_number || cpr.back.extracted.personal_id_number || '')
  const dlId    = norm(dl.front.extracted.license_number      || dl.back.extracted.license_number      || '')
  const cprName = norm(cpr.front.extracted.full_name  || '')
  const dlName  = norm(dl.front.extracted.owner_name  || dl.back.extracted.owner_name || '')

  const conflicts = []

  if (cprId && dlId && cprId !== dlId)
    conflicts.push({
      field: 'ID',
      docA: 'Smart Card (CPR)', valA: cprId,
      docB: 'Driving License',  valB: dlId,
    })

  if (cprName && dlName && cprName !== dlName)
    conflicts.push({
      field: 'Name',
      docA: 'Smart Card (CPR)', valA: cprName,
      docB: 'Driving License',  valB: dlName,
    })

  return conflicts
})

// ── Helpers ────────────────────────────────────────────────────────────────
// hasSides() → true if this doc type has a front AND back side.
function hasSides (type) { return !!DOC_SCHEMAS[type]?.hasSides }
function docTypeLabel (type) { return type ? DOC_SCHEMAS[type]?.label : 'No type selected' }

// docStatus() → derives an overall status from the individual slot statuses.
// Priority: ocr_running > error > done (all slots) > partial (some slots) > empty
function docStatus (doc) {
  if (!doc.type) return 'empty'
  const slots = hasSides(doc.type) ? [doc.front, doc.back] : [doc.front]
  if (slots.some(s => s.status === 'ocr_running')) return 'ocr_running'
  if (slots.some(s => s.status === 'error'))       return 'error'
  if (slots.every(s => s.status === 'done'))        return 'done'
  if (slots.some(s => s.status === 'done'))         return 'partial'
  return 'empty'
}

// statusDotClass() → maps docStatus to a CSS class for the colored dot.
function statusDotClass (doc) {
  const st = docStatus(doc)
  if (st === 'ocr_running') return 'dot--blue'
  if (st === 'error')       return 'dot--red'
  if (st === 'done')        return 'dot--green'
  if (st === 'partial')     return 'dot--amber'
  return 'dot--gray'
}

// totalUnmatchedDoc() → counts expected fields that are still null after scanning.
function totalUnmatchedDoc (doc) {
  if (!doc.type) return 0
  const s = DOC_SCHEMAS[doc.type]
  const frontMiss = (s.frontFields || []).filter(f => doc.front.status === 'done' && !doc.front.extracted[f]).length
  const backMiss  = (s.backFields  || []).filter(f => doc.back.status  === 'done' && !doc.back.extracted[f]).length
  return frontMiss + backMiss
}

// fieldSummary() → returns a short badge label like "5 fields · 2 miss".
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

// addDocument() → appends a new empty document card and makes it the active one.
function addDocument () {
  const doc = mkDoc(nextId++)
  documents.value.push(doc)
  activeDocId.value = doc.id
}

// removeDocument() → cleans up blob URLs to avoid memory leaks,
// removes the card from the array, ensures at least one card always exists,
// and repoints activeDocId to a neighboring card.
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

// ── Image preview lightbox ─────────────────────────────────────────────────
const previewOpen   = ref(false)
const previewImgUrl = ref(null)
// openPreview() → stores the image URL and shows the lightbox dialog.
function openPreview (url) {
  if (!url) return
  previewImgUrl.value = url
  previewOpen.value   = true
}

// ── File input refs (keyed "docId-side") ───────────────────────────────────
// inputRefs stores direct DOM references to hidden <input type="file"> elements,
// keyed by "docId-side" (e.g. "1-front"). Vue's :ref callback populates this.
const inputRefs = {}
function setInputRef (docId, side, el) {
  const key = `${docId}-${side}`
  if (el) inputRefs[key] = el
  else delete inputRefs[key]
}
// triggerFileInput() → programmatically opens the OS file picker for the given slot.
function triggerFileInput (docId, side) {
  inputRefs[`${docId}-${side}`]?.click()
}

function setSideMode (mode) {
  const doc = activeDoc.value
  if (!doc) return
  doc.sideMode = mode
}

// onSetType() → called when user clicks a type pill.
// Sets doc.type, then immediately re-triggers OCR on any files already uploaded.
function onSetType (key) {
  const doc = activeDoc.value
  if (!doc) return
  doc.type = key
  // Re-run OCR if files already present
  if (doc.front.file && doc.front.status !== 'ocr_running') runOcr(doc, 'front')
  if (doc.back.file  && doc.back.status  !== 'ocr_running') runOcr(doc, 'back')
}

// ── STEP 5: File upload handler ────────────────────────────────────────────
// onFileChange() is the main entry point when a user selects a file.
// Flow:
//   1. Read the File from the input event.
//   2. GOES TO useFileValidation.js → validateFile(file, 'ocr')
//      RETURNS { ok, reason }
//   3. If rejected:
//      - Show a Quasar notification.
//      - GOES TO useSeim.js → logSiemEvent() → RETURNS void (fire-and-forget).
//      - Early return — nothing else happens.
//   4. If accepted:
//      - Revoke any old blob URL for this slot.
//      - Assign the new file, create a new blob URL for the thumbnail preview.
//      - Reset extracted fields and status.
//      - If a doc type is selected, call runOcr() to start scanning.
function onFileChange (e, side) {
  const file = e.target.files?.[0]
  if (!file || !activeDoc.value) return
  e.target.value = ''

  // GOES TO: src/composables/useFileValidation.js → validateFile()
  // RETURNS: { ok: boolean, reason?: string }
  const validation = validateFile(file, 'ocr')
  if (!validation.ok) {
    $q.notify({ type: 'negative', message: `${file.name} rejected — ${validation.reason}`, icon: 'block', timeout: 5000 })
    // GOES TO: src/composables/useSeim.js → logSiemEvent()
    // RETURNS: void — just writes a security audit log entry
    logSiemEvent('FILE_REJECTED', localStorage.getItem('siem_user_email') || 'staff', {
      filename: file.name,
      reason:   validation.reason,
    }, 'medium')
    return
  }

  const slot = activeDoc.value[side]
  if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl)
  slot.file       = file
  slot.previewUrl = URL.createObjectURL(file)
  slot.status     = 'uploaded'
  slot.extracted  = {}
  slot.rawText    = null
  // Only start OCR if the user has already selected a document type.
  if (activeDoc.value.type) runOcr(activeDoc.value, side)
}

// clearSide() → resets a slot back to its initial mkSlot() state.
function clearSide (side) {
  const doc = activeDoc.value
  if (!doc) return
  const slot = doc[side]
  if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl)
  Object.assign(slot, mkSlot())
}

// downloadFile() → creates a temporary <a> element to trigger a file download.
function downloadFile (slot) {
  if (!slot?.file || !slot?.previewUrl) return
  const a = document.createElement('a')
  a.href     = slot.previewUrl
  a.download = slot.file.name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// reRunOcr() → manually re-scans files that are already uploaded.
// Called by the "Re-scan" footer button.
function reRunOcr () {
  const doc = activeDoc.value
  if (!doc?.type) return
  if (doc.front.file) runOcr(doc, 'front')
  if (doc.back.file)  runOcr(doc, 'back')
}

// ── STEP 6: Core OCR function ──────────────────────────────────────────────
// runOcr() is the async function that sends the image to the backend and
// processes the result. It is called by onFileChange() and onSetType().
//
// Flow:
//   1. Guard: slot must have a file and the doc must have a type.
//   2. GOES TO: src/composables/useZoho.js → getSanctumToken()
//      RETURNS: string token or null.
//      If null → show warning notification and return early.
//   3. Set slot.status = 'ocr_running' (triggers scanning overlay in template).
//   4. STAYS IN this file → normaliseImageOrientation(file)
//      RETURNS: a new File with correct EXIF rotation applied.
//   5. Build a FormData body (file + OCREngine parameter).
//      OCREngine 2 is used for denser documents (CR cert, vehicle ownership).
//   6. POST to /api/ocr/extract (Laravel backend proxy to OCR.space API).
//      RETURNS: JSON with ParsedResults[].ParsedText.
//   7. If the API returns an error flag → throw to catch block.
//   8. STAYS IN this file → parseFields(rawText, docType, side)
//      RETURNS: { fieldKey: value, ... }
//   9. Assign extracted fields to slot.extracted, set status = 'done'.
//   10. On any error → set status = 'error'.
async function runOcr (doc, side) {
  const slot = doc[side]
  if (!slot?.file || !doc.type) return

  // GOES TO: src/composables/useZoho.js → getSanctumToken()
  // RETURNS: Bearer token string, or null if not authorised
  const sanctumToken = getSanctumToken()
  if (!sanctumToken) {
    $q.notify({ type: 'warning', message: 'Please authorise with Zoho before scanning documents.', icon: 'lock', timeout: 5000 })
    return
  }

  slot.status    = 'ocr_running'
  slot.extracted = {}
  try {
    // STAYS IN this file → normaliseImageOrientation()
    // RETURNS: File with EXIF rotation corrected (so OCR sees upright image)
    const orientedFile = await normaliseImageOrientation(slot.file)
    const body = new FormData()
    body.append('file', orientedFile)
    // OCREngine 2 handles printed/complex documents better; Engine 1 is faster for IDs
    body.append('OCREngine', ['cr_certificate', 'vehicle_ownership'].includes(doc.type) ? '2' : '1')

    const apiBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LARAVEL_API_BASE) || 'http://127.0.0.1:8000/api'
    // LEAVES this file → POST to Laravel backend at /api/ocr/extract
    // The backend proxies the image to the OCR.space API and returns JSON.
    // RETURNS: { ParsedResults: [{ ParsedText: '...', ... }], IsErroredOnProcessing: bool }
    const res  = await fetch(`${apiBase}/ocr/extract`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${sanctumToken}` },
      body,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (json.IsErroredOnProcessing) throw new Error(json.ErrorMessage?.[0] || 'OCR error')

    // Join all parsed pages into a single text string
    const raw = (json.ParsedResults || []).map(r => r.ParsedText || '').join('\n').trim()
    slot.rawText   = raw
    console.log(`[OCR ${side} raw]`, raw)
    // STAYS IN this file → parseFields() → extractField()
    // RETURNS: { fieldKey: extractedValue | null, ... }
    slot.extracted = raw ? parseFields(raw, doc.type, side) : {}
    console.log(`[OCR ${side} fields]`, slot.extracted)
    slot.status = 'done'
  } catch (err) {
    console.error('[OCR]', err)
    slot.status = 'error'
  }
}

// ── STEP 10: Confirm handler ───────────────────────────────────────────────
// confirm() is called when the user clicks "Apply to Form".
// It re-merges all extracted fields (same priority logic as mergedFields computed),
// then emits them to the parent (IndexPage.vue) via 'fields-confirmed'.
// The parent receives the object and populates its form inputs.
// Finally, it closes the dialog by emitting 'update:modelValue' = false.
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
  // GOES TO: parent component (IndexPage.vue) via event listener
  // The parent handles 'fields-confirmed' by writing merged into the form state.
  emit('fields-confirmed', merged)
  emit('update:modelValue', false)
}

// ── STEP 7: Image orientation fix ─────────────────────────────────────────
// Phones embed EXIF rotation in JPEGs. Sending the raw file to OCR ignores
// that flag and the server sees an upside-down image. Drawing through an
// <img> element causes the browser to apply EXIF rotation, so the canvas
// blob is always correctly oriented.
// Called by: runOcr() before building the FormData body.
// RETURNS: a new File object (Promise) with correct orientation baked in.
function normaliseImageOrientation (file) {
  return new Promise((resolve) => {
    // Non-images (PDFs) pass through unchanged
    if (!file.type.startsWith('image/')) { resolve(file); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      // Draw the image into a canvas — browser applies EXIF rotation here
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      // Export as JPEG blob at 92% quality, wrap in a File, resolve the Promise
      canvas.toBlob((blob) => {
        resolve(new File([blob], file.name, { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.92)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// ── OCR field parsing ──────────────────────────────────────────────────────
// matchP() is a utility that tries a list of regex patterns against `text`
// and returns the first non-empty capture group, or null.
// Used by all the individual field extractors in extractField().
function matchP (text, patterns) {
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]?.trim()) return m[1].trim()
  }
  return null
}

// fmtDate() normalises date strings to DD/MM/YYYY format.
function fmtDate (raw) {
  if (!raw) return null
  const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (m) return `${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[3]}`
  return raw
}

// parseFields() → entry point for field extraction after OCR returns raw text.
// Looks up which fields the schema expects for this side, normalises whitespace,
// then calls extractField() for each field key.
// RETURNS: { fieldKey: value | null, ... }
function parseFields (rawText, docType, side) {
  const schema = DOC_SCHEMAS[docType]
  if (!schema) return {}
  const fields = side === 'back' ? (schema.backFields || []) : (schema.frontFields || [])
  const text   = rawText.replace(/\r\n|\r/g, '\n').replace(/[ \t]+/g, ' ')
  const result = {}
  for (const field of fields) result[field] = extractField(text, field)
  return result
}

// extractField() → a large switch that maps a field key to regex extraction logic.
// Each case handles the quirks of how OCR renders that particular field across
// different document layouts (forward scan, backward scan for bilingual tables,
// Arabic keyword mapping, etc.).
// RETURNS: string value or null.
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
        if (/^[A-Z][A-Z\-]{2,}(\s+[A-Z][A-Z\-]{2,}){2,}$/.test(t) && !blocked(t)) return t
      }
      return null
    }
    case 'cpr_number': {
      const cprRaw = matchP(text, [
        /(?:CPR|C\.P\.R\.?)\s*[:\-#.\s]*\n?\s*(\d{6,10})/im,
        /Civil\s*(?:ID|No\.?)\s*[:\-#]?\s*\n?\s*(\d{8,10})/im,
        /(?:PERSONAL\s*NO|National\s*(?:ID|No\.?))\s*[:\-\/]?\s*\n?\s*(\d{8,10})/im,
        /\b(\d{9})\b/,
        /\b((?:19|20)\d{7,8})\b/,
        /\b(\d{5,7}\s*-\s*\d{1,3})\b/,
      ])
      if (cprRaw) return cprRaw.replace(/\s*-\s*/g, '-').trim()
      // Vehicle ownership layout: labels column then values column — CPR label and
      // its value may be many lines apart. Scan forward from the CPR label for
      // the first 7-10 digit standalone number (6-digit ones are reg numbers).
      const cprLabelIdx = text.search(/\bCPR\b/i)
      if (cprLabelIdx !== -1) {
        const after = text.slice(cprLabelIdx + 3)
        const m = after.match(/\b(\d{7,10})\b/)
        if (m) return m[1]
      }
      return null
    }
    case 'nationality': {
      // Arabic nationality keywords (OCR of هندي → "HINDI" = Indian, etc.)
      const NAT_MAP = [
        ['INDIAN','Indian'],    ['هندي','Indian'],   ['HINDI','Indian'],
        ['PAKISTANI','Pakistani'], ['باكستاني','Pakistani'],
        ['BANGLADESHI','Bangladeshi'], ['بنغلاديشي','Bangladeshi'],
        ['FILIPINO','Filipino'], ['FILIPIN','Filipino'], ['فلبيني','Filipino'],
        ['BAHRAINI','Bahraini'], ['بحريني','Bahraini'], ['BAHRAIN','Bahraini'],
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
      const FIELD_LABELS_SET = /^(color|colour|type|weight|seats?|class|year|make|chassis|engine|cylinders?)$/i
      const isValid = v => v && !MODEL_BRANDS.has(v.trim().toUpperCase()) && v.trim().length >= 2 && !FIELD_LABELS_SET.test(v.trim())
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
    case 'expiry_date': {
      // ISO YYYY-MM-DD after label (date may be on next line, junk chars between)
      const expFwd = matchP(text, [
        /(?:expiry\s*date|exp(?:iry|ires)?\s*(?:date)?|valid\s*(?:until|to)|date\s*of\s*expiry)[^\d\n]*\n?\s*((19|20)\d{2}-\d{2}-\d{2})/i,
        /تاريخ\s*الإنتهاء[^\d\n]*\n?\s*((19|20)\d{2}-\d{2}-\d{2})/,
      ])
      if (expFwd) return expFwd
      // DD/MM/YYYY after label (same or next line)
      const expFwd2 = fmtDate(matchP(text, [
        /(?:expiry\s*date|exp(?:iry|ires)?\s*(?:date)?|valid\s*(?:until|to)|date\s*of\s*expiry)[^\d\n]*\n?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /تاريخ\s*الإنتهاء[^\d\n]*\n?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
      ]))
      if (expFwd2) return expFwd2
      // Backward scan — date appears before the label in RTL bilingual layout
      const expLabel = text.search(/expiry\s*date|date\s*of\s*expiry|تاريخ\s*الإنتهاء/i)
      if (expLabel !== -1) {
        const before = text.slice(Math.max(0, expLabel - 120), expLabel)
        const bm = before.match(/((19|20)\d{2}-\d{2}-\d{2})\s*$/) ||
                   before.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s*$/)
        if (bm) return fmtDate(bm[1])
      }
      return null
    }
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
      if (/\b(?:individual\s*owner|personal\s*ownership|cash\s*ownership|other\s*owner)\b/i.test(text)) return 'cash'
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
    case 'reg_number': {
      const regPatterns = [
        /\bRegistration\s*\n?\s*No\.?\s*[:\-]?\s*\n?\s*(\d[\d\s]*-\s*\d+)/im,
        /\bRegistration\s*\n?\s*No\.?\s*[:\-]?\s*\n?\s*(\d{5,10})/im,
      ]
      const raw = matchP(text, regPatterns)
      if (raw) return raw.replace(/\s*-\s*/g, '-').trim()
      // Backward scan: "Registration\nNo." split across lines in bilingual layout
      const clean = text.replace(/[؀-ۿ]+/g, ' ')
      const labelIdx = clean.search(/\bRegistration\s*\n?\s*No\.?/i)
      if (labelIdx !== -1) {
        const after = clean.slice(labelIdx)
        const m = after.match(/(\d[\d\s]*-\s*\d+|\d{5,10})/)
        if (m) return m[1].replace(/\s*-\s*/g, '-').trim()
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
  flex: 1; overflow: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px;
}
.docs-scroll::-webkit-scrollbar       { width: 4px; height: 4px; }
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
  width: 100%;
  box-sizing: border-box;
  flex-shrink: 0;
}
.doc-card:hover    { border-color: #93c5fd; box-shadow: 0 2px 8px rgba(37,99,235,0.1); }
.doc-card--active  { border-color: #2563eb !important; box-shadow: 0 2px 12px rgba(37,99,235,0.18) !important; }

.dc-toprow {
  display: flex; align-items: center; gap: 7px; margin-bottom: 8px;
}
.dc-name  { font-size: 12px; font-weight: 700; color: #0f1f3d; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dc-badge { font-size: 9px !important; border-radius: 6px !important; }
.dc-rm    { opacity: 0.45; transition: opacity 0.15s; flex-shrink: 0; }
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
.photo-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: start; min-width: 0; }
.photo-col  { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.photo-pair .photo-zone { height: 180px; min-height: unset; }
.photo-pair .pz-thumb   { width: 100%; height: 100%; object-fit: contain; }
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

.pz-thumb { width: 100%; height: 100%; object-fit: contain; display: block; border-radius: 8px; }
.pz-thumb--wide { height: 100%; }

.pz-scanning {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  background: rgba(15,31,61,0.55); border-radius: 8px;
}
.pz-scan-txt { font-size: 11px; color: #fff; font-weight: 600; }

.pz-hover {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  background: rgba(15,31,61,0.55); color: #fff; font-size: 11px; font-weight: 600;
  opacity: 0; transition: opacity 0.15s; border-radius: 8px;
}
.photo-zone--filled:hover .pz-hover { opacity: 1; }
.pz-action {
  display: flex; align-items: center; gap: 4px; cursor: pointer;
  padding: 5px 9px; border-radius: 6px; background: rgba(255,255,255,0.15);
  transition: background 0.12s;
}
.pz-action:hover { background: rgba(255,255,255,0.28); }
.pz-action-sep   { opacity: 0.35; }

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

/* ── Cross-Validation Warning ── */
.cv-card {
  border-radius: 12px; border: 2px solid #fbbf24;
  background: #fffbeb; padding: 11px 14px; flex-shrink: 0;
}
.cv-hdr {
  display: flex; align-items: center; gap: 6px;
  font-size: 10px; font-weight: 800; color: #92400e;
  text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;
}
.cv-row {
  display: flex; gap: 10px; align-items: flex-start;
  font-size: 11px; color: #78350f; padding: 4px 0;
  border-top: 1px solid rgba(251,191,36,0.3);
}
.cv-field { font-weight: 700; width: 36px; flex-shrink: 0; padding-top: 1px; }
.cv-detail { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.cv-doc    { font-weight: 700; color: #92400e; }

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

/* ── Image Preview Lightbox ── */
.ocr-lightbox {
  width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.93);
  display: flex; flex-direction: column; outline: none;
}
.ocr-lb-topbar {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px; background: rgba(0,0,0,0.45); flex-shrink: 0;
}
.ocr-lb-title {
  flex: 1; font-size: 13px; font-weight: 600; color: #fff;
}
.ocr-lb-body {
  flex: 1; display: flex; align-items: center; justify-content: center;
  min-height: 0; padding: 16px; overflow: hidden;
}
.ocr-lb-img {
  max-width: 100%; max-height: 100%; object-fit: contain;
  border-radius: 6px; box-shadow: 0 8px 40px rgba(0,0,0,0.6);
}
</style>
