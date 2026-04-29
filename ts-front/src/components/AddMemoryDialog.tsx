import { useEffect, useRef, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import { memoryService } from '../services'
import type { ApiError, ChatbotImageInput, MemoryContent } from '../types/api'

type AddMemoryDialogProps = {
  isOpen: boolean
  onClose: () => void
  onCreated?: (memory: MemoryContent) => void
}

type FormState = {
  title: string
  time: string
  location: string
  content: string
}

const MAX_PHOTO_COUNT = 3
const MAX_AUDIO_COUNT = 3

const initialFormState: FormState = {
  title: '',
  time: '',
  location: '',
  content: '',
}

function getFileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function appendUniqueFiles(previousFiles: File[], incomingFiles: File[]): File[] {
  const existing = new Set(previousFiles.map(getFileKey))
  const next = [...previousFiles]
  incomingFiles.forEach((file) => {
    const key = getFileKey(file)
    if (!existing.has(key)) {
      existing.add(key)
      next.push(file)
    }
  })
  return next
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as ApiError).message)
  }
  return fallbackMessage
}

function getImageTypeFromFile(file: File): string {
  if (file.type.startsWith('image/')) {
    return file.type
  }

  return file.name.split('.').pop() ?? ''
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function fileToChatbotImage(file: File): Promise<ChatbotImageInput> {
  return {
    base64: await fileToDataUrl(file),
    imageType: getImageTypeFromFile(file),
  }
}

function buildMemoryAssistantMessage(formState: FormState): string {
  return [
    `标题：${formState.title.trim()}`,
    `时间：${formState.time}`,
    `地点：${formState.location.trim()}`,
    `内容：${formState.content.trim()}`,
  ].join('\n')
}

export function AddMemoryDialog({ isOpen, onClose, onCreated }: AddMemoryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const [formState, setFormState] = useState<FormState>(initialFormState)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [audioFiles, setAudioFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  const [isRefiningWithImages, setIsRefiningWithImages] = useState(false)
  const [contentBeforeRefine, setContentBeforeRefine] = useState<string | null>(null)
  const isBusy = isSubmitting || isRefining || isRefiningWithImages
  const isPhotoLimitReached = photoFiles.length >= MAX_PHOTO_COUNT
  const isAudioLimitReached = audioFiles.length >= MAX_AUDIO_COUNT

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) {
      dialog.showModal()
      return
    }

    if (!isOpen && dialog.open) {
      dialog.close()
    }
  }, [isOpen])

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget && !isBusy) {
      onClose()
    }
  }

  const handleClose = () => {
    if (isOpen && !isBusy) {
      onClose()
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!formState.title || !formState.time || !formState.location || !formState.content) {
      setError('请填写标题、时间、地点和内容。')
      return
    }

    try {
      setIsSubmitting(true)
      setError('')

      const created = await memoryService.create({
        title: formState.title.trim(),
        content: formState.content.trim(),
        time: formState.time,
        location: formState.location.trim(),
      })

      if (photoFiles.length > 0) {
        await Promise.all(photoFiles.map((file) => memoryService.uploadPhoto(created.id, file)))
      }
      if (audioFiles.length > 0) {
        await Promise.all(audioFiles.map((file) => memoryService.uploadAudio(created.id, file)))
      }

      setFormState(initialFormState)
      setPhotoFiles([])
      setAudioFiles([])
      setContentBeforeRefine(null)
      onCreated?.(created)
      onClose()
    } catch (submitError) {
      setError(getErrorMessage(submitError, '保存失败，请稍后重试。'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRefineContent = async () => {
    if (!formState.content.trim()) {
      setError('请先输入要润色的内容。')
      return
    }

    const originalContent = formState.content

    try {
      setIsRefining(true)
      setError('')
      const response = await memoryService.refineText(originalContent)
      setContentBeforeRefine(originalContent)
      setFormState((prev) => ({ ...prev, content: response.reply }))
    } catch (refineError) {
      setError(getErrorMessage(refineError, '润色失败，请稍后重试。'))
    } finally {
      setIsRefining(false)
    }
  }

  const handleRefineContentWithImages = async () => {
    if (!formState.title.trim() || !formState.time || !formState.location.trim() || !formState.content.trim()) {
      setError('请先填写标题、时间、地点和内容。')
      return
    }

    if (photoFiles.length === 0) {
      setError('请先选择至少一张图片。')
      return
    }

    const originalContent = formState.content

    try {
      setIsRefiningWithImages(true)
      setError('')
      const images = await Promise.all(photoFiles.map(fileToChatbotImage))
      const response = await memoryService.refineTextWithImages(buildMemoryAssistantMessage(formState), images)
      setContentBeforeRefine(originalContent)
      setFormState((prev) => ({ ...prev, content: response.reply }))
    } catch (refineError) {
      setError(getErrorMessage(refineError, '图文润色失败，请稍后重试。'))
    } finally {
      setIsRefiningWithImages(false)
    }
  }

  const handleRevertContent = () => {
    if (contentBeforeRefine === null) {
      return
    }

    setFormState((prev) => ({ ...prev, content: contentBeforeRefine }))
    setContentBeforeRefine(null)
    setError('')
  }

  const handlePhotoChange = (files: FileList | null) => {
    const selected = Array.from(files ?? [])
    if (selected.length === 0) {
      return
    }

    const mergedFiles = appendUniqueFiles(photoFiles, selected)
    if (mergedFiles.length > MAX_PHOTO_COUNT) {
      setError(`每次最多上传 ${MAX_PHOTO_COUNT} 张图片。`)
    } else {
      setError('')
    }

    setPhotoFiles(mergedFiles.slice(0, MAX_PHOTO_COUNT))
  }

  const handleAudioChange = (files: FileList | null) => {
    const selected = Array.from(files ?? [])
    if (selected.length === 0) {
      return
    }

    const mergedFiles = appendUniqueFiles(audioFiles, selected)
    if (mergedFiles.length > MAX_AUDIO_COUNT) {
      setError(`每次最多上传 ${MAX_AUDIO_COUNT} 段音频。`)
    } else {
      setError('')
    }

    setAudioFiles(mergedFiles.slice(0, MAX_AUDIO_COUNT))
  }

  return (
    <dialog
      ref={dialogRef}
      className="create-memory-dialog"
      onClick={handleBackdropClick}
      onCancel={(event) => {
        if (isBusy) {
          event.preventDefault()
        }
      }}
      onClose={handleClose}
    >
      <div className="create-memory-dialog-content">
        <h2>新增记忆</h2>
        <p className="auth-subtitle">填写基础信息后可选上传多张图片和多段音频。</p>
        {error ? <p className="auth-error">{error}</p> : null}

        <form className="create-memory-form" onSubmit={handleSubmit}>
          <label className="auth-label">
            标题
            <input
              className="auth-input"
              type="text"
              value={formState.title}
              onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
              disabled={isBusy}
              required
            />
          </label>

          <label className="auth-label">
            时间
            <input
              className="auth-input create-memory-date"
              type="date"
              value={formState.time}
              onChange={(event) => setFormState((prev) => ({ ...prev, time: event.target.value }))}
              disabled={isBusy}
              required
            />
          </label>

          <label className="auth-label">
            地点
            <input
              className="auth-input"
              type="text"
              value={formState.location}
              onChange={(event) => setFormState((prev) => ({ ...prev, location: event.target.value }))}
              disabled={isBusy}
              required
            />
          </label>

          <label className="auth-label">
            内容
            <textarea
              className="auth-input create-memory-textarea"
              value={formState.content}
              onChange={(event) => setFormState((prev) => ({ ...prev, content: event.target.value }))}
              disabled={isBusy}
              rows={4}
              required
            />
            <div className="text-assistant-row">
              <button
                type="button"
                className="text-assistant-icon-button"
                onClick={handleRevertContent}
                disabled={isBusy || contentBeforeRefine === null}
                aria-label="恢复润色前文本"
                title="恢复润色前文本"
              >
                ↺
              </button>
              <button
                type="button"
                className="text-assistant-button"
                onClick={handleRefineContent}
                disabled={isBusy || !formState.content.trim()}
              >
                {isRefining ? (
                  <>
                    <span className="text-assistant-spinner" aria-hidden="true" />
                    润色中...
                  </>
                ) : (
                  '文字AI助手'
                )}
              </button>
              <button
                type="button"
                className="text-assistant-button"
                onClick={handleRefineContentWithImages}
                disabled={
                  isBusy ||
                  photoFiles.length === 0 ||
                  !formState.title.trim() ||
                  !formState.time ||
                  !formState.location.trim() ||
                  !formState.content.trim()
                }
              >
                {isRefiningWithImages ? (
                  <>
                    <span className="text-assistant-spinner" aria-hidden="true" />
                    图文润色中...
                  </>
                ) : (
                  '图文AI助手'
                )}
              </button>
            </div>
          </label>

          <label className="auth-label">
            图片
            <div className="file-picker-row">
              <label
                htmlFor="photo-file-input"
                className={`file-picker-trigger ${isBusy || isPhotoLimitReached ? 'disabled' : ''}`}
              >
                选择图片
              </label>
              <span className="file-picker-name">
                {photoFiles.length > 0 ? `已选择 ${photoFiles.length}/${MAX_PHOTO_COUNT} 张` : `最多 ${MAX_PHOTO_COUNT} 张`}
              </span>
            </div>
            {photoFiles.length > 0 ? (
              <div className="selected-file-list">
                {photoFiles.map((file) => (
                  <div key={getFileKey(file)} className="selected-file-item">
                    <span className="selected-file-item-name">{file.name}</span>
                    <button
                      type="button"
                      className="selected-file-remove"
                      onClick={() =>
                        setPhotoFiles((prev) => prev.filter((x) => getFileKey(x) !== getFileKey(file)))
                      }
                      disabled={isBusy}
                      aria-label={`删除图片 ${file.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <input
              id="photo-file-input"
              className="file-input-hidden"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                handlePhotoChange(event.target.files)
                event.currentTarget.value = ''
              }}
              disabled={isBusy || isPhotoLimitReached}
            />
          </label>

          <label className="auth-label">
            音频
            <div className="file-picker-row">
              <label
                htmlFor="audio-file-input"
                className={`file-picker-trigger ${isBusy || isAudioLimitReached ? 'disabled' : ''}`}
              >
                选择音频
              </label>
              <span className="file-picker-name">
                {audioFiles.length > 0 ? `已选择 ${audioFiles.length}/${MAX_AUDIO_COUNT} 段` : `最多 ${MAX_AUDIO_COUNT} 段`}
              </span>
            </div>
            {audioFiles.length > 0 ? (
              <div className="selected-file-list">
                {audioFiles.map((file) => (
                  <div key={getFileKey(file)} className="selected-file-item">
                    <span className="selected-file-item-name">{file.name}</span>
                    <button
                      type="button"
                      className="selected-file-remove"
                      onClick={() =>
                        setAudioFiles((prev) => prev.filter((x) => getFileKey(x) !== getFileKey(file)))
                      }
                      disabled={isBusy}
                      aria-label={`删除音频 ${file.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <input
              id="audio-file-input"
              className="file-input-hidden"
              type="file"
              accept="audio/*"
              multiple
              onChange={(event) => {
                handleAudioChange(event.target.files)
                event.currentTarget.value = ''
              }}
              disabled={isBusy || isAudioLimitReached}
            />
          </label>

          <div className="create-memory-actions">
            <button type="button" className="auth-toolbar-button" onClick={onClose} disabled={isBusy}>
              取消
            </button>
            <button type="submit" className="auth-submit" disabled={isBusy}>
              {isSubmitting ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
