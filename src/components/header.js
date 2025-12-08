/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import React, { useEffect } from 'react'

const Header = props => {
  useEffect(() => {
    // Add SVG elements to all links in the header
    const links = document.querySelectorAll('header a');
    links.forEach(link => {
      // Only add SVG if it doesn't already exist
      if (!link.querySelector('svg')) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 70 36');
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M6.9739 30.8153H63.0244C65.5269 30.8152 75.5358 -3.68471 35.4998 2.81531C-16.1598 11.2025 0.894099 33.9766 26.9922 34.3153C104.062 35.3153 54.5169 -6.68469 23.489 9.31527');
        
        svg.appendChild(path);
        link.appendChild(svg);
      }
    });
  }, []);
  
  return (
  <header
    css={css`
      display: flex;
      margin-bottom: 5rem;
      justify-content: space-evenly;

      a {
        display: inline-block;
        position: relative;
        text-decoration: none;
        color: var(--grey-3);
        cursor: pointer;
        margin-right: 1.5rem;
        margin: 0 var(--spacing, 0px);
        transition: margin .25s, color .2s ease;
      }

      a:hover {
        color: var(--grey-4);
      }
      
      a svg {
        width: 76px;
        height: 40px;
        position: absolute;
        left: 50%;
        bottom: 0;
        transform: translate(-50%, 7px) translateZ(0);
        fill: none;
        stroke: var(--stroke, var(--line));
        stroke-linecap: round;
        stroke-width: 2px;
        stroke-dasharray: var(--offset, 69px) 278px;
        stroke-dashoffset: 361px;
        transition: stroke .25s ease var(--stroke-delay, 0s), stroke-dasharray .35s;
      }
      
      button {
        color: var(--grey-3);
        cursor: pointer;
        transition: all 200ms ease;
      }

      button:hover {
        color: var(--grey-4);
      }

      button:last-of-type {
        margin-right: 0;
      }

      button {
        border: none;
        padding: 0;
        background: none;
      }
    `}
    {...props}
  >
    {props.children}
  </header>
)
}
export default Header;