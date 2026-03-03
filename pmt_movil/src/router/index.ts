import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Search from '../views/Search.vue'
import Report from '../views/Report.vue'
import { getSessionUser } from '@/services/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/',
    name: 'Search',
    component: Search,
    meta: { requiresAuth: true }
  },
  {
    path: '/report',
    name: 'Report',
    component: Report,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory('/pmt-movil/'),
  routes
})

// Simple auth guard
router.beforeEach(async (to, _from, next) => {
  // Skip auth call for public route
  if (!to.meta.requiresAuth) {
    // If authenticated, avoid showing login again
    if (to.path === '/login') {
      try {
        const session = await getSessionUser()
        if (!session.is_guest) {
          next('/')
          return
        }
      } catch {
        // ignore and continue to login
      }
    }

    next()
    return
  }

  let isLoggedIn = false
  try {
    const session = await getSessionUser()
    isLoggedIn = !session.is_guest
  } catch (e) {
    console.error('Auth check failed', e)
  }

  if (!isLoggedIn) {
    next('/login')
  } else {
    next()
  }
})

export default router
