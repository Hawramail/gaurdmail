<template>
  <q-layout>
    <q-page-container>
      <q-page class="flex flex-center">
        <div style="text-align: center;">
          <div class="text-bold text-h5 q-mb-md">You are authorized to send Mails</div>
          <q-icon name="check_circle" color="positive" size="64px" />
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script>
export default {
  mounted() {
    const fullHash = window.location.hash;
    const secondHash = fullHash.split("#")[2] || fullHash.split("#")[1];
    const urlParams = new URLSearchParams(secondHash);
    const accessToken = urlParams.get("access_token");

    if (accessToken) {
      localStorage.setItem("zoho_access_token", accessToken);
      console.log("Zoho token saved successfully");
    } else {
      console.error("Access token not found in redirect URL");
    }
  },
};
</script>