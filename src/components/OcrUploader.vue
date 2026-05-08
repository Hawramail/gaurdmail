<!-- src/components/OcrUploader.vue
     Drop a document → OCR extracts fields → emits { fields } for template auto-fill

     Usage in SendEmailPage.vue:
       <OcrUploader @fields-extracted="onOcrFields" />

       function onOcrFields(fields) {
         if (fields.insuredName)  form.value.insuredName  = fields.insuredName
         if (fields.policyNumber) form.value.policyNumber = fields.policyNumber
         // merge whichever fields your active template uses
       }
-->

<template>
  <div class="ocr-uploader">

    <!-- ── Drop Zone ─────────────────────────────────────────────────────── -->
    <div
      class="drop-zone"
      :class="{ 'drop-zone--over': isDragging, 'drop-zone--done': !!ocrFields, 'drop-zone--error': !!ocrError }"
      @dragover.prevent="isDragging = true"
      @dragleave="isDragging = false"
      @drop.prevent="onDrop"
      @click="openFilePicker"
    >
      <!-- idle state -->
      <template v-if="!ocrLoading && !ocrFields && !ocrError">
        <q-icon name="upload_file" size="2rem" class="drop-icon" />
        <p class="drop-label">Drop a document to auto-fill fields</p>
        <p class="drop-sub">JPG · PNG · PDF · BMP · TIFF · WebP &nbsp;·&nbsp; max 5 MB</p>
      </template>

      <!-- loading -->
      <template v-else-if="ocrLoading">
        <q-circular-progress
          :value="ocrProgress"
          size="2.2rem"
          :thickness="0.18"
          color="primary"
          track-color="grey-3"
          class="q-mb-sm"
        />
        <p class="drop-label">Reading <strong>{{ ocrFileName }}</strong>…</p>
        <p class="drop-sub">{{ ocrProgress }}% — extracting text via OCR</p>
      </template>

      <!-- success -->
      <template v-else-if="ocrFields && !ocrError">
        <q-icon name="check_circle" size="1.8rem" color="positive" class="drop-icon" />
        <p class="drop-label text-positive">{{ foundCount }} field{{ foundCount !== 1 ? 's' : '' }} found</p>
        <p class="drop-sub">{{ ocrFileName }}</p>
      </template>

      <!-- error -->
      <template v-else-if="ocrError">
        <q-icon name="error_outline" size="1.8rem" color="negative" class="drop-icon" />
        <p class="drop-label text-negative">Extraction failed</p>
        <p class="drop-sub">{{ ocrError }}</p>
      </template>

      <input ref="fileInput" type="file" accept=".jpg,.jpeg,.png,.pdf,.bmp,.tiff,.webp" class="hidden-input" @change="onFileChange" />
    </div>

    <!-- ── Reset / Re-upload ─────────────────────────────────────────────── -->
    <div v-if="ocrFields || ocrError" class="row justify-end q-mt-xs">
      <q-btn flat dense size="sm" icon="refresh" label="Try another file" color="grey-7" @click="reset" />
    </div>

    <!-- ── Extracted Fields Panel ────────────────────────────────────────── -->
    <transition name="slide-in">
      <div v-if="ocrFields" class="fields-panel q-mt-sm">
        <div class="fields-header row items-center q-mb-xs">
          <span class="fields-title">Extracted Fields</span>
          <q-space />
          <q-btn
            unelevated
            dense
            size="sm"
            color="primary"
            icon="auto_fix_high"
            label="Apply All"
            @click="applyAll"
          />
        </div>

        <div class="fields-grid">
          <div
            v-for="(value, key) in nonNullFields"
            :key="key"
            class="field-chip"
            :class="{ 'field-chip--applied': appliedKeys.has(key) }"
            @click="applyField(key, value)"
          >
            <div class="field-chip__label">{{ fieldLabel(key) }}</div>
            <div class="field-chip__value">{{ value }}</div>
            <q-icon
              class="field-chip__check"
              :name="appliedKeys.has(key) ? 'check' : 'add'"
              size="14px"
            />
          </div>
        </div>

        <div v-if="Object.keys(nonNullFields).length === 0" class="text-grey-6 text-caption q-pa-sm">
          No recognisable insurance fields found. You may need a clearer scan.
        </div>
      </div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useOcr } from 'src/composables/useOcr'

