/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { Skeleton, SkeletonText, SkeletonCircle } from './skeleton'

// Dashboard post item skeleton - matches dashboard/index.js structure
export function SkeletonDashboardItem() {
  return (
    <li
      css={css`
        margin: 2rem 0;
        display: flex;

        @media (max-width: 720px) {
          display: block;
          margin: 2rem 0;
        }
      `}
    >
      <Skeleton width="5rem" height="0.9rem" />
      <div
        css={css`
          width: 70%;
          margin-left: auto;

          @media (max-width: 720px) {
            width: 100%;
            margin: 0.75rem 0 0 0;
          }
        `}
      >
        <Skeleton width="85%" height="1rem" />
      </div>
    </li>
  )
}

// Explore post item skeleton - matches explore/index.js structure
export function SkeletonExploreItem() {
  return (
    <li
      css={css`
        max-width: 25rem;
        margin: 2.5rem 0;
      `}
    >
      {/* Title */}
      <Skeleton width="80%" height="1rem" style={{ marginBottom: '0.6rem' }} />

      {/* Author row */}
      <div
        css={css`
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        `}
      >
        <SkeletonCircle size="1.5rem" />
        <Skeleton width="6rem" height="0.9rem" />
      </div>

      {/* Excerpt */}
      <SkeletonText lines={2} lastLineWidth="60%" />
    </li>
  )
}

// Editor skeleton
export function SkeletonEditor() {
  return (
    <div>
      {/* Title */}
      <Skeleton width="60%" height="2rem" style={{ marginBottom: '1.5rem' }} />
      {/* Content */}
      <SkeletonText lines={8} lastLineWidth="45%" />
    </div>
  )
}
