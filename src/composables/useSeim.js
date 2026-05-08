/**
 * useSiem.js
 * Vue 3 composable — real-time SIEM data via Firebase onSnapshot
 *
 * Place at: src/composables/useSiem.js
 *
 * Provides:
 *   events         — live security_events feed (newest first, max 100)
 *   alerts         — live alerts feed
 *   openAlerts     — computed: only status === 'open'
 *   stats          — email count, upload count, anomaly count
 *   chartData      — vue-chartjs Line dataset (events per hour, last 12h)
 *   feedFilter     — ref: 'all' | 'critical' | 'high' | 'medium' | 'low'
 *   filteredEvents — computed: events filtered by feedFilter
 *   acknowledgeAlert(alert)
 *   resolveAlert(alert)
 *   logEvent(eventType, userId, metadata, severity)  ← call from anywhere
 */

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
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from 'src/firebase/config'
import { api } from 'boot/axios' // adjust if your axios boot path differs

export function useSiem () {
  // ── Reactive state ─────────────────────────────────────────────────────────
  const events     = ref([])
  const alerts     = ref([])
  const feedFilter = ref('all')
  const stats      = ref({
    emailsSent:      0,
    emailsSentDelta: '—',
    fileUploads:     0,
    fileUploadsSub:  '—',
    anomalies:       0,
    anomaliesSub:    '—',
  })

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

  // ── Firebase subscriptions ─────────────────────────────────────────────────
  function subscribeEvents () {
    const q = query(
      collection(db, 'security_events'),
      orderBy('timestamp', 'desc'),
      limit(100)
    )

    eventsUnsub = onSnapshot(q, snap => {
      events.value = snap.docs.map(d => {
        const data = d.data()
        const tsDate = data.timestamp?.toDate?.()

        return {
          id:        d.id,
          eventType: data.eventType ?? '—',
          userId:    data.userId    ?? '—',
          severity:  data.severity  ?? 'low',
          metadata:  formatMetadata(data.metadata),
          timestamp: tsDate ? tsDate.toLocaleTimeString() : '—',
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
          time:        data.timestamp?.toDate?.()?.toLocaleTimeString() ?? '—',
        }
      })
    })
  }

  // ── Stats (from Laravel API) ───────────────────────────────────────────────
  async function loadStats () {
    try {
      const res  = await api.get('/siem/stats')
      stats.value = res.data
    } catch (e) {
      console.error('[useSiem] Failed to load stats:', e)
    }
  }

  // ── Alert actions ──────────────────────────────────────────────────────────
  async function acknowledgeAlert (alert) {
    await api.patch(`/siem/alerts/${alert.id}/acknowledge`)
    // onSnapshot will update the local state automatically
  }

  async function resolveAlert (alert) {
    await api.patch(`/siem/alerts/${alert.id}/resolve`)
  }

  // ── Event logger (call from anywhere in the app) ──────────────────────────
  async function logEvent (eventType, userId, metadata = {}, severity = 'low') {
    try {
      await api.post('/siem/events', { eventType, userId, metadata, severity })
    } catch (e) {
      // Fallback: write directly to Firestore if Laravel is unreachable
      await addDoc(collection(db, 'security_events'), {
        eventType, userId, metadata, severity,
        anomalyRuleTriggered: null,
        timestamp: serverTimestamp(),
      })
    }
  }

  // ── Simulation helper ──────────────────────────────────────────────────────
  const simulatedEvents = [
    { eventType: 'EMAIL_SENT',           userId: 'sim-user',    metadata: { count: 11, message: 'Burst email #11' },                     severity: 'critical', rule: 'email_burst' },
    { eventType: 'FILE_REJECTED',        userId: 'unknown.user',metadata: { filename: 'payload.exe', reason: 'exe disguised as PDF' },   severity: 'critical', rule: 'repeated_file_rejections' },
    { eventType: 'ADMIN_CONFIG_CHANGED', userId: 'unknown.user',metadata: { field: 'TO address', company: 'GIG Gulf' },                  severity: 'high',     rule: 'admin_config_tampering' },
    { eventType: 'EMAIL_SENT',           userId: 'sim-user',    metadata: { message: 'Email at 02:34 AM' },                              severity: 'high',     rule: 'unusual_send_time' },
    { eventType: 'ZOHO_TOKEN_FAILURE',   userId: 'system',      metadata: { attempts: 3, message: '3 consecutive failures' },            severity: 'medium',   rule: 'zoho_token_failure_spike' },
    { eventType: 'FILE_UPLOAD',          userId: 'staff.user',  metadata: { filename: 'large_pack.pdf', sizeBytes: 14500000, sizeMB: 13.8, message: '13.8 MB upload' }, severity: 'medium', rule: 'large_file_upload' },
  ]

  async function runSimulation () {
    for (const ev of simulatedEvents) {
      await new Promise(r => setTimeout(r, 500))

      // Write event directly to Firestore so onSnapshot fires immediately
      await addDoc(collection(db, 'security_events'), {
        eventType:            ev.eventType,
        userId:               ev.userId,
        metadata:             ev.metadata,
        severity:             ev.severity,
        anomalyRuleTriggered: ev.rule,
        timestamp:            serverTimestamp(),
      })

      // Also create an alert for high/critical
      if (ev.severity === 'critical' || ev.severity === 'high') {
        await addDoc(collection(db, 'alerts'), {
          rule:        ev.rule,
          description: ev.metadata.message ?? ev.rule,
          severity:    ev.severity,
          userId:      ev.userId,
          metadata:    ev.metadata,
          status:      'open',
          timestamp:   serverTimestamp(),
        })
      }

      // Bump anomaly counter in stats
      stats.value.anomalies++
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function formatMetadata (meta) {
    if (!meta) return ''
    if (typeof meta === 'string') return meta
    const msg = meta.message
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
    loadStats()
  })

  onUnmounted(() => {
    if (eventsUnsub) eventsUnsub()
    if (alertsUnsub) alertsUnsub()
  })

  return {
    // state
    events,
    alerts,
    openAlerts,
    stats,
    feedFilter,
    filteredEvents,
    chartData,
    chartOptions,
    // actions
    acknowledgeAlert,
    resolveAlert,
    logEvent,
    runSimulation,
    loadStats,
  }
}
