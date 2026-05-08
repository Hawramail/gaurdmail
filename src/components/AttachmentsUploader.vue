<template>
  <div class="attachments-panel">
    <!-- Drop zone -->
    <div
      class="drop-zone"
      :class="{ 'drop-zone--active': isDragging, 'drop-zone--has-files': files.length > 0 }"
      @dragenter.prevent="isDragging = true"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
      @click="$refs.fileInput.click()"
    >
      <input
        ref="fileInput"
        type="file"
        multiple
        class="hidden-input"
        @change="onFileInputChange"
      />

      <div v-if="files.length === 0" class="drop-zone__empty">
        <q-icon name="upload_file" size="32px" class="drop-icon" />
        <p class="drop-text">Drop files here or <span class="drop-link">browse</span></p>
        <p class="drop-hint">PDF, images, Word, Excel — any file type</p>
      </div>

      <div v-else class="drop-zone__add-more">
        <q-icon name="add" size="18px" />
        <span>Add more files</span>
      </div>
    </div>

    <!-- File list -->
    <transition-group name="file-list" tag="div" class="file-list" v-if="files.length > 0">
      <div
        v-for="(file, index) in files"
        :key="file.name + file.size"
        class="file-item"
      >
        <!-- Icon by type -->
        <div class="file-icon" :class="fileIconClass(file)">
          <q-icon :name="fileIconName(file)" size="20px" />
        </div>

        <!-- Info -->
        <div class="file-info">
          <p class="file-name">{{ file.name }}</p>
          <p class="file-meta">{{ formatSize(file.size) }} · {{ fileTypLabel(file) }}</p>
        </div>

        <!-- Status -->
        <div class="file-status">
          <q-icon name="check_circle" color="positive" size="18px" />
        </div>

        <!-- Remove -->
        <q-btn
          flat
          round
          dense
          icon="close"
          size="sm"
          class="remove-btn"
          @click.stop="removeFile(index)"
        />
      </div>
    </transition-group>

    <!-- Footer summary -->
    <div v-if="files.length > 0" class="attachments-footer">
      <span class="file-count">
        <q-icon name="attach_file" size="14px" />
        {{ files.length }} file{{ files.length !== 1 ? 's' : '' }} · {{ totalSizeFormatted }}
      </span>
      <q-btn
        flat
        dense
        label="Clear all"
        size="sm"
        color="negative"
        @click="clearAll"
      />
    </div>

    <!-- Merge status (shown when sending) -->
    <div v-if="mergeStatus" class="merge-status" :class="mergeStatusClass">
      <q-spinner v-if="mergeStatus === 'merging'" size="14px" />
      <q-icon v-else-if="mergeStatus === 'done'" name="check" size="14px" />
      <q-icon v-else-if="mergeStatus === 'error'" name="error_outline" size="14px" />
      <span>{{ mergeStatusText }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// Props & emits
const props = defineProps({
  mergeStatus: {
    type: String,
    default: null // null | 'merging' | 'done' | 'error'
  }
})

const emit = defineEmits(['update:files'])

// State
const files = ref([])
const isDragging = ref(false)

// Computed
const totalSize = computed(() => files.value.reduce((sum, f) => sum + f.size, 0))
const totalSizeFormatted = computed(() => formatSize(totalSize.value))

const mergeStatusText = computed(() => {
  if (props.mergeStatus === 'merging') return 'Merging attachments into PDF…'
  if (props.mergeStatus === 'done') return 'Attachments merged successfully'
  if (props.mergeStatus === 'error') return 'Merge failed — check Laravel logs'
  return ''
})

const mergeStatusClass = computed(() => ({
  'merge-status--merging': props.mergeStatus === 'merging',
  'merge-status--done': props.mergeStatus === 'done',
  'merge-status--error': props.mergeStatus === 'error'
}))

// Methods
function onDrop(e) {
  isDragging.value = false
  addFiles(Array.from(e.dataTransfer.files))
}

function onFileInputChange(e) {
  addFiles(Array.from(e.target.files))
  e.target.value = '' // reset so same file can be re-added
}

function addFiles(newFiles) {
  const existing = new Set(files.value.map(f => f.name + f.size))
  const unique = newFiles.filter(f => !existing.has(f.name + f.size))
  files.value = [...files.value, ...unique]
  emit('update:files', files.value)
}

function removeFile(index) {
  files.value.splice(index, 1)
  emit('update:files', files.value)
}

function clearAll() {
  files.value = []
  emit('update:files', [])
}

// Helpers
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function fileTypLabel(file) {
  const ext = file.name.split('.').pop().toUpperCase()
  return ext || 'File'
}

function fileIconName(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'pdf') return 'picture_as_pdf'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  if (['doc', 'docx'].includes(ext)) return 'description'
  if (['xls', 'xlsx'].includes(ext)) return 'table_chart'
  if (['ppt', 'pptx'].includes(ext)) return 'slideshow'
  if (['zip', 'rar', '7z'].includes(ext)) return 'folder_zip'
  return 'insert_drive_file'
}

