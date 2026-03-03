<template>
  <div class="min-h-screen bg-gray-50 pb-20">
    <!-- Header -->
    <header class="bg-white shadow-sm px-4 py-3 flex items-center">
      <router-link to="/" class="text-indigo-900 mr-4">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </router-link>
      <h1 class="text-xl font-bold text-gray-900">Registrar Novedad</h1>
    </header>

    <main class="px-4 py-6">
      <div class="bg-indigo-50 rounded-xl p-4 mb-6 flex items-start">
        <div class="flex-shrink-0 mt-0.5">
          <svg class="h-5 w-5 text-indigo-900" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-indigo-900">
            Por favor, completa los detalles de la incidencia para que nuestro equipo técnico pueda revisarla.
          </p>
        </div>
      </div>

      <form @submit.prevent="submitReport" class="space-y-6">
        <div>
          <label for="tipo" class="block text-sm font-medium text-gray-700 mb-1">
            Tipo de Incidencia
          </label>
          <div class="relative">
            <select id="tipo" v-model="tipo" class="block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-xl appearance-none bg-white border shadow-sm" required>
              <option value="" disabled selected>Seleccionar categoría</option>
              <option value="Accidente de Tránsito">Accidente de Tránsito</option>
              <option value="Semáforo Dañado">Semáforo Dañado</option>
              <option value="Vía Obstruida">Vía Obstruida</option>
              <option value="Otro">Otro</option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div>
          <label for="descripcion" class="block text-sm font-medium text-gray-700 mb-1">
            Descripción
          </label>
          <div class="mt-1">
            <textarea id="descripcion" v-model="descripcion" rows="4" class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-xl p-3 border" placeholder="Escribe los detalles aquí..." required></textarea>
          </div>
        </div>

        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <div class="text-sm font-medium text-gray-700">
            Ubicación GPS automática
          </div>
          <div class="mt-1 text-xs text-gray-500">
            Se captura automáticamente al abrir esta pantalla y se envía por defecto en cada novedad.
          </div>
          <div v-if="gpsError" class="mt-2 text-xs text-red-600">{{ gpsError }}</div>
          <div v-if="latitud !== null && longitud !== null" class="mt-3 text-xs text-gray-600">
            Lat: {{ latitud }} • Lon: {{ longitud }}
            <span v-if="precisionGps !== null"> • ±{{ precisionGps }}m</span>
          </div>
        </div>

        <div>
          <label for="ubicacionTexto" class="block text-sm font-medium text-gray-700 mb-1">
            Referencia de Ubicación
          </label>
          <textarea
            id="ubicacionTexto"
            v-model="ubicacionTexto"
            rows="2"
            class="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-xl p-3 border"
            placeholder="Ej: 5a avenida y 10a calle, zona 1"
          ></textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Evidencia Visual
          </label>
          <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="onFilesSelected" />
          <button
            type="button"
            @click="openFilePicker"
            class="w-full border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-indigo-500 transition-colors py-6"
          >
            <svg class="mx-auto h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span class="text-sm font-medium">Agregar imágenes</span>
          </button>

          <div v-if="imagenes.length" class="mt-3 grid grid-cols-3 gap-3">
            <div v-for="(img, idx) in imagenes" :key="`${img.filename}-${idx}`" class="relative rounded-lg overflow-hidden border border-gray-200">
              <img :src="img.preview" class="w-full h-24 object-cover" />
              <button
                type="button"
                @click="removeImage(idx)"
                class="absolute top-1 right-1 bg-black/60 text-white rounded-full h-6 w-6 text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <div class="pt-4">
          <button :disabled="submitting" type="submit" class="w-full flex justify-center items-center py-4 px-4 border border-transparent rounded-full shadow-sm text-base font-medium text-white bg-indigo-900 hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60">
            <svg class="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            {{ submitting ? 'Enviando...' : 'Enviar Reporte' }}
          </button>
        </div>
      </form>
    </main>

    <BottomNav @logout="handleLogout" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import { ensureCsrfToken, logout } from '@/services/auth'
import { parseApiError } from '@/services/http'
import type { NovedadPayload } from '@/types/api'

const router = useRouter()
const tipo = ref('')
const descripcion = ref('')
const ubicacionTexto = ref('')
const latitud = ref<number | null>(null)
const longitud = ref<number | null>(null)
const precisionGps = ref<number | null>(null)
const gpsLoading = ref(false)
const gpsError = ref('')
const submitting = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

type ImagenPayload = {
  file: File
  filename: string
  preview: string
  image_data?: string
}

const imagenes = ref<ImagenPayload[]>([])

const openFilePicker = () => {
  fileInput.value?.click()
}

const onFilesSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])

  for (const file of files) {
    const preview = URL.createObjectURL(file)
    const image_data = await fileToBase64(file)
    imagenes.value.push({ file, filename: file.name, preview, image_data })
  }

  input.value = ''
}

const removeImage = (index: number) => {
  const img = imagenes.value[index]
  if (img?.preview) {
    URL.revokeObjectURL(img.preview)
  }
  imagenes.value.splice(index, 1)
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

void ensureCsrfToken().catch(() => undefined)

const capturarGPS = async (showError = true) => {
  gpsError.value = ''
  if (!navigator.geolocation) {
    if (showError) {
      gpsError.value = 'El dispositivo no soporta geolocalización.'
    }
    return
  }

  gpsLoading.value = true
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      })
    })

    latitud.value = Number(position.coords.latitude.toFixed(6))
    longitud.value = Number(position.coords.longitude.toFixed(6))
    precisionGps.value = Number(position.coords.accuracy.toFixed(2))
  } catch (error) {
    if (showError) {
      const message = error instanceof Error ? error.message : String(error)
      gpsError.value = `No se pudo obtener GPS: ${message}`
    }
  } finally {
    gpsLoading.value = false
  }
}

onMounted(() => {
  void capturarGPS(false)
})

const submitReport = async () => {
  submitting.value = true
  try {
    const csrfToken = await ensureCsrfToken()

    if (latitud.value === null || longitud.value === null) {
      await capturarGPS(true)
    }

    if (latitud.value === null || longitud.value === null) {
      throw new Error('No se pudo obtener ubicación GPS. Verifica permisos de ubicación e inténtalo de nuevo.')
    }

    const payload: NovedadPayload = {
      tipo_incidencia: tipo.value,
      descripcion: descripcion.value,
      usar_ubicacion_gps: 1,
      latitud: latitud.value,
      longitud: longitud.value,
      precision_gps: precisionGps.value,
      ubicacion_texto: ubicacionTexto.value,
      imagenes: imagenes.value.map((img) => ({
        filename: img.filename,
        image_data: img.image_data,
      })),
    }

    const body = new URLSearchParams({ payload: JSON.stringify(payload) })
    const response = await fetch('/api/method/sam.api.pmt_novedades.create_pmt_novedad', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Frappe-CSRF-Token': csrfToken,
      },
      credentials: 'include',
      body,
    })

    if (!response.ok) {
      throw new Error(await parseApiError(response))
    }

    alert('Novedad registrada exitosamente')
    tipo.value = ''
    descripcion.value = ''
    ubicacionTexto.value = ''
    latitud.value = null
    longitud.value = null
    precisionGps.value = null
    imagenes.value.forEach((img) => URL.revokeObjectURL(img.preview))
    imagenes.value = []
    void capturarGPS(false)
    router.push('/')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    alert(`No se pudo registrar la novedad: ${message}`)
  } finally {
    submitting.value = false
  }
}

const handleLogout = async () => {
  try {
    await logout()
    router.push('/login')
  } catch {
    router.push('/login')
  }
}
</script>
