// Central place for the Rink Rater Amazon Associates tracking ID.
// Every outbound Amazon link (ads, Shop products, the Storefront link)
// should go through withAssociateTag() so a link pasted without a
// tracking tag doesn't silently earn nothing.
export const AMAZON_ASSOCIATE_TAG = 'rinkrater-20'

export function withAssociateTag(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url // not a valid absolute URL — leave it alone rather than throw
  }

  if (!/(^|\.)amazon\.[a-z.]+$/i.test(parsed.hostname)) {
    return url // not an amazon.* link, nothing to tag
  }

  if (!parsed.searchParams.has('tag')) {
    parsed.searchParams.set('tag', AMAZON_ASSOCIATE_TAG)
  }

  return parsed.toString()
}
