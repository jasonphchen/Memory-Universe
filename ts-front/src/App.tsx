import { useEffect, useState } from 'react'
import { MemoryPanel } from './components/MemoryPanel'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { UniverseScene } from './components/UniverseScene'
import type { MemoryNode } from './components/memory.types'
import { AuthDialog } from './components/auth/AuthDialog'
import { AddMemoryDialog } from './components/AddMemoryDialog'
import { EditMemoryDialog } from './components/EditMemoryDialog'
import { authService, memoryService, setAccessToken } from './services'
import type { AuthResponse, MemoryContent } from './types/api'
import {
  universeThemes,
  type UniverseTheme,
  type UniverseThemeId,
} from './components/universeThemes'
import './App.css'

type AuthUser = {
  id: string
  username: string
  isSuperuser: boolean
}

const AUTH_REFRESH_TOKEN_KEY = 'memory_universe_refresh_token'
const AUTH_USER_KEY = 'memory_universe_user'
const LEGACY_ACCESS_TOKEN_KEY = 'memory_universe_access_token'

function App() {
  const [memories, setMemories] = useState<MemoryNode[]>([])
  const [selectedMemory, setSelectedMemory] = useState<MemoryContent | null>(null)
  const [isMemoryLoading, setIsMemoryLoading] = useState(false)
  const [memoryErrorMessage, setMemoryErrorMessage] = useState('')
  const [themeId, setThemeId] = useState<UniverseThemeId>('galaxy')
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [addMemoryDialogOpen, setAddMemoryDialogOpen] = useState(false)
  const [editMemoryDialogOpen, setEditMemoryDialogOpen] = useState(false)
  const [memoryToEdit, setMemoryToEdit] = useState<MemoryContent | null>(null)
  const selectedTheme =
    universeThemes.find((theme) => theme.id === themeId) ?? (universeThemes[0] as UniverseTheme)

  const clearAuthState = () => {
    setAccessToken(null)
    setAuthUser(null)
    localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
    localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY)
  }

  const loadMemoryList = async () => {
    try {
      const list = await memoryService.list()
      setMemories(list.map((item) => ({ id: item.id, title: item.title })))
    } catch {
      setMemories([])
    }
  }

  const handleAuthSuccess = (response: AuthResponse) => {
    const user: AuthUser = {
      id: response.id,
      username: response.username,
      isSuperuser: response.isSuperuser,
    }

    setAccessToken(response.accessToken)
    setAuthUser(user)
    localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, response.refreshToken)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
    localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY)
    loadMemoryList()
  }

  useEffect(() => {
    loadMemoryList()

    const savedRefreshToken = localStorage.getItem(AUTH_REFRESH_TOKEN_KEY)
    const savedUser = localStorage.getItem(AUTH_USER_KEY)

    if (!savedRefreshToken || !savedUser) {
      setAccessToken(null)
      localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY)
      return
    }

    const bootstrapAuth = async () => {
      try {
        JSON.parse(savedUser)
      } catch {
        clearAuthState()
        return
      }

      try {
        const refreshed = await authService.refresh(savedRefreshToken)
        handleAuthSuccess(refreshed)
      } catch {
        clearAuthState()
      }
    }

    bootstrapAuth()
  }, [])

  const handleSelectMemory = async (memoryId: string) => {
    try {
      setMemoryErrorMessage('')
      setIsMemoryLoading(true)
      setSelectedMemory(null)
      const [memory, photos, audios] = await Promise.all([
        memoryService.getById(memoryId),
        memoryService.getPhotos(memoryId),
        memoryService.getAudios(memoryId),
      ])

      const resolvedPhotos = await Promise.all(
        photos.map(async (photo) => {
          const result = await memoryService.getPhotoPath(memoryId, photo.id)
          return { ...photo, url: memoryService.toAbsoluteMediaUrl(result.path) }
        }),
      )

      const resolvedAudios = await Promise.all(
        audios.map(async (audio) => {
          const result = await memoryService.getAudioPath(memoryId, audio.id)
          return { ...audio, url: memoryService.toAbsoluteMediaUrl(result.path) }
        }),
      )

      setSelectedMemory({
        ...memory,
        photos: resolvedPhotos,
        audios: resolvedAudios,
      })
    } catch {
      setMemoryErrorMessage('记忆加载失败，请稍后重试。')
    } finally {
      setIsMemoryLoading(false)
    }
  }

  const handleCloseMemoryPanel = () => {
    setSelectedMemory(null)
    setIsMemoryLoading(false)
    setMemoryErrorMessage('')
  }

  const handleMemoryCreated = async (memory: MemoryContent) => {
    await loadMemoryList()
    await handleSelectMemory(memory.id)
  }

  const handleEditSaved = async (memoryId: string) => {
    await loadMemoryList()
    await handleSelectMemory(memoryId)
  }

  const handleDeleteMemory = async (memory: MemoryContent) => {
    try {
      await memoryService.delete(memory.id)
      await loadMemoryList()
      handleCloseMemoryPanel()
    } catch {
      setMemoryErrorMessage('删除失败，请稍后重试。')
    }
  }

  // const handleLogout = () => {
  //   setSelectedMemory(null)
  //   setAccessToken(null)
  //   setAuthUser(null)
  //   localStorage.removeItem(AUTH_TOKEN_KEY)
  //   localStorage.removeItem(AUTH_USER_KEY)
  // }

  return (
    <div className={`universe-app theme-${selectedTheme.id}`}>
      <UniverseScene
        memories={memories}
        onSelectMemory={handleSelectMemory}
        theme={selectedTheme}
      />

      {/* <div className="universe-caption">点击一颗星球，查看它的故事。</div> */}

      <div className="auth-toolbar">
        {authUser ? (
          <>
            <span className="auth-user">Hi, {authUser.username}</span>
            {/* <button type="button" className="auth-toolbar-button" onClick={handleLogout}>
              退出
            </button> */}
          </>
        ) : (
          <button type="button" className="auth-toolbar-button" onClick={() => setAuthDialogOpen(true)}>
            登录
          </button>
        )}
      </div>

      <ThemeSwitcher
        themes={universeThemes}
        selectedThemeId={themeId}
        onSelectTheme={setThemeId}
      />

      {authUser ? (
        <button
          type="button"
          className="add-memory-fab"
          aria-label="新增记忆"
          onClick={() => setAddMemoryDialogOpen(true)}
        >
          +
        </button>
      ) : null}

      <MemoryPanel
        selectedMemory={selectedMemory}
        isLoading={isMemoryLoading}
        errorMessage={memoryErrorMessage}
        canManage={!!authUser}
        onEdit={(memory) => {
          setMemoryToEdit(memory)
          setEditMemoryDialogOpen(true)
        }}
        onDelete={handleDeleteMemory}
        onClose={handleCloseMemoryPanel}
      />
      <AuthDialog
        isOpen={authDialogOpen}
        onClose={() => setAuthDialogOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
      <AddMemoryDialog
        isOpen={addMemoryDialogOpen}
        onClose={() => setAddMemoryDialogOpen(false)}
        onCreated={handleMemoryCreated}
      />
      <EditMemoryDialog
        isOpen={editMemoryDialogOpen}
        memory={memoryToEdit}
        onClose={() => {
          setEditMemoryDialogOpen(false)
          setMemoryToEdit(null)
        }}
        onSaved={handleEditSaved}
      />
    </div>
  )
}

export default App
