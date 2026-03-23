import type { ApiError } from '../types/api'

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  (import.meta.env.PROD ? 'http://43.132.123.72' : 'http://localhost:5000')

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

let accessToken: string | null = null

function buildUrl(path: string): string {
  if (!API_BASE_URL) return path
  return `${API_BASE_URL.replace(/\/+$/, '')}${path}`
}

export function setAccessToken(token: string | null) {
  accessToken = token
}

export async function request<T>(
  path: string,
  method: HttpMethod,
  body?: BodyInit | object,
  options?: { auth?: boolean; isFormData?: boolean },
): Promise<T> {
  const headers = new Headers()

  if (!(options?.isFormData ?? false)) {
    headers.set('Content-Type', 'application/json')
  }

  if (options?.auth && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const payload =
    body === undefined
      ? undefined
      : body instanceof FormData
        ? body
        : JSON.stringify(body)

  const response = await fetch(buildUrl(path), {
    method,
    headers,
    body: payload,
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const errorBody = (await response.json()) as { message?: string }
      if (errorBody.message) {
        message = errorBody.message
      }
    } catch {
      // Keep default message if no JSON body.
    }

    throw { status: response.status, message } satisfies ApiError
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
