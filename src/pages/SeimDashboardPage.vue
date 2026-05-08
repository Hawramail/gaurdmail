<template>
  <q-page class="siem-page q-pa-md">

    <!-- ── PAGE HEADER ── -->
    <div class="siem-page-header q-mb-md">
      <div>
        <div class="siem-title">SIEM Dashboard</div>
        <div class="siem-subtitle">Security Information and Event Management — Real-time monitoring</div>
      </div>
      <div class="header-right">
        <div class="live-indicator">
          <div class="live-dot" />
          Live
        </div>
        <q-btn
          outline color="negative" label="Run Attack Simulation"
          icon="play_arrow" no-caps dense class="sim-btn"
          @click="handleSimulation" :loading="simulating"
        />
      </div>
    </div>

    <!-- ── STAT CARDS ── -->
    <div class="stat-grid q-mb-md">
      <div class="stat-card stat-blue">
        <div class="stat-icon-bg"><q-icon name="mail" size="22px" /></div>
        <div class="stat-label">Emails sent today</div>
        <div class="stat-value">{{ stats.emailsSent }}</div>
        <div class="stat-sub">{{ stats.emailsSentDelta }}</div>
      </div>
      <div class="stat-card stat-teal">
        <div class="stat-icon-bg"><q-icon name="upload_file" size="22px" /></div>
        <div class="stat-label">File uploads</div>
        <div class="stat-value">{{ stats.fileUploads }}</div>
        <div class="stat-sub">{{ stats.fileUploadsSub }}</div>
      </div>
      <div class="stat-card stat-amber">
        <div class="stat-icon-bg"><q-icon name="warning" size="22px" /></div>
        <div class="stat-label">Anomalies detected</div>
        <div class="stat-value">{{ stats.anomalies }}</div>
        <div class="stat-sub">{{ stats.anomaliesSub }}</div>
      </div>
      <div class="stat-card stat-red">
        <div class="stat-icon-bg"><q-icon name="notifications_active" size="22px" /></div>
        <div class="stat-label">Open alerts</div>
        <div class="stat-value">{{ openAlerts.length }}</div>
        <div class="stat-sub">{{ openAlerts.length > 0 ? 'Requires attention' : 'All clear' }}</div>
      </div>
    </div>

    <!-- ── LOWER GRID ── -->
    <div class="lower-grid">

      <!-- LEFT: CHART + FEED -->
      <div class="left-col">

        <!-- EVENT VOLUME CHART -->
        <q-card flat bordered class="siem-card chart-card q-mb-md">
          <q-card-section class="siem-card-header">
            <div>
              <div class="siem-card-title">Event volume — last 12 hours</div>
              <div class="siem-card-sub">Security events per hour</div>
            </div>
            <div class="siem-card-icon icon-blue"><q-icon name="show_chart" size="18px" /></div>
          </q-card-section>
          <q-separator class="soft-sep" />
          <q-card-section class="chart-body q-pa-md">
            <Line :data="chartData" :options="chartOptions" style="height:130px" />
          </q-card-section>
        </q-card>

        <!-- LIVE EVENT FEED -->
        <q-card flat bordered class="siem-card feed-card">
          <q-card-section class="siem-card-header">
            <div>
              <div class="siem-card-title">Live security event feed</div>
              <div class="siem-card-sub">Real-time · Firebase onSnapshot</div>
            </div>
            <div class="header-right-small">
              <div class="live-indicator-sm"><div class="live-dot-sm" /> Live</div>
              <div class="siem-card-icon icon-teal"><q-icon name="stream" size="18px" /></div>
            </div>
          </q-card-section>
          <q-separator class="soft-sep" />

          <!-- Filter row -->
          <q-card-section class="filter-row q-py-sm">
            <q-select
              v-model="feedFilter"
              :options="severityFilterOptions"
              outlined dense emit-value map-options options-dense
              class="feed-filter-select"
            >
              <template #prepend>
                <q-icon name="filter_list" size="14px" color="primary" />
              </template>
            </q-select>
            <q-space />
            <div class="event-count-label">{{ filteredEvents.length }} events</div>
          </q-card-section>
          <q-separator class="soft-sep" />

          <!-- Event rows -->
          <div class="feed-body" ref="feedBody">
            <div
              v-for="(event, i) in filteredEvents" :key="event.id || i"
              class="event-row"
            >
              <div class="event-dot-wrap">
                <div class="event-dot" :class="'dot-' + event.severity" />
              </div>
              <div class="event-type-col">{{ event.eventType }}</div>
              <div class="event-user-col">{{ event.userId }}</div>
              <div class="event-meta-col">{{ event.metadata }}</div>
              <div class="sev-pill" :class="'sev-' + event.severity">{{ event.severity }}</div>
              <div class="event-time-col">{{ event.timestamp }}</div>
            </div>

            <div v-if="filteredEvents.length === 0" class="feed-empty">
              <q-icon name="stream" size="32px" color="grey-4" />
              <div class="feed-empty-text">No events yet</div>
              <div class="feed-empty-sub">Security events will appear here in real time</div>
            </div>
          </div>
        </q-card>

      </div>

      <!-- RIGHT: ALERTS -->
      <div class="right-col">
        <q-card flat bordered class="siem-card alert-card">
          <q-card-section class="siem-card-header">
            <div>
              <div class="siem-card-title">Active alerts</div>
              <div class="siem-card-sub">{{ openAlerts.length }} open · requires action</div>
            </div>
            <div class="siem-card-icon icon-red">
              <q-icon name="notifications_active" size="18px" />
            </div>
          </q-card-section>
          <q-separator class="soft-sep" />

          <div class="alert-body">
            <div
              v-for="(alert, i) in openAlerts" :key="alert.id || i"
              class="alert-item"
            >
              <div class="alert-top-row">
                <div class="sev-pill" :class="'sev-' + alert.severity">{{ alert.severity }}</div>
                <div class="alert-rule">{{ alert.rule?.replace(/_/g, ' ') }}</div>
                <div class="alert-time">{{ alert.time }}</div>
              </div>
              <div class="alert-desc">{{ alert.description }}</div>
              <div class="alert-actions">
                <q-btn
                  flat dense no-caps label="Acknowledge" color="primary" size="sm"
                  class="alert-btn" :loading="loadingAlert === alert.id + 'ack'"
                  @click="handleAcknowledge(alert)"
                />
                <q-btn
                  flat dense no-caps label="Resolve" color="positive" size="sm"
                  class="alert-btn" :loading="loadingAlert === alert.id + 'res'"
                  @click="handleResolve(alert)"
                />
              </div>
            </div>

            <div v-if="openAlerts.length === 0" class="alerts-empty">
              <q-icon name="check_circle" size="32px" color="green-4" />
              <div class="alerts-empty-text">All clear</div>
              <div class="alerts-empty-sub">No open alerts at this time</div>
            </div>
          </div>

          <!-- SIMULATION PANEL -->
          <q-separator class="soft-sep" />
          <q-card-section class="sim-section">
            <div class="sim-label">Attack simulator</div>
            <div class="sim-desc">
              Trigger simulated anomalies to test all 6 detection rules and verify the dashboard responds correctly.
            </div>
            <q-btn
              unelevated color="dark" label="Run Attack Simulation" icon="play_arrow"
              no-caps class="sim-full-btn q-mt-sm"
              :loading="simulating" @click="handleSimulation"
            />
          </q-card-section>

        </q-card>
      </div>

    </div>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  LineElement, PointElement, LinearScale,
  CategoryScale, Filler, Tooltip, Legend,
} from 'chart.js'
import { useQuasar } from 'quasar'
import { useSiem } from 'src/composables/useSeim'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

