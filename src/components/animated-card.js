/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import Link from 'next/link'
import { useState, useEffect } from 'react'

const cardStyles = css`
  --background-color: #18181B;
  --text-color: #A1A1AA;
  --card-background-color: rgba(255, 255, 255, .015);
  --card-border-color: rgba(255, 255, 255, 0.1);
  --card-box-shadow-1: rgba(0, 0, 0, 0.05);
  --card-box-shadow-1-y: 3px;
  --card-box-shadow-1-blur: 6px;
  --card-box-shadow-2: rgba(0, 0, 0, 0.1);
  --card-box-shadow-2-y: 8px;
  --card-box-shadow-2-blur: 15px;
  --card-label-color: #FFFFFF;
  --card-icon-color: #D4D4D8;
  --card-icon-background-color: rgba(255, 255, 255, 0.08);
  --card-icon-border-color: rgba(255, 255, 255, 0.12);
  --card-shine-opacity: .1;
  --card-shine-gradient: conic-gradient(from 205deg at 50% 50%, rgba(16, 185, 129, 0) 0deg, #10B981 25deg, rgba(52, 211, 153, 0.18) 295deg, rgba(16, 185, 129, 0) 360deg);
  --card-line-color: #2A2B2C;
  --card-tile-color: rgba(16, 185, 129, 0.05);
  --card-hover-border-color: rgba(255, 255, 255, 0.2);
  --card-hover-box-shadow-1: rgba(0, 0, 0, 0.04);
  --card-hover-box-shadow-1-y: 5px;
  --card-hover-box-shadow-1-blur: 10px;
  --card-hover-box-shadow-2: rgba(0, 0, 0, 0.3);
  --card-hover-box-shadow-2-y: 15px;
  --card-hover-box-shadow-2-blur: 25px;
  --card-hover-icon-color: #34D399;
  --card-hover-icon-background-color: rgba(52, 211, 153, 0.1);
  --card-hover-icon-border-color: rgba(52, 211, 153, 0.2);

  [data-theme='light'] & {
    --background-color: #FAFAFA;
    --text-color: #52525B;
    --card-background-color: transparent;
    --card-border-color: rgba(24, 24, 27, 0.08);
    --card-box-shadow-1: rgba(24, 24, 27, 0.02);
    --card-box-shadow-1-y: 3px;
    --card-box-shadow-1-blur: 6px;
    --card-box-shadow-2: rgba(24, 24, 27, 0.04);
    --card-box-shadow-2-y: 2px;
    --card-box-shadow-2-blur: 7px;
    --card-label-color: #18181B;
    --card-icon-color: #18181B;
    --card-icon-background-color: rgba(24, 24, 27, 0.04);
    --card-icon-border-color: rgba(24, 24, 27, 0.1);
    --card-shine-opacity: .3;
    --card-shine-gradient: conic-gradient(from 225deg at 50% 50%, rgba(16, 185, 129, 0) 0deg, #10B981 25deg, #EDFAF6 285deg, #FFFFFF 345deg, rgba(16, 185, 129, 0) 360deg);
    --card-line-color: #E9E9E7;
    --card-tile-color: rgba(16, 185, 129, 0.08);
    --card-hover-border-color: rgba(24, 24, 27, 0.15);
    --card-hover-box-shadow-1: rgba(24, 24, 27, 0.05);
    --card-hover-box-shadow-1-y: 3px;
    --card-hover-box-shadow-1-blur: 6px;
    --card-hover-box-shadow-2: rgba(24, 24, 27, 0.1);
    --card-hover-box-shadow-2-y: 8px;
    --card-hover-box-shadow-2-blur: 15px;
    --card-hover-icon-color: #18181B;
    --card-hover-icon-background-color: rgba(24, 24, 27, 0.04);
    --card-hover-icon-border-color: rgba(24, 24, 27, 0.34);
  }

  .card {
    background-color: var(--background-color);
    box-shadow: 0px 3px 6px var(--card-hover-box-shadow-1), 0px var(--card-hover-box-shadow-2-y) var(--card-hover-box-shadow-2-blur) var(--card-hover-box-shadow-2), 0 0 0 1px var(--card-hover-border-color);
    padding: 56px 16px 16px 16px;
    border-radius: 15px;
    cursor: pointer;
    position: relative;
    transition: all .25s ease;
    height: 180px;
    width: 280px;

    &.expanded {
      height: auto;
      min-height: 180px;
    }

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 15px;
      background-color: var(--card-background-color);
    }

    .icon {
      z-index: 2;
      position: relative;
      display: table;
      padding: 8px;

      &::after {
        content: '';
        position: absolute;
        inset: 4.5px;
        border-radius: 50%;
        background-color: var(--card-hover-icon-background-color);
        border: 1px solid var(--card-hover-icon-border-color);
        backdrop-filter: blur(2px);
        transition: background-color .25s, border-color .25s;
      }

      svg {
        position: relative;
        z-index: 1;
        display: block;
        width: 24px;
        height: 24px;
        transform: translateZ(0);
        color: var(--card-hover-icon-color);
        transition: color .25s;
      }
    }

    h4 {
      z-index: 2;
      position: relative;
      margin: 12px 0 4px 0;
      font-family: inherit;
      font-weight: 600;
      font-size: 14px;
      line-height: 2;
      color: var(--card-label-color);
    }

    p {
      z-index: 2;
      position: relative;
      margin: 0;
      font-size: 14px;
      line-height: 1.7;
      color: var(--text-color);
      word-wrap: break-word;
      overflow-wrap: break-word;
      hyphens: auto;
    }

    .read-more {
      z-index: 2;
      position: relative;
      margin-top: 8px;
      font-size: 14px;
      font-weight: bold;
      color: var(--card-hover-icon-color);
      cursor: pointer;
      transition: color .25s ease;
      display: inline-block;
      margin-left: 4px;

      &:hover {
        color: var(--card-label-color);
      }
    }

    .shine {
      border-radius: inherit;
      position: absolute;
      inset: 0;
      z-index: 1;
      overflow: hidden;
      opacity: 1;
      transition: opacity .5s;

      &:before {
        content: '';
        width: 150%;
        padding-bottom: 150%;
        border-radius: 50%;
        position: absolute;
        left: 50%;
        bottom: 55%;
        filter: blur(35px);
        opacity: var(--card-shine-opacity);
        transform: translateX(-50%);
        background-image: var(--card-shine-gradient);
      }
    }

    .background {
      border-radius: inherit;
      position: absolute;
      inset: 0;
      overflow: hidden;
      -webkit-mask-image: radial-gradient(circle at 60% 5%, black 0%, black 15%, transparent 60%);
      mask-image: radial-gradient(circle at 60% 5%, black 0%, black 15%, transparent 60%);

      .tiles {
        opacity: 1;
        transition: opacity .25s;

        .tile {
          position: absolute;
          background-color: var(--card-tile-color);
          animation-duration: 8s;
          animation-iteration-count: infinite;
          animation-name: tile;
          opacity: 0;

          &.tile-4,
          &.tile-6,
          &.tile-10 {
            animation-delay: -2s;
          }

          &.tile-3,
          &.tile-5,
          &.tile-8 {
            animation-delay: -4s;
          }

          &.tile-2,
          &.tile-9 {
            animation-delay: -6s;
          }

          &.tile-1 {
            top: 0;
            left: 0;
            height: 10%;
            width: 22.5%;
          }

          &.tile-2 {
            top: 0;
            left: 22.5%;
            height: 10%;
            width: 27.5%;
          }

          &.tile-3 {
            top: 0;
            left: 50%;
            height: 10%;
            width: 27.5%;
          }

          &.tile-4 {
            top: 0;
            left: 77.5%;
            height: 10%;
            width: 22.5%;
          }

          &.tile-5 {
            top: 10%;
            left: 0;
            height: 22.5%;
            width: 22.5%;
          }

          &.tile-6 {
            top: 10%;
            left: 22.5%;
            height: 22.5%;
            width: 27.5%;
          }

          &.tile-7 {
            top: 10%;
            left: 50%;
            height: 22.5%;
            width: 27.5%;
          }

          &.tile-8 {
            top: 10%;
            left: 77.5%;
            height: 22.5%;
            width: 22.5%;
          }

          &.tile-9 {
            top: 32.5%;
            left: 50%;
            height: 22.5%;
            width: 27.5%;
          }

          &.tile-10 {
            top: 32.5%;
            left: 77.5%;
            height: 22.5%;
            width: 22.5%;
          }
        }
      }

      @keyframes tile {
        0%,
        12.5%,
        100% {
          opacity: 1;
        }

        25%,
        82.5% {
          opacity: 0;
        }
      }

      .line {
        position: absolute;
        inset: 0;
        opacity: 1;
        transition: opacity .35s;

        &:before,
        &:after {
          content: '';
          position: absolute;
          background-color: var(--card-line-color);
          transition: transform .35s;
        }

        &:before {
          left: 0;
          right: 0;
          height: 1px;
          transform-origin: 0 50%;
          transform: scaleX(1);
        }

        &:after {
          top: 0;
          bottom: 0;
          width: 1px;
          transform-origin: 50% 0;
          transform: scaleY(1);
        }

        &.line-1 {
          &:before {
            top: 10%;
          }

          &:after {
            left: 22.5%;
          }

          &:before,
          &:after {
            transition-delay: 0s;
          }
        }

        &.line-2 {
          &:before {
            top: 32.5%;
          }

          &:after {
            left: 50%;
          }

          &:before,
          &:after {
            transition-delay: .15s;
          }
        }

        &.line-3 {
          &:before {
            top: 55%;
          }

          &:after {
            right: 22.5%;
          }

          &:before,
          &:after {
            transition-delay: .3s;
          }
        }
      }
    }


  }
`

