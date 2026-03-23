import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, TouchEvent } from 'react'
import type { MemoryContent } from '../types/api'

type MemoryPanelProps = {
  selectedMemory: MemoryContent | null
  isLoading?: boolean
  errorMessage?: string
  onClose: () => void
}

export function MemoryPanel({
  selectedMemory,
  isLoading = false,
  errorMessage = '',
  onClose,
}: MemoryPanelProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null)
  const [previewScale, setPreviewScale] = useState(1)
  const pinchDistanceRef = useRef<number | null>(null)

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

  const handleDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  const handleDialogClose = () => {
    setPreviewPhotoUrl(null)
    setPreviewScale(1)
    pinchDistanceRef.current = null
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

  const memoryTime = selectedMemory
    ? (() => {
        const date = new Date(selectedMemory.time)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}/${month}/${day}`
      })()
    : ''
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
            aria-label="关闭弹窗"
          >
            ×
          </button>
          {isLoading ? (
            <p className="memory-loading">加载中...</p>
          ) : errorMessage ? (
            <p className="memory-error">{errorMessage}</p>
          ) : selectedMemory ? (
            <>
              <h2>{selectedMemory.title}</h2>
              <p className="memory-meta">
                {memoryTime} - {selectedMemory.location}
              </p>
              <p>{selectedMemory.content}</p>

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
                        aria-label="查看大图"
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
                        您的浏览器不支持音频播放。
                      </audio>
                    ))}
                  </div>
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
            alt="大图预览"
            className="memory-photo-lightbox-image"
            style={{ transform: `scale(${previewScale})` }}
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handlePreviewTouchStart}
            onTouchMove={handlePreviewTouchMove}
            onTouchEnd={handlePreviewTouchEnd}
          />
        </div>
      ) : null}
    </dialog>
  )
}
