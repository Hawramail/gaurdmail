<template>
  <q-layout view="lHh Lpr lFf">

    <q-header elevated style="background: #0f1f3d;">
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />
        <q-toolbar-title>
          <span style="font-size: 15px; font-weight: 700; letter-spacing: -0.2px;">MailGuard</span>
          <span v-if="pageTitle" style="font-size: 12px; font-weight: 500; color: #93c5fd; margin-left: 8px;">· {{ pageTitle }}</span>
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      :width="220"
      style="background: #ffffff;"
    >
      <q-list padding>

        <!-- MAIN NAV -->
        <q-item-label header style="font-size: 10px; font-weight: 700; color: #8492a6; letter-spacing: 0.8px; text-transform: uppercase;">
          Mail
        </q-item-label>

        <q-item
          clickable
          v-ripple
          :to="'/'"
          exact
          active-class="nav-active"
          class="nav-item"
        >
          <q-item-section avatar>
            <q-icon name="send" size="18px" />
          </q-item-section>
          <q-item-section>
            <q-item-label style="font-size: 13px; font-weight: 600;">Send Email</q-item-label>
            <q-item-label caption style="font-size: 11px;">Compose & send</q-item-label>
          </q-item-section>
        </q-item>

        <q-separator spaced style="opacity: 0.4;" />

        <!-- SECURITY NAV -->
        <q-item-label header style="font-size: 10px; font-weight: 700; color: #8492a6; letter-spacing: 0.8px; text-transform: uppercase;">
          Security
        </q-item-label>

        <q-item
          clickable
          v-ripple
          :to="'/security'"
          exact
          active-class="nav-active"
          class="nav-item"
        >
          <q-item-section avatar>
            <q-icon name="security" size="18px" />
          </q-item-section>
          <q-item-section>
            <q-item-label style="font-size: 13px; font-weight: 600;">Security</q-item-label>
            <q-item-label caption style="font-size: 11px;">SIEM dashboard</q-item-label>
          </q-item-section>
        </q-item>

        <q-separator spaced style="opacity: 0.4;" />

        <!-- ADMIN NAV -->
        <q-item-label header style="font-size: 10px; font-weight: 700; color: #8492a6; letter-spacing: 0.8px; text-transform: uppercase;">
          Admin
        </q-item-label>

        <q-item
          clickable
          v-ripple
          :to="'/admin/companies'"
          exact
          active-class="nav-active"
          class="nav-item"
        >
          <q-item-section avatar>
            <q-icon name="business" size="18px" />
          </q-item-section>
          <q-item-section>
            <q-item-label style="font-size: 13px; font-weight: 600;">Companies</q-item-label>
            <q-item-label caption style="font-size: 11px;">Email routing config</q-item-label>
          </q-item-section>
        </q-item>

      </q-list>

      <!-- DRAWER FOOTER -->
      <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 16px; border-top: 1px solid rgba(0,0,0,0.07);">
        <div style="font-size: 11px; color: #8492a6; font-weight: 600;">MailGuard System</div>
        <div style="font-size: 10px; color: #b0bac9;">Insurance Email Automation</div>
      </div>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

  </q-layout>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

const leftDrawerOpen = ref(false)
const route = useRoute()

const pageTitle = computed(() => {
  const titles = {
    '/': 'Email Composer',
    '/security': 'Security Dashboard',
    '/admin/companies': 'Company Settings',
  }
  return titles[route.path] || ''
})

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value
}
</script>

<style>
.nav-item {
  border-radius: 10px !important;
  margin: 2px 8px !important;
}
.nav-item .q-icon {
  color: #8492a6;
}
.nav-active {
  background: #eff6ff !important;
  color: #2563eb !important;
}
.nav-active .q-icon {
  color: #2563eb !important;
}
.nav-active .q-item__label {
  color: #2563eb !important;
}
</style>