import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { inr } from '../lib/settle.js'

const W = 460, H = 330, R = 24

// People sit on an ellipse; the first one is at the top.
function place(members) {
  const n = members.length
  return Object.fromEntries(members.map((m, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    const x = W / 2 + Math.cos(a) * 138, y = H / 2 + 4 + Math.sin(a) * 108
    // Names sit on the outside of the ring so arrows never cross them.
    return [m.id, { x, y, nx: x + Math.cos(a) * (R + 12), ny: y + Math.sin(a) * (R + 14), anchor: Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end' }]
  }))
}

// A curved arrow from a to b, stopping short of both circles.
function curve(a, b, bend) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1
  const ux = dx / len, uy = dy / len
  const sx = a.x + ux * (R + 4), sy = a.y + uy * (R + 4)
  const ex = b.x - ux * (R + 10), ey = b.y - uy * (R + 10)
  const cx = (sx + ex) / 2 - uy * bend, cy = (sy + ey) / 2 + ux * bend
  return { d: `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`, lx: (sx + 2 * cx + ex) / 4, ly: (sy + 2 * cy + ey) / 4 }
}

export default function DebtGraph({ members, raw, clean, simplified, label }) {
  const still = useReducedMotion()
  const at = place(members)
  const edges = simplified ? clean : raw
  const draw = (i) => ({
    initial: { pathLength: still ? 1 : 0, opacity: still ? 1 : 0 },
    animate: { pathLength: 1, opacity: simplified ? 1 : 0.38 },
    exit: { opacity: 0, transition: { duration: 0.2 } },
    transition: { duration: 0.55, delay: still ? 0 : (simplified ? 0.25 : 0) + i * 0.07, ease: 'easeOut' },
  })

  return (
    <svg className="graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <defs>
        <marker id="tip" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" style={{ fill: 'var(--ink)' }} />
        </marker>
      </defs>
      <AnimatePresence mode="wait">
        <g key={simplified ? 'clean' : 'raw'}>
          {edges.map((e, i) => {
            if (!at[e.from] || !at[e.to]) return null
            const c = curve(at[e.from], at[e.to], simplified ? 14 : 22)
            const text = inr(e.amount)
            return (
              <g key={e.from + e.to}>
                <motion.path className={'edge ' + (simplified ? 'clean' : 'raw')} d={c.d} markerEnd="url(#tip)" {...draw(i)} />
                {simplified && (
                  <motion.g className="tag" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: still ? 0 : 0.7 + i * 0.07 }}>
                    <rect x={c.lx - text.length * 4 - 6} y={c.ly - 10} width={text.length * 8 + 12} height={20} rx={4} />
                    <text x={c.lx} y={c.ly}>{text}</text>
                  </motion.g>
                )}
              </g>
            )
          })}
        </g>
      </AnimatePresence>
      {members.map((m) => (
        <g key={m.id}>
          <circle cx={at[m.id].x} cy={at[m.id].y} r={R} fill={m.hue} />
          <text className={'ini' + (m.onLight ? ' on-light' : '')} x={at[m.id].x} y={at[m.id].y}>{m.name.slice(0, 2)}</text>
          <text className="who" x={at[m.id].nx} y={at[m.id].ny} style={{ textAnchor: at[m.id].anchor }}>{m.name}</text>
        </g>
      ))}
    </svg>
  )
}
