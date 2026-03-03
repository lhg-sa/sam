import type { ApiResponse, SessionUserResponse } from '@/types/api'
import { ensureOk } from '@/services/http'

const CSRF_COOKIE = 'csrf_token='

export function getCsrfToken(): string {
  const globalToken = (window as { csrf_token?: string }).csrf_token
  if (globalToken) return String(globalToken)

  const cookieMatch = document.cookie
    .split('; ')
    .find((row) => row.startsWith(CSRF_COOKIE))

  return cookieMatch ? decodeURIComponent(cookieMatch.split('=')[1]) : ''
}

export async function ensureCsrfToken(): Promise<string> {
  let token = getCsrfToken()
  if (token) return token

  const res = await fetch('/api/method/sam.api.pmt_novedades.get_csrf_token', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  })

  await ensureOk(res)
  const data = (await res.json().catch(() => ({}))) as ApiResponse<{ csrf_token?: string }>
  token = data?.message?.csrf_token || ''
  return token
}

export async function getSessionUser(): Promise<SessionUserResponse> {
  const response = await fetch('/api/method/sam.api.auth.get_session_user', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  })

  await ensureOk(response)
  const data = (await response.json()) as ApiResponse<SessionUserResponse>
  return data.message || { user: 'Guest', is_guest: true }
}

export async function logout(): Promise<void> {
  const csrfToken = await ensureCsrfToken()

  const response = await fetch('/api/method/logout', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'X-Frappe-CSRF-Token': csrfToken,
    },
    credentials: 'include',
  })

  await ensureOk(response)
}
