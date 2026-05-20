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

// ── Standalone export ─────────────────────────────────────────────────────────
//
// logSiemEvent() is exported separately so any component (IndexPage, OcrUploadDialog, etc.)
// can write a security event to Firestore without mounting the full useSiem() composable.
//
// serverTimestamp() tells Firestore to set the time on its own server rather than using
// the browser clock — important because browser clocks can be wrong, skewed, or spoofed,
// which would corrupt chronological ordering in the SIEM feed.
//
// anomalyRuleTriggered is always null here because this is a real production event,
// not a simulation. The detection engine and clearSimData() use this field to tell the
// difference: null = real, non-null = demo/simulation and safe to delete.
export async function logSiemEvent (eventType, userId, metadata = {}, severity = 'low') {
  await addDoc(collection(db, 'security_events'), {
    eventType,
    userId,
    metadata,
    severity,
    anomalyRuleTriggered: null,
    timestamp: new Date().toISOString(),
  })
}

// ── Helper ────────────────────────────────────────────────────────────────────
// Compares only the calendar date portion (ignores time) to determine if an
// event's millisecond timestamp falls on today's date.
// Used by the stats computed to count today's EMAIL_SENT / FILE_UPLOAD events.
function isToday (ms) {
  if (!ms) return false
  return new Date(ms).toDateString() === new Date().toDateString()
}

