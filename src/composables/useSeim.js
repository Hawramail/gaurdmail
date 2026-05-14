import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  updateDoc,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from 'src/firebase/config'
import { simulationScenarios } from 'src/data/siemSimulation'

// ── Standalone export — call from any component without subscribing ──────────
export async function logSiemEvent (eventType, userId, metadata = {}, severity = 'low') {
  await addDoc(collection(db, 'security_events'), {
    eventType,
    userId,
    metadata,
    severity,
    anomalyRuleTriggered: null,
    timestamp: serverTimestamp(),
  })
}

// ── Helper ────────────────────────────────────────────────────────────────────
function isToday (ms) {
  if (!ms) return false
  return new Date(ms).toDateString() === new Date().toDateString()
}

export function useSiem () {
  // ── Reactive state ─────────────────────────────────────────────────────────
  const events     = ref([])
  const alerts     = ref([])
  const feedFilter = ref('all')

  let eventsUnsub = null
  let alertsUnsub = null

  // ── Computed ───────────────────────────────────────────────────────────────
  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }

  const filteredEvents = computed(() => {
    const f = feedFilter.value
    if (f === 'all')      return events.value
    if (f === 'critical') return events.value.filter(e => e.severity === 'critical')
    if (f === 'high')     return events.value.filter(e => severityOrder[e.severity] >= 3)
    if (f === 'medium')   return events.value.filter(e => severityOrder[e.severity] >= 2)
    return events.value.filter(e => e.severity === 'low')
  })

  const openAlerts = computed(() => alerts.value.filter(a => a.status === 'open'))

  const stats = computed(() => {
    const todayEvents = events.value.filter(e => isToday(e._rawMs))
    return {
      emailsSent:      todayEvents.filter(e => e.eventType === 'EMAIL_SENT').length,
      emailsSentDelta: 'Today',
      fileUploads:     todayEvents.filter(e => e.eventType === 'FILE_UPLOAD').length,
      fileUploadsSub:  'Today',
      anomalies:       events.value.filter(e => e.anomalyRuleTriggered).length,
      anomaliesSub:    'Total flagged',
    }
  })

  // ── Chart data — events per hour for last 12 hours ─────────────────────────
  const chartData = computed(() => {
    const now    = Date.now()
    const labels = []
    const counts = new Array(12).fill(0)

    for (let i = 11; i >= 0; i--) {
      const h = new Date(now - i * 3_600_000)
      labels.push(h.getHours().toString().padStart(2, '0') + ':00')
    }

    events.value.forEach(e => {
      if (!e._rawMs) return
      const ageH = (now - e._rawMs) / 3_600_000
      if (ageH >= 12) return
      const idx = 11 - Math.floor(ageH)
      if (idx >= 0 && idx < 12) counts[idx]++
    })

    return {
      labels,
      datasets: [{
        label:           'Events',
        data:            counts,
        borderColor:     '#2563eb',
        backgroundColor: 'rgba(37,99,235,0.08)',
        fill:            true,
        tension:         0.4,
        pointRadius:     3,
        pointBackgroundColor: '#2563eb',
      }],
    }
  })

  const chartOptions = {
    responsive:          true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { stepSize: 1 } },
      x: { grid: { display: false } },
    },
  }

  // ── Timestamp helpers ──────────────────────────────────────────────────────
  // Handles both Firestore Timestamp objects (frontend writes) and ISO strings (backend REST writes)
  function resolveTs (raw) {
    if (!raw) return null
    if (typeof raw.toDate === 'function') return raw.toDate()
    const d = new Date(raw)
    return isNaN(d.getTime()) ? null : d
  }

  function formatTs (date) {
    return date.toLocaleString('en-GB', {
      day:    '2-digit',
      month:  'short',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  // ── Firebase subscriptions ─────────────────────────────────────────────────
  function subscribeEvents () {
    const q = query(
      collection(db, 'security_events'),
      orderBy('timestamp', 'desc'),
      limit(100)
    )

    eventsUnsub = onSnapshot(q, snap => {
      events.value = snap.docs.map(d => {
        const data   = d.data()
        const tsDate = resolveTs(data.timestamp)

        return {
          id:        d.id,
          eventType: data.eventType ?? '—',
          userId:    data.userId    ?? '—',
          severity:  data.severity  ?? 'low',
          metadata:  formatMetadata(data.metadata),
          timestamp: tsDate ? formatTs(tsDate) : '—',
          _rawMs:    tsDate ? tsDate.getTime() : null,
          anomalyRuleTriggered: data.anomalyRuleTriggered ?? null,
        }
      })
    })
  }

  function subscribeAlerts () {
    const q = query(
      collection(db, 'alerts'),
      orderBy('timestamp', 'desc'),
      limit(50)
    )

    alertsUnsub = onSnapshot(q, snap => {
      alerts.value = snap.docs.map(d => {
        const data = d.data()
        return {
          id:          d.id,
          rule:        data.rule        ?? '—',
          description: data.description ?? '—',
          severity:    data.severity    ?? 'low',
          status:      data.status      ?? 'open',
          userId:      data.userId      ?? '—',
          time:        (() => { const d = resolveTs(data.timestamp); return d ? formatTs(d) : '—' })(),
        }
      })
    })
  }

  // ── Alert actions — direct Firestore writes ────────────────────────────────
  async function acknowledgeAlert (alert) {
    await updateDoc(doc(db, 'alerts', alert.id), { status: 'acknowledged' })
  }

  async function resolveAlert (alert) {
    await updateDoc(doc(db, 'alerts', alert.id), {
      status:     'resolved',
      resolvedAt: serverTimestamp(),
    })
    // Audit trail — the SIEM logs its own resolution
    await addDoc(collection(db, 'security_events'), {
      eventType:            'ALERT_RESOLVED',
      userId:               'staff_user',
      severity:             'low',
      metadata:             { alertRule: alert.rule, alertId: alert.id },
      anomalyRuleTriggered: null,
      timestamp:            serverTimestamp(),
    })
  }

  // ── Event logger ──────────────────────────────────────────────────────────
  async function logEvent (eventType, userId, metadata = {}, severity = 'low') {
    await logSiemEvent(eventType, userId, metadata, severity)
  }

  // ── Simulation ────────────────────────────────────────────────────────────
  async function runSimulation () {
    for (const ev of simulationScenarios) {
      await new Promise(r => setTimeout(r, 500))

      await addDoc(collection(db, 'security_events'), {
        eventType:            ev.eventType,
        userId:               ev.userId,
        metadata:             ev.metadata,
        severity:             ev.severity,
        anomalyRuleTriggered: ev.rule,   // non-null marks this as a demo event
        timestamp:            serverTimestamp(),
      })

      if (ev.severity === 'critical' || ev.severity === 'high') {
        await addDoc(collection(db, 'alerts'), {
          rule:        ev.rule,
          description: ev.metadata.message ?? ev.rule,
          severity:    ev.severity,
          userId:      ev.userId,
          metadata:    ev.metadata,
          status:      'open',
          _demo:       true,              // marks this as a demo alert
          timestamp:   serverTimestamp(),
        })
      }
    }
  }

  // Delete only demo events (anomalyRuleTriggered !== null) and all alerts.
  // Real events (anomalyRuleTriggered: null) are preserved.
  async function clearSimData () {
    const [eventsSnap, alertsSnap] = await Promise.all([
      getDocs(query(collection(db, 'security_events'), where('anomalyRuleTriggered', '!=', null))),
      getDocs(collection(db, 'alerts')),
    ])
    await Promise.all([
      ...eventsSnap.docs.map(d => deleteDoc(doc(db, 'security_events', d.id))),
      ...alertsSnap.docs.map(d => deleteDoc(doc(db, 'alerts',           d.id))),
    ])
  }

  // Delete ALL events and ALL alerts — full clean slate.
  async function clearAllData () {
    const [eventsSnap, alertsSnap] = await Promise.all([
      getDocs(collection(db, 'security_events')),
      getDocs(collection(db, 'alerts')),
    ])
    await Promise.all([
      ...eventsSnap.docs.map(d => deleteDoc(doc(db, 'security_events', d.id))),
      ...alertsSnap.docs.map(d => deleteDoc(doc(db, 'alerts',           d.id))),
    ])
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function formatMetadata (meta) {
    if (!meta) return ''
    if (typeof meta === 'string') return meta
    const msg  = meta.message
    const rest = Object.entries(meta)
      .filter(([k]) => k !== 'message')
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ')
    return rest || msg || ''
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onMounted(() => {
    subscribeEvents()
    subscribeAlerts()
  })

  onUnmounted(() => {
    if (eventsUnsub) eventsUnsub()
    if (alertsUnsub) alertsUnsub()
  })

  return {
    events,
    alerts,
    openAlerts,
    stats,
    feedFilter,
    filteredEvents,
    chartData,
    chartOptions,
    acknowledgeAlert,
    resolveAlert,
    logEvent,
    runSimulation,
    clearSimData,
    clearAllData,
  }
}
