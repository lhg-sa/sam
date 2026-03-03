<template>
  <div class="min-h-screen bg-gray-50 pb-20">
    <!-- Header -->
    <header class="bg-white shadow-sm px-4 py-3 flex justify-between items-center">
      <div class="flex items-center">
        <div class="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
          <svg class="h-6 w-6 text-indigo-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h1 class="text-xl font-bold text-gray-900">Buscador de Placas</h1>
      </div>
      <button class="text-gray-500 hover:text-gray-700">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </button>
    </header>

    <main class="px-4 py-6">
      <h2 class="text-3xl font-bold text-gray-900 mb-2">Buscar Placa</h2>
      <p class="text-gray-600 mb-6">
        Ingresa el número de matrícula para consultar información detallada del vehículo.
      </p>

      <!-- Search Input -->
      <form @submit.prevent="searchPlaca" class="relative mb-8">
        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg class="h-6 w-6 text-indigo-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input 
          v-model="searchQuery" 
          type="text" 
          class="block w-full pl-12 pr-16 py-4 text-lg border-gray-300 rounded-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500 uppercase" 
          placeholder="ABC-1234"
          required
        >
        <button 
          type="submit" 
          class="absolute inset-y-0 right-0 px-6 flex items-center bg-indigo-900 text-white rounded-r-full hover:bg-indigo-800"
          :disabled="loading"
        >
          <svg v-if="!loading" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <span v-else class="text-sm">...</span>
        </button>
      </form>

      <!-- Results Section -->
      <div v-if="searchResultHistory.length > 0" class="mb-8">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold text-gray-900">Resultados (últimas 5 búsquedas)</h3>
          <button @click="clearResultHistory" class="text-indigo-900 text-sm font-medium">Limpiar</button>
        </div>
        
        <div class="space-y-4">
          <div v-for="(searchItem, searchIndex) in searchResultHistory" :key="`${searchItem.placa}-${searchIndex}`" class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div class="flex justify-between items-start mb-3">
              <div>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 mb-2">
                  Placa {{ searchItem.placa }}
                </span>
                <h4 class="text-sm font-medium text-gray-700">
                  {{ searchItem.boletas.length }} boleta(s) encontrada(s)
                </h4>
              </div>
              <div class="text-right text-xs text-gray-500">{{ formatRecentTime(searchItem.searchedAt) }}</div>
            </div>

            <div v-if="searchItem.boletas.length === 0" class="text-sm text-gray-500">
              No se encontraron boletas pendientes para esta búsqueda.
            </div>

            <div v-else class="space-y-3">
              <div v-for="boleta in searchItem.boletas" :key="`${searchItem.placa}-${boleta.boleta_id}`" class="rounded-lg border border-gray-200 p-3">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mb-2">
                      Boleta #{{ boleta.boleta_id }}
                    </span>
                    <h4 class="text-sm font-bold text-gray-900">{{ boleta.nombre_infractor || 'Infractor Desconocido' }}</h4>
                  </div>
                  <div class="text-right">
                    <div class="text-xs text-gray-500">{{ formatDate(boleta.fecha_infraccion || '') }}</div>
                    <div class="text-sm font-bold text-red-600">Q {{ boleta.infraccion_saldo }}</div>
                  </div>
                </div>
                <div class="text-xs text-gray-600 mt-1">
                  <div><span class="font-medium">Placa:</span> {{ boleta.vehiculo_id || 'N/D' }}</div>
                  <div><span class="font-medium">Ubicación:</span> {{ boleta.ubicacion_infraccion || 'N/D' }}</div>
                  <span class="font-medium">Art. {{ boleta.articulo_codigo }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="searched && searchResultHistory.length === 0" class="mb-8 text-center py-8 bg-white rounded-xl shadow-sm">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">No se encontraron boletas</h3>
        <p class="mt-1 text-sm text-gray-500">No hay registros de infracciones para la placa {{ searchQuery }}.</p>
      </div>

      <!-- Recent Searches -->
      <div v-if="!searched || searchResultHistory.length === 0">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold text-gray-900">Búsquedas Recientes</h3>
          <button @click="clearHistory" class="text-indigo-900 text-sm font-medium">Limpiar</button>
        </div>

        <div class="space-y-3">
          <div v-for="(item, index) in recentSearches" :key="index" @click="searchQuery = item.placa; searchPlaca()" class="bg-white p-4 rounded-xl shadow-sm flex items-center justify-between cursor-pointer hover:bg-gray-50">
            <div class="flex items-center">
              <div class="h-10 w-10 rounded-full flex items-center justify-center mr-4" :class="item.bgClass">
                <svg class="h-5 w-5" :class="item.iconClass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div class="font-bold text-gray-900 text-lg">{{ item.placa }}</div>
                <div class="text-sm text-gray-500">{{ item.desc }} • {{ formatRecentTime(item.time) }}</div>
              </div>
            </div>
            <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Stats Card -->
      <div class="mt-8 bg-indigo-900 rounded-2xl p-6 text-white relative overflow-hidden">
        <div class="relative z-10">
          <div class="text-sm font-medium text-indigo-200 mb-1">Consultas hoy</div>
          <div class="text-4xl font-bold mb-2">{{ consultasHoy.toLocaleString('es-GT') }}</div>
          <div class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-800 text-indigo-100">
            Consultas realizadas hoy
          </div>
        </div>
        <svg class="absolute right-0 bottom-0 h-32 w-32 text-indigo-800 transform translate-x-4 translate-y-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      <div class="mt-6 bg-white rounded-2xl p-4 border border-gray-200">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-sm font-medium text-gray-800">Ubicación GPS actual</div>
            <div class="text-xs text-gray-500">Opcional para usar en búsquedas y novedades</div>
          </div>
          <button
            type="button"
            @click="capturarGPS"
            :disabled="gpsLoading"
            class="px-3 py-2 text-sm rounded-lg bg-indigo-100 text-indigo-900 hover:bg-indigo-200 disabled:opacity-50"
          >
            {{ gpsLoading ? 'Obteniendo...' : 'Capturar GPS' }}
          </button>
        </div>
        <div v-if="gpsError" class="mt-2 text-xs text-red-600">{{ gpsError }}</div>
        <div v-if="latitud !== null && longitud !== null" class="mt-2 text-xs text-gray-600">
          Lat: {{ latitud }} • Lon: {{ longitud }}
          <span v-if="precisionGps !== null"> • ±{{ precisionGps }}m</span>
        </div>
      </div>
    </main>

    <BottomNav @logout="handleLogout" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import { ensureCsrfToken, logout } from '@/services/auth'
import type { Boleta, SearchResultHistoryItem } from '@/types/api'

const router = useRouter()
const searchQuery = ref('')
const loading = ref(false)
const searched = ref(false)
const results = ref<Boleta[]>([])
const searchResultHistory = ref<SearchResultHistoryItem[]>([])
const CONSULTAS_STORAGE_KEY = 'pmt_movil_consultas_hoy'
const RECENT_SEARCHES_STORAGE_KEY = 'pmt_movil_recent_searches'
const consultasHoy = ref(0)
const latitud = ref<number | null>(null)
const longitud = ref<number | null>(null)
const precisionGps = ref<number | null>(null)
const gpsLoading = ref(false)
const gpsError = ref('')

const getTodayKey = () => new Date().toISOString().slice(0, 10)

void ensureCsrfToken().catch(() => undefined)

const loadConsultasHoy = () => {
  try {
    const raw = localStorage.getItem(CONSULTAS_STORAGE_KEY)
    if (!raw) return 0

    const parsed = JSON.parse(raw) as { date?: string; count?: number }
    if (parsed.date !== getTodayKey()) return 0

    return Number.isFinite(parsed.count) ? Number(parsed.count) : 0
  } catch {
    return 0
  }
}

const saveConsultasHoy = (count: number) => {
  consultasHoy.value = count
  localStorage.setItem(
    CONSULTAS_STORAGE_KEY,
    JSON.stringify({ date: getTodayKey(), count })
  )
}

const incrementConsultasHoy = () => {
  saveConsultasHoy(loadConsultasHoy() + 1)
}

type RecentSearchVisualItem = {
  placa: string
  desc: string
  time: string
  ageDays: number
  bgClass: string
  iconClass: string
}

const getAgeDaysFromDate = (dateString?: string) => {
  if (!dateString) return 0
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 0

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

const getRecentSearchColor = (ageDays: number) => {
  if (ageDays <= 30) {
    return { bgClass: 'bg-green-100', iconClass: 'text-green-700' }
  }
  if (ageDays <= 60) {
    return { bgClass: 'bg-orange-100', iconClass: 'text-orange-700' }
  }
  return { bgClass: 'bg-red-100', iconClass: 'text-red-700' }
}

const loadRecentSearches = () => {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY)
    if (!raw) return [] as RecentSearchVisualItem[]

    const parsed = JSON.parse(raw) as {
      date?: string
      items?: RecentSearchVisualItem[]
    }

    if (parsed.date !== getTodayKey()) return []
    return Array.isArray(parsed.items)
      ? parsed.items.map((item) => {
          const ageDays = Number.isFinite(item.ageDays)
            ? Number(item.ageDays)
            : getAgeDaysFromDate(item.time)
          const color = getRecentSearchColor(ageDays)
          return {
            placa: item.placa,
            desc: item.desc,
            time: item.time,
            ageDays,
            bgClass: color.bgClass,
            iconClass: color.iconClass,
          }
        })
      : []
  } catch {
    return []
  }
}

