/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useRef, useEffect } from 'react'

// Sized to sit centered in DsButton default (height 2.1rem)
const MicIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
)

const StopIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
)

export default function VoiceInput({ onTranscript, disabled }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState(null)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const streamRef = useRef(null)

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const startRecording = async () => {
    try {
      setError(null)
      chunksRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      })

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())

        if (chunksRef.current.length > 0) {
          await processAudio()
        }
      }

      mediaRecorder.start(1000) // Collect data every second
      setIsRecording(true)
      setRecordingTime(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

    } catch (err) {
      console.error('Recording error:', err)
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access to use voice input.')
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.')
      } else {
        setError('Failed to start recording. Please try again.')
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const processAudio = async () => {
    setIsProcessing(true)
    setError(null)

    try {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const blob = new Blob(chunksRef.current, { type: mimeType })

      const formData = new FormData()
      formData.append('audio', blob, `recording.${mimeType.split('/')[1]}`)

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Transcription failed')
      }

      const result = await response.json()

      if (result.text && result.text.trim()) {
        onTranscript(result.text.trim())
      } else {
        setError('No speech detected. Please try again.')
      }
    } catch (err) {
      console.error('Processing error:', err)
      setError(err.message || 'Failed to process audio. Please try again.')
    } finally {
      setIsProcessing(false)
      setRecordingTime(0)
      chunksRef.current = []
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleClick = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  return (
    <div
      css={css`
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      `}
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isProcessing}
        title={isRecording ? 'Stop recording' : 'Start voice input'}
        css={css`
          /* Match DsButton default size so it lines up with the +Image toolbar button */
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-family: 'Inter', sans-serif;
          font-weight: 500;
          font-size: 0.825rem;
          line-height: 1;
          height: 2.1rem;
          padding: 0 0.85rem;
          border-radius: 6px;
          border: 1px solid ${isRecording ? '#ef4444' : 'var(--border)'};
          border-bottom-width: 2px;
          background: ${isRecording ? '#ef4444' : 'var(--grey-1)'};
          color: ${isRecording ? 'white' : 'var(--grey-4)'};
          cursor: pointer;
          user-select: none;
          transition: background 150ms ease, color 150ms ease, border-color 150ms ease;

          &:hover:not(:disabled) {
            background: ${isRecording ? '#dc2626' : 'var(--accent-bg-strong)'};
            border-color: ${isRecording ? '#dc2626' : 'var(--grey-3)'};
          }

          &:active:not(:disabled) {
            border-bottom-width: 1px;
            padding-top: 1px;
          }

          &:disabled {
            opacity: 0.55;
            cursor: not-allowed;
          }
        `}
      >
        {isProcessing ? (
          <span
            css={css`
              display: inline-flex;
              align-items: center;
              gap: 0.5rem;
            `}
          >
            <span
              css={css`
                width: 12px;
                height: 12px;
                border: 1.5px solid currentColor;
                border-bottom-color: transparent;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}
            />
            Processing...
          </span>
        ) : isRecording ? (
          <span
            css={css`
              display: inline-flex;
              align-items: center;
              gap: 0.5rem;
            `}
          >
            <StopIcon />
            Stop ({formatTime(recordingTime)})
          </span>
        ) : (
          <span
            css={css`
              display: inline-flex;
              align-items: center;
              gap: 0.5rem;
            `}
          >
            <MicIcon />
            Voice
          </span>
        )}
      </button>

      {/* Error message */}
      {error && (
        <span
          css={css`
            font-size: 0.75rem;
            color: #ef4444;
            max-width: 200px;
          `}
        >
          {error}
        </span>
      )}
    </div>
  )
}
