const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'sh', 'bash', 'zsh', 'ps1', 'vbs', 'vbe',
  'js', 'jse', 'wsf', 'wsh', 'msi', 'dll', 'sys', 'drv',
  'py', 'rb', 'pl', 'php', 'jar', 'class',
  'reg', 'scr', 'pif', 'hta', 'cpl',
])

const ALLOWED_EMAIL = new Set(['jpg', 'jpeg', 'png', 'pdf'])

const ALLOWED_OCR = new Set(['jpg', 'jpeg', 'png', 'pdf'])

const MAX_BYTES_EMAIL = 25 * 1024 * 1024
const MAX_BYTES_OCR   =  1 * 1024 * 1024  // OCR.space free tier hard limit

function ext (filename) {
  return (filename.split('.').pop() || '').toLowerCase()
}

// Returns { ok: true } or { ok: false, reason: string }
export function validateFile (file, context = 'email') {
  const e = ext(file.name)

  if (BLOCKED_EXTENSIONS.has(e)) {
    return { ok: false, reason: `Executable or script file blocked (.${e})` }
  }

  const allowed = context === 'ocr' ? ALLOWED_OCR : ALLOWED_EMAIL
  if (!allowed.has(e)) {
    return { ok: false, reason: `File type not allowed (.${e})` }
  }

  const maxBytes = context === 'ocr' ? MAX_BYTES_OCR : MAX_BYTES_EMAIL
  const maxLabel = context === 'ocr' ? '1 MB' : '25 MB'
  if (file.size > maxBytes) {
    return { ok: false, reason: `File too large — ${(file.size / 1024 / 1024).toFixed(1)} MB (max ${maxLabel} for ${context === 'ocr' ? 'OCR' : 'attachments'})` }
  }

  return { ok: true }
}