const emit = defineEmits(['fields-extracted', 'field-applied'])

const { ocrLoading, ocrError, ocrFields, ocrFileName, ocrProgress, uploadAndExtract, resetOcr, fieldLabel } = useOcr()

const isDragging  = ref(false)
const fileInput   = ref(null)
const appliedKeys = ref(new Set())

// ── Computed ──────────────────────────────────────────────────────────────────
const nonNullFields = computed(() => {
  if (!ocrFields.value) return {}
  return Object.fromEntries(
    Object.entries(ocrFields.value).filter(([, v]) => v !== null)
  )
})

const foundCount = computed(() => Object.keys(nonNullFields.value).length)

// ── File handling ─────────────────────────────────────────────────────────────
function openFilePicker () {
  if (ocrLoading.value) return
  fileInput.value?.click()
}

function onFileChange (e) {
  const file = e.target.files?.[0]
  if (file) processFile(file)
}

function onDrop (e) {
  isDragging.value = false
  const file = e.dataTransfer.files?.[0]
  if (file) processFile(file)
}

async function processFile (file) {
  appliedKeys.value = new Set()
  const result = await uploadAndExtract(file)
  if (result) {
    emit('fields-extracted', result.fields)
  }
}

// ── Apply ─────────────────────────────────────────────────────────────────────
function applyField (key, value) {
  appliedKeys.value = new Set([...appliedKeys.value, key])
  emit('field-applied', { key, value })
}

function applyAll () {
  const fields = nonNullFields.value
  appliedKeys.value = new Set(Object.keys(fields))
  emit('fields-extracted', fields)
}

// ── Reset ─────────────────────────────────────────────────────────────────────
function reset () {
  resetOcr()
  appliedKeys.value = new Set()
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<style scoped>
/* ── Drop Zone ──────────────────────────────────────────────────────────────── */
.drop-zone {
  border: 1.5px dashed #c5c9d1;
  border-radius: 10px;
  padding: 20px 16px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s;
  background: #fafbfc;
  user-select: none;
}
.drop-zone:hover      { border-color: #6a7bff; background: #f4f5ff; }
.drop-zone--over      { border-color: #6a7bff; background: #eef0ff; border-style: solid; }
.drop-zone--done      { border-color: #22c55e; background: #f0fdf4; border-style: solid; }
.drop-zone--error     { border-color: #ef4444; background: #fff5f5; border-style: solid; }

.drop-icon   { color: #9ca3af; margin-bottom: 6px; }
.drop-label  { margin: 0; font-size: 13px; font-weight: 500; color: #374151; }
.drop-sub    { margin: 4px 0 0; font-size: 11px; color: #9ca3af; }
.hidden-input { display: none; }

/* ── Fields Panel ───────────────────────────────────────────────────────────── */
.fields-panel {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  background: #fff;
}
.fields-title {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.fields-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* ── Field Chips ────────────────────────────────────────────────────────────── */
.field-chip {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 6px 26px 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  background: #f9fafb;
  transition: border-color 0.15s, background 0.15s;
  min-width: 110px;
  max-width: 200px;
}
.field-chip:hover {
  border-color: #6a7bff;
  background: #f0f1ff;
}
.field-chip--applied {
  border-color: #22c55e;
  background: #f0fdf4;
}
.field-chip__label {
  font-size: 10px;
  font-weight: 500;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: .03em;
  margin-bottom: 2px;
}
.field-chip__value {
  font-size: 12px;
  color: #111827;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.field-chip__check {
  position: absolute;
  top: 6px;
  right: 6px;
  color: #9ca3af;
}
.field-chip--applied .field-chip__check { color: #22c55e; }

/* ── Transition ─────────────────────────────────────────────────────────────── */
.slide-in-enter-active { transition: all 0.25s ease; }
.slide-in-enter-from   { opacity: 0; transform: translateY(-8px); }
</style>