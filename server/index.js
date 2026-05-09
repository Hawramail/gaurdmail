// server/index.js
// GuardMail — Genie (Selenium) Server
// Runs as a separate Node.js process on http://localhost:3001
// Vue app calls POST /api/scrape to trigger the bahrain.bh lookup

const express    = require('express')
const cors       = require('cors')
const bodyParser = require('body-parser')
const admin      = require('firebase-admin')
const path       = require('path')

const { searchTrafficRecord } = require('./scrapers/bahrain')

const app = express()
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

// ── Firebase Admin init ────────────────────────────────────────────────────
// Place your Firebase service account key at server/firebase-service-account.json
// Download it from: Firebase Console → Project Settings → Service Accounts → Generate new private key
const serviceAccount = require('./firebase-service-account.json')

admin.initializeApp({
  credential:    admin.credential.cert(serviceAccount),
  storageBucket: 'gs://mailgaurd-2d6dc.firebasestorage.app',
})

const db     = admin.firestore()
const bucket = admin.storage().bucket('gs://mailgaurd-2d6dc.firebasestorage.app')

// ── POST /api/scrape ───────────────────────────────────────────────────────
// Body: { cpr, plateno, company (bool), regTypeID }
// Returns: { success, vehicleData, screenshots, pdfUrl, firestoreDocId }
app.post('/api/scrape', async (req, res) => {
  const { cpr, plateno, company, regTypeID } = req.body

  if (!cpr || !plateno) {
    return res.status(400).json({ error: 'cpr and plateno are required' })
  }

  console.log(`[Genie] Scraping — plateno: ${plateno}, cpr: ${cpr}, company: ${!!company}`)

  try {
    const result = await searchTrafficRecord(
      {
        cpr,
        plateno,
        company:   !!company,
        regTypeID: regTypeID || '01',
      },
      bucket,
      db
    )

    console.log('[Genie] Scrape complete:', result.firestoreDocId)
    res.json({ success: true, ...result })

  } catch (err) {
    console.error('[Genie] Scrape error:', err.message)
    res.status(500).json({ error: err.message || 'Scrape failed' })
  }
})

// ── Health check ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'guardmail-genie' })
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`Genie server running on http://localhost:${PORT}`)
  console.log('Waiting for scrape requests from Vue app...')
})