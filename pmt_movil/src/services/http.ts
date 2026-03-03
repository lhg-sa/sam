import type { ApiResponse } from '@/types/api'

function normalizeHtmlText(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractServerMessages(raw?: string): string | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as string[]
    if (!Array.isArray(parsed) || !parsed.length) return null

    const first = String(parsed[0] ?? '').trim()
    if (!first) return null

    return normalizeHtmlText(first)
  } catch {
    return normalizeHtmlText(raw)
  }
}

export async function parseApiError(response: Response): Promise<string> {
  const asJson = await response.json().catch(() => null as ApiResponse<unknown> | null)
  if (asJson) {
    const serverMessage = extractServerMessages(asJson._server_messages)

    return (
      serverMessage ||
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