const $q = useQuasar()

const {
  openAlerts,
  stats,
  feedFilter,
  filteredEvents,
  chartData,
  chartOptions,
  acknowledgeAlert,
  resolveAlert,
  runSimulation,
} = useSiem()

const simulating   = ref(false)
const loadingAlert = ref(null)

const severityFilterOptions = [
  { label: 'All severities', value: 'all' },
  { label: 'Critical only',  value: 'critical' },
  { label: 'High & above',   value: 'high' },
  { label: 'Medium & above', value: 'medium' },
  { label: 'Low',            value: 'low' },
]

async function handleAcknowledge (alert) {
  loadingAlert.value = alert.id + 'ack'
  try {
    await acknowledgeAlert(alert)
    $q.notify({ type: 'info', message: `Alert acknowledged: ${alert.rule?.replace(/_/g, ' ')}`, icon: 'check' })
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to acknowledge alert', icon: 'error' })
  }
  loadingAlert.value = null
}

async function handleResolve (alert) {
  loadingAlert.value = alert.id + 'res'
  try {
    await resolveAlert(alert)
    $q.notify({ type: 'positive', message: `Alert resolved: ${alert.rule?.replace(/_/g, ' ')}`, icon: 'check_circle' })
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to resolve alert', icon: 'error' })
  }
  loadingAlert.value = null
}

