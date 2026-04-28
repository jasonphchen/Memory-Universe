import { useEffect, useRef, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import { memoryService } from '../services'
import type { ApiError, MemoryContent } from '../types/api'

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

export function AddMemoryDialog({ isOpen, onClose, onCreated }: AddMemoryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const [formState, setFormState] = useState<FormState>(initialFormState)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [audioFiles, setAudioFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  const [contentBeforeRefine, setContentBeforeRefine] = useState<string | null>(null)
  const isBusy = isSubmitting || isRefining

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

  const handleRevertContent = () => {
    if (contentBeforeRefine === null) {
      return
    }

    setFormState((prev) => ({ ...prev, content: contentBeforeRefine }))
    setContentBeforeRefine(null)
    setError('')
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
                  '文字助手'
                )}
              </button>
            </div>
          </label>

          <label className="auth-label">
            图片
            <div className="file-picker-row">
              <label
                htmlFor="photo-file-input"
                className={`file-picker-trigger ${isBusy ? 'disabled' : ''}`}
              >
                选择图片
              </label>
              <span className="file-picker-name">
                {photoFiles.length > 0 ? `已选择 ${photoFiles.length} 张` : ''}
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
                const selected = Array.from(event.target.files ?? [])
                if (selected.length > 0) {
                  setPhotoFiles((prev) => appendUniqueFiles(prev, selected))
                }
                event.currentTarget.value = ''
              }}
              disabled={isBusy}
            />
          </label>

          <label className="auth-label">
            音频
            <div className="file-picker-row">
              <label
                htmlFor="audio-file-input"
                className={`file-picker-trigger ${isBusy ? 'disabled' : ''}`}
              >
                选择音频
              </label>
              <span className="file-picker-name">
                {audioFiles.length > 0 ? `已选择 ${audioFiles.length} 段` : ''}
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
                const selected = Array.from(event.target.files ?? [])
                if (selected.length > 0) {
                  setAudioFiles((prev) => appendUniqueFiles(prev, selected))
                }
                event.currentTarget.value = ''
              }}
              disabled={isBusy}
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
