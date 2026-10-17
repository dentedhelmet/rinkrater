'use client'

export function BottomBanner() {
  return (
    <a
      href="https://www.northpoledesign.com"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        width: '100%',
        textDecoration: 'none',
        flexShrink: 0,
      }}
    >
      <img
        src="/ads/npd_rr_bottom_banner.jpg"
        alt="Created and designed by North Pole Design — northpoledesign.com"
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
        }}
      />
    </a>
  )
}
