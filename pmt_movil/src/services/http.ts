import type { ApiResponse } from '@/types/api'

export async function parseApiError(response: Response): Promise<string> {
  const asJson = await response.json().catch(() => null as ApiResponse<unknown> | null)
  if (asJson) {
    return (
      (typeof asJson.message === 'string' && asJson.message) ||
      asJson.exc_type ||
      asJson.exception ||
      `HTTP ${response.status}`
    )
  }

  const asText = await response.text().catch(() => '')
  return asText || `HTTP ${response.status}`
}

export async function ensureOk(response: Response): Promise<void> {
  if (!response.ok) {
    throw new Error(await parseApiError(response))
  }
}
