import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
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
    if (selectedMemory || isLoading || errorMessage) {
      onClose()
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
                      <img key={photo.id} src={photo.url} alt={selectedMemory.title} className="memory-photo" />
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
    </dialog>
  )
}