function fileIconClass(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'pdf') return 'file-icon--pdf'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'file-icon--img'
  if (['doc', 'docx'].includes(ext)) return 'file-icon--word'
  if (['xls', 'xlsx'].includes(ext)) return 'file-icon--excel'
  return 'file-icon--generic'
}

// Expose files array for parent (SendEmailPage) to access when sending
defineExpose({ files })
</script>

<style scoped>
.attachments-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Drop Zone */
.drop-zone {
  border: 1.5px dashed #9ba3af;
  border-radius: 10px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: rgba(255,255,255,0.02);
  text-align: center;
}
.drop-zone:hover,
.drop-zone--active {
  border-color: var(--q-primary, #1976d2);
  background: rgba(25, 118, 210, 0.04);
}
.drop-zone--has-files {
  padding: 10px 16px;
}
.drop-zone__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.drop-icon {
  color: #9ba3af;
  margin-bottom: 4px;
}
.drop-text {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}
.drop-link {
  color: var(--q-primary, #1976d2);
  text-decoration: underline;
  cursor: pointer;
}
.drop-hint {
  margin: 0;
  font-size: 11px;
  color: #9ba3af;
}
.drop-zone__add-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: var(--q-primary, #1976d2);
}
.hidden-input {
  display: none;
}

/* File list */
.file-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.file-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  transition: background 0.15s;
}
.body--dark .file-item {
  background: #1e2a36;
  border-color: #2d3f50;
}
.file-item:hover { background: #f3f4f6; }
.body--dark .file-item:hover { background: #243040; }

.file-icon {
  width: 36px;
  height: 36px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.file-icon--pdf   { background: #fde8e8; color: #dc2626; }
.file-icon--img   { background: #e0f2fe; color: #0284c7; }
.file-icon--word  { background: #dbeafe; color: #1d4ed8; }
.file-icon--excel { background: #dcfce7; color: #16a34a; }
.file-icon--generic { background: #f3f4f6; color: #6b7280; }

.file-info {
  flex: 1;
  min-width: 0;
}
.file-name {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #111827;
}
.body--dark .file-name { color: #f1f5f9; }
.file-meta {
  margin: 0;
  font-size: 11px;
  color: #9ba3af;
}

.file-status { margin-left: auto; }
.remove-btn { color: #9ba3af !important; }
.remove-btn:hover { color: #dc2626 !important; }

/* Footer */
.attachments-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px;
}
.file-count {
  font-size: 11px;
  color: #9ba3af;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Merge status bar */
.merge-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
}
.merge-status--merging { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
.merge-status--done    { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
.merge-status--error   { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }

/* Transitions */
.file-list-enter-active, .file-list-leave-active { transition: all 0.2s ease; }
.file-list-enter-from { opacity: 0; transform: translateY(-6px); }
.file-list-leave-to   { opacity: 0; transform: translateX(10px); }
</style>