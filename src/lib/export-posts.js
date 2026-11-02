/**
 * Build the files for "Export your writing": every post as Markdown with
 * front matter (works with Hugo, Jekyll, Astro, Obsidian, Bear Blog...), plus
 * a JSON copy that keeps the original HTML so nothing is lost.
 *
 * Pure function so it can be tested; the browser supplies the HTML
 * converters.
 */

const SITE_URL = 'https://bublr.life'

function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value.toMillis === 'function') return new Date(value.toMillis())
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000)
  const date = new Date(value)
  return isNaN(date) ? null : date
}

function fileSlug(value, fallback) {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || fallback
}

// JSON strings are valid YAML double-quoted scalars
const yamlString = value => JSON.stringify(String(value ?? ''))

/**
 * @param {object} params
 * @param {object} params.user   the writer's profile ({ name, displayName, about, link })
 * @param {object[]} params.posts the writer's posts (published and drafts)
 * @param {(html: string) => string} params.toMarkdown
 * @param {(html: string) => string} params.toText  HTML → plain text (titles, excerpts)
 * @param {Date} [params.now]
 * @returns {{ folder: string, files: { name: string, data: string, date?: Date }[] }}
 */
export function buildExportFiles({ user, posts, toMarkdown, toText, now = new Date() }) {
  const username = user?.name || 'me'
  const folder = `bublr-${fileSlug(username, 'export')}-${now.toISOString().slice(0, 10)}`
  const used = new Set()

  const sorted = [...(posts || [])].sort(
    (a, b) => (toDate(b.lastEdited)?.getTime() || 0) - (toDate(a.lastEdited)?.getTime() || 0)
  )

  const files = []
  const jsonPosts = []

  for (const post of sorted) {
    const title = toText(post.title || '').trim() || 'Untitled'
    const excerpt = toText(post.excerpt || '').trim()
    const edited = toDate(post.lastEdited)
    const published = Boolean(post.published)

    let base = fileSlug(post.slug, fileSlug(post.id, 'post'))
    let name = base
    for (let i = 2; used.has(name); i++) name = `${base}-${i}`
    used.add(name)

    const frontMatter = [
      '---',
      `title: ${yamlString(title)}`,
      edited ? `date: ${edited.toISOString()}` : null,
      `slug: ${yamlString(post.slug || name)}`,
      `draft: ${!published}`,
      excerpt ? `description: ${yamlString(excerpt)}` : null,
      published && post.slug ? `canonical_url: ${SITE_URL}/${username}/${post.slug}` : null,
      '---',
      '',
    ]
      .filter(line => line !== null)
      .join('\n')

    files.push({
      name: `${folder}/posts/${name}.md`,
      data: `${frontMatter}\n${toMarkdown(post.content || '')}`,
      date: edited || now,
    })

    jsonPosts.push({
      id: post.id || null,
      title,
      slug: post.slug || null,
      published,
      lastEdited: edited ? edited.toISOString() : null,
      excerpt,
      dotColor: post.dotColor || null,
      html: post.content || '',
    })
  }

  const published = jsonPosts.filter(p => p.published).length
  const readme = [
    `# ${user?.displayName || username} on Bublr`,
    '',
    `Exported ${now.toUTCString()} from ${SITE_URL}/${username}.`,
    '',
    `- ${jsonPosts.length} post${jsonPosts.length === 1 ? '' : 's'} (${published} published, ${jsonPosts.length - published} draft${jsonPosts.length - published === 1 ? '' : 's'})`,
    '- `posts/` has one Markdown file per post, with front matter most static site generators understand. Drafts have `draft: true`.',
    '- `bublr-export.json` keeps every post’s original HTML, so nothing is lost if you want to convert it yourself.',
    '',
    'Your words are yours. Take them anywhere.',
    '',
  ].join('\n')

  files.unshift({ name: `${folder}/README.md`, data: readme, date: now })
  files.push({
    name: `${folder}/bublr-export.json`,
    data: JSON.stringify(
      {
        exportedAt: now.toISOString(),
        source: SITE_URL,
        profile: {
          username,
          displayName: user?.displayName || '',
          about: user?.about || '',
          link: user?.link || '',
          url: `${SITE_URL}/${username}`,
        },
        posts: jsonPosts,
      },
      null,
      2
    ),
    date: now,
  })

  return { folder, files }
}
