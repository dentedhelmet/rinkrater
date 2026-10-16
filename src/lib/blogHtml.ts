import sanitizeHtml from 'sanitize-html'

/**
 * Cleans post HTML before it's shown on the public blog. Only admins can
 * write posts, but this keeps the page safe even if something unexpected
 * gets pasted into the editor (scripts, tracking pixels, inline handlers).
 *
 * Allowed: the formatting the editor produces, images, links, and YouTube
 * embeds. Everything else is stripped.
 */
export function cleanPostHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'h2', 'h3', 'h4', 'p', 'br', 'hr',
      'strong', 'b', 'em', 'i', 'u', 's',
      'a', 'ul', 'ol', 'li', 'blockquote',
      'code', 'pre', 'img', 'figure', 'figcaption',
      'div', 'iframe',
    ],
    allowedAttributes: {
      a:      ['href', 'title', 'target', 'rel'],
      img:    ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
      div:    ['data-youtube-video'],
      iframe: ['src', 'width', 'height', 'allowfullscreen', 'title', 'loading'],
      ol:     ['start'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['https'] },
    allowedIframeHostnames: ['www.youtube-nocookie.com', 'www.youtube.com'],
    // Drop iframes left empty after a non-YouTube source was stripped.
    exclusiveFilter: (frame) => frame.tag === 'iframe' && !frame.attribs.src,
    transformTags: {
      // Outside links open in a new tab; links to our own pages (rinks,
      // other posts) stay in the same tab.
      a: (tagName, attribs) => {
        const href = attribs.href ?? ''
        const isInternal = href.startsWith('/') || /^https?:\/\/(www\.)?rinkrater\.com/i.test(href)
        const out: sanitizeHtml.Attributes = isInternal
          ? { href }
          : { href, target: '_blank', rel: 'noopener noreferrer' }
        return { tagName, attribs: out }
      },
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, alt: attribs.alt ?? '', loading: 'lazy', decoding: 'async' },
      }),
      iframe: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, title: attribs.title || 'Embedded video', loading: 'lazy' },
      }),
    },
  })
}
