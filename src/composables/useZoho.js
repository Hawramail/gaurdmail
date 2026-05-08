// src/composables/useZoho.js
// Zoho OAuth + Send Email with Attachments

import { ref } from 'vue'

const CLIENT_ID    = '1000.S3IJADF48CR3220NYR50SPRMF8OG2I'
const REDIRECT_URL = 'http://localhost:9000/redirect.html'
const SCOPE        = 'ZohoMail.messages.ALL,ZohoMail.accounts.READ,ZohoMail.folders.ALL'
const API_BASE = 'http://127.0.0.1:8000/api'

export function useZoho() {
  const isSending   = ref(false)
  const mergeStatus = ref(null) // null | 'merging' | 'done' | 'error'
  const sendError   = ref(null)

  // ── Auth ──────────────────────────────────────────────────────────
  function authZoho() {
    const url =
      `https://accounts.zoho.com/oauth/v2/auth` +
      `?response_type=token` +
      `&client_id=${CLIENT_ID}` +
      `&scope=${SCOPE}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URL)}`
    window.open(url, '_blank')
  }

  function getToken() {
    return localStorage.getItem('zoho_access_token')
  }

  function isAuthenticated() {
    return !!getToken()
  }

  function isTokenValid() {
    const token = getToken()
    if (!token) return false
    const savedAt = localStorage.getItem('zoho_token_saved_at')
    if (!savedAt) return true // assume valid if no timestamp saved
    const ageMinutes = (Date.now() - parseInt(savedAt)) / 60000
    return ageMinutes < 55
  }

  function getTokenAgeMinutes() {
    const savedAt = localStorage.getItem('zoho_token_saved_at')
    if (!savedAt) return 0
    return Math.floor((Date.now() - parseInt(savedAt)) / 60000)
  }

  function clearSession() {
    localStorage.removeItem('zoho_access_token')
    localStorage.removeItem('zoho_token_saved_at')
  }

  // ── Send Email ────────────────────────────────────────────────────
  // @param {Object} params
  //   to          string[]  — TO addresses array
  //   cc          string[]  — CC addresses array
  //   subject     string
  //   content         string    — rendered HTML template string
  //   attachments     File[]    — raw File objects from q-file
  //   attachmentMode  string    — 'merge' | 'separate'
  async function sendEmail({ to, cc, subject, content, attachments = [], attachmentMode = 'merge' }) {
    sendError.value   = null
    isSending.value   = true
    mergeStatus.value = null

    const token = getToken()
    if (!token) {
      sendError.value = 'Not authenticated with Zoho. Please click Auth Email first.'
      isSending.value = false
      throw new Error(sendError.value)
    }

    try {
      // Step 1 — Get Zoho account info
      const accountRes = await fetch(`${API_BASE}/zoho/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      if (!accountRes.ok) {
        const err = await accountRes.json()
        throw new Error(err.error || 'Failed to fetch Zoho account')
      }

      const { accountId, mailboxAddress } = await accountRes.json()

      // Step 2 — Build FormData (multipart so files travel together)
      if (attachments.length > 0) {
        mergeStatus.value = 'merging'
      }

      const formData = new FormData()
      formData.append('token',          token)
      formData.append('accountId',      accountId)
      formData.append('fromAddress',    mailboxAddress)
      formData.append('toAddress',      Array.isArray(to) ? to.join(',') : to)
      formData.append('ccAddress',      Array.isArray(cc) ? cc.join(',') : (cc || ''))
      formData.append('subject',        subject)
      formData.append('htmlBody',       content)
      formData.append('attachmentMode', attachmentMode)

      for (const file of attachments) {
        formData.append('files[]', file)
      }

      // Step 3 — Send (Laravel handles merge + Zoho send)
      const sendRes = await fetch(`${API_BASE}/zoho/sendEmailwAttachments`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData,
        // NOTE: Do NOT set Content-Type — browser sets it with boundary automatically
      })

      const result = await sendRes.json()

      if (!sendRes.ok) {
        if (sendRes.status === 422 && result.errors) {
          const firstField = Object.keys(result.errors)[0]
          const firstMsg = result.errors[firstField][0]
          throw new Error(`Validation failed — ${firstField}: ${firstMsg}`)
        }
        throw new Error(result.error || result.message || 'Send failed')
      }

      mergeStatus.value = attachments.length > 0 ? 'done' : null
      isSending.value   = false
      return { success: true }

    } catch (err) {
      sendError.value   = err.message
      mergeStatus.value = attachments.length > 0 ? 'error' : null
      isSending.value   = false
      throw err // re-throw so handleSendEmail catch block works
    }
  }

  return {
    authZoho,
    getToken,
    isAuthenticated,
    isTokenValid,
    getTokenAgeMinutes,
    clearSession,
    sendEmail,
    isSending,
    mergeStatus,
    sendError,
  }
}