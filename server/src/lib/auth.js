import jwt from 'jsonwebtoken'
import { User } from '../models/index.js'

const SECRET = () => process.env.JWT_SECRET || 'dev-only-secret-change-me'
export const signToken = (userId) => jwt.sign({ sub: String(userId) }, SECRET(), { expiresIn: '7d' })
export const verifyToken = (token) => jwt.verify(token, SECRET()).sub

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Log in to continue.' })
  try {
    const user = await User.findById(verifyToken(token))
    if (!user) return res.status(401).json({ error: 'Your account no longer exists. Log in again.' })
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Your session has expired. Log in again.' })
  }
}

// Wraps an async route so a thrown error reaches the error handler.
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

export const PALETTE = [
  { hue: '#3d4f9f' }, { hue: '#9b8ac4' }, { hue: '#f2a20c', onLight: true }, { hue: '#0e8c9b' },
  { hue: '#c2317a' }, { hue: '#8a5a44' }, { hue: '#9ba83b', onLight: true }, { hue: '#7c8791' },
]
