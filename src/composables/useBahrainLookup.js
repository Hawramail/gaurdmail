import { ref } from 'vue'

const SERVER_URL = 'http://localhost:3001'

export function useBahrainLookup () {
  const loading = ref(false)
  const error   = ref(null)

  async function _post (endpoint, body) {
    loading.value = true
    error.value   = null
    try {
      const res  = await fetch(`${SERVER_URL}${endpoint}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Server error ${res.status}`)
      return json
    } catch (err) {
      error.value = err.message
      return null
    } finally {
      loading.value = false
    }
  }

  // Lookup a person by CPR number
  // Returns: { name, nationality, dob, gender, address }
  async function lookupCPR (cpr) {
    return _post('/api/lookup/cpr', { cpr })
  }

  // Lookup a vehicle by plate number
  // Returns: { make, model, year, color, chassisNumber, engineNumber, ownerName }
  async function lookupVehicle (plate) {
    return _post('/api/lookup/vehicle', { plate })
  }

  return { loading, error, lookupCPR, lookupVehicle }
}
