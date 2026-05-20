// src/composables/useZoho.js
// Zoho OAuth + Send Email with Attachments

import { ref } from 'vue'

// ── Constants ─────────────────────────────────────────────────────────────────
// CLIENT_ID: identifies this app to Zoho. Registered in the Zoho developer console.
const CLIENT_ID    = '1000.S3IJADF48CR3220NYR50SPRMF8OG2I'

// REDIRECT_URL: where Zoho sends the browser after login. Must match exactly
// what is registered in the Zoho developer console. Points to redirect.html.
const REDIRECT_URL = 'http://localhost:9000/redirect.html'

// SCOPE: the permissions this app is requesting from Zoho.
//   ZohoMail.messages.ALL  → read and send emails
//   ZohoMail.accounts.READ → read the account ID and mailbox address
//   ZohoMail.folders.ALL   → access mail folders
const SCOPE        = 'ZohoMail.messages.ALL,ZohoMail.accounts.READ,ZohoMail.folders.ALL'

// API_BASE: the Laravel backend URL. All fetch calls go here.
const API_BASE     = 'http://127.0.0.1:8000/api'

// ── Token helpers (exported so other modules can read identity) ───────────────

// Returns the logged-in user's email, used to tag SIEM security events.
// Falls back to 'staff_user' if not yet authenticated.
export function getSiemUserId() {
  return localStorage.getItem('siem_user_email') || 'staff_user'
}