const saveRecentSearches = (items: RecentSearchVisualItem[]) => {
  localStorage.setItem(
    RECENT_SEARCHES_STORAGE_KEY,
    JSON.stringify({ date: getTodayKey(), items })
  )
}

consultasHoy.value = loadConsultasHoy()

const capturarGPS = () => {
  gpsError.value = ''
  if (!navigator.geolocation) {
    gpsError.value = 'El dispositivo no soporta geolocalización.'
    return
  }

  gpsLoading.value = true
  navigator.geolocation.getCurrentPosition(
    (position) => {
      latitud.value = Number(position.coords.latitude.toFixed(6))
      longitud.value = Number(position.coords.longitude.toFixed(6))
      precisionGps.value = Number(position.coords.accuracy.toFixed(2))
      gpsLoading.value = false
    },
    (error) => {
      gpsError.value = `No se pudo obtener GPS: ${error.message}`
      gpsLoading.value = false
    },
    { enableHighAccuracy: true, timeout: 10000 }
  )
}

const recentSearches = ref<RecentSearchVisualItem[]>(loadRecentSearches())

const clearHistory = () => {
  recentSearches.value = []
  saveRecentSearches([])
}

const clearResultHistory = () => {
  searchResultHistory.value = []
}

const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('es-ES', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  }).format(date)
}

