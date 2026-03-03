<template>
  <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <div class="flex justify-center">
        <div class="h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center">
          <svg class="h-8 w-8 text-indigo-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
      </div>
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        Búsqueda de Placas
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        Sistema de Control Vehicular
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <div class="mb-6 bg-white h-32 rounded-lg flex items-center justify-center border border-gray-200">
          <img src="/lidar-logo.png" alt="LIDAR Holding Group" class="max-h-24 w-auto object-contain" />
        </div>

        <h3 class="text-xl font-bold text-center mb-6">Iniciar Sesión</h3>

        <form class="space-y-6" @submit.prevent="handleLogin">
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700">
              Usuario ERPNext o Email
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <input id="email" v-model="email" name="email" type="text" required class="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border" placeholder="ejemplo@erpnext.com">
            </div>
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <div class="mt-1 relative rounded-md shadow-sm">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input id="password" v-model="password" name="password" :type="showPassword ? 'text' : 'password'" required class="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 pr-10 sm:text-sm border-gray-300 rounded-md py-2 border" placeholder="••••••••">
              <div class="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer" @click="showPassword = !showPassword">
                <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path v-if="!showPassword" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path v-if="!showPassword" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <input id="remember-me" name="remember-me" type="checkbox" class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
              <label for="remember-me" class="ml-2 block text-sm text-gray-900">
                Recordarme
              </label>
            </div>

            <div class="text-sm">
              <a href="#" class="font-medium text-indigo-900 hover:text-indigo-700">
                ¿Olvidaste tu contraseña?
              </a>
            </div>
          </div>

          <div>
            <button type="submit" :disabled="loading" class="w-full flex justify-center py-3 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-indigo-900 hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              <span v-if="loading">Cargando...</span>
              <span v-else class="flex items-center">
                Acceder al Sistema
                <svg class="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              </span>
            </button>
          </div>
        </form>

        <div class="mt-8 text-center text-sm text-gray-600">
          ¿No tienes acceso? <a href="#" class="font-bold text-indigo-900">Contacta al administrador</a>
        </div>
      </div>
    </div>
    
    <div class="mt-8 text-center text-xs text-gray-400">
      © 2024 SEGURIDAD VIAL • VERSIÓN 2.4.0
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)

const handleLogin = async () => {
  loading.value = true
  try {
    const response = await fetch('/api/method/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        usr: email.value,
        pwd: password.value
      }),
      credentials: 'include'
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.message === 'Logged In') {
        router.push('/')
      } else {
        alert('Error de inicio de sesión. Verifica tus credenciales.')
      }
    } else {
      // Handle non-200 responses (like 401 Unauthorized)
      let errorMsg = 'Error de inicio de sesión.'
      try {
        const errorData = await response.json()
        if (errorData.message) {
          errorMsg = typeof errorData.message === 'string' ? errorData.message : 'Credenciales incorrectas.'
        }
      } catch (e) {
        console.error('No se pudo interpretar la respuesta de error', e)
      }
      alert(errorMsg)
    }
  } catch (error) {
    console.error('Login network error:', error)
    alert(`Error de conexión al servidor: ${error instanceof Error ? error.message : 'Desconocido'}`)
  } finally {
    loading.value = false
  }
}
</script>