// Returns the Sanctum Bearer token saved after login.
// This token is sent in the Authorization header on every Laravel API call.
export function getSanctumToken() {
  return localStorage.getItem('sanctum_token')
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useZoho() {
  // isSending: true while an email send is in progress — used to show loading spinner
  const isSending   = ref(false)
  // mergeStatus: tracks PDF merge progress — null | 'merging' | 'done' | 'error'
  const mergeStatus = ref(null)
  // sendError: holds the error message string if a send fails, null otherwise
  const sendError   = ref(null)

  // ── Auth ──────────────────────────────────────────────────────────────────

  // Opens the Zoho login page in a new tab.
  // Zoho will redirect back to redirect.html with the token after the user logs in.
  function authZoho() {
    const url =
      `https://accounts.zoho.com/oauth/v2/auth` +
      `?response_type=token` +           // implicit flow — token returned directly in URL
      `&client_id=${CLIENT_ID}` +
      `&scope=${SCOPE}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URL)}`  // must be URL-encoded
    window.open(url, '_blank')           // opens in a new tab, not the current one
  }

  // Reads the raw Zoho access token from localStorage (saved by redirect.html).
  function getToken() {
    return localStorage.getItem('zoho_access_token')
  }

  // Returns true if a Zoho token exists in localStorage (user has logged in).
  function isAuthenticated() {
    return !!getToken()    // !! converts the string to a boolean
  }

  // Returns true if the Zoho token is present AND less than 55 minutes old.
  // Zoho tokens expire after ~60 minutes. We use 55 as a safety margin so
  // the warning banner appears before the token actually dies mid-send.
  function isTokenValid() {
    const token = getToken()
    if (!token) return false
    const savedAt = localStorage.getItem('zoho_token_saved_at')
    if (!savedAt) return true    // no timestamp saved — assume valid
    const ageMinutes = (Date.now() - parseInt(savedAt)) / 60000
    return ageMinutes < 55
  }

  // Returns how many whole minutes old the current Zoho token is.
  // Used by the composer to display "Token expires in X minutes".
  function getTokenAgeMinutes() {
    const savedAt = localStorage.getItem('zoho_token_saved_at')
    if (!savedAt) return 0
    return Math.floor((Date.now() - parseInt(savedAt)) / 60000)
  }

  // Wipes all auth data from localStorage — called on logout.
  function clearSession() {
    localStorage.removeItem('zoho_access_token')
    localStorage.removeItem('zoho_token_saved_at')
    localStorage.removeItem('sanctum_token')
    localStorage.removeItem('siem_user_email')
  }

  // ── Send Email ────────────────────────────────────────────────────────────
  // @param {Object} params
  //   to             string[]  — TO addresses
  //   cc             string[]  — CC addresses
  //   subject        string
  //   content        string    — rendered HTML
  //   attachments    File[]    — raw File objects
  //   attachmentMode string    — 'merge' | 'separate'
  //   company        string    — company name (for SIEM log)
  //   template       string    — template key (for SIEM log)
  async function sendEmail({
    to,
    cc,
    subject,
    content,
    attachments = [],
    attachmentMode = 'merge',
    company = '',
    template = '',
  }) {
    // Reset all state before starting a new send
    sendError.value   = null
    isSending.value   = true
    mergeStatus.value = null

    const zohoToken    = getToken()
    const sanctumToken = getSanctumToken()

    // Guard: cannot send without a Zoho token
    if (!zohoToken) {
      sendError.value = 'Not authenticated with Zoho. Please click Auth Email first.'
      isSending.value = false
      throw new Error(sendError.value)
    }

    try {
      // ── Step 1: Get Zoho account info ──────────────────────────────────────
      // We need the accountId and mailboxAddress before we can send.
      // We POST both tokens to Laravel, which calls the Zoho accounts API
      // and returns the account details.
      const accountRes = await fetch(`${API_BASE}/zoho/accounts`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sanctumToken}`,  // proves identity to Laravel
        },
        body: JSON.stringify({ token: zohoToken }),   // Laravel forwards this to Zoho
      })

      if (!accountRes.ok) {
        const err = await accountRes.json()
        throw new Error(err.error || 'Failed to fetch Zoho account')
      }

      const { accountId, mailboxAddress } = await accountRes.json()
      // Keep siem_user_email fresh in case the user re-authed with a different account
      localStorage.setItem('siem_user_email', mailboxAddress)

      // ── Step 2: Build the FormData payload ────────────────────────────────
      // FormData is used (instead of JSON) because we need to attach binary files.
      // When there are attachments, show the 'merging' spinner — Laravel will
      // merge them into a single PDF before sending.
      if (attachments.length > 0) {
        mergeStatus.value = 'merging'
      }

      const formData = new FormData()
      formData.append('token',          zohoToken)
      formData.append('accountId',      accountId)
      formData.append('fromAddress',    mailboxAddress)
      // If to/cc are arrays, join them into a comma-separated string for Laravel
      formData.append('toAddress',      Array.isArray(to) ? to.join(',') : to)
      formData.append('ccAddress',      Array.isArray(cc) ? cc.join(',') : (cc || ''))
      formData.append('subject',        subject)
      formData.append('htmlBody',       content)
      formData.append('attachmentMode', attachmentMode)
      // company and template are passed through to the LogSecurityEvent middleware
      // so SIEM events show which company and template this send was for
      formData.append('company',        company)
      formData.append('template',       template)

      // Append each file under the key 'files[]' — Laravel reads them as an array
      for (const file of attachments) {
        formData.append('files[]', file)
      }

      // ── Step 3: Send to Laravel ────────────────────────────────────────────
      // Laravel receives the files, merges PDFs using FPDF, then calls the
      // Zoho Mail API to actually send the email.
      const sendRes = await fetch(`${API_BASE}/zoho/sendEmailwAttachments`, {
        method:  'POST',
        headers: {
          'Accept':        'application/json',
          'Authorization': `Bearer ${sanctumToken}`,
          // NOTE: Do NOT set Content-Type manually — the browser sets it automatically
          // with the correct multipart/form-data boundary when body is FormData.
          // Setting it manually would break the file upload.
        },
        body: formData,
      })

      const result = await sendRes.json()

      if (!sendRes.ok) {
        // 422 = Laravel validation error — extract the first field's message
        if (sendRes.status === 422 && result.errors) {
          const firstField = Object.keys(result.errors)[0]
          const firstMsg   = result.errors[firstField][0]
          throw new Error(`Validation failed — ${firstField}: ${firstMsg}`)
        }
        throw new Error(result.error || result.message || 'Send failed')
      }

      // Success — update status and return the Zoho message ID for the sent log
      mergeStatus.value = attachments.length > 0 ? 'done' : null
      isSending.value   = false
      return { success: true, zohoMessageId: result.zohoMessageId ?? null }

    } catch (err) {
      // On any failure, store the error message and reset loading states
      sendError.value   = err.message
      mergeStatus.value = attachments.length > 0 ? 'error' : null
      isSending.value   = false
      throw err    // re-throw so the caller (IndexPage) can show a notification
    }
  }

  // Everything returned here becomes available to any component that calls useZoho()
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
