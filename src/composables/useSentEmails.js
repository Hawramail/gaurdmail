// src/composables/useSentEmails.js

import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore'
import { ref } from 'vue'
import { db } from 'src/firebase/config'

export function useSentEmails () {
  const sentEmails   = ref([])
  let   unsubscribe  = null

  // ── Save a sent email record ─────────────────────────────────────────────
  //
  // Call this from SendEmailPage after a successful send:
  //
  //   await this.saveSentEmail({
  //     to:              this.form.to,
  //     cc:              this.form.cc,
  //     subject:         this.form.subject,
  //     template:        this.form.template,
  //     companyId:       this.form.company,
  //     companyName:     this.companies.find(c => c.id === this.form.company)?.name || '',
  //     attachmentCount: attachments.length,
  //     user:            'staff',   // replace with real auth user when auth is added
  //   })
  //
  async function saveSentEmail (payload) {

    // ── Sanitise email arrays ───────────────────────────────────────────────
    // q-select sometimes wraps values in Markdown link syntax when the input
    // value contains special characters, e.g. "[email@x.com](mailto:email@x.com)".
    // Strip that down to a plain address.
    const cleanEmails = (arr) => {
      if (!Array.isArray(arr)) return []
      return arr.map(e => {
        if (typeof e !== 'string') return String(e)
        // Match [display](mailto:addr) or [display](addr)
        const mdLink = e.match(/^\[.*?\]\((?:mailto:)?([^\)]+)\)$/)
        return mdLink ? mdLink[1].trim() : e.trim()
      }).filter(Boolean)
    }

    const record = {
      // Who / when
      sentAt:          serverTimestamp(),
      user:            payload.user || 'staff',

      // Email metadata
      subject:         payload.subject         || '',
      template:        payload.template        || '',

      // Store both ID and display name so the history page can filter
      // by ID (fast) but display the human-readable name without a join
      companyId:       payload.companyId       || payload.company || '',
      companyName:     payload.companyName     || '',

      // Cleaned recipient arrays — never raw q-select objects
      to:              cleanEmails(payload.to),
      cc:              cleanEmails(payload.cc),

      attachmentCount: Number(payload.attachmentCount) || 0,
    }

    await addDoc(collection(db, 'sent_emails'), record)
  }

  // ── Real-time listener for the history page ──────────────────────────────
  function startListening () {
    const q  = query(collection(db, 'sent_emails'), orderBy('sentAt', 'desc'))

    unsubscribe = onSnapshot(q, (snapshot) => {
      sentEmails.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore Timestamp → JS Date for easy display
        sentAtDate: doc.data().sentAt?.toDate?.() || null,
      }))
    })
  }

  function stopListening () {
    if (unsubscribe) { unsubscribe(); unsubscribe = null }
  }

  return { saveSentEmail, sentEmails, startListening, stopListening }
}