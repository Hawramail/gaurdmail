<template>
  <q-layout>
    <q-page-container>
      <q-page class="flex flex-center">
        <div style="text-align: center;">
          <div class="text-bold text-h5 q-mb-md">You are authorized to send Mails</div>
          <q-icon name="check_circle" color="positive" size="64px" />
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script>
const API_BASE = 'http://127.0.0.1:8000/api'

export default {
  async mounted() {
    const fullHash   = window.location.hash
    const secondHash = fullHash.split('#')[2] || fullHash.split('#')[1]
    const urlParams  = new URLSearchParams(secondHash)
    const zohoToken  = urlParams.get('access_token')

    if (!zohoToken) {
      console.error('Access token not found in redirect URL')
      return
    }

    // Persist the raw Zoho token (used by useZoho.js to call the Zoho API directly)
    localStorage.setItem('zoho_access_token', zohoToken)
    localStorage.setItem('zoho_token_saved_at', Date.now().toString())

    // Exchange the Zoho token for a Sanctum session token.
    // The backend verifies the token with Zoho, so we know the identity is real.
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token: zohoToken }),
      })

      if (res.ok) {
        const { token, mailboxAddress } = await res.json()
        localStorage.setItem('sanctum_token',   token)
        localStorage.setItem('siem_user_email', mailboxAddress)
      } else {
        console.error('Sanctum login failed:', await res.text())
      }
    } catch (err) {
      // Non-fatal — the user can still use the app; identity will be missing from logs
      console.error('Could not establish API session:', err.message)
    }
  },
}
</script>
