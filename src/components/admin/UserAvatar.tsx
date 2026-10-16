'use client'

/** Round avatar: the user's photo if they have one, otherwise their initials. */
export function UserAvatar({
  alias,
  initials,
  avatarUrl,
  size = 44,
}: {
  alias:     string | null
  initials:  string | null
  avatarUrl: string | null
  size?:     number
}) {
  const fallback = (initials || alias?.slice(0, 2) || '?').toUpperCase()

  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {avatarUrl ? <img src={avatarUrl} alt="" /> : fallback}
      <style jsx>{`
        .avatar {
          flex-shrink: 0;
          border-radius: 50%;
          background: var(--rr-navy);
          color: #fff;
          font-weight: 900;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border: 2px solid #fff;
          box-shadow: 0 0 0 2px var(--rr-navy);
        }
        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      `}</style>
    </span>
  )
}