const formatRecentTime = (dateString: string) => {
  if (!dateString) return 'Sin fecha'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return dateString
  return new Intl.DateTimeFormat('es-GT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const searchPlaca = async () => {
  if (!searchQuery.value) return

  incrementConsultasHoy()
  
  loading.value = true
  searched.value = true
  
  try {
    // Build query parameters properly
    const params = new URLSearchParams({
      filters: JSON.stringify([
        ["vehiculo_id", "=", searchQuery.value.toUpperCase()],
        ["estado_boleta", "=", "PENDIENTE-PAGO"]
      ]),
      fields: JSON.stringify([
        "name",
        "boleta_id",
        "vehiculo_id",
        "fecha_infraccion",
        "ubicacion_infraccion",
        "nombre_infractor",
        "articulo_codigo",
        "infraccion_saldo",
        "estado_boleta"
      ]),
      limit_page_length: '500',
      order_by: 'fecha_infraccion desc'
    })

    // Call Frappe API to get PMT Boleta records
    const response = await fetch(`/api/resource/PMT Boleta?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      credentials: 'include' // Ensure cookies are sent
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('API Response:', data)
      results.value = data.data || []

      searchResultHistory.value.unshift({
        placa: searchQuery.value.toUpperCase(),
        searchedAt: new Date().toISOString(),
        boletas: [...results.value],
      })
      if (searchResultHistory.value.length > 5) {
        searchResultHistory.value = searchResultHistory.value.slice(0, 5)
      }
      
      // Add to recent searches if found
      if (results.value.length > 0) {
        const exists = recentSearches.value.find(s => s.placa === searchQuery.value.toUpperCase())
        if (!exists) {
          const boletaDate = results.value[0]?.fecha_infraccion
          const ageDays = getAgeDaysFromDate(boletaDate)
          const color = getRecentSearchColor(ageDays)

          recentSearches.value.unshift({
            placa: searchQuery.value.toUpperCase(),
            desc: 'Vehículo',
            time: boletaDate || new Date().toISOString(),
            ageDays,
            bgClass: color.bgClass,
            iconClass: color.iconClass,
          })
          if (recentSearches.value.length > 5) recentSearches.value.pop()
        }
        saveRecentSearches(recentSearches.value)
      }
    } else if (response.status === 401 || response.status === 403) {
      console.error('Unauthorized or Forbidden. Redirecting to login.')
      router.push('/login')
    } else {
      console.error('Error fetching data', response.status)
      results.value = []
    }
  } catch (error) {
    console.error('Search error:', error)
    results.value = []
  } finally {
    loading.value = false
  }
}

const handleLogout = async () => {
  try {
    await logout()
    router.push('/login')
  } catch (error) {
    console.error('Logout error:', error)
    router.push('/login')
  }
}
</script>
