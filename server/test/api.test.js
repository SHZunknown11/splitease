// Integration tests: the real Express app against a real MongoDB (a separate
// database called splitease_test, wiped before the run).
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { User, Group, Expense, Settlement } from '../src/models/index.js'

const app = createApp()
const api = () => request(app)
const today = '2026-11-15'
const ctx = {}

before(async () => {
  await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/splitease_test')
  await Promise.all([User, Group, Expense, Settlement].map((m) => m.deleteMany({})))
})
after(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
})

const register = (name, email, password = 'secret1') => api().post('/api/auth/register').send({ name, email, password })
const authed = (token) => ({ Authorization: 'Bearer ' + token })

test('register creates an account and returns a token', async () => {
  const res = await register('Asha', 'asha@test.dev')
  assert.equal(res.status, 201)
  assert.ok(res.body.token)
  assert.equal(res.body.user.name, 'Asha')
  assert.equal(res.body.user.passwordHash, undefined, 'the hash must never be sent')
  ctx.asha = res.body
})

test('register stores a hashed password, not the plain text', async () => {
  const u = await User.findOne({ email: 'asha@test.dev' }).select('+passwordHash')
  assert.ok(u.passwordHash.startsWith('$2'))
  assert.notEqual(u.passwordHash, 'secret1')
})

test('register rejects a duplicate email', async () => {
  const res = await register('Other', 'ASHA@test.dev')
  assert.equal(res.status, 409)
  assert.match(res.body.error, /already has an account/)
})

test('register rejects a bad email, a short password and a missing name', async () => {
  assert.equal((await register('X', 'not-an-email')).status, 400)
  assert.equal((await register('X', 'x@test.dev', '123')).status, 400)
  assert.equal((await register('  ', 'y@test.dev')).status, 400)
})

test('login works with the right password', async () => {
  const res = await api().post('/api/auth/login').send({ email: 'asha@test.dev', password: 'secret1' })
  assert.equal(res.status, 200)
  assert.ok(res.body.token)
})

test('login rejects a wrong password and an unknown email', async () => {
  assert.equal((await api().post('/api/auth/login').send({ email: 'asha@test.dev', password: 'nope-nope' })).status, 401)
  assert.equal((await api().post('/api/auth/login').send({ email: 'ghost@test.dev', password: 'secret1' })).status, 401)
})

test('protected routes reject a missing or a forged token', async () => {
  assert.equal((await api().get('/api/state')).status, 401)
  assert.equal((await api().get('/api/state').set(authed('forged.token.value'))).status, 401)
})

test('a new user starts with an empty state', async () => {
  const res = await api().get('/api/state').set(authed(ctx.asha.token))
  assert.equal(res.status, 200)
  assert.equal(res.body.session, ctx.asha.user.id)
  assert.deepEqual(res.body.groups, [])
})

test('profile name can be changed, and an empty name is refused', async () => {
  const ok = await api().patch('/api/me').set(authed(ctx.asha.token)).send({ name: 'Asha K' })
  assert.equal(ok.status, 200)
  assert.equal(ok.body.name, 'Asha K')
  assert.equal((await api().patch('/api/me').set(authed(ctx.asha.token)).send({ name: ' ' })).status, 400)
})

test('create a group with an existing user and a new person', async () => {
  ctx.ben = (await register('Ben', 'ben@test.dev')).body
  const res = await api().post('/api/groups').set(authed(ctx.asha.token))
    .send({ name: 'Goa trip', memberIds: [ctx.ben.user.id], newNames: ['Chitra'] })
  assert.equal(res.status, 201)
  assert.equal(res.body.members.length, 3)
  assert.equal(res.body.members[0], ctx.asha.user.id)
  ctx.group = res.body
})

test('a group needs a name and at least one other person', async () => {
  const h = authed(ctx.asha.token)
  assert.equal((await api().post('/api/groups').set(h).send({ name: '', memberIds: [ctx.ben.user.id] })).status, 400)
  assert.equal((await api().post('/api/groups').set(h).send({ name: 'Solo', memberIds: [], newNames: [] })).status, 400)
  assert.equal((await api().post('/api/groups').set(h).send({ name: 'Bad', memberIds: ['zzz'] })).status, 400)
})

test('state shows the group to its members and lists the new person', async () => {
  const res = await api().get('/api/state').set(authed(ctx.ben.token))
  assert.equal(res.body.groups.length, 1)
  const names = res.body.users.map((u) => u.name).sort()
  assert.deepEqual(names, ['Asha K', 'Ben', 'Chitra'])
  ctx.chitra = res.body.users.find((u) => u.name === 'Chitra')
})

const expenseBody = (over = {}) => {
  const [a, b, c] = ctx.group.members
  return { title: 'Dinner', amount: 3000, paidBy: a, category: 'food', date: today, splitType: 'equal', shares: { [a]: 1000, [b]: 1000, [c]: 1000 }, ...over }
}

