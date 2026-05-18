import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, TouchEvent } from 'react'
import { forwardGeocode, memoryService } from '../services'
import type { GpsCoordinate } from '../services'
import type { MemoryContent } from '../types/api'
import { LocationMap } from './LocationMap'
import { useI18n } from '../i18n/I18nContext'

const ELEVENLABS_VOICE_ID = 'YdgyLJpK2cRMqNNfmRoK'
const ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128'
const ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2'

type MemoryPanelProps = {
  selectedMemory: MemoryContent | null
  isLoading?: boolean
  errorMessage?: string
  canManage?: boolean
  onEdit?: (memory: MemoryContent) => void
  onDelete?: (memory: MemoryContent) => Promise<void> | void
  onClose: () => void
}

export function MemoryPanel({
  selectedMemory,
  isLoading = false,
  errorMessage = '',
  canManage = false,
  onEdit,
  onDelete,
  onClose,
}: MemoryPanelProps) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null)
  const [previewScale, setPreviewScale] = useState(1)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [geocodedCoordinates, setGeocodedCoordinates] = useState<GpsCoordinate | null>(null)
  const pinchDistanceRef = useRef<number | null>(null)
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState<string>('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  const ttsObjectUrlRef = useRef<string | null>(null)

  const clampScale = (value: number) => Math.min(4, Math.max(1, value))

  const getTouchDistance = (event: TouchEvent<HTMLImageElement>) => {
    const [touchA, touchB] = [event.touches[0], event.touches[1]]
    const dx = touchA.clientX - touchB.clientX
    const dy = touchA.clientY - touchB.clientY
    return Math.hypot(dx, dy)
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if ((selectedMemory || isLoading || errorMessage) && !dialog.open) {
      dialog.showModal()
      return
    }

    if (!selectedMemory && !isLoading && !errorMessage && dialog.open) {
      dialog.close()
    }
  }, [selectedMemory, isLoading, errorMessage])

  useEffect(() => {
    if (!selectedMemory) return
    let cancelled = false
    void (async () => {
      try {
        const credentials = await memoryService.getOpenAiCredentials()
        if (cancelled) return
        const key = credentials.ElevenLabsApiKey ?? credentials.elevenLabsApiKey ?? ''
        setElevenLabsApiKey(key)
      } catch {
        if (!cancelled) setElevenLabsApiKey('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedMemory])

  const stopTts = () => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      ttsAudioRef.current.src = ''
      ttsAudioRef.current = null
    }
    if (ttsObjectUrlRef.current) {
      URL.revokeObjectURL(ttsObjectUrlRef.current)
      ttsObjectUrlRef.current = null
    }
    setIsSpeaking(false)
  }

  useEffect(() => {
    stopTts()
  }, [selectedMemory?.id])

  useEffect(() => {
    return () => {
      stopTts()
    }
  }, [])

  const handleSpeakContent = async () => {
    const text = selectedMemory?.content?.trim()
    if (!text || !elevenLabsApiKey) return

    if (isSpeaking) {
      stopTts()
      return
    }

    try {
      setIsSpeaking(true)
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=${ELEVENLABS_OUTPUT_FORMAT}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': elevenLabsApiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: ELEVENLABS_MODEL_ID,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(`ElevenLabs TTS failed: ${response.status}`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      ttsObjectUrlRef.current = url

      const audio = new Audio(url)
      ttsAudioRef.current = audio
      audio.onended = () => stopTts()
      audio.onerror = () => stopTts()
      await audio.play()
    } catch {
      stopTts()
    }
  }

  const hasStoredCoordinates =
    typeof selectedMemory?.latitude === 'number' && typeof selectedMemory?.longitude === 'number'
  const locationQuery = hasStoredCoordinates ? '' : selectedMemory?.location?.trim() ?? ''

  useEffect(() => {
    setGeocodedCoordinates(null)
    if (!locationQuery) return

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      const gps = await forwardGeocode(locationQuery, controller.signal)
      if (controller.signal.aborted) return
      if (gps) setGeocodedCoordinates(gps)
    }, 700)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [locationQuery])

  const mapCoordinates: GpsCoordinate | null = hasStoredCoordinates
    ? { lat: selectedMemory!.latitude as number, lon: selectedMemory!.longitude as number }
    : geocodedCoordinates

  const handleDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  const handleDialogClose = () => {
    setPreviewPhotoUrl(null)
    setPreviewScale(1)
    pinchDistanceRef.current = null
    setIsDeleteConfirmOpen(false)
    setIsDeleting(false)
    if (selectedMemory || isLoading || errorMessage) {
      onClose()
    }
  }

  const openPhotoPreview = (url: string) => {
    setPreviewPhotoUrl(url)
    setPreviewScale(1)
    pinchDistanceRef.current = null
  }

  const closePhotoPreview = () => {
    setPreviewPhotoUrl(null)
    setPreviewScale(1)
    pinchDistanceRef.current = null
  }

  const handlePreviewTouchStart = (event: TouchEvent<HTMLImageElement>) => {
    if (event.touches.length === 2) {
      pinchDistanceRef.current = getTouchDistance(event)
    }
  }

  const handlePreviewTouchMove = (event: TouchEvent<HTMLImageElement>) => {
    if (event.touches.length !== 2) return
    event.preventDefault()
    const currentDistance = getTouchDistance(event)
    if (!pinchDistanceRef.current) {
      pinchDistanceRef.current = currentDistance
      return
    }
    const ratio = currentDistance / pinchDistanceRef.current
    setPreviewScale((prev) => clampScale(prev * ratio))
    pinchDistanceRef.current = currentDistance
  }

  const handlePreviewTouchEnd = (event: TouchEvent<HTMLImageElement>) => {
    if (event.touches.length < 2) {
      pinchDistanceRef.current = null
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedMemory || !onDelete) return
    try {
      setIsDeleting(true)
      await onDelete(selectedMemory)
      setIsDeleteConfirmOpen(false)
    } finally {
      setIsDeleting(false)
    }
  }

  const memoryTime = selectedMemory?.time
    ? (() => {
        const date = new Date(selectedMemory.time)
        if (Number.isNaN(date.getTime())) return ''
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}/${month}/${day}`
      })()
    : ''
  const memoryMeta = [memoryTime, selectedMemory?.location].filter(Boolean).join(' - ')
  const hasPhotos = (selectedMemory?.photos.length ?? 0) > 0
  const hasAudios = (selectedMemory?.audios.length ?? 0) > 0

  return (
    <dialog
      ref={dialogRef}
      className="memory-dialog"
      onClose={handleDialogClose}
      onClick={handleDialogClick}
    >
      {(selectedMemory || isLoading || errorMessage) && (
        <div className="memory-dialog-content">
          <button
            type="button"
            className="memory-dialog-close"
            onClick={onClose}
            aria-label={t('closeDialog')}
          >
            ×
          </button>
          {isLoading ? (
            <p className="memory-loading">{t('loading')}</p>
          ) : errorMessage ? (
            <p className="memory-error">{errorMessage}</p>
          ) : selectedMemory ? (
            <>
              <h2>{selectedMemory.title}</h2>
              {memoryMeta ? <p className="memory-meta">{memoryMeta}</p> : null}
              <div className="memory-content-block">
                <p className="memory-content-text">{selectedMemory.content}</p>
                {selectedMemory.content?.trim() && elevenLabsApiKey ? (
                  <button
                    type="button"
                    className="text-assistant-icon-button memory-tts-button"
                    onClick={handleSpeakContent}
                    aria-label={isSpeaking ? t('stopReading') : t('readContent')}
                    title={isSpeaking ? t('stopReading') : t('readContent')}
                  >
                    {isSpeaking ? '⏸' : '🔊'}
                  </button>
                ) : null}
              </div>

              {hasPhotos ? (
                <div className="memory-media-block">
                  {/* <h3>图片</h3> */}
                  <div className="memory-photo-list">
                    {selectedMemory.photos.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        className="memory-photo-button"
                        onClick={() => openPhotoPreview(photo.url)}
                        aria-label={t('viewLargeImage')}
                      >
                        <img src={photo.url} alt={selectedMemory.title} className="memory-photo" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {hasAudios ? (
                <div className="memory-media-block">
                  {/* <h3>音频</h3> */}
                  <div className="memory-audio-list">
                    {selectedMemory.audios.map((audio) => (
                      <audio key={audio.id} controls src={audio.url} className="memory-audio">
                        {t('audioNotSupported')}
                      </audio>
                    ))}
                  </div>
                </div>
              ) : null}

              {mapCoordinates ? (
                <div className="memory-media-block">
                  <LocationMap latitude={mapCoordinates.lat} longitude={mapCoordinates.lon} />
                </div>
              ) : null}

              {canManage ? (
                <div className="memory-actions">
                  <button
                    type="button"
                    className="auth-toolbar-button"
                    onClick={() => selectedMemory && onEdit?.(selectedMemory)}
                    aria-label={t('editMemoryAria')}
                  >
                    {t('edit')}
                  </button>
                  <button
                    type="button"
                    className="auth-toolbar-button memory-action-danger"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    aria-label={t('deleteMemoryAria')}
                  >
                    {t('delete')}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      )}
      {previewPhotoUrl ? (
        <div className="memory-photo-lightbox" onClick={closePhotoPreview}>
          <img
            src={previewPhotoUrl}
            alt={t('imagePreview')}
            className="memory-photo-lightbox-image"
            style={{ transform: `scale(${previewScale})` }}
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handlePreviewTouchStart}
            onTouchMove={handlePreviewTouchMove}
            onTouchEnd={handlePreviewTouchEnd}
          />
        </div>
      ) : null}
      {isDeleteConfirmOpen ? (
        <div className="memory-confirm-overlay" onClick={() => !isDeleting && setIsDeleteConfirmOpen(false)}>
          <div className="memory-confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <p>{t('confirmDeleteMemory')}</p>
            <div className="memory-confirm-actions">
              <button
                type="button"
                className="auth-toolbar-button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={isDeleting}
              >
                {t('cancel')}
              </button>
              <button type="button" className="auth-submit" onClick={handleDeleteConfirm} disabled={isDeleting}>
                {isDeleting ? t('deleting') : t('confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
