import { useEffect, useState } from 'react'

/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'

const baseInputStyles = css`
  display: block;
  width: 100%;
  padding: 0.75em 1em 0.75em 2.5em;
  background: none;
  border: 1px solid var(--grey-2);
  outline: none;
  border-radius: 0.5rem;

  color: var(--grey-4);
  &::placeholder {
    color: var(--grey-3);
  }
`

const dashboardInputStyles = css`
  display: block;
  width: 100%;
  padding: 0.5rem 0.85rem 0.5rem 2.15rem;
  background: var(--accent-bg);
  border: 1px dashed var(--border-dashed);
  outline: none;
  border-radius: 6px;
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  color: var(--grey-4);
  transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;

  &::placeholder {
    color: var(--grey-3);
  }

  &:hover {
    border-color: var(--border);
  }

  &:focus {
    background: var(--grey-1);
    border: 1px solid var(--accent-border);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
`

const baseWrapStyle = css`
  width: 80%;
  position: relative;
`

const dashboardWrapStyle = css`
  width: 100%;
  position: relative;
`

const baseIconStyle = css`
  position: absolute;
  margin: 0.8em;

  path {
    stroke: var(--grey-3);
  }
`

const dashboardIconStyle = css`
  position: absolute;
  top: 50%;
  left: 0.75rem;
  transform: translateY(-50%);
  pointer-events: none;

  path {
    stroke: var(--grey-3);
  }
`

export default function Search(props) {
  const [searchInput, setSearchInput] = useState('');
  const searchBarPlaceholder = props.isGlobalSearch ? 'Search published posts...' : 'Search your posts...'
  const isDashboard = props.variant === 'dashboard'

  const handleKeyDown = (event) => {
    if (props.isGlobalSearch) {
      if (event.key === 'Enter') {
        props.getSearchInput(searchInput);
      }
    }
  }

  useEffect(() => {
    if (props.isGlobalSearch) {
      const delayDebounceFn = setTimeout(() => {
        if (searchInput.trim().length > 0 || searchInput === '') {
          props.getSearchInput(searchInput);
        }
      }, 500)

      return () => clearTimeout(delayDebounceFn)
    } else {
      const delayDebounceFn = setTimeout(() => {
        if (props.posts) {
          filterPosts();
          props.getSearchInput(searchInput);
        }
      }, 500)

      return () => clearTimeout(delayDebounceFn)
    }
  }, [searchInput])

  const filterPosts = () => {
    if (props.isGlobalSearch) {
      console.log('Do global search')
    } else {
      let tempPosts = props.posts.filter(p => p.title.toLowerCase().includes(searchInput.toLowerCase()))
      props.getFilteredPosts(tempPosts);
    }
  }

  return (
    <div css={isDashboard ? dashboardWrapStyle : baseWrapStyle}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={isDashboard ? '14' : '1.1em'}
        height={isDashboard ? '14' : '1.1em'}
        fill="none"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
        css={isDashboard ? dashboardIconStyle : baseIconStyle}
      >
        <path
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m17 17 4 4M3 11a8 8 0 1 0 16 0 8 8 0 0 0-16 0Z">
        </path>
      </svg>
      <input
        id="search-posts"
        type="text"
        placeholder={searchBarPlaceholder}
        onKeyDown={handleKeyDown}
        css={isDashboard ? dashboardInputStyles : baseInputStyles}
        onChange={e => {
          setSearchInput(e.target.value);
        }}
      />
    </div>
  )
}
