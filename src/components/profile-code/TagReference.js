/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import DsButton from '../dashboard/ds-button'

const GROUPS = [
  {
    title: 'Your details',
    hint: 'Swapped for your own text. Safe to use anywhere in HTML or CSS.',
    items: [
      { code: '{{displayName}}', about: 'Your display name', key: 'displayName' },
      { code: '{{name}}', about: 'Your username', key: 'name' },
      { code: '{{about}}', about: 'Your bio', key: 'about' },
      { code: '<img src="{{photo}}" alt="{{displayName}}">', about: 'Your profile picture' },
      { code: '{{banner}}', about: 'Your banner image link (try it in CSS: url({{banner}}))', key: 'banner' },
      { code: '{{link}}', about: 'Your website', key: 'link' },
      { code: '{{postCount}} · {{totalReads}} · {{followerCount}}', about: 'Posts, reads and followers' },
      { code: '{{year}}', about: 'This year, for footers', key: 'year' },
    ],
  },
  {
    title: 'Lists',
    hint: '{{#list}}…{{/list}} repeats for every item; {{^list}}…{{/list}} shows when it’s empty. {{#hasPosts}}…{{/hasPosts}} shows a block only if you have posts (also hasSkills, hasSocials, hasGuestbook, hasWork, hasEducation).',
    items: [
      { code: '{{#posts}}\n  <a href="{{url}}">{{title}}</a> {{date}}\n{{/posts}}\n{{^posts}}No posts yet{{/posts}}', about: 'Posts: title, url, excerpt, date, reads, dotColor, index' },
      { code: '{{#skills}}<span>{{.}}</span> {{/skills}}', about: 'Skills' },
      { code: '{{#socials}}<a href="{{url}}">{{label}}</a> {{/socials}}', about: 'Social links and website: label, url, handle, network' },
      { code: '{{#guestbook}}<p><b>{{name}}</b>: {{message}}</p>{{/guestbook}}', about: 'Guest book: name, message, date' },
      { code: '{{#work}}<p>{{title}} at {{organization}} ({{dates}})</p>{{/work}}', about: 'Work (and {{#education}})' },
    ],
  },
  {
    title: 'Widgets',
    hint: 'Ready-made pieces with sensible styles you can override. Put your own HTML inside a list widget to choose how each item looks.',
    items: [
      { code: '<bublr-posts limit="5" layout="list"></bublr-posts>', about: 'Your posts. layout: list, cards, grid or compact' },
      { code: '<bublr-posts limit="3">\n  <h3><a href="{{url}}">{{title}}</a></h3>\n</bublr-posts>', about: 'Posts with your own markup per item' },
      { code: '<bublr-latest-post></bublr-latest-post>', about: 'A card for your newest post' },
      { code: '<bublr-avatar size="96" shape="circle"></bublr-avatar>', about: 'Profile picture. shape: circle, square or rounded' },
      { code: '<bublr-friends users="alice, bob" title="Top 8"></bublr-friends>', about: 'Your Top 8: up to 12 Bublr usernames' },
      { code: '<bublr-music src="https://example.com/song.mp3" title="Song — Artist"></bublr-music>', about: 'A profile song (any .mp3 link)' },
      { code: '<bublr-guestbook limit="6"></bublr-guestbook>', about: 'Guest book signatures, drawn' },
      { code: '<bublr-counter digits="6"></bublr-counter>', about: 'An old-school counter of your total reads' },
      { code: '<bublr-stats></bublr-stats>', about: 'Posts, reads, followers, following' },
      { code: '<bublr-socials></bublr-socials>', about: 'Links to your socials and website' },
      { code: '<bublr-skills></bublr-skills>', about: 'Your skills with coloured dots' },
      { code: '<bublr-work></bublr-work>\n<bublr-education></bublr-education>', about: 'Your work and education timelines' },
      { code: '<bublr-bio></bublr-bio> <bublr-name></bublr-name> <bublr-username></bublr-username> <bublr-banner></bublr-banner>', about: 'Small pieces' },
    ],
  },
  {
    title: 'Light, dark and scripts',
    hint: 'The page follows each visitor’s Bublr theme. Scripts can read the same data.',
    items: [
      { code: '<style>\n  [data-theme=dark] body { background: #111; color: #eee; }\n</style>', about: '<html> has data-theme="light" or "dark"' },
      { code: '<p style="color: var(--bublr-muted)">Muted text</p>', about: 'Colour variables: --bublr-bg, --bublr-text, --bublr-muted, --bublr-border, --bublr-accent' },
      { code: '<script>\n  document.title = window.bublr.displayName\n  addEventListener(\'bublr:theme\', e => console.log(e.detail))\n</script>', about: 'window.bublr and the bublr:theme event' },
      { code: '<!-- bublr:no-tags -->', about: 'Turns {{tags}} off for the whole page (for Vue and friends). Widgets still work.' },
    ],
  },
]

const groupStyle = css`
  margin-bottom: 1.5rem;

  h3 {
    margin: 0 0 0.25rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--grey-4);
  }

  > p {
    margin: 0 0 0.75rem;
    font-size: 0.76rem;
    line-height: 1.5;
    color: var(--grey-3);
  }
`

const rowStyle = css`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.55rem 0;
  border-top: 1px dashed var(--border-dashed);

  pre {
    margin: 0 0 0.25rem;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.74rem;
    color: var(--accent-foreground);
  }

  span {
    font-size: 0.74rem;
    color: var(--grey-3);
  }
`

/** The cheat sheet in the editor: every tag and widget, one click to insert. */
export default function TagReference({ onInsert, data }) {
  return (
    <div>
      {GROUPS.map(group => (
        <section key={group.title} css={groupStyle}>
          <h3>{group.title}</h3>
          <p>{group.hint}</p>
          {group.items.map(item => {
            const value = item.key && data ? data[item.key] : undefined
            return (
              <div key={item.code} css={rowStyle}>
                <div css={css`flex: 1; min-width: 0;`}>
                  <pre>{item.code}</pre>
                  <span>
                    {item.about}
                    {value !== undefined && value !== '' ? ` · now “${String(value).slice(0, 60)}”` : ''}
                  </span>
                </div>
                <DsButton size="sm" variant="outline" onClick={() => onInsert(item.code)} aria-label={`Insert ${item.code}`}>
                  Insert
                </DsButton>
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
