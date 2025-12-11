/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'

const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`

const baseStyles = css`
  background: linear-gradient(
    90deg,
    var(--grey-2) 25%,
    var(--grey-1) 50%,
    var(--grey-2) 75%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 1.5s ease-in-out infinite;
  border-radius: 0.25rem;
`

export function Skeleton({ width, height, borderRadius, style }) {
  return (
    <div
      css={css`
        ${baseStyles}
        width: ${width || '100%'};
        height: ${height || '1rem'};
        ${borderRadius ? `border-radius: ${borderRadius};` : ''}
      `}
      style={style}
    />
  )
}

export function SkeletonText({ lines = 1, lastLineWidth = '80%' }) {
  return (
    <div css={css`display: flex; flex-direction: column; gap: 0.5rem;`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="0.9rem"
          width={i === lines - 1 && lines > 1 ? lastLineWidth : '100%'}
        />
      ))}
    </div>
  )
}

export function SkeletonCircle({ size = '2rem' }) {
  return <Skeleton width={size} height={size} borderRadius="50%" />
}
