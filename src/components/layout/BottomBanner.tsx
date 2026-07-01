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
        src="/ads/npd_bottom_bar.jpg"
        alt="North Pole Design"
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
        }}
      />
    </a>
  )
}
