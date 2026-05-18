import { useEffect, useRef, useState } from 'react'
import { createLangchainService, memoryService } from '../services'
import type { ApiError } from '../types/api'
import { useI18n } from '../i18n/I18nContext'

type AudioTranscribeButtonProps = {
  onTranscribed: (text: string) => void
  onError?: (message: string) => void
  disabled?: boolean
  ariaLabel?: string
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as ApiError).message)
  }
  return fallback
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const candidates = ['audio/webm', 'audio/mp4', 'audio/ogg']
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return undefined
}

export function AudioTranscribeButton({
  onTranscribed,
  onError,
  disabled,
  ariaLabel,
}: AudioTranscribeButtonProps) {
  const { t } = useI18n()
  const mountedRef = useRef(true)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const recorder = mediaRecorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop()
        } catch {
          /* ignore */
        }
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const transcribeChunks = async () => {
    const chunks = chunksRef.current
    chunksRef.current = []
    if (chunks.length === 0) {
      if (mountedRef.current) setIsTranscribing(false)
      onError?.(t('noAudioCaptured'))
      return
    }

    const recorder = mediaRecorderRef.current
    const rawMime = recorder?.mimeType || 'audio/webm'
    const baseMime = rawMime.split(';')[0] || 'audio/webm'
    const blob = new Blob(chunks, { type: baseMime })

    if (blob.size === 0) {
      if (mountedRef.current) setIsTranscribing(false)
      onError?.(t('audioEmpty'))
      return
    }

    if (!mountedRef.current) return

    try {
      setIsTranscribing(true)
      const base64 = await blobToDataUrl(blob)
      const credentials = await memoryService.getOpenAiCredentials()
      const langchain = createLangchainService(credentials)
      const text = await langchain.transcribeAudio({
        base64,
        audioType: baseMime,
      })
      if (!mountedRef.current) return
      const trimmed = text.trim()
      if (trimmed) {
        onTranscribed(trimmed)
      } else {
        onError?.(t('noSpeechRecognized'))
      }
    } catch (error) {
      if (!mountedRef.current) return
      onError?.(getErrorMessage(error, t('speechRecognitionFailed')))
    } finally {
      if (mountedRef.current) {
        setIsTranscribing(false)
      }
    }
  }

  const startRecording = async () => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      onError?.(t('recordingNotSupported'))
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = pickRecorderMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }
      recorder.onstop = () => {
        releaseStream()
        void transcribeChunks()
      }
      recorder.onerror = () => {
        onError?.(t('recordingError'))
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch (error) {
      releaseStream()
      onError?.(getErrorMessage(error, t('microphoneAccessFailed')))
    }
  }

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current
    setIsRecording(false)
    if (recorder && recorder.state !== 'inactive') {
      setIsTranscribing(true)
      try {
        recorder.stop()
      } catch {
        setIsTranscribing(false)
        releaseStream()
      }
    } else {
      releaseStream()
    }
  }

  const handleClick = () => {
    if (isTranscribing) return
    if (isRecording) {
      stopRecording()
    } else {
      void startRecording()
    }
  }

  const label = isRecording
    ? t('stopRecording')
    : isTranscribing
      ? t('recognizing')
      : ariaLabel || t('voiceInput')

  const stateClass = isRecording ? ' recording' : isTranscribing ? ' transcribing' : ''

  return (
    <button
      type="button"
      className={`audio-transcribe-button${stateClass}`}
      onClick={handleClick}
      disabled={disabled || isTranscribing}
      aria-label={label}
      title={label}
      aria-busy={isTranscribing || undefined}
    >
      {isTranscribing ? (
        <span className="audio-transcribe-spinner" aria-hidden="true" />
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      )}
    </button>
  )
}
