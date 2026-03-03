<script setup lang="ts">
import InstallPrompt from '@/components/InstallPrompt.vue'
</script>

<template>
  <router-view />
  <InstallPrompt />
</template>

<style>
#app {
  max-width: 100%;
  margin: 0;
  padding: 0;
  text-align: left;
}
</style>