const AnimatedCard = ({ post, index = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const getIcon = (index) => {
    const icons = [
      // House icon
      <svg
        key="house"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M14.5 3.5C14.5 3.5 14.5 5.5 12 5.5C9.5 5.5 9.5 3.5 9.5 3.5H7.5L4.20711 6.79289C3.81658 7.18342 3.81658 7.81658 4.20711 8.20711L6.5 10.5V20.5H17.5V10.5L19.7929 8.20711C20.1834 7.81658 20.1834 7.18342 19.7929 6.79289L16.5 3.5H14.5Z" />
      </svg>,
      // Shapes icon
      <svg
        key="shapes"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M4.5 9.5V5.5C4.5 4.94772 4.94772 4.5 5.5 4.5H9.5C10.0523 4.5 10.5 4.94772 10.5 5.5V9.5C10.5 10.0523 10.0523 10.5 9.5 10.5H5.5C4.94772 10.5 4.5 10.0523 4.5 9.5Z" />
        <path d="M13.5 18.5V14.5C13.5 13.9477 13.9477 13.5 14.5 13.5H18.5C19.0523 13.5 19.5 13.9477 19.5 14.5V18.5C19.5 19.0523 19.0523 19.5 18.5 19.5H14.5C13.9477 19.5 13.5 19.0523 13.5 18.5Z" />
        <path d="M4.5 19.5L7.5 13.5L10.5 19.5H4.5Z" />
        <path d="M16.5 4.5C18.1569 4.5 19.5 5.84315 19.5 7.5C19.5 9.15685 18.1569 10.5 16.5 10.5C14.8431 10.5 13.5 9.15685 13.5 7.5C13.5 5.84315 14.8431 4.5 16.5 4.5Z" />
      </svg>,
      // Document icon
      <svg
        key="document"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10,9 9,9 8,9" />
      </svg>,
      // Star icon
      <svg
        key="star"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
      >
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
      </svg>
    ]
    return icons[index % icons.length]
  }

  const getPreviewText = () => {
    const text = post.excerpt || (post.content ? post.content.substring(0, 200) : 'No preview available')
    if (isExpanded) {
      return post.excerpt || (post.content ? post.content.substring(0, 500) : 'No preview available')
    }
    
    if (text.length > 100) {
      // Find the last space before character 100 to avoid cutting words
      const truncateAt = text.lastIndexOf(' ', 100)
      const cutPoint = truncateAt > 80 ? truncateAt : 100
      return text.substring(0, cutPoint)
    }
    
    return text
  }

  const shouldShowReadMore = () => {
    const text = post.excerpt || post.content || ''
    return text.length > 100
  }

  const handleReadMoreClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  return (
    <div css={cardStyles}>
      <Link href={`/${post.author?.name || 'unknown'}/${post.slug}`}>
        <div className={`card ${isExpanded ? 'expanded' : ''}`}>
          <span className="icon">
            {getIcon(index)}
          </span>
          <h4>{post.title || 'Untitled'}</h4>
          <p>
            {getPreviewText()}
            {shouldShowReadMore() && !isExpanded && (
              <span>...
                <span className="read-more" onClick={handleReadMoreClick}>
                  Read More
                </span>
              </span>
            )}
          </p>
          {shouldShowReadMore() && isExpanded && (
            <div className="read-more" onClick={handleReadMoreClick}>
              Show less
            </div>
          )}
          <div className="shine"></div>
          <div className="background">
            <div className="tiles">
              <div className="tile tile-1"></div>
              <div className="tile tile-2"></div>
              <div className="tile tile-3"></div>
              <div className="tile tile-4"></div>
              <div className="tile tile-5"></div>
              <div className="tile tile-6"></div>
              <div className="tile tile-7"></div>
              <div className="tile tile-8"></div>
              <div className="tile tile-9"></div>
              <div className="tile tile-10"></div>
            </div>
            <div className="line line-1"></div>
            <div className="line line-2"></div>
            <div className="line line-3"></div>
          </div>
        </div>
      </Link>
    </div>
  )
}

export default AnimatedCard