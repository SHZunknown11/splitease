import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

export function Avatar({ user, large }) {
  if (!user) return null
  return (
    <span className={'avatar' + (user.onLight ? ' on-light' : '') + (large ? ' lg' : '')} style={{ background: user.hue }} title={user.name}>
      {user.name.slice(0, 2)}
    </span>
  )
}

export function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <clipPath id="lg-tile"><rect x="2" y="2" width="60" height="60" rx="15" /></clipPath>
        <clipPath id="lg-up"><polygon points="0,0 64,0 0,64" /></clipPath>
        <clipPath id="lg-lo"><polygon points="64,0 64,64 0,64" /></clipPath>
      </defs>
      <g clipPath="url(#lg-tile)">
        <rect width="64" height="64" fill="#1c2a6b" />
        <polygon points="64,0 64,64 0,64" fill="#f28c0c" />
      </g>
      <g clipPath="url(#lg-up)"><g transform="translate(2.4,-2.4)">
        <circle cx="32" cy="32" r="19" fill="#ffd23f" />
        <circle cx="32" cy="32" r="14" fill="none" stroke="#e3a500" strokeWidth="2.2" />
      </g></g>
      <g clipPath="url(#lg-lo)"><g transform="translate(-2.4,2.4)">
        <circle cx="32" cy="32" r="19" fill="#ffd23f" />
        <circle cx="32" cy="32" r="14" fill="none" stroke="#e3a500" strokeWidth="2.2" />
      </g></g>
      <rect x="28.6" y="28.6" width="6.8" height="6.8" rx="1.2" transform="rotate(45 32 32)" fill="#0e8c9b" />
    </svg>
  )
}

export function Dialog({ title, onClose, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    ref.current?.querySelector('input, select, button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        ref={ref} className="dialog" role="dialog" aria-modal="true" aria-label={title}
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
      >
        <h2>{title}</h2>
        {children}
      </motion.div>
    </div>
  )
}
