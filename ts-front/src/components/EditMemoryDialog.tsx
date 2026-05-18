import { useEffect, useRef, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import {
  createLangchainService,
  extractLocationFromPhotos,
  memoryService,
  REFINED_TEXT_PHOTO_PROMPT,
  STORY_TEXT_PHOTO_PROMPT,
} from '../services'
import type { LangchainAudioInput, LangchainImageInput } from '../services'
import type { ApiError, MemoryAudio, MemoryContent, MemoryPhoto } from '../types/api'
import { AudioTranscribeButton } from './AudioTranscribeButton'
import { useI18n } from '../i18n/I18nContext'

type EditMemoryDialogProps = {
  memory: MemoryContent | null
  isOpen: boolean
  onClose: () => void
  onSaved?: (memoryId: string) => void
}

type FormState = {
  title: string
  time: string
  location: string
  content: string
}

const MAX_PHOTO_COUNT = 3
const MAX_AUDIO_COUNT = 3

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

function toDateInputValue(value: string): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getFileNameFromUrl(url: string, fallback: string): string {
  if (!url) return fallback
  const cleaned = url.split('?')[0]
  const fileName = cleaned.split('/').pop()
  if (!fileName) return fallback
  try {
    return decodeURIComponent(fileName)
  } catch {
    return fileName
  }
}

function getImageTypeFromFile(file: File): string {
  if (file.type.startsWith('image/')) {
    return file.type
  }

  return file.name.split('.').pop() ?? ''
}

function getImageTypeFromUrl(url: string): string {
  const cleanUrl = url.split('?')[0]
  return cleanUrl.split('.').pop() ?? ''
}

function getAudioTypeFromFile(file: File): string {
  if (file.type.startsWith('audio/')) {
    return file.type
  }

  return file.name.split('.').pop() ?? ''
}

function getAudioTypeFromUrl(url: string): string {
  const cleanUrl = url.split('?')[0]
  return cleanUrl.split('.').pop() ?? ''
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function fileToChatbotImage(file: File): Promise<LangchainImageInput> {
  return {
    base64: await blobToDataUrl(file),
    imageType: getImageTypeFromFile(file),
  }
}

async function fileToChatbotAudio(file: File): Promise<LangchainAudioInput> {
  return {
    base64: await blobToDataUrl(file),
    audioType: getAudioTypeFromFile(file),
  }
}

async function photoToChatbotImage(
  photo: MemoryPhoto,
  errorMessage: string,
): Promise<LangchainImageInput> {
  const response = await fetch(memoryService.toAbsoluteMediaUrl(photo.url))
  if (!response.ok) {
    throw new Error(errorMessage)
  }

  const blob = await response.blob()
  return {
    base64: await blobToDataUrl(blob),
    imageType: blob.type || getImageTypeFromUrl(photo.url),
  }
}

async function audioToChatbotAudio(
  audio: MemoryAudio,
  errorMessage: string,
): Promise<LangchainAudioInput> {
  const response = await fetch(memoryService.toAbsoluteMediaUrl(audio.url))
  if (!response.ok) {
    throw new Error(errorMessage)
  }

  const blob = await response.blob()
  return {
    base64: await blobToDataUrl(blob),
    audioType: blob.type || getAudioTypeFromUrl(audio.url),
  }
}

function buildMemoryAssistantMessage(formState: FormState): string {
  return [
    formState.title.trim() ? `标题：${formState.title.trim()}` : '',
    formState.time ? `时间：${formState.time}` : '',
    formState.location.trim() ? `地点：${formState.location.trim()}` : '',
    formState.content.trim() ? `内容：${formState.content.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildStoryAssistantMessage(formState: FormState): string {
  return [
    formState.title.trim() ? `标题：${formState.title.trim()}` : '',
    formState.time ? `时间：${formState.time}` : '',
    formState.location.trim() ? `地点：${formState.location.trim()}` : '',
    formState.content.trim() ? `内容：${formState.content.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function EditMemoryDialog({ memory, isOpen, onClose, onSaved }: EditMemoryDialogProps) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const [formState, setFormState] = useState<FormState>({
    title: '',
    time: '',
    location: '',
    content: '',
  })
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [audioFiles, setAudioFiles] = useState<File[]>([])
  const [existingPhotos, setExistingPhotos] = useState<MemoryPhoto[]>([])
  const [existingAudios, setExistingAudios] = useState<MemoryAudio[]>([])
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([])
  const [removedAudioIds, setRemovedAudioIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  const [isRefiningWithImages, setIsRefiningWithImages] = useState(false)
  const [isRefiningWithAudio, setIsRefiningWithAudio] = useState(false)
  const [contentBeforeRefine, setContentBeforeRefine] = useState<string | null>(null)
  const isBusy = isSubmitting || isRefining || isRefiningWithImages || isRefiningWithAudio
  const totalPhotoCount = existingPhotos.length + photoFiles.length
  const totalAudioCount = existingAudios.length + audioFiles.length
  const isPhotoLimitReached = totalPhotoCount >= MAX_PHOTO_COUNT
  const isAudioLimitReached = totalAudioCount >= MAX_AUDIO_COUNT
  const canUseImageAssistants = Boolean(buildStoryAssistantMessage(formState)) || totalPhotoCount > 0

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

  useEffect(() => {
    if (!memory) return
    setFormState({
      title: memory.title,
      time: toDateInputValue(memory.time ?? ''),
      location: memory.location ?? '',
      content: memory.content,
    })
    setPhotoFiles([])
    setAudioFiles([])
    setExistingPhotos(memory.photos)
    setExistingAudios(memory.audios)
    setRemovedPhotoIds([])
    setRemovedAudioIds([])
    setError('')
    setIsRefining(false)
    setIsRefiningWithImages(false)
    setIsRefiningWithAudio(false)
    setContentBeforeRefine(null)
  }, [memory])

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget && !isBusy) {
      onClose()
    }
  }

  const handleClose = () => {
    if (!isBusy) {
      onClose()
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!memory) return

    if (!formState.title.trim() || !formState.content.trim()) {
      setError(t('fillTitleContent'))
      return
    }

    try {
      setIsSubmitting(true)
      setError('')

      await memoryService.update(memory.id, {
        title: formState.title.trim(),
        content: formState.content.trim(),
        ...(formState.time ? { time: formState.time } : {}),
        ...(formState.location.trim() ? { location: formState.location.trim() } : {}),
      })

      if (removedPhotoIds.length > 0) {
        await Promise.all(removedPhotoIds.map((photoId) => memoryService.deletePhoto(memory.id, photoId)))
      }

      if (removedAudioIds.length > 0) {
        await Promise.all(removedAudioIds.map((audioId) => memoryService.deleteAudio(memory.id, audioId)))
      }

      if (photoFiles.length > 0) {
        await Promise.all(photoFiles.map((file) => memoryService.uploadPhoto(memory.id, file)))
      }

      if (audioFiles.length > 0) {
        await Promise.all(audioFiles.map((file) => memoryService.uploadAudio(memory.id, file)))
      }

      onSaved?.(memory.id)
      onClose()
    } catch (submitError) {
      setError(getErrorMessage(submitError, t('updateFailed')))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRefineContent = async () => {
    const message = buildStoryAssistantMessage(formState)
    if (!message && totalPhotoCount === 0) {
      setError(t('enterTextOrImage'))
      return
    }

    const originalContent = formState.content

    try {
      setIsRefining(true)
      setError('')
      const images = await Promise.all([
        ...existingPhotos.map((photo) => photoToChatbotImage(photo, t('readExistingPhotoFailed'))),
        ...photoFiles.map(fileToChatbotImage),
      ])
      const credentials = await memoryService.getOpenAiCredentials()
      const langchain = createLangchainService(credentials)
      const response = await langchain.chatWithImages({
        systemPrompt: STORY_TEXT_PHOTO_PROMPT,
        ...(message.trim() ? { message } : {}),
        ...(images.length > 0 ? { images } : {}),
      })
      setContentBeforeRefine(originalContent)
      setFormState((prev) => ({ ...prev, content: response.reply }))
    } catch (refineError) {
      setError(getErrorMessage(refineError, t('storyGenerateFailed')))
    } finally {
      setIsRefining(false)
    }
  }

  const handleRefineContentWithImages = async () => {
    const message = buildMemoryAssistantMessage(formState)
    if (!message && totalPhotoCount === 0) {
      setError(t('enterTextOrImage'))
      return
    }

    const originalContent = formState.content

    try {
      setIsRefiningWithImages(true)
      setError('')
      const images = await Promise.all([
        ...existingPhotos.map((photo) => photoToChatbotImage(photo, t('readExistingPhotoFailed'))),
        ...photoFiles.map(fileToChatbotImage),
      ])
      const credentials = await memoryService.getOpenAiCredentials()
      const langchain = createLangchainService(credentials)
      const response = await langchain.chatWithImages({
        systemPrompt: REFINED_TEXT_PHOTO_PROMPT,
        ...(message.trim() ? { message } : {}),
        ...(images.length > 0 ? { images } : {}),
      })
      setContentBeforeRefine(originalContent)
      setFormState((prev) => ({ ...prev, content: response.reply }))
    } catch (refineError) {
      setError(getErrorMessage(refineError, t('imageTextRefineFailed')))
    } finally {
      setIsRefiningWithImages(false)
    }
  }

  const handleRefineContentWithAudio = async () => {
    if (totalAudioCount === 0) {
      setError(t('selectAudioFirst'))
      return
    }

    const originalContent = formState.content

    try {
      setIsRefiningWithAudio(true)
      setError('')
      const audios = await Promise.all([
        ...existingAudios.map((audio) => audioToChatbotAudio(audio, t('readExistingAudioFailed'))),
        ...audioFiles.map(fileToChatbotAudio),
      ])
      const credentials = await memoryService.getOpenAiCredentials()
      const langchain = createLangchainService(credentials)
      const response = await langchain.chatWithAudio({ audios })
      setContentBeforeRefine(originalContent)
      setFormState((prev) => ({ ...prev, content: response.reply }))
    } catch (refineError) {
      setError(getErrorMessage(refineError, t('transcribeFailed')))
    } finally {
      setIsRefiningWithAudio(false)
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
    const remainingSlots = Math.max(0, MAX_PHOTO_COUNT - existingPhotos.length)
    if (mergedFiles.length > remainingSlots) {
      setError(t('maxKeepPhotos', { max: MAX_PHOTO_COUNT }))
    } else {
      setError('')
    }

    const trimmed = mergedFiles.slice(0, remainingSlots)
    setPhotoFiles(trimmed)
    void autoFillLocationFromPhotos(trimmed)
  }

  const autoFillLocationFromPhotos = async (files: File[]) => {
    if (formState.location.trim()) return
    const result = await extractLocationFromPhotos(files)
    if (!result) return
    setFormState((prev) => (prev.location.trim() ? prev : { ...prev, location: result.location }))
  }

  const handleAudioChange = (files: FileList | null) => {
    const selected = Array.from(files ?? [])
    if (selected.length === 0) {
      return
    }

    const mergedFiles = appendUniqueFiles(audioFiles, selected)
    const remainingSlots = Math.max(0, MAX_AUDIO_COUNT - existingAudios.length)
    if (mergedFiles.length > remainingSlots) {
      setError(t('maxKeepAudio', { max: MAX_AUDIO_COUNT }))
    } else {
      setError('')
    }

    setAudioFiles(mergedFiles.slice(0, remainingSlots))
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
        <h2>{t('editMemory')}</h2>
        {error ? <p className="auth-error">{error}</p> : null}

        <form className="create-memory-form" onSubmit={handleSubmit}>
          <label className="auth-label">
            {t('fieldTitle')}
            <div className="input-with-audio">
              <input
                className="auth-input"
                type="text"
                value={formState.title}
                onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                disabled={isBusy}
                required
              />
              <AudioTranscribeButton
                disabled={isBusy}
                ariaLabel={t('voiceInputTitle')}
                onError={setError}
                onTranscribed={(text) =>
                  setFormState((prev) => ({
                    ...prev,
                    title: prev.title.trim() ? `${prev.title} ${text}` : text,
                  }))
                }
              />
            </div>
          </label>

          <label className="auth-label">
            {t('fieldTime')}
            <input
              className="auth-input create-memory-date"
              type="date"
              value={formState.time}
              onChange={(event) => setFormState((prev) => ({ ...prev, time: event.target.value }))}
              disabled={isBusy}
            />
          </label>

          <label className="auth-label">
            {t('fieldLocation')}
            <div className="input-with-audio">
              <input
                className="auth-input"
                type="text"
                value={formState.location}
                onChange={(event) => setFormState((prev) => ({ ...prev, location: event.target.value }))}
                disabled={isBusy}
              />
              <AudioTranscribeButton
                disabled={isBusy}
                ariaLabel={t('voiceInputLocation')}
                onError={setError}
                onTranscribed={(text) =>
                  setFormState((prev) => ({
                    ...prev,
                    location: prev.location.trim() ? `${prev.location} ${text}` : text,
                  }))
                }
              />
            </div>
          </label>

          <label className="auth-label">
            {t('fieldContent')}
            <div className="input-with-audio input-with-audio--textarea">
              <textarea
                className="auth-input create-memory-textarea"
                value={formState.content}
                onChange={(event) => setFormState((prev) => ({ ...prev, content: event.target.value }))}
                disabled={isBusy}
                rows={4}
                required
              />
              <AudioTranscribeButton
                disabled={isBusy}
                ariaLabel={t('voiceInputContent')}
                onError={setError}
                onTranscribed={(text) =>
                  setFormState((prev) => ({
                    ...prev,
                    content: prev.content.trim() ? `${prev.content}\n${text}` : text,
                  }))
                }
              />
            </div>
            <div className="text-assistant-row">
              <button
                type="button"
                className="text-assistant-icon-button"
                onClick={handleRevertContent}
                disabled={isBusy || contentBeforeRefine === null}
                aria-label={t('revertRefine')}
                title={t('revertRefine')}
              >
                ↺
              </button>
              <button
                type="button"
                className="text-assistant-button"
                onClick={handleRefineContent}
                disabled={isBusy || !canUseImageAssistants}
              >
                {isRefining ? (
                  <>
                    <span className="text-assistant-spinner" aria-hidden="true" />
                    {t('generatingStory')}
                  </>
                ) : (
                  t('storyAi')
                )}
              </button>
              <button
                type="button"
                className="text-assistant-button"
                onClick={handleRefineContentWithImages}
                disabled={isBusy || !canUseImageAssistants}
              >
                {isRefiningWithImages ? (
                  <>
                    <span className="text-assistant-spinner" aria-hidden="true" />
                    {t('refiningImageText')}
                  </>
                ) : (
                  t('imageTextAi')
                )}
              </button>
              <button
                type="button"
                className="text-assistant-button"
                onClick={handleRefineContentWithAudio}
                disabled={
                  isBusy ||
                  totalAudioCount === 0
                }
              >
                {isRefiningWithAudio ? (
                  <>
                    <span className="text-assistant-spinner" aria-hidden="true" />
                    {t('transcribingAudio')}
                  </>
                ) : (
                  t('voiceTranscribeAi')
                )}
              </button>
            </div>
          </label>

          <label className="auth-label">
            {t('fieldPhotos')}
            <div className="file-picker-row">
              <label
                htmlFor="edit-photo-file-input"
                className={`file-picker-trigger ${isBusy || isPhotoLimitReached ? 'disabled' : ''}`}
              >
                {t('choosePhotos')}
              </label>
              <span className="file-picker-name">
                {totalPhotoCount > 0
                  ? t('photosCurrent', { count: totalPhotoCount, max: MAX_PHOTO_COUNT })
                  : t('photosMax', { max: MAX_PHOTO_COUNT })}
              </span>
            </div>
            {existingPhotos.length > 0 ? (
              <div className="selected-file-list">
                {existingPhotos.map((photo) => (
                  <div key={photo.id} className="selected-file-item">
                    <span className="selected-file-item-name">
                      {getFileNameFromUrl(photo.url, t('unnamedFile'))}
                    </span>
                    <button
                      type="button"
                      className="selected-file-remove"
                      onClick={() => {
                        setExistingPhotos((prev) => prev.filter((x) => x.id !== photo.id))
                        setRemovedPhotoIds((prev) => (prev.includes(photo.id) ? prev : [...prev, photo.id]))
                      }}
                      disabled={isBusy}
                      aria-label={t('removePhoto', { name: getFileNameFromUrl(photo.url, t('unnamedFile')) })}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
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
                      aria-label={t('removePhoto', { name: file.name })}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <input
              id="edit-photo-file-input"
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
            {t('fieldAudio')}
            <div className="file-picker-row">
              <label
                htmlFor="edit-audio-file-input"
                className={`file-picker-trigger ${isBusy || isAudioLimitReached ? 'disabled' : ''}`}
              >
                {t('chooseAudio')}
              </label>
              <span className="file-picker-name">
                {totalAudioCount > 0
                  ? t('audioCurrent', { count: totalAudioCount, max: MAX_AUDIO_COUNT })
                  : t('audioMax', { max: MAX_AUDIO_COUNT })}
              </span>
            </div>
            {existingAudios.length > 0 ? (
              <div className="selected-file-list">
                {existingAudios.map((audio) => (
                  <div key={audio.id} className="selected-file-item">
                    <span className="selected-file-item-name">
                      {getFileNameFromUrl(audio.url, t('unnamedFile'))}
                    </span>
                    <button
                      type="button"
                      className="selected-file-remove"
                      onClick={() => {
                        setExistingAudios((prev) => prev.filter((x) => x.id !== audio.id))
                        setRemovedAudioIds((prev) => (prev.includes(audio.id) ? prev : [...prev, audio.id]))
                      }}
                      disabled={isBusy}
                      aria-label={t('removeAudio', { name: getFileNameFromUrl(audio.url, t('unnamedFile')) })}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
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
                      aria-label={t('removeAudio', { name: file.name })}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <input
              id="edit-audio-file-input"
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
              {t('cancel')}
            </button>
            <button type="submit" className="auth-submit" disabled={isBusy}>
              {isSubmitting ? t('saving') : t('saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}
