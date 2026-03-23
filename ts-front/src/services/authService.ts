import { request } from './apiClient'
import type { AuthResponse } from '../types/api'

export const authService = {
  register(username: string, password: string, secret: string) {
    return request<AuthResponse>('/api/user/register', 'POST', { username, password, secret })
  },
  login(username: string, password: string) {
    return request<AuthResponse>('/api/user/login', 'POST', { username, password })
  },
  refresh(refreshToken: string) {
    return request<AuthResponse>('/api/user/refresh', 'POST', { refreshToken })
  },
}
