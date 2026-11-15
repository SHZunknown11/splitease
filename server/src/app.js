import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { User, Group, Expense, Settlement } from './models/index.js'
import { signToken, requireAuth, wrap, HttpError, PALETTE } from './lib/auth.js'
import { checkShares } from './lib/settle.js'
import { notifyGroup, joinRoom } from './lib/realtime.js'
import { seedDatabase } from './seed.js'

const isId = (v) => mongoose.isValidObjectId(v)
const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d))
const validEmail = (e) => /^\S+@\S+\.\S+$/.test(e)
const CATEGORIES = ['food', 'rent', 'travel', 'groceries', 'utilities', 'fun', 'other']

export function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '100kb' }))

  const api = express.Router()

  // ---------- auth ----------
  api.post('/auth/register', wrap(async (req, res) => {
    const { name = '', email = '', password = '' } = req.body
    if (!String(name).trim()) throw new HttpError(400, 'Enter your name.')
    if (!validEmail(email)) throw new HttpError(400, 'Enter a valid email address.')
    if (String(password).length < 6) throw new HttpError(400, 'Use a password of at least 6 characters.')
    if (await User.findOne({ email: email.toLowerCase() })) throw new HttpError(409, 'That email already has an account. Log in instead.')
    const count = await User.countDocuments()
    const user = await User.create({ name: String(name).trim(), email, passwordHash: await bcrypt.hash(password, 10), ...PALETTE[count % PALETTE.length] })
    res.status(201).json({ token: signToken(user._id), user })
  }))

  api.post('/auth/login', wrap(async (req, res) => {
    const { email = '', password = '' } = req.body
    if (!email || !password) throw new HttpError(400, 'Enter your email and password.')
    const user = await User.findOne({ email: String(email).toLowerCase() }).select('+passwordHash')
    if (!user) throw new HttpError(401, 'No account uses that email. Create one instead.')
    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'That password is not right.')
    res.json({ token: signToken(user._id), user })
  }))

  // ---------- everything below needs a login ----------
  api.use(requireAuth)

  api.patch('/me', wrap(async (req, res) => {
    const name = String(req.body.name || '').trim()
    if (!name) throw new HttpError(400, 'Enter a name.')
    req.user.name = name.slice(0, 60)
    await req.user.save()
    res.json(req.user)
  }))

  // One call returns everything the signed-in user can see.
  api.get('/state', wrap(async (req, res) => {
    const groups = await Group.find({ members: req.user._id }).sort({ createdAt: 1 })
    const ids = groups.map((g) => g._id)
    const memberIds = new Set(groups.flatMap((g) => g.members.map(String)))
    memberIds.add(String(req.user._id))
    const [users, expenses, settlements] = await Promise.all([
      User.find({ _id: { $in: [...memberIds] } }),
      Expense.find({ groupId: { $in: ids } }).sort({ date: 1, createdAt: 1 }),
      Settlement.find({ groupId: { $in: ids } }).sort({ date: 1, createdAt: 1 }),
    ])
    res.json({ session: String(req.user._id), users, groups, expenses, settlements })
  }))

  api.post('/groups', wrap(async (req, res) => {
    const name = String(req.body.name || '').trim()
    const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : []
    const newNames = (Array.isArray(req.body.newNames) ? req.body.newNames : []).map((n) => String(n).trim()).filter(Boolean)
    if (!name) throw new HttpError(400, 'Name the group.')
    if (!memberIds.every(isId)) throw new HttpError(400, 'One of the people you picked is not valid.')
    if (!memberIds.length && !newNames.length) throw new HttpError(400, 'Add at least one other person.')
    const known = await User.find({ _id: { $in: memberIds } })
    if (known.length !== new Set(memberIds).size) throw new HttpError(400, 'One of the people you picked does not exist.')
    const count = await User.countDocuments()
    const created = await User.insertMany(newNames.map((n, i) => ({ name: n.slice(0, 60), ...PALETTE[(count + i) % PALETTE.length] })))
    const groupCount = await Group.countDocuments()
    const others = [...known, ...created].filter((u) => !u._id.equals(req.user._id))
    const group = await Group.create({
      name: name.slice(0, 60), hue: PALETTE[(groupCount + 1) % PALETTE.length].hue, createdBy: req.user._id,
      members: [req.user._id, ...others.map((u) => u._id)],
    })
    await joinRoom(group.members.map(String), group._id)
    res.status(201).json(group)
  }))

  async function memberGroup(req) {
    if (!isId(req.params.id)) throw new HttpError(404, 'That group does not exist.')
    const group = await Group.findById(req.params.id)
    if (!group || !group.members.some((m) => m.equals(req.user._id))) throw new HttpError(404, 'That group does not exist.')
    return group
  }

  api.post('/groups/:id/expenses', wrap(async (req, res) => {
    const group = await memberGroup(req)
    const { title = '', amount, paidBy, category = 'other', date, splitType = 'equal', shares } = req.body
    const members = group.members.map(String)
    if (!String(title).trim()) throw new HttpError(400, 'Say what the expense was for.')
    if (!Number.isInteger(amount) || amount <= 0) throw new HttpError(400, 'The amount must be a whole number of paise above zero.')
    if (!members.includes(String(paidBy))) throw new HttpError(400, 'The person who paid must be in the group.')
    if (!validDate(date)) throw new HttpError(400, 'Enter the date as YYYY-MM-DD.')
    if (!CATEGORIES.includes(category)) throw new HttpError(400, 'Pick one of the listed categories.')
    if (!['equal', 'exact', 'percent'].includes(splitType)) throw new HttpError(400, 'Unknown split type.')
    const problem = checkShares(amount, shares, members)
    if (problem) throw new HttpError(400, problem)
    const expense = await Expense.create({ groupId: group._id, title: String(title).trim().slice(0, 120), amount, paidBy, category, date, splitType, shares })
    notifyGroup(group._id)
    res.status(201).json(expense)
  }))

  api.delete('/expenses/:id', wrap(async (req, res) => {
    if (!isId(req.params.id)) throw new HttpError(404, 'That expense does not exist.')
    const expense = await Expense.findById(req.params.id)
    const group = expense && (await Group.findById(expense.groupId))
    if (!group || !group.members.some((m) => m.equals(req.user._id))) throw new HttpError(404, 'That expense does not exist.')
    await expense.deleteOne()
    notifyGroup(group._id)
    res.status(204).end()
  }))

  api.post('/groups/:id/settlements', wrap(async (req, res) => {
    const group = await memberGroup(req)
    const { from, to, amount, date } = req.body
    const members = group.members.map(String)
    if (!members.includes(String(from)) || !members.includes(String(to))) throw new HttpError(400, 'Both people must be in the group.')
    if (String(from) === String(to)) throw new HttpError(400, 'Pick two different people.')
    if (!Number.isInteger(amount) || amount <= 0) throw new HttpError(400, 'The amount must be a whole number of paise above zero.')
    if (!validDate(date)) throw new HttpError(400, 'Enter the date as YYYY-MM-DD.')
    const settlement = await Settlement.create({ groupId: group._id, from, to, amount, date })
    notifyGroup(group._id)
    res.status(201).json(settlement)
  }))

  // Puts the sample data back. Local demos only; set ALLOW_RESET=false to turn it off.
  api.post('/reset-demo', wrap(async (_req, res) => {
    if (process.env.ALLOW_RESET === 'false') throw new HttpError(403, 'Resetting is turned off on this server.')
    await seedDatabase()
    res.status(204).end()
  }))

  app.use('/api', api)
  app.use('/api', (_req, res) => res.status(404).json({ error: 'No such endpoint.' }))

  // In production one service does everything: serve the built React app and fall back to
  // index.html for client-side routes. Skipped when client/dist does not exist (local dev, tests).
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }))
    // A missing file (has an extension, e.g. /assets/old.js) is a real 404, not the app shell.
    app.get('*', (req, res) => (path.extname(req.path)
      ? res.status(404).type('text').send('Not found')
      : res.sendFile(path.join(dist, 'index.html'))))
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    if (err.name === 'ValidationError') return res.status(400).json({ error: Object.values(err.errors)[0].message })
    console.error(err)
    res.status(500).json({ error: 'Something went wrong on the server. Try again.' })
  })
  return app
}
