// src/composables/useBahrainLookup.js
// Calls the Genie (Node.js/Selenium) server to scrape bahrain.bh
// and listens to Firestore for the result in real time

import { ref } from 'vue'
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import { db } from 'src/firebase/config'

const GENIE_URL = 'http://localhost:3001/api/scrape'

// Registration type map — matches your governmentType form values
// to the dropdown IDs used by bahrain.bh
const REG_TYPE_IDS = {
  private:    '01',
  government: '02',
  commercial: '03',
}

export function useBahrainLookup() {
  const lookupLoading = ref(false)
  const lookupError   = ref(null)
  const lookupResult  = ref(null)

  // ── Run the scraper ────────────────────────────────────────────────────────
  // @param {string} cpr           - CPR number (individual) or CR number (company)
  // @param {string} plateno       - Vehicle plate number
  // @param {boolean} company      - true = CR lookup, false = CPR lookup
  // @param {string} regTypeID     - Registration type ID from REG_TYPE_MAP (default '01' = Private)
  async function runLookup({ cpr, plateno, company = false, regTypeID = '01' }) {
    lookupLoading.value = true
    lookupError.value   = null
    lookupResult.value  = null

    try {
      const res = await fetch(GENIE_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ cpr, plateno, company, regTypeID }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Scrape failed')

      lookupResult.value = data
      return data

    } catch (err) {
      // Check if the Genie server is not running
      if (err.message.includes('fetch') || err.message.includes('network')) {
        lookupError.value = 'Genie server is not running. Start it with: cd server && npm start'
      } else {
        lookupError.value = err.message
      }
      return null

    } finally {
      lookupLoading.value = false
    }
  }

  // ── Listen to the latest traffic record in Firestore ──────────────────────
  // Returns the unsubscribe function — call it in onUnmounted
  // callback receives: { plateNo, chassisNo, engineNo, color, yearOfMake,
  //                      regType, screenshotUrls, pdfUrl, ... }
  function listenToLatestRecord(callback) {
    const q = query(
      collection(db, 'traffic_records'),
      orderBy('createdAt', 'desc'),
      limit(1)
    )

    return onSnapshot(q, snap => {
      if (!snap.empty) {
        const docSnap = snap.docs[0]
        callback({ id: docSnap.id, ...docSnap.data() })
      }
    })
  }

  function resetLookup() {
    lookupLoading.value = false
    lookupError.value   = null
    lookupResult.value  = null
  }

  return {
    lookupLoading,
    lookupError,
    lookupResult,
    runLookup,
    listenToLatestRecord,
    resetLookup,
  }
}