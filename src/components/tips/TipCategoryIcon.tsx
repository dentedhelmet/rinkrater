'use client'

import { useState } from 'react'
import Image from 'next/image'
import { TIP_CATEGORY_MAP, type TipCategory } from '@/lib/parentTips'

/**
 * A tip category's round icon (public/tip-icons/...). If the image file is
 * missing or misnamed, it falls back to the category's emoji instead of
 * showing a broken image.
 */
export function TipCategoryIcon({ category, size = 22 }: { category: TipCategory; size?: number }) {
  const [failed, setFailed] = useState(false)
  const cat = TIP_CATEGORY_MAP[category]
  if (!cat) return null

  if (failed || !cat.iconSrc) {
    return (
      <span aria-hidden="true" style={{ fontSize: Math.round(size * 0.8), lineHeight: 1 }}>
        {cat.icon}
      </span>
    )
  }

  return (
    <Image
      src={cat.iconSrc}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
    />
  )
}
