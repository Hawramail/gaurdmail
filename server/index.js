const express = require('express')
const cors    = require('cors')
const { lookupCPR, lookupVehicle } = require('./scrapers/bahrain')

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: 'http://localhost:9000' })) // Quasar dev port
app.use(express.json())

// ── CPR / Person lookup ────────────────────────────────────────────────────
// POST /api/lookup/cpr  { cpr: "041002130" }
// → { name, nationality, dob, address, ... }
app.post('/api/lookup/cpr', async (req, res) => {
  const { cpr } = req.body
  if (!cpr || !/^\d{8,10}$/.test(cpr.trim())) {
    return res.status(400).json({ error: 'Invalid CPR number (8-10 digits required)' })
  }
  try {
    const result = await lookupCPR(cpr.trim())
    res.json(result)
  } catch (err) {
    console.error('[CPR lookup]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Vehicle / Plate lookup ─────────────────────────────────────────────────
// POST /api/lookup/vehicle  { plate: "12345" }
// → { make, model, year, chassisNumber, color, ... }
app.post('/api/lookup/vehicle', async (req, res) => {
  const { plate } = req.body
  if (!plate || plate.trim().length < 2) {
    return res.status(400).json({ error: 'Invalid plate number' })
  }
  try {
    const result = await lookupVehicle(plate.trim())
    res.json(result)
  } catch (err) {
    console.error('[Vehicle lookup]', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => console.log(`MailGaurd server running on http://localhost:${PORT}`))
