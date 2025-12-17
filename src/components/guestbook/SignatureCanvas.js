/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'
import { useState, useRef, useEffect, useCallback } from 'react'
import gsap from 'gsap'

// Minimum requirements for valid signature
const MIN_POINTS = 50
const MIN_DISTANCE = 150

// Pen icon SVG
const PenIcon = ({ signed }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    css={css`
      vertical-align: middle;
      margin-right: 8px;
      margin-top: -2px;
    `}
  >
    {signed ? (
      <polyline points="20 6 9 17 4 12" />
    ) : (
      <path d="M12 20h9M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.86z" />
    )}
  </svg>
)

// Eraser icon
const EraserIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
    <path d="M22 21H7" />
    <path d="m5 11 9 9" />
  </svg>
)

// Loading spinner
const spinKeyframes = keyframes`
  to { transform: rotate(360deg); }
`

const LoadingSpinner = () => (
  <span
    css={css`
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-bottom-color: transparent;
      border-radius: 50%;
      display: inline-block;
      margin-right: 8px;
      animation: ${spinKeyframes} 0.8s linear infinite;
      vertical-align: middle;
      margin-top: -2px;
    `}
  />
)

export default function SignatureCanvas({
  colors,
  onSignatureComplete,
  onCancel,
  isSubmitting = false,
  name,
  setName,
  message,
  setMessage,
  authorDisplayName,
  errorMessage = '',
}) {
  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const containerRef = useRef(null)
  const svgRef = useRef(null)
  const pathRef = useRef(null)
  const [strokes, setStrokes] = useState([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [isValid, setIsValid] = useState(false)
  const [isSigned, setIsSigned] = useState(false)
  const [isHolding, setIsHolding] = useState(false)
  const [isReversing, setIsReversing] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)
  const [signDuration, setSignDuration] = useState(0)
  const [svgPath, setSvgPath] = useState('')
  const [viewBox, setViewBox] = useState('0 0 300 130')
  const strokesRef = useRef([])
  const currentStrokeRef = useRef([])
  const animationFrameRef = useRef(null)
  const signoffRef = useRef(null)
  const allPointsRef = useRef([])

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const DPR = window.devicePixelRatio || 1

    canvas.width = Math.floor(rect.width * DPR)
    canvas.height = Math.floor(rect.height * DPR)

    const ctx = canvas.getContext('2d')
    ctx.scale(DPR, DPR)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = colors.text
    ctxRef.current = ctx

    setViewBox(`0 0 ${rect.width} ${rect.height}`)
  }, [colors.text])

  // Generate SVG path from strokes
  const generateSVGPath = useCallback((strokesData) => {
    let path = ''
    for (const stroke of strokesData) {
      if (stroke.length > 0) {
        path += `M ${stroke[0].x} ${stroke[0].y} `
        for (let i = 1; i < stroke.length; i++) {
          path += `L ${stroke[i].x} ${stroke[i].y} `
        }
      }
    }
    return path
  }, [])

  // Validate signature
  const validateSignature = useCallback((strokesData) => {
    let totalPoints = 0
    let totalDistance = 0

    for (const stroke of strokesData) {
      totalPoints += stroke.length
      for (let i = 1; i < stroke.length; i++) {
        const dx = stroke[i].x - stroke[i - 1].x
        const dy = stroke[i].y - stroke[i - 1].y
        totalDistance += Math.sqrt(dx * dx + dy * dy)
      }
    }

    return totalPoints >= MIN_POINTS && totalDistance >= MIN_DISTANCE
  }, [])

  // Calculate sign duration from strokes
  const calculateSignDuration = useCallback((strokesData) => {
    if (strokesData.length === 0) return 0

    let minTime = Infinity
    let maxTime = -Infinity

    for (const stroke of strokesData) {
      for (const point of stroke) {
        minTime = Math.min(minTime, point.time)
        maxTime = Math.max(maxTime, point.time)
      }
    }

    return (maxTime - minTime) / 1000
  }, [])

  // Render strokes to canvas
  const render = useCallback(() => {
    const ctx = ctxRef.current
    if (!ctx) return

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    ctx.strokeStyle = colors.text

    // Render completed strokes
    for (const stroke of strokesRef.current) {
      if (stroke.length > 0) {
        ctx.beginPath()
        ctx.moveTo(stroke[0].x, stroke[0].y)
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y)
        }
        ctx.stroke()
      }
    }

    // Render current stroke
    if (currentStrokeRef.current.length > 0) {
      ctx.beginPath()
      ctx.moveTo(currentStrokeRef.current[0].x, currentStrokeRef.current[0].y)
      for (let i = 1; i < currentStrokeRef.current.length; i++) {
        ctx.lineTo(currentStrokeRef.current[i].x, currentStrokeRef.current[i].y)
      }
      ctx.stroke()
    }
  }, [colors.text])

  // Get point from pointer event
  const getPoint = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top
    return { x, y, time: Date.now() }
  }, [])

  // Handle pointer down
  const handlePointerDown = useCallback((e) => {
    if (isSigned || isHolding) return
    e.preventDefault()

    const point = getPoint(e)
    if (!point) return

    setIsDrawing(true)
    currentStrokeRef.current = [point]

    // Start animation loop
    const animate = () => {
      render()
      animationFrameRef.current = requestAnimationFrame(animate)
    }
    animate()
  }, [getPoint, render, isSigned, isHolding])

  // Handle pointer move
  const handlePointerMove = useCallback((e) => {
    if (!isDrawing || isSigned) return
    e.preventDefault()

    const point = getPoint(e)
    if (!point) return

    currentStrokeRef.current.push(point)
  }, [isDrawing, getPoint, isSigned])

  // Handle pointer up
  const handlePointerUp = useCallback(() => {
    if (!isDrawing) return

    setIsDrawing(false)
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    if (currentStrokeRef.current.length > 0) {
      strokesRef.current = [...strokesRef.current, [...currentStrokeRef.current]]
      currentStrokeRef.current = []
      setStrokes([...strokesRef.current])

      // Update validation, SVG path, and duration
      const valid = validateSignature(strokesRef.current)
      setIsValid(valid)
      setSvgPath(generateSVGPath(strokesRef.current))
      setSignDuration(calculateSignDuration(strokesRef.current))
    }

    render()
  }, [isDrawing, validateSignature, generateSVGPath, calculateSignDuration, render])

  // Clear signature
  const clearSignature = useCallback(() => {
    strokesRef.current = []
    currentStrokeRef.current = []
    allPointsRef.current = []
    setStrokes([])
    setIsValid(false)
    setIsSigned(false)
    setIsHolding(false)
    setIsReversing(false)
    setHoldProgress(0)
    setSignDuration(0)
    setSvgPath('')

    if (signoffRef.current) {
      signoffRef.current.kill()
      signoffRef.current = null
    }

    const ctx = ctxRef.current
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
  }, [])

  // Prepare all points for replay animation
  const prepareReplayData = useCallback(() => {
    const all = []
    const firstPointTime = strokesRef.current[0]?.[0]?.time || 0

    for (const stroke of strokesRef.current) {
      stroke.forEach((point, pointIndex) => {
        all.push({
          x: point.x,
          y: point.y,
          time: point.time,
          relativeTime: point.time - firstPointTime,
          isNewStroke: pointIndex === 0,
        })
      })
    }

    all.sort((a, b) => a.time - b.time)
    allPointsRef.current = all
    return all
  }, [])

  // Replay signature animation (on hold)
  const replaySignature = useCallback(() => {
    if (!isValid || !name.trim() || isSigned) return

    setIsHolding(true)
    setIsReversing(false)

    const all = prepareReplayData()
    if (all.length === 0) return

    // Kill any existing animation
    if (signoffRef.current) {
      signoffRef.current.kill()
    }

    // Create GSAP timeline for replay
    const timeline = gsap.timeline({
      paused: true,
      onUpdate: () => {
        setHoldProgress(timeline.progress())
      },
      onComplete: () => {
        setIsSigned(true)
        setIsHolding(false)

        // Get canvas bounds for viewBox
        const canvas = canvasRef.current
        if (!canvas) return

        const rect = canvas.getBoundingClientRect()
        const vb = `0 0 ${rect.width} ${rect.height}`

        // Call parent callback with signature data
        onSignatureComplete({
          path: svgPath,
          viewBox: vb,
          name: name.trim(),
          message: message.trim(),
        })
      },
    })

    // Build the animation - replay the signature point by point
    let def = ''
    const pathElement = pathRef.current

    for (const point of all) {
      def += ` ${point.isNewStroke ? 'M' : 'L'} ${point.x} ${point.y} `
      timeline.set(
        pathElement,
        { attr: { d: def } },
        point.relativeTime / 1000
      )
    }

    signoffRef.current = timeline
    timeline.play()
  }, [isValid, name, message, isSigned, svgPath, prepareReplayData, onSignatureComplete])

  // Handle touch/mouse release (stop holding)
  const handleHoldRelease = useCallback(() => {
    if (!isHolding || !signoffRef.current) return

    if (signoffRef.current.progress() < 1) {
      // Not complete - reverse the animation
      setIsReversing(true)
      signoffRef.current.timeScale(2) // Reverse faster
      signoffRef.current.reverse()

      // When reverse completes, reset
      signoffRef.current.eventCallback('onReverseComplete', () => {
        setIsHolding(false)
        setIsReversing(false)
        setHoldProgress(0)
        if (pathRef.current) {
          pathRef.current.setAttribute('d', '')
        }
      })
    }
  }, [isHolding])

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (signoffRef.current) {
        signoffRef.current.kill()
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      css={css`
        border: 1px solid ${colors.border};
        border-radius: 6px;
        overflow: hidden;
        background: ${colors.bg};
      `}
    >
      {/* Header */}
      <div
        css={css`
          padding: 12px 16px;
          border-bottom: 1px solid ${colors.border};
          display: flex;
          align-items: center;
          justify-content: space-between;
        `}
      >
        <span
          css={css`
            font-size: 14px;
            font-weight: 500;
            color: ${colors.text};
            display: flex;
            align-items: center;
          `}
        >
          <PenIcon signed={isSigned} />
          {isSigned ? 'Signed!' : 'Sign the Guest Book'}
        </span>
        <button
          type="button"
          onClick={onCancel}
          css={css`
            background: none;
            border: none;
            padding: 4px;
            cursor: pointer;
            color: ${colors.muted};
            display: flex;
            align-items: center;
            justify-content: center;

            &:hover {
              color: ${colors.text};
            }
          `}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div
        css={css`
          padding: 16px;
        `}
      >
        {/* Instructions */}
        <p
          css={css`
            font-size: 13px;
            color: ${colors.muted};
            margin: 0 0 20px 0;
            line-height: 1.5;
          `}
        >
          Draw your signature in {authorDisplayName}'s guest book. Add an optional message below.
        </p>

        {/* Name Input */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name *"
          maxLength={50}
          disabled={isSigned || isSubmitting}
          css={css`
            width: 100%;
            padding: 10px 14px;
            border: 1px solid ${colors.border};
            border-radius: 4px;
            background: ${colors.bg};
            color: ${colors.text};
            font-size: 14px;
            font-family: Inter, sans-serif;
            outline: none;
            transition: border-color 0.2s ease;
            margin-bottom: 12px;

            &:focus {
              border-color: ${colors.text};
            }

            &::placeholder {
              color: ${colors.muted};
            }

            &:disabled {
              opacity: 0.6;
            }
          `}
        />

        {/* Signature Canvas Container */}
        <div
          css={css`
            position: relative;
            height: 130px;
            border: 1px solid ${colors.border};
            border-radius: 4px;
            margin-bottom: 12px;
            overflow: hidden;
            background: ${colors.bg};
            ${isSigned ? 'opacity: 0.7; pointer-events: none;' : ''}
          `}
        >
          {/* Canvas for drawing */}
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            css={css`
              width: 100%;
              height: 100%;
              cursor: ${isSigned ? 'default' : 'crosshair'};
              touch-action: none;
              opacity: ${isHolding && !isReversing ? 0.1 : 1};
              transition: opacity 0.2s ease;
            `}
          />

          {/* SVG overlay for replay animation */}
          <div
            css={css`
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              pointer-events: none;
              opacity: ${isHolding || isSigned ? 1 : 0};
              transition: opacity 0.2s ease;
            `}
          >
            <svg
              ref={svgRef}
              viewBox={viewBox}
              css={css`
                width: 100%;
                height: 100%;
              `}
            >
              <path
                ref={pathRef}
                d=""
                fill="none"
                stroke={colors.text}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Placeholder text */}
          {strokes.length === 0 && !isDrawing && (
            <div
              css={css`
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: ${colors.muted};
                font-size: 13px;
                pointer-events: none;
                opacity: 0.6;
              `}
            >
              Draw your signature here
            </div>
          )}
        </div>

        {/* Message Input */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a message (optional)"
          maxLength={200}
          disabled={isSigned || isSubmitting}
          rows={2}
          css={css`
            width: 100%;
            padding: 10px 14px;
            border: 1px solid ${colors.border};
            border-radius: 4px;
            background: ${colors.bg};
            color: ${colors.text};
            font-size: 14px;
            font-family: Inter, sans-serif;
            outline: none;
            transition: border-color 0.2s ease;
            margin-bottom: 12px;
            resize: none;

            &:focus {
              border-color: ${colors.text};
            }

            &::placeholder {
              color: ${colors.muted};
            }

            &:disabled {
              opacity: 0.6;
            }
          `}
        />

        {/* Footer Actions */}
        <div
          css={css`
            display: flex;
            justify-content: space-between;
            align-items: center;
          `}
        >
          <button
            type="button"
            onClick={clearSignature}
            disabled={strokes.length === 0 || isSigned || isSubmitting || isHolding}
            title="Clear signature"
            css={css`
              display: flex;
              align-items: center;
              justify-content: center;
              width: 36px;
              height: 36px;
              border: none;
              border-radius: 4px;
              background: transparent;
              color: ${colors.muted};
              cursor: pointer;
              transition: all 0.2s ease;

              &:hover:not(:disabled) {
                color: ${colors.text};
                background: ${colors.border};
              }

              &:disabled {
                opacity: 0.4;
                cursor: not-allowed;
              }
            `}
          >
            <EraserIcon />
          </button>

          {/* Hold to Confirm Button */}
          <button
            type="button"
            onPointerDown={replaySignature}
            onPointerUp={handleHoldRelease}
            onPointerLeave={handleHoldRelease}
            onTouchStart={replaySignature}
            onTouchEnd={handleHoldRelease}
            disabled={!isValid || !name.trim() || isSigned || isSubmitting}
            css={css`
              position: relative;
              padding: 10px 20px;
              background: ${isSigned ? '#6BCB77' : colors.text};
              color: ${colors.bg};
              border: none;
              border-radius: 4px;
              font-size: 14px;
              font-family: Inter, sans-serif;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s ease;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              user-select: none;
              -webkit-user-select: none;
              touch-action: manipulation;

              &:hover:not(:disabled) {
                opacity: 0.9;
              }

              &:disabled {
                opacity: 0.6;
                cursor: not-allowed;
              }

              /* Progress bar overlay */
              &::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                width: ${holdProgress * 100}%;
                background: ${isSigned ? '#6BCB77' : isReversing ? '#E23E57' : '#6BCB77'};
                transition: ${isReversing ? 'none' : 'width 0.05s linear'};
                z-index: 0;
              }

              /* Text on top */
              & > span {
                position: relative;
                z-index: 1;
              }
            `}
          >
            <span>
              {isSubmitting ? (
                <>
                  <LoadingSpinner />
                  Signing...
                </>
              ) : isSigned ? (
                <>
                  <PenIcon signed />
                  Signed!
                </>
              ) : isHolding ? (
                isReversing ? 'Releasing...' : 'Keep holding...'
              ) : (
                `Hold to confirm${signDuration > 0 ? ` (${signDuration.toFixed(1)}s)` : ''}`
              )}
            </span>
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <p css={css`font-size: 12px; color: #E23E57; margin: 8px 0 0 0;`}>
            {errorMessage}
          </p>
        )}

        {/* Validation hints */}
        {!isSigned && !errorMessage && (
          <div css={css`margin-top: 8px; text-align: right;`}>
            {strokes.length === 0 && (
              <p css={css`font-size: 12px; color: ${colors.muted}; margin: 0;`}>
                Draw your signature above
              </p>
            )}
            {strokes.length > 0 && !isValid && (
              <p css={css`font-size: 12px; color: ${colors.muted}; margin: 0;`}>
                Keep drawing to complete your signature
              </p>
            )}
            {isValid && !name.trim() && (
              <p css={css`font-size: 12px; color: #E23E57; margin: 0;`}>
                Please enter your name
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
