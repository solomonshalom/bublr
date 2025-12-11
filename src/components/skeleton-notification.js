/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { Skeleton, SkeletonCircle } from './skeleton'

export default function SkeletonNotification() {
  return (
    <div
      css={css`
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.75rem;
        border-radius: 0.5rem;
        background: var(--grey-1);
        border: 1px solid var(--grey-2);
      `}
    >
      {/* Color dot */}
      <Skeleton
        width="8px"
        height="8px"
        borderRadius="50%"
        style={{ marginTop: '0.5rem', flexShrink: 0 }}
      />

      {/* Avatar */}
      <SkeletonCircle size="32px" />

      {/* Content */}
      <div css={css`flex: 1; min-width: 0;`}>
        <Skeleton width="90%" height="0.85rem" style={{ marginBottom: '0.25rem' }} />
        <Skeleton width="4rem" height="0.75rem" />
      </div>
    </div>
  )
}
