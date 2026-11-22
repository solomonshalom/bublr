/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { html } from '@codemirror/lang-html'
import { css as cssLanguage } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'

const wrapStyle = css`
  height: 100%;
  font-size: 13px;

  .cm-editor {
    height: 100%;
    background: var(--grey-1);
  }

  .cm-editor.cm-focused {
    outline: none;
  }

  .cm-scroller {
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    line-height: 1.6;
  }

  .cm-gutters {
    background: var(--grey-1);
    border-right: 1px dashed var(--border-dashed);
    color: var(--grey-3);
  }
`

const BASIC_SETUP = {
  foldGutter: false,
  highlightActiveLineGutter: true,
  autocompletion: true,
  bracketMatching: true,
  closeBrackets: true,
  indentOnInput: true,
  tabSize: 2,
}

/**
 * One CodeMirror editor (HTML, CSS or JS). Loaded only in the browser
 * (next/dynamic with ssr: false) because CodeMirror needs the DOM.
 */
export default function CodeEditor({ language, value, onChange, dark, onCreateEditor, label, placeholder }) {
  const extensions = useMemo(() => {
    const lang =
      language === 'css' ? cssLanguage() : language === 'js' ? javascript() : html({ autoCloseTags: true, selfClosingTags: false })
    return [lang, EditorView.lineWrapping, EditorView.contentAttributes.of({ 'aria-label': label || `${language} editor` })]
  }, [language, label])

  return (
    <div css={wrapStyle}>
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        theme={dark ? oneDark : 'light'}
        height="100%"
        basicSetup={BASIC_SETUP}
        placeholder={placeholder}
        onCreateEditor={onCreateEditor}
      />
    </div>
  )
}
