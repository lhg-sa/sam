<template>
  <div>
    <!-- Android/desktop prompt -->
    <div
      v-if="showDialog"
      class="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/30 p-4"
    >
      <div class="w-full max-w-md bg-white rounded-2xl shadow-xl p-5">
        <h2 class="text-lg font-bold text-gray-900 mb-2">Instalar PMT Movil</h2>
        <p class="text-sm text-gray-600 mb-4">
          Instala la app en tu dispositivo para acceso rápido desde el inicio.
        </p>
        <div class="grid grid-cols-2 gap-3">
          <button
            class="py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            @click="dismiss"
          >
            Ahora no
          </button>
          <button
            class="py-2 rounded-lg bg-indigo-900 text-white hover:bg-indigo-800"
            @click="install"
          >
            Instalar
          </button>
        </div>
      </div>
    </div>

    <!-- iOS instructions -->
    <div
      v-if="iosInstallMessage"
      class="fixed bottom-20 left-3 right-3 z-[70] bg-blue-100 border border-blue-200 rounded-xl p-4 shadow"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-bold text-gray-900 mb-1">Instalar PMT Movil</div>
          <div class="text-xs text-gray-700">
            En iPhone/iPad: toca <span class="font-semibold">Compartir</span> y luego
            <span class="font-semibold">Agregar a pantalla de inicio</span>.
          </div>
        </div>
        <button class="text-gray-700" @click="iosInstallMessage = false">✕</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const STORAGE_KEY = 'pmt_movil_install_prompt_hidden_until'
const HIDE_DAYS = 3

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const showDialog = ref(false)
const iosInstallMessage = ref(false)

const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent)
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true

const dismissedRecently = () => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return false

  const hiddenUntil = Number(raw)
  if (!Number.isFinite(hiddenUntil)) return false

  return Date.now() < hiddenUntil
}

const dismiss = () => {
  showDialog.value = false
  iosInstallMessage.value = false
  const hiddenUntil = Date.now() + HIDE_DAYS * 24 * 60 * 60 * 1000
  localStorage.setItem(STORAGE_KEY, String(hiddenUntil))
}

const install = async () => {
  if (!deferredPrompt.value) return

  await deferredPrompt.value.prompt()
  const choice = await deferredPrompt.value.userChoice
  if (choice.outcome === 'accepted') {
    showDialog.value = false
    deferredPrompt.value = null
    localStorage.removeItem(STORAGE_KEY)
  }
}

if (isIOS() && !isStandalone() && !dismissedRecently()) {
  iosInstallMessage.value = true
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferredPrompt.value = event as BeforeInstallPromptEvent

  if (!isStandalone() && !dismissedRecently()) {
    showDialog.value = true
  }
})

window.addEventListener('appinstalled', () => {
  showDialog.value = false
  iosInstallMessage.value = false
  deferredPrompt.value = null
  localStorage.removeItem(STORAGE_KEY)
})
</script>
