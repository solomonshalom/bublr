/** @jsxImportSource @emotion/react */
import { css, keyframes } from '@emotion/react'

const moveRight = keyframes`
  from {
    background-position-x: 100%;
  }
  to {
    background-position-x: 0%;
  }
`

const ctaButtonStyles = css`
  * {
    box-sizing: border-box;
  }

  appearance: none;
  border: none;
  outline: none;
  cursor: pointer;
  display: inline-flex;
  background-color: #212631;
  font: 500 14px/20px 'Inter', Arial;
  letter-spacing: 0.25px;
  color: #fff;
  border-radius: 6px;
  padding: 2px 2px 2px 52px;
  margin: 0;
  position: relative;
  box-shadow: 0px 8px 20px -8px rgba(26, 33, 43, 0.50), 0px 4px 12px 0px rgba(26, 33, 43, 0.05), 0px 1px 3px 0px rgba(26, 33, 43, 0.25), 0px 1.5px 0.5px 0px #454D57 inset, 0px -3px 1px 0px rgba(0, 0, 0, 0.50) inset;

  .arrow {
    position: absolute;
    left: 2px;
    top: 2px;
    width: 48px;
    height: 36px;
    border-radius: 4px;
    background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.32) 0%,
        rgba(255, 255, 255, 0) 77.51%
      ),
      #d2ff00;
    box-shadow: 0px 1px 1px -0.5px rgba(11, 21, 34, 0.24),
      0px 3px 3px -1.5px rgba(11, 21, 34, 0.24),
      0px 6px 6px -3px rgba(11, 21, 34, 0.24),
      0px 12px 12px -6px rgba(11, 21, 34, 0.32),
      0px 24px 24px -12px rgba(11, 21, 34, 0.24),
      0px 32px 32px -16px rgba(11, 21, 34, 0.24),
      0px 0.5px 0.5px 0px rgba(255, 255, 255, 0.4) inset,
      0px 1px 2px 0px rgba(255, 255, 255, 0.32) inset;
    transition: width 0.3s;

    div {
      position: absolute;
      width: 100%;
      height: 16px;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      mask-image: linear-gradient(
        to right,
        transparent 12px,
        black 18px,
        black calc(100% - 18px),
        transparent calc(100% - 12px)
      );

      &:before,
      &:after {
        content: '';
        position: absolute;
        inset: 0;
      }

      &:before {
        background: linear-gradient(
            to right,
            rgba(13, 21, 33, 0.02) 0.405%,
            rgba(13, 21, 33, 0.12) 1.61%,
            rgba(32, 38, 50, 0.26) 8.005%,
            rgba(13, 21, 33, 0.33) 9.2%,
            rgba(46, 52, 62, 0.28) 15.61%,
            rgba(13, 21, 33, 0.56) 16.805%,
            rgba(13, 21, 33, 0.84) 23.2%,
            rgba(32, 38, 50, 0.87) 24.4%,
            rgba(13, 21, 33, 0.75) 30.815%,
            rgba(13, 21, 33, 0.69) 31.995%,
            rgba(32, 38, 50, 0.42) 38.39%,
            rgba(13, 21, 33, 0.34) 39.59%,
            rgba(32, 38, 50, 0.29) 46%,
            rgba(32, 38, 50, 0.26) 47.19%,
            rgba(13, 21, 33, 0.02) 50%,
            rgba(13, 21, 33, 0.02) 50.405%,
            rgba(13, 21, 33, 0.12) 51.61%,
            rgba(32, 38, 50, 0.26) 58.005%,
            rgba(13, 21, 33, 0.33) 59.2%,
            rgba(46, 52, 62, 0.28) 65.61%,
            rgba(13, 21, 33, 0.56) 66.805%,
            rgba(13, 21, 33, 0.84) 73.2%,
            rgba(32, 38, 50, 0.87) 74.4%,
            rgba(13, 21, 33, 0.75) 80.815%,
            rgba(13, 21, 33, 0.69) 81.995%,
            rgba(32, 38, 50, 0.42) 88.39%,
            rgba(13, 21, 33, 0.34) 89.59%,
            rgba(32, 38, 50, 0.29) 96%,
            rgba(32, 38, 50, 0.26) 97.19%,
            rgba(13, 21, 33, 0.02) 100%
          )
          0 1px/200% 2px repeat-x,
          linear-gradient(
            to right,
            rgba(13, 21, 33, 0.02) 0.405%,
            rgba(13, 21, 33, 0.12) 1.61%,
            rgba(32, 38, 50, 0.26) 8.005%,
            rgba(13, 21, 33, 0.33) 9.2%,
            rgba(46, 52, 62, 0.28) 15.61%,
            rgba(13, 21, 33, 0.56) 16.805%,
            rgba(13, 21, 33, 0.84) 23.2%,
            rgba(32, 38, 50, 0.87) 24.4%,
            rgba(13, 21, 33, 0.75) 30.815%,
            rgba(13, 21, 33, 0.69) 31.995%,
            rgba(32, 38, 50, 0.42) 38.39%,
            rgba(13, 21, 33, 0.34) 39.59%,
            rgba(32, 38, 50, 0.29) 46%,
            rgba(32, 38, 50, 0.26) 47.19%,
            rgba(13, 21, 33, 0.02) 50%,
            rgba(13, 21, 33, 0.02) 50.405%,
            rgba(13, 21, 33, 0.12) 51.61%,
            rgba(32, 38, 50, 0.26) 58.005%,
            rgba(13, 21, 33, 0.33) 59.2%,
            rgba(46, 52, 62, 0.28) 65.61%,
            rgba(13, 21, 33, 0.56) 66.805%,
            rgba(13, 21, 33, 0.84) 73.2%,
            rgba(32, 38, 50, 0.87) 74.4%,
            rgba(13, 21, 33, 0.75) 80.815%,
            rgba(13, 21, 33, 0.69) 81.995%,
            rgba(32, 38, 50, 0.42) 88.39%,
            rgba(13, 21, 33, 0.34) 89.59%,
            rgba(32, 38, 50, 0.29) 96%,
            rgba(32, 38, 50, 0.26) 97.19%,
            rgba(13, 21, 33, 0.02) 100%
          )
          0 13px/200% 2px repeat-x,
          linear-gradient(
            90deg,
            rgba(13, 21, 33, 0.02) 0%,
            rgba(13, 21, 33, 0.16) 1.595%,
            rgba(32, 38, 50, 0.22) 2.79%,
            rgba(13, 21, 33, 0.35) 9.195%,
            rgba(32, 38, 50, 0.42) 10.415%,
            rgba(12, 26, 33, 0.58) 16.795%,
            rgba(32, 38, 50, 0.67) 18.01%,
            rgba(32, 38, 50, 0.87) 24.405%,
            rgba(13, 21, 33, 0.95) 25.59%,
            rgba(13, 21, 33, 0.55) 31.99%,
            rgba(32, 38, 50, 0.46) 33.19%,
            rgba(13, 21, 33, 0.32) 39.595%,
            rgba(13, 21, 33, 0.23) 40.805%,
            rgba(32, 38, 50, 0.22) 47.21%,
            rgba(13, 21, 33, 0.2) 48.38%,
            rgba(13, 21, 33, 0.02) 50%,
            rgba(13, 21, 33, 0.16) 51.595%,
            rgba(32, 38, 50, 0.22) 52.79%,
            rgba(13, 21, 33, 0.35) 59.195%,
            rgba(32, 38, 50, 0.42) 60.415%,
            rgba(12, 26, 33, 0.58) 66.795%,
            rgba(32, 38, 50, 0.67) 68.01%,
            rgba(32, 38, 50, 0.87) 74.405%,
            rgba(13, 21, 33, 0.95) 75.59%,
            rgba(13, 21, 33, 0.55) 81.99%,
            rgba(32, 38, 50, 0.46) 83.19%,
            rgba(13, 21, 33, 0.32) 89.595%,
            rgba(13, 21, 33, 0.23) 90.805%,
            rgba(32, 38, 50, 0.22) 97.21%,
            rgba(13, 21, 33, 0.2) 98.38%,
            rgba(13, 21, 33, 0.02) 100%
          )
          0 4px/200% 2px repeat-x,
          linear-gradient(
            90deg,
            rgba(13, 21, 33, 0.02) 0%,
            rgba(13, 21, 33, 0.16) 1.595%,
            rgba(32, 38, 50, 0.22) 2.79%,
            rgba(13, 21, 33, 0.35) 9.195%,
            rgba(32, 38, 50, 0.42) 10.415%,
            rgba(12, 26, 33, 0.58) 16.795%,
            rgba(32, 38, 50, 0.67) 18.01%,
            rgba(32, 38, 50, 0.87) 24.405%,
            rgba(13, 21, 33, 0.95) 25.59%,
            rgba(13, 21, 33, 0.55) 31.99%,
            rgba(32, 38, 50, 0.46) 33.19%,
            rgba(13, 21, 33, 0.32) 39.595%,
            rgba(13, 21, 33, 0.23) 40.805%,
            rgba(32, 38, 50, 0.22) 47.21%,
            rgba(13, 21, 33, 0.2) 48.38%,
            rgba(13, 21, 33, 0.02) 50%,
            rgba(13, 21, 33, 0.16) 51.595%,
            rgba(32, 38, 50, 0.22) 52.79%,
            rgba(13, 21, 33, 0.35) 59.195%,
            rgba(32, 38, 50, 0.42) 60.415%,
            rgba(12, 26, 33, 0.58) 66.795%,
            rgba(32, 38, 50, 0.67) 68.01%,
            rgba(32, 38, 50, 0.87) 74.405%,
            rgba(13, 21, 33, 0.95) 75.59%,
            rgba(13, 21, 33, 0.55) 81.99%,
            rgba(32, 38, 50, 0.46) 83.19%,
            rgba(13, 21, 33, 0.32) 89.595%,
            rgba(13, 21, 33, 0.23) 90.805%,
            rgba(32, 38, 50, 0.22) 97.21%,
            rgba(13, 21, 33, 0.2) 98.38%,
            rgba(13, 21, 33, 0.02) 100%
          )
          0 10px/200% 2px repeat-x,
          linear-gradient(
            90deg,
            rgba(13, 21, 33, 0.05) 0%,
            rgba(13, 21, 33, 0.28) 2.79%,
            rgba(32, 38, 50, 0.29) 4%,
            rgba(13, 21, 33, 0.48) 10.4%,
            rgba(32, 38, 50, 0.49) 11.61%,
            rgba(13, 21, 33, 0.68) 17.995%,
            rgba(32, 38, 50, 0.76) 19.19%,
            #202632 25.595%,
            #202632 26.8%,
            rgba(32, 38, 50, 0.4) 33.22%,
            rgba(32, 38, 50, 0.4) 34.42%,
            rgba(32, 38, 50, 0.22) 40.8%,
            rgba(32, 38, 50, 0.22) 42%,
            rgba(13, 21, 33, 0.08) 48.405%,
            rgba(13, 21, 33, 0.05) 49.62%,
            rgba(13, 21, 33, 0.05) 50%,
            rgba(13, 21, 33, 0.28) 52.79%,
            rgba(32, 38, 50, 0.29) 54%,
            rgba(13, 21, 33, 0.48) 60.4%,
            rgba(32, 38, 50, 0.49) 61.61%,
            rgba(13, 21, 33, 0.68) 67.995%,
            rgba(32, 38, 50, 0.76) 69.19%,
            #202632 75.595%,
            #202632 76.8%,
            rgba(32, 38, 50, 0.4) 83.22%,
            rgba(32, 38, 50, 0.4) 84.42%,
            rgba(32, 38, 50, 0.22) 90.8%,
            rgba(32, 38, 50, 0.22) 92%,
            rgba(13, 21, 33, 0.08) 98.405%,
            rgba(13, 21, 33, 0.05) 99.62%
          )
          0 center/200% 2px repeat-x;
        background-position-x: 100%;
        animation: ${moveRight} 2s linear infinite;
        -webkit-mask-image: url('https://assets.codepen.io/165585/arrow-dots.svg');
        mask-image: url('https://assets.codepen.io/165585/arrow-dots.svg');
        mask-position: center center;
      }

      &:after {
        background-image: url('https://assets.codepen.io/165585/arrow-dots.svg');
        -webkit-mask-image: url('https://assets.codepen.io/165585/arrow-dots-mask.svg');
        mask-image: url('https://assets.codepen.io/165585/arrow-dots-mask.svg');
        mask-position: center center;
        background-position: center center;
        filter: drop-shadow(0 0.5px 0.5px rgba(255, 255, 255, 0.5))
          drop-shadow(0 0.25px 0.75px rgba(255, 255, 255, 0.5));
      }
    }
  }

  .label {
    display: block;
    padding: 8px 0;
    width: 21.5em;
  }

  &:focus-visible,
  &:hover {
    .arrow {
      width: 351px;
    }
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;

    .arrow {
      animation: none;
    }

    &:hover .arrow {
      width: 48px;
    }
  }
`

export default function CTAButton({ children = 'Sign Up', ...props }) {
  return (
    <button css={ctaButtonStyles} {...props}>
      <div className="arrow">
        <div></div>
      </div>
      <span className="label">{children}</span>
    </button>
  )
}