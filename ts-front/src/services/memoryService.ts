import { request } from './apiClient'
import type {
  ChatbotRequest,
  ChatbotResponse,
  CreateOrUpdateMemoryPayload,
  MemoryAudio,
  MemoryContent,
  MemoryItem,
  MemoryPhoto,
} from '../types/api'

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  (import.meta.env.PROD ? 'http://43.132.123.72' : 'http://localhost:5000')

const REFINED_TEXT_PROMPT = '请帮我将文本进行润色，使其更加流畅、自然、符合中文表达习惯。不要添加任何说明或其他内容。'

function toAbsoluteMediaUrl(path: string): string {
  if (!path) return path
  if (/^https?:\/\//i.test(path)) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL.replace(/\/+$/, '')}${normalizedPath}`
}

export const memoryService = {
  chat(payload: ChatbotRequest) {
    return request<ChatbotResponse>('/api/chatbot/chat', 'POST', payload, { auth: true })
  },
  refineText(message: string) {
    return request<ChatbotResponse>(
      '/api/chatbot/chat',
      'POST',
      { message, systemPrompt: REFINED_TEXT_PROMPT },
      { auth: true },
    )
  },
  create(payload: CreateOrUpdateMemoryPayload) {
    return request<MemoryContent>('/api/content', 'POST', payload, { auth: true })
  },
  getById(id: string) {
    return request<MemoryContent>(`/api/content/${encodeURIComponent(id)}`, 'GET')
  },
  getPhotos(id: string) {
    return request<MemoryPhoto[]>(`/api/content/${encodeURIComponent(id)}/photos`, 'GET')
  },
  getAudios(id: string) {
    return request<MemoryAudio[]>(`/api/content/${encodeURIComponent(id)}/audios`, 'GET')
  },
  getPhotoPath(id: string, photoId: string) {
    return request<{ path: string }>(`/api/content/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`, 'GET')
  },
  getAudioPath(id: string, audioId: string) {
    return request<{ path: string }>(`/api/content/${encodeURIComponent(id)}/audios/${encodeURIComponent(audioId)}`, 'GET')
  },
  toAbsoluteMediaUrl,
  update(id: string, payload: CreateOrUpdateMemoryPayload) {
    return request<MemoryContent>(`/api/content/${encodeURIComponent(id)}`, 'PUT', payload, {
      auth: true,
    })
  },
  delete(id: string) {
    return request<void>(`/api/content/${encodeURIComponent(id)}`, 'DELETE', undefined, {
      auth: true,
    })
  },
  list() {
    return request<MemoryItem[]>('/api/content', 'GET')
  },
  async uploadPhoto(memoryId: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return request<MemoryPhoto>(`/api/content/${encodeURIComponent(memoryId)}/photos`, 'POST', formData, {
      auth: true,
      isFormData: true,
    })
  },
  async uploadAudio(memoryId: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return request<MemoryAudio>(`/api/content/${encodeURIComponent(memoryId)}/audios`, 'POST', formData, {
      auth: true,
      isFormData: true,
    })
  },
  deletePhoto(memoryId: string, photoId: string) {
    return request<void>(
      `/api/content/${encodeURIComponent(memoryId)}/photos/${encodeURIComponent(photoId)}`,
      'DELETE',
      undefined,
      { auth: true },
    )
  },
  deleteAudio(memoryId: string, audioId: string) {
    return request<void>(
      `/api/content/${encodeURIComponent(memoryId)}/audios/${encodeURIComponent(audioId)}`,
      'DELETE',
      undefined,
      { auth: true },
    )
  },
}