async function handleSimulation () {
  simulating.value = true
  try {
    await runSimulation()
    $q.notify({ type: 'warning', message: 'Simulation complete — 6 anomalies fired', icon: 'warning', timeout: 4000 })
  } finally {
    simulating.value = false
  }
}
</script>

<style scoped>
/* ── PAGE ── */
.siem-page { background: #eef2fb; min-height: 100vh; }

/* ── HEADER ── */
.siem-page-header { display: flex; align-items: center; justify-content: space-between; }
.siem-title       { font-size: 18px; font-weight: 700; color: #0f1f3d; letter-spacing: -0.3px; }
.siem-subtitle    { font-size: 12px; color: #8492a6; margin-top: 2px; }
.header-right     { display: flex; align-items: center; gap: 12px; }
.live-indicator   { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #16a34a; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 4px 12px; border-radius: 20px; }
.live-dot         { width: 7px; height: 7px; border-radius: 50%; background: #16a34a; animation: blink 1.4s infinite; }
@keyframes blink  { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
.sim-btn          { border-radius: 8px !important; font-weight: 600 !important; font-size: 12px !important; }

/* ── STAT CARDS ── */
.stat-grid        { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.stat-card        { background: #fff; border: 1px solid rgba(0,0,0,0.07); border-radius: 14px; padding: 16px 18px; box-shadow: 0 2px 8px rgba(15,31,61,0.05); position: relative; overflow: hidden; }
.stat-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:14px 14px 0 0; }
.stat-blue::before  { background:#2563eb; }
.stat-teal::before  { background:#0d9488; }
.stat-amber::before { background:#d97706; }
.stat-red::before   { background:#dc2626; }
.stat-icon-bg      { position:absolute; right:14px; top:14px; width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; opacity:.12; background:#2563eb; }
.stat-teal .stat-icon-bg  { background:#0d9488; }
.stat-amber .stat-icon-bg { background:#d97706; }
.stat-red .stat-icon-bg   { background:#dc2626; }
.stat-label       { font-size:10px; font-weight:700; color:#8492a6; text-transform:uppercase; letter-spacing:.6px; margin-bottom:6px; }
.stat-value       { font-size:30px; font-weight:700; line-height:1; font-variant-numeric:tabular-nums; margin-bottom:4px; }
.stat-blue .stat-value  { color:#2563eb; }
.stat-teal .stat-value  { color:#0d9488; }
.stat-amber .stat-value { color:#d97706; }
.stat-red .stat-value   { color:#dc2626; }
.stat-sub { font-size:11px; color:#8492a6; }

/* ── LOWER GRID ── */
.lower-grid { display:grid; grid-template-columns:1fr 360px; gap:12px; min-height:500px; }
.left-col   { display:flex; flex-direction:column; min-height:0; }
.right-col  { min-height:0; }

/* ── SIEM CARDS ── */
.siem-card        { border-radius:14px !important; background:#fff !important; border-color:rgba(0,0,0,0.07) !important; box-shadow:0 2px 8px rgba(15,31,61,0.05) !important; display:flex; flex-direction:column; overflow:hidden; }
.siem-card-header { display:flex; align-items:center; justify-content:space-between; padding:14px 16px 12px !important; flex-shrink:0; }
.siem-card-title  { font-size:13px; font-weight:700; color:#0f1f3d; }
.siem-card-sub    { font-size:11px; color:#8492a6; margin-top:2px; }
.siem-card-icon   { width:32px; height:32px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.icon-blue { background:#eff6ff; color:#2563eb; }
.icon-teal { background:#f0fdfa; color:#0d9488; }
.icon-red  { background:#fef2f2; color:#dc2626; }
.soft-sep  { opacity:.5; }

/* ── CHART ── */
.chart-card { flex-shrink:0; }
.chart-body { padding:12px 16px !important; }

/* ── FEED ── */
.feed-card   { flex:1; min-height:0; }
.filter-row  { display:flex; align-items:center; gap:10px; padding:8px 16px !important; }
.feed-filter-select { width:180px; }
.feed-filter-select :deep(.q-field__control) { border-radius:8px !important; min-height:32px !important; }
.event-count-label  { font-size:11px; color:#8492a6; font-weight:500; }
.header-right-small { display:flex; align-items:center; gap:8px; }
.live-indicator-sm  { display:flex; align-items:center; gap:4px; font-size:11px; font-weight:600; color:#16a34a; }
.live-dot-sm        { width:6px; height:6px; border-radius:50%; background:#16a34a; animation:blink 1.4s infinite; }

.feed-body { flex:1; overflow-y:auto; min-height:0; }
.feed-body::-webkit-scrollbar { width:4px; }
.feed-body::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.1); border-radius:4px; }

.event-row { display:flex; align-items:center; gap:10px; padding:9px 16px; border-bottom:1px solid rgba(0,0,0,0.04); transition:background .1s; animation:slideIn .25s ease; }
.event-row:hover { background:#f8faff; }
@keyframes slideIn { from { opacity:0; transform:translateY(-3px); } to { opacity:1; transform:translateY(0); } }
.event-dot-wrap { width:14px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
.event-dot      { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.dot-low      { background:#16a34a; }
.dot-medium   { background:#d97706; }
.dot-high     { background:#f97316; }
.dot-critical { background:#dc2626; animation:blink .8s infinite; }
.event-type-col { font-size:12px; font-weight:700; color:#0f1f3d; min-width:180px; font-family:'Courier New',monospace; }
.event-user-col { font-size:12px; color:#4b5a7a; flex:1; }
.event-meta-col { font-size:11px; color:#8492a6; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.event-time-col { font-size:11px; color:#8492a6; font-family:'Courier New',monospace; white-space:nowrap; flex-shrink:0; }

.sev-pill    { padding:2px 8px; border-radius:20px; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.4px; flex-shrink:0; }
.sev-low     { background:#f0fdf4; color:#16a34a; }
.sev-medium  { background:#fffbeb; color:#d97706; }
.sev-high    { background:#fff7ed; color:#f97316; }
.sev-critical{ background:#fef2f2; color:#dc2626; }

.feed-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:48px 24px; }
.feed-empty-text { font-size:14px; font-weight:600; color:#4b5a7a; }
.feed-empty-sub  { font-size:12px; color:#8492a6; text-align:center; }

/* ── ALERT PANEL ── */
.alert-card { height:100%; }
.alert-body { flex:1; overflow-y:auto; min-height:0; }
.alert-body::-webkit-scrollbar { width:4px; }
.alert-body::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.1); border-radius:4px; }
.alert-item    { padding:12px 16px; border-bottom:1px solid rgba(0,0,0,0.05); cursor:pointer; transition:background .1s; }
.alert-item:hover { background:#f8faff; }
.alert-top-row { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
.alert-rule    { font-size:12px; font-weight:700; color:#0f1f3d; flex:1; text-transform:capitalize; }
.alert-time    { font-size:11px; color:#8492a6; font-family:'Courier New',monospace; white-space:nowrap; }
.alert-desc    { font-size:11px; color:#4b5a7a; line-height:1.5; }
.alert-actions { display:flex; gap:6px; margin-top:8px; }
.alert-btn     { border-radius:6px !important; font-size:11px !important; font-weight:600 !important; }
.alerts-empty  { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:40px 24px; }
.alerts-empty-text { font-size:14px; font-weight:600; color:#4b5a7a; }
.alerts-empty-sub  { font-size:12px; color:#8492a6; text-align:center; }

/* ── SIM PANEL ── */
.sim-section  { padding:14px 16px !important; flex-shrink:0; }
.sim-label    { font-size:11px; font-weight:700; color:#8492a6; text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; }
.sim-desc     { font-size:12px; color:#4b5a7a; line-height:1.5; }
.sim-full-btn { width:100%; border-radius:9px !important; font-weight:700 !important; font-size:12px !important; min-height:36px !important; }

/* ── RESPONSIVE ── */
@media (max-width: 1200px) { .lower-grid { grid-template-columns: 1fr 300px; } }
@media (max-width: 900px)  {
  .stat-grid  { grid-template-columns: repeat(2, 1fr); }
  .lower-grid { grid-template-columns: 1fr; }
  .right-col  { height: 500px; }
}
</style>
