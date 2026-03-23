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

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as ApiError).message)
  }
  return '保存失败，请稍后重试。'
}

export function AddMemoryDialog({ isOpen, onClose, onCreated }: AddMemoryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const [formState, setFormState] = useState<FormState>(initialFormState)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [audioFiles, setAudioFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

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
    if (event.target === event.currentTarget && !isSubmitting) {
      onClose()
    }
  }

  const handleClose = () => {
    if (isOpen) {
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
      onCreated?.(created)
      onClose()
    } catch (submitError) {
      setError(getErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="create-memory-dialog"
      onClick={handleBackdropClick}
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
              required
            />
          </label>

          <label className="auth-label">
            内容
            <textarea
              className="auth-input create-memory-textarea"
              value={formState.content}
              onChange={(event) => setFormState((prev) => ({ ...prev, content: event.target.value }))}
              disabled={isSubmitting}
              rows={4}
              required
            />
          </label>

          <label className="auth-label">
            图片
            <div className="file-picker-row">
              <label
                htmlFor="photo-file-input"
                className={`file-picker-trigger ${isSubmitting ? 'disabled' : ''}`}
              >
                选择图片
              </label>
              <span className="file-picker-name">
                {photoFiles.length > 0 ? `已选择 ${photoFiles.length} 张` : ''}
              </span>
            </div>
            <input
              id="photo-file-input"
              className="file-input-hidden"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => setPhotoFiles(Array.from(event.target.files ?? []))}
              disabled={isSubmitting}
            />
          </label>

          <label className="auth-label">
            音频
            <div className="file-picker-row">
              <label
                htmlFor="audio-file-input"
                className={`file-picker-trigger ${isSubmitting ? 'disabled' : ''}`}
              >
                选择音频
              </label>
              <span className="file-picker-name">
                {audioFiles.length > 0 ? `已选择 ${audioFiles.length} 段` : ''}
              </span>
            </div>
            <input
              id="audio-file-input"
              className="file-input-hidden"
              type="file"
              accept="audio/*"
              multiple
              onChange={(event) => setAudioFiles(Array.from(event.target.files ?? []))}
              disabled={isSubmitting}
            />
          </label>

          <div className="create-memory-actions">
            <button type="button" className="auth-toolbar-button" onClick={onClose} disabled={isSubmitting}>
              取消
            </button>
            <button type="submit" className="auth-submit" disabled={isSubmitting}>
              {isSubmitting ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