export function useSiem () {
  // ── Reactive state ─────────────────────────────────────────────────────────
  //
  // events and alerts are populated by onSnapshot listeners (see subscribeEvents /
  // subscribeAlerts below). Every time Firestore changes, Vue's reactivity system
  // automatically re-runs all computed values that depend on these refs.
  //
  // feedFilter holds the currently selected severity in the UI dropdown ('all',
  // 'critical', 'high', 'medium', 'low'). filteredEvents reads it to slice the feed.
  const events     = ref([])
  const alerts     = ref([])
  const feedFilter = ref('all')

  // Unsubscribe handles returned by onSnapshot — called in onUnmounted to stop the
  // persistent listeners and prevent memory leaks after the component is destroyed.
  let eventsUnsub = null
  let alertsUnsub = null

  // ── Computed ───────────────────────────────────────────────────────────────

  // Maps severity labels to a numeric rank so range comparisons work cleanly
  // (e.g. "high and above" = severityOrder >= 3 instead of an array includes check).
  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }

  // Applies the severity dropdown filter to the full events array.
  // 'high' means high OR critical (>= 3), 'medium' means medium, high, or critical (>= 2)
  // because showing a high-severity event when the user filters for "medium and above"
  // is more useful than hiding it.
  const filteredEvents = computed(() => {
    const f = feedFilter.value
    if (f === 'all')      return events.value
    if (f === 'critical') return events.value.filter(e => e.severity === 'critical')
    if (f === 'high')     return events.value.filter(e => severityOrder[e.severity] >= 3)
    if (f === 'medium')   return events.value.filter(e => severityOrder[e.severity] >= 2)
    return events.value.filter(e => e.severity === 'low')
  })

  // Filters alerts to only those still requiring action. When an alert is acknowledged
  // or resolved, its status changes in Firestore → onSnapshot fires → alerts.value updates
  // → this computed recomputes → the alert card disappears from the dashboard panel
  // automatically, with no manual refresh or polling needed.
  const openAlerts = computed(() => alerts.value.filter(a => a.status === 'open'))

  // Derives the three summary counters shown at the top of the dashboard entirely from
  // the in-memory events array — no separate counter document in Firestore.
  // emailsSent and fileUploads are scoped to today so the number resets each day.
  // anomalies counts ALL time because every anomaly remains relevant regardless of age.
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
  // Builds 12 hourly buckets (oldest → newest, left → right on the chart).
  // For each event, ageH is how many hours ago it happened. Math.floor(ageH) gives
  // which integer hour-ago slot it belongs to; subtracting from 11 flips the index
  // so bucket 0 = 11 hours ago and bucket 11 = current partial hour.
  // Events older than 12 hours are skipped entirely.
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
  //
  // Two different timestamp formats arrive from Firestore depending on who wrote the document:
  //   • Frontend writes (logSiemEvent, resolveAlert, simulation) use serverTimestamp(), which
  //     Firestore returns as a Timestamp object with a .toDate() method.
  //   • Laravel backend writes use the REST API and store timestamps as ISO 8601 strings.
  // resolveTs normalises both into a plain JS Date so the rest of the code doesn't care
  // which path was used to write the document.
  function resolveTs (raw) {
    if (!raw) return null
    if (typeof raw.toDate === 'function') return raw.toDate()  // Firestore Timestamp object
    const d = new Date(raw)                                     // ISO string from Laravel REST
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
  //
  // onSnapshot creates a persistent real-time listener rather than a one-shot fetch.
  // It fires immediately with the current snapshot, then fires again every time the
  // underlying Firestore collection changes (new document, update, delete).
  // This means the dashboard updates live — no polling or manual refresh required.
  //
  // The client-side re-sort after mapping is necessary because Firestore orders
  // Firestore Timestamp objects and plain string timestamps independently. Two events
  // written at nearly the same time — one from the frontend (Timestamp) and one from
  // Laravel (string) — can appear out of order in the Firestore query result even
  // though orderBy('timestamp', 'desc') was requested. Sorting by resolved _rawMs
  // guarantees correct display order regardless of how the timestamp was stored.
  function subscribeEvents () {
    const q = query(
      collection(db, 'security_events'),
      orderBy('timestamp', 'desc'),
      limit(100)          // cap at 100 most-recent events to keep reads and memory bounded
    )

    eventsUnsub = onSnapshot(q, snap => {
      events.value = snap.docs
        .map(d => {
          const data   = d.data()
          const tsDate = resolveTs(data.timestamp)

          return {
            id:        d.id,
            eventType: data.eventType ?? '—',
            userId:    data.userId    ?? '—',
            severity:  data.severity  ?? 'low',
            metadata:  formatMetadata(data.metadata),
            timestamp: tsDate ? formatTs(tsDate) : '—',
            _rawMs:    tsDate ? tsDate.getTime() : null,  // numeric ms for sorting and age math
            anomalyRuleTriggered: data.anomalyRuleTriggered ?? null,
          }
        })
        // Re-sort client-side — see comment above about mixed timestamp types.
        .sort((a, b) => (b._rawMs ?? 0) - (a._rawMs ?? 0))
    })
  }

  function subscribeAlerts () {
    const q = query(
      collection(db, 'alerts'),
      orderBy('timestamp', 'desc'),
      limit(50)
    )

    // When the detection engine (DetectAnomalies.php) or the simulation writes a new alert,
    // this listener fires and alerts.value updates → openAlerts recomputes → the alert card
    // appears in the dashboard panel within milliseconds, without any polling.
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
  //
  // Both functions write directly to Firestore without going through Laravel.
  // The onSnapshot listener picks up the status change and the card disappears
  // from openAlerts automatically — no extra UI state to manage.

  // Marks the alert as seen but not yet fixed — keeps it visible but de-escalated.
  async function acknowledgeAlert (alert) {
    await updateDoc(doc(db, 'alerts', alert.id), { status: 'acknowledged' })
  }

  // Marks the alert as fixed and writes an ALERT_RESOLVED event to the security_events
  // feed so there is a permanent audit trail of who resolved what and when.
  // anomalyRuleTriggered is null on this event so it is treated as a real event and
  // is NOT deleted by clearSimData().
  async function resolveAlert (alert) {
    await updateDoc(doc(db, 'alerts', alert.id), {
      status:     'resolved',
      resolvedAt: serverTimestamp(),
    })
    // Audit trail the SIEM logs its own resolution
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
  // Thin wrapper around the standalone logSiemEvent so components that already
  // have useSiem() mounted can call logEvent() without importing the standalone function.
  async function logEvent (eventType, userId, metadata = {}, severity = 'low') {
    await logSiemEvent(eventType, userId, metadata, severity)
  }

  // ── Simulation ────────────────────────────────────────────────────────────
  //
  // Walks through simulationScenarios and writes them to Firestore with a 500 ms
  // pause between scenarios so the dashboard visually animates rather than
  // flooding all at once.
  //
  // For burst scenarios (burstCount > 1, e.g. email flooding), individual events are
  // written with severity 'low' and empty metadata so they look like ordinary traffic.
  // Only the accompanying alert carries the high/critical severity. The 80 ms gap between
  // burst items is enough for DetectAnomalies.php's Firestore count query to see the correct
  // number of events when it next polls.
  //
  // anomalyRuleTriggered is set to ev.rule (non-null) on every simulation event.
  // This single field is the marker that distinguishes simulated from real events and
  // is what clearSimData() queries on when cleaning up.
  //
  // Alerts for high/critical scenarios are written directly here rather than waiting for
  // the detection engine to pick them up — this makes the demo instantaneous regardless
  // of the engine's polling interval.
  async function runSimulation () {
    for (const ev of simulationScenarios) {
      await new Promise(r => setTimeout(r, 500))

      const burst = ev.burstCount ?? 1
      for (let i = 0; i < burst; i++) {
        // Individual burst events are low-severity plain docs so DetectAnomalies.php
        // document-count query sees the right number; only the alert is critical.
        await addDoc(collection(db, 'security_events'), {
          eventType:            ev.eventType,
          userId:               ev.userId,
          metadata:             burst > 1 ? {} : ev.metadata,
          severity:             burst > 1 ? 'low' : ev.severity,
          anomalyRuleTriggered: ev.rule,
          timestamp:            serverTimestamp(),
        })
        if (burst > 1 && i < burst - 1) await new Promise(r => setTimeout(r, 80))
      }

      // Write the alert directly so the demo doesn't depend on the backend engine's poll interval.
      if (ev.severity === 'critical' || ev.severity === 'high') {
        await addDoc(collection(db, 'alerts'), {
          rule:        ev.rule,
          description: ev.metadata.message ?? ev.rule,
          severity:    ev.severity,
          userId:      ev.userId,
          metadata:    ev.metadata,
          status:      'open',
          _demo:       true,
          timestamp:   serverTimestamp(),
        })
      }
    }
  }

  // Deletes only simulation events (anomalyRuleTriggered !== null) and all alerts.
  // Real production events written by logSiemEvent (anomalyRuleTriggered: null) are
  // deliberately preserved, so running a demo does not erase real usage history.
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

  // Nuclear option — wipes every event and every alert regardless of origin.
  // Use only when a full clean slate is needed (e.g. resetting a dev environment).
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
  //
  // Metadata objects vary widely by event type (file uploads have filename/mimeType,
  // auth events have attempts/reason, etc.). This function flattens them into a single
  // readable string for the feed table.
  //
  // META_KEY_ORDER controls column priority — the most important keys (method, path,
  // filename) appear first regardless of insertion order. Keys not in the list are
  // appended alphabetically at the end. The 'message' key is pulled out separately
  // and used as a fallback if no other keys are present.
  const META_KEY_ORDER = [
    'method', 'path', 'statusCode', 'template', 'company',
    'filename', 'fileSize', 'mimeType', 'docType', 'side',
    'source', 'accountId', 'reason', 'status', 'attempts',
    'field', 'alertRule', 'alertId',
  ]

  function formatMetadata (meta) {
    if (!meta) return ''
    if (typeof meta === 'string') return meta
    const msg = meta.message
    const rest = Object.entries(meta)
      .filter(([k]) => k !== 'message')
      .sort(([a], [b]) => {
        const ai = META_KEY_ORDER.indexOf(a)
        const bi = META_KEY_ORDER.indexOf(b)
        if (ai === -1 && bi === -1) return a.localeCompare(b)
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ')
    return rest || msg || ''
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  //
  // Listeners are started in onMounted (not at composable call time) so that the
  // Vue component tree is fully set up before Firestore data starts flowing in.
  // They are torn down in onUnmounted — calling the unsubscribe functions returned by
  // onSnapshot stops Firestore from pushing updates to a component that no longer
  // exists, preventing memory leaks and Vue reactivity warnings.
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