test('add an expense and see it in the state', async () => {
  const res = await api().post(`/api/groups/${ctx.group.id}/expenses`).set(authed(ctx.asha.token)).send(expenseBody())
  assert.equal(res.status, 201)
  assert.equal(res.body.amount, 3000)
  assert.equal(res.body.shares[ctx.group.members[1]], 1000)
  ctx.expense = res.body
  const state = await api().get('/api/state').set(authed(ctx.ben.token))
  assert.equal(state.body.expenses.length, 1)
})

test('an expense is rejected when its shares do not add up', async () => {
  const [a, b] = ctx.group.members
  const res = await api().post(`/api/groups/${ctx.group.id}/expenses`).set(authed(ctx.asha.token))
    .send(expenseBody({ shares: { [a]: 1000, [b]: 1000 } }))
  assert.equal(res.status, 400)
  assert.match(res.body.error, /add up/)
})

test('an expense is rejected for a bad amount, date, payer, title or category', async () => {
  const h = authed(ctx.asha.token), url = `/api/groups/${ctx.group.id}/expenses`
  assert.equal((await api().post(url).set(h).send(expenseBody({ amount: 0 }))).status, 400)
  assert.equal((await api().post(url).set(h).send(expenseBody({ amount: 10.5 }))).status, 400)
  assert.equal((await api().post(url).set(h).send(expenseBody({ date: '15/11/2026' }))).status, 400)
  assert.equal((await api().post(url).set(h).send(expenseBody({ paidBy: '507f1f77bcf86cd799439011' }))).status, 400)
  assert.equal((await api().post(url).set(h).send(expenseBody({ title: '   ' }))).status, 400)
  assert.equal((await api().post(url).set(h).send(expenseBody({ category: 'gambling' }))).status, 400)
})

test('a user outside the group cannot see it, add to it or delete from it', async () => {
  ctx.eve = (await register('Eve', 'eve@test.dev')).body
  const h = authed(ctx.eve.token)
  const state = await api().get('/api/state').set(h)
  assert.deepEqual(state.body.groups, [])
  assert.deepEqual(state.body.expenses, [])
  assert.equal((await api().post(`/api/groups/${ctx.group.id}/expenses`).set(h).send(expenseBody())).status, 404)
  assert.equal((await api().delete('/api/expenses/' + ctx.expense.id).set(h)).status, 404)
  assert.equal((await api().post(`/api/groups/${ctx.group.id}/settlements`).set(h).send({ from: ctx.group.members[1], to: ctx.group.members[0], amount: 100, date: today })).status, 404)
})

test('record a settlement', async () => {
  const [a, b] = ctx.group.members
  const res = await api().post(`/api/groups/${ctx.group.id}/settlements`).set(authed(ctx.ben.token))
    .send({ from: b, to: a, amount: 1000, date: today })
  assert.equal(res.status, 201)
  assert.equal(res.body.amount, 1000)
})

test('a settlement needs two different group members and a positive amount', async () => {
  const [a, b] = ctx.group.members
  const h = authed(ctx.ben.token), url = `/api/groups/${ctx.group.id}/settlements`
  assert.equal((await api().post(url).set(h).send({ from: a, to: a, amount: 100, date: today })).status, 400)
  assert.equal((await api().post(url).set(h).send({ from: b, to: ctx.eve.user.id, amount: 100, date: today })).status, 400)
  assert.equal((await api().post(url).set(h).send({ from: b, to: a, amount: -5, date: today })).status, 400)
})

test('delete an expense', async () => {
  const res = await api().delete('/api/expenses/' + ctx.expense.id).set(authed(ctx.asha.token))
  assert.equal(res.status, 204)
  const state = await api().get('/api/state').set(authed(ctx.asha.token))
  assert.equal(state.body.expenses.length, 0)
})

test('deleting an unknown expense returns 404', async () => {
  assert.equal((await api().delete('/api/expenses/507f1f77bcf86cd799439011').set(authed(ctx.asha.token))).status, 404)
  assert.equal((await api().delete('/api/expenses/not-an-id').set(authed(ctx.asha.token))).status, 404)
})

test('an unknown group id returns 404', async () => {
  assert.equal((await api().post('/api/groups/507f1f77bcf86cd799439011/expenses').set(authed(ctx.asha.token)).send(expenseBody())).status, 404)
})

test('an unknown endpoint returns a JSON 404 when logged in, and 401 when not', async () => {
  const res = await api().get('/api/nope').set(authed(ctx.asha.token))
  assert.equal(res.status, 404)
  assert.ok(res.body.error)
  assert.equal((await api().get('/api/nope')).status, 401)
})

test('exact and percent splits are stored with their type', async () => {
  const [a, b, c] = ctx.group.members
  const res = await api().post(`/api/groups/${ctx.group.id}/expenses`).set(authed(ctx.asha.token))
    .send(expenseBody({ title: 'Cab', amount: 1001, splitType: 'percent', shares: { [a]: 501, [b]: 300, [c]: 200 } }))
  assert.equal(res.status, 201)
  assert.equal(res.body.splitType, 'percent')
})
