<template>
  <nav class="fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around py-3 px-2 z-50">
    <router-link to="/" class="flex flex-col items-center" :class="isActive('/') ? 'text-indigo-900' : 'text-gray-500 hover:text-indigo-900'">
      <div class="p-2 mb-1" :class="isActive('/') ? 'bg-indigo-100 rounded-full' : ''">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <span class="text-xs" :class="isActive('/') ? 'font-bold' : 'font-medium'">Buscar</span>
    </router-link>

    <router-link to="/report" class="flex flex-col items-center" :class="isActive('/report') ? 'text-indigo-900' : 'text-gray-500 hover:text-indigo-900'">
      <div class="p-2 mb-1 relative" :class="isActive('/report') ? 'bg-indigo-100 rounded-full' : ''">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <span class="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
      </div>
      <span class="text-xs" :class="isActive('/report') ? 'font-bold' : 'font-medium'">Novedades</span>
    </router-link>

    <a href="#" @click.prevent="$emit('logout')" class="flex flex-col items-center text-gray-500 hover:text-indigo-900">
      <div class="p-2 mb-1">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </div>
      <span class="text-xs font-medium">Salir</span>
    </a>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
defineEmits<{ (e: 'logout'): void }>()

const isActive = (path: string) => route.path === path
</script>
