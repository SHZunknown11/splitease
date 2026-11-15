import test from 'node:test'
import assert from 'node:assert/strict'
import { equalShares, balances, simplify, checkShares } from '../src/lib/settle.js'

const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0)

test('equalShares splits evenly when the amount divides exactly', () => {
  assert.deepEqual(equalShares(900, ['a', 'b', 'c']), { a: 300, b: 300, c: 300 })
})

test('equalShares gives leftover paise to the first people and always adds up', () => {
  const s = equalShares(1000, ['a', 'b', 'c'])
  assert.deepEqual(s, { a: 334, b: 333, c: 333 })
  assert.equal(sum(s), 1000)
})

test('equalShares works for a single person', () => {
  assert.deepEqual(equalShares(5000, ['a']), { a: 5000 })
})

test('balances: payer is owed the others\' shares', () => {
  const bal = balances(['a', 'b', 'c'], [{ paidBy: 'a', amount: 3000, shares: { a: 1000, b: 1000, c: 1000 } }], [])
  assert.deepEqual(bal, { a: 2000, b: -1000, c: -1000 })
})

test('balances always sum to zero', () => {
  const ex = [
    { paidBy: 'a', amount: 1001, shares: { a: 334, b: 334, c: 333 } },
    { paidBy: 'b', amount: 500, shares: { a: 250, c: 250 } },
  ]
  assert.equal(sum(balances(['a', 'b', 'c'], ex, [])), 0)
})

test('balances: a settlement moves money from payer to receiver', () => {
  const ex = [{ paidBy: 'a', amount: 2000, shares: { a: 1000, b: 1000 } }]
  const bal = balances(['a', 'b'], ex, [{ from: 'b', to: 'a', amount: 1000 }])
  assert.deepEqual(bal, { a: 0, b: 0 })
})

test('balances: a part payment leaves the rest owed', () => {
  const ex = [{ paidBy: 'a', amount: 2000, shares: { a: 1000, b: 1000 } }]
  assert.deepEqual(balances(['a', 'b'], ex, [{ from: 'b', to: 'a', amount: 400 }]), { a: 600, b: -600 })
})

test('simplify returns nothing when everyone is square', () => {
  assert.deepEqual(simplify({ a: 0, b: 0, c: 0 }), [])
})

test('simplify: one debtor, one creditor gives a single payment', () => {
  assert.deepEqual(simplify({ a: 500, b: -500 }), [{ from: 'b', to: 'a', amount: 500 }])
})

test('simplify: the landing-page example settles in three payments', () => {
  const net = { a: 90000, m: 30000, k: -70000, z: -50000, d: 0 }
  const pays = simplify(net)
  assert.equal(pays.length, 3)
  assert.ok(!pays.some((p) => p.from === 'd' || p.to === 'd'))
})

test('simplify: chain debts collapse (a owes b, b owes c becomes a pays c)', () => {
  const bal = balances(['a', 'b', 'c'], [
    { paidBy: 'b', amount: 1000, shares: { a: 1000 } },
    { paidBy: 'c', amount: 1000, shares: { b: 1000 } },
  ], [])
  assert.deepEqual(simplify(bal), [{ from: 'a', to: 'c', amount: 1000 }])
})

test('simplify never uses more than n-1 payments, and applying them clears every balance', () => {
  // A deterministic pseudo-random generator so a failure can be repeated.
  let seed = 12345
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  for (let round = 0; round < 300; round++) {
    const n = 2 + Math.floor(rnd() * 9)
    const ids = Array.from({ length: n }, (_, i) => 'p' + i)
    const bal = Object.fromEntries(ids.map((id) => [id, Math.round((rnd() - 0.5) * 200000)]))
    const drift = sum(bal)
    bal[ids[0]] -= drift // force the total to zero, as real group balances are
    const pays = simplify(bal)
    assert.ok(pays.length <= n - 1, `round ${round}: ${pays.length} payments for ${n} people`)
    const after = { ...bal }
    for (const p of pays) { assert.ok(p.amount > 0); after[p.from] += p.amount; after[p.to] -= p.amount }
    for (const v of Object.values(after)) assert.equal(v, 0)
  }
})

test('checkShares accepts a valid split', () => {
  assert.equal(checkShares(1000, { a: 600, b: 400 }, ['a', 'b', 'c']), null)
})

test('checkShares rejects shares that do not add up', () => {
  assert.match(checkShares(1000, { a: 600, b: 300 }, ['a', 'b']), /add up/)
})

test('checkShares rejects people outside the group', () => {
  assert.match(checkShares(1000, { a: 500, z: 500 }, ['a', 'b']), /member/)
})

test('checkShares rejects fractional or negative shares', () => {
  assert.match(checkShares(1000, { a: 500.5, b: 499.5 }, ['a', 'b']), /whole number/)
  assert.match(checkShares(1000, { a: 1500, b: -500 }, ['a', 'b']), /whole number/)
})

test('checkShares rejects an empty split', () => {
  assert.match(checkShares(1000, {}, ['a']), /at least one/)
})
