/**
 * Turns an Instagram caption into the pieces of a blog draft:
 * a title, a short summary, and the body as simple HTML.
 *
 * Captions are messy (emoji, hashtag walls, "link in bio"), so this keeps
 * what reads like writing and drops the rest. The result is a starting
 * point — the post is saved as a draft for you to expand in HQ.
 */

const TITLE_MAX = 90
const EXCERPT_MAX = 155

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** A line made only of hashtags, mentions, dots or dashes. */
const isTagLine = (line: string) => /^[\s.·•\-–—_|]*((#|@)[\p{L}\p{N}_.]+[\s.·•,]*)*$/u.test(line) && /[#@.·•\-–—_]/u.test(line)

/** Drop hashtag walls, spacer lines and "link in bio" lines; trim trailing hashtags. */
export function cleanCaption(caption: string | null | undefined): string {
  if (!caption) return ''
  const lines = caption.replace(/\r\n?/g, '\n').split('\n')
  const kept = lines
    .filter((l) => !isTagLine(l.trim()) || l.trim() === '')
    .filter((l) => !/link in (our |the )?bio/i.test(l))
    .map((l) => l.replace(/(\s+#[\p{L}\p{N}_]+)+\s*$/u, '').trimEnd())
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function cutAtWord(s: string, max: number): string {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–—]+$/, '') + '…'
}

export interface CaptionDraft {
  title:     string
  excerpt:   string
  bodyHtml:  string
}

export function draftFromCaption(caption: string | null | undefined, postedAt: string): CaptionDraft {
  const clean = cleanCaption(caption)
  const dateLabel = new Date(postedAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York',
  })

  if (!clean) {
    return {
      title:    `From our Instagram — ${dateLabel}`,
      excerpt:  '',
      bodyHtml: '<p></p>',
    }
  }

  const lines = clean.split('\n')
  const firstLine = lines[0].trim()
  const title = cutAtWord(firstLine, TITLE_MAX)

  // If the first line was used whole as the title, don't repeat it in the body.
  const rest = (title === firstLine ? lines.slice(1) : lines).join('\n').trim()

  const paragraphs = rest
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) =>
      '<p>' +
      escapeHtml(p)
        .split('\n')
        .join('<br>')
        .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1">$1</a>') +
      '</p>'
    )

  const excerptSource = (rest || firstLine).replace(/\s+/g, ' ').trim()

  return {
    title,
    excerpt:  cutAtWord(excerptSource, EXCERPT_MAX),
    bodyHtml: paragraphs.length ? paragraphs.join('') : '<p></p>',
  }
}
