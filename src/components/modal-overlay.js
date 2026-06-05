/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'
import { Overlay } from '@radix-ui/react-dialog'

const fadeIn = keyframes`
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
`

const ModalOverlay = props => (
  <Overlay
    css={css`
      background: rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      position: fixed;
      inset: 0;
      animation: ${fadeIn} 160ms cubic-bezier(0.22, 1, 0.36, 1);
      z-index: 99;
    `}
    {...props}
  />
)

export default ModalOverlay
