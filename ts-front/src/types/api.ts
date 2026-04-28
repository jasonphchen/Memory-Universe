export type ApiError = {
  status: number
  message: string
}

export type AuthResponse = {
  id: string
  username: string
  isSuperuser: boolean
  accessToken: string
  refreshToken: string
}

export type ChatbotRequest = {
  message: string
  systemPrompt?: string
}

export type ChatbotResponse = {
  reply: string
  model: string
}

export type MemoryPhoto = {
  id: string
  url: string
  createdAt: string
}

export type MemoryAudio = {
  id: string
  url: string
  createdAt: string
}

export type MemoryItem = {
  id: string
  title: string
}

export type MemoryContent = {
  id: string
  title: string
  content: string
  time: string
  location: string
  photos: MemoryPhoto[]
  audios: MemoryAudio[]
  createdAt: string
  updatedAt: string
}

export type CreateOrUpdateMemoryPayload = {
  title: string
  content: string
  time: string
  location: string
}
