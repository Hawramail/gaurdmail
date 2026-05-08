// ── CPR / Person lookup ────────────────────────────────────────────────────
async function lookupCPR (cpr) {
  // TODO: implement lookup via HTTP request or Bahrain.bh API
  return { cpr, name: null, nationality: null, dob: null, gender: null, address: null }
}

// ── Vehicle / Plate lookup ─────────────────────────────────────────────────
async function lookupVehicle (plate) {
  // TODO: implement lookup via HTTP request or Bahrain.bh API
  return { plate, make: null, model: null, year: null, color: null, chassisNumber: null, engineNumber: null, ownerName: null }
}

module.exports = { lookupCPR, lookupVehicle }
