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

type IconProps = { size?: number }

function CalendarIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function PinIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function GlobeIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function PencilIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  )
}

function TrashIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function ChevronIcon({ size = 20, direction = 'right' }: IconProps & { direction?: 'left' | 'right' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={direction === 'left' ? { transform: 'scaleX(-1)' } : undefined}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function NavArrowIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11l19-9-9 19-2-8-8-2z" />
    </svg>
  )
}

function formatCoordinates(gps: GpsCoordinate): string {
  const latLabel = `${Math.abs(gps.lat).toFixed(2)}°${gps.lat >= 0 ? 'N' : 'S'}`
  const lonLabel = `${Math.abs(gps.lon).toFixed(2)}°${gps.lon >= 0 ? 'E' : 'W'}`
  return `${latLabel} ${lonLabel}`
}

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
  const [translatedContent, setTranslatedContent] = useState<string | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [translationError, setTranslationError] = useState<string>('')
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)

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
    setTranslatedContent(null)
    setTranslationError('')
    setIsTranslating(false)
    setActivePhotoIndex(0)
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

  const handleTranslateContent = async () => {
    const text = selectedMemory?.content?.trim()
    if (!text || isTranslating) return

    if (translatedContent) {
      setTranslatedContent(null)
      setTranslationError('')
      return
    }

    try {
      setIsTranslating(true)
      setTranslationError('')
      const response = await memoryService.translateToEnglish(text)
      setTranslatedContent(response.reply.trim())
    } catch {
      setTranslationError(t('translationFailed'))
    } finally {
      setIsTranslating(false)
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
  const memoryLocation = selectedMemory?.location?.trim() ?? ''
  const photos = selectedMemory?.photos ?? []
  const hasPhotos = photos.length > 0
  const hasAudios = (selectedMemory?.audios.length ?? 0) > 0
  const safePhotoIndex = hasPhotos ? Math.min(activePhotoIndex, photos.length - 1) : 0
  const activePhoto = hasPhotos ? photos[safePhotoIndex] : null

  const showPrevPhoto = () =>
    setActivePhotoIndex((safePhotoIndex - 1 + photos.length) % photos.length)
  const showNextPhoto = () => setActivePhotoIndex((safePhotoIndex + 1) % photos.length)

  return (
    <dialog
      ref={dialogRef}
      className={`memory-dialog${hasPhotos ? ' has-photos' : ''}`}
      onClose={handleDialogClose}
      onClick={handleDialogClick}
    >
      {(selectedMemory || isLoading || errorMessage) && (
        <div className="memory-dialog-content memory-detail">
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
              <header className="memory-detail-header">
                <div className="memory-detail-heading">
                  <h2>{selectedMemory.title}</h2>
                  {memoryTime || memoryLocation ? (
                    <p className="memory-meta">
                      {memoryTime ? (
                        <span className="memory-meta-item">
                          <CalendarIcon />
                          {memoryTime}
                        </span>
                      ) : null}
                      {memoryTime && memoryLocation ? (
                        <span className="memory-meta-sep">·</span>
                      ) : null}
                      {memoryLocation ? (
                        <span className="memory-meta-item">
                          <PinIcon />
                          {memoryLocation}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                {canManage ? (
                  <div className="memory-detail-actions">
                    <button
                      type="button"
                      className="memory-header-button"
                      onClick={() => selectedMemory && onEdit?.(selectedMemory)}
                      aria-label={t('editMemoryAria')}
                    >
                      <PencilIcon />
                      {t('edit')}
                    </button>
                    <button
                      type="button"
                      className="memory-header-button memory-header-button-danger"
                      onClick={() => setIsDeleteConfirmOpen(true)}
                      aria-label={t('deleteMemoryAria')}
                    >
                      <TrashIcon />
                      {t('delete')}
                    </button>
                  </div>
                ) : null}
              </header>

              <div className={`memory-detail-body${hasPhotos ? ' has-photos' : ''}`}>
                <div className="memory-detail-main">
                  {selectedMemory.content?.trim() ? (
                    <div className="memory-translation-block">
                      <button
                        type="button"
                        className="memory-translate-link"
                        onClick={handleTranslateContent}
                        disabled={isTranslating}
                        aria-label={
                          isTranslating
                            ? t('translating')
                            : translatedContent
                              ? t('hideTranslation')
                              : t('translateToEnglish')
                        }
                      >
                        <GlobeIcon />
                        {isTranslating
                          ? t('translating')
                          : translatedContent
                            ? t('hideTranslation')
                            : t('translateToEnglish')}
                      </button>
                      {translationError ? (
                        <p className="memory-error memory-translation-error">{translationError}</p>
                      ) : null}
                      {translatedContent ? (
                        <div className="memory-translation-result">
                          <p className="memory-translation-label">{t('englishTranslationBy')}</p>
                          <p className="memory-translation-text">{translatedContent}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

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

                  {hasAudios ? (
                    <div className="memory-media-block">
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
                    <div className="memory-location-section">
                      <p className="memory-location-label">{t('locationLabel')}</p>
                      <div className="memory-location-card">
                        <LocationMap
                          latitude={mapCoordinates.lat}
                          longitude={mapCoordinates.lon}
                          height={180}
                        />
                        <div className="memory-location-footer">
                          {memoryLocation ? (
                            <span className="memory-meta-item">
                              <PinIcon />
                              {memoryLocation}
                            </span>
                          ) : (
                            <span />
                          )}
                          <span className="memory-meta-item memory-location-coords">
                            <NavArrowIcon />
                            {formatCoordinates(mapCoordinates)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {hasPhotos && activePhoto ? (
                  <div className="memory-detail-gallery">
                    <div className="memory-gallery-stage">
                      <button
                        type="button"
                        className="memory-gallery-photo-button"
                        onClick={() => openPhotoPreview(activePhoto.url)}
                        aria-label={t('viewLargeImage')}
                      >
                        <img
                          src={activePhoto.url}
                          alt={selectedMemory.title}
                          className="memory-gallery-photo"
                        />
                      </button>
                      {photos.length > 1 ? (
                        <>
                          <button
                            type="button"
                            className="memory-gallery-nav memory-gallery-nav-prev"
                            onClick={showPrevPhoto}
                            aria-label={t('prevPhoto')}
                          >
                            <ChevronIcon direction="left" />
                          </button>
                          <button
                            type="button"
                            className="memory-gallery-nav memory-gallery-nav-next"
                            onClick={showNextPhoto}
                            aria-label={t('nextPhoto')}
                          >
                            <ChevronIcon />
                          </button>
                          <span className="memory-gallery-count">
                            {safePhotoIndex + 1} / {photos.length}
                          </span>
                        </>
                      ) : null}
                    </div>
                    {photos.length > 1 ? (
                      <div className="memory-gallery-thumbs">
                        {photos.map((photo, index) => (
                          <button
                            key={photo.id}
                            type="button"
                            className={`memory-gallery-thumb${index === safePhotoIndex ? ' is-active' : ''}`}
                            onClick={() => setActivePhotoIndex(index)}
                            aria-label={`${t('viewLargeImage')} ${index + 1}`}
                            aria-current={index === safePhotoIndex}
                          >
                            <img src={photo.url} alt="" />
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
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
