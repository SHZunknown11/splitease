// All money is stored as integer paise so sums never drift.

export const CATEGORIES = [
  { id: 'food', label: 'Food', hue: '#f2a20c' },
  { id: 'rent', label: 'Rent', hue: '#9b8ac4' },
  { id: 'travel', label: 'Travel', hue: '#0e8c9b' },
  { id: 'groceries', label: 'Groceries', hue: '#9ba83b' },
  { id: 'utilities', label: 'Utilities', hue: '#7c8791' },
  { id: 'fun', label: 'Fun', hue: '#c2317a' },
  { id: 'other', label: 'Other', hue: '#8a5a44' },
]
export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[6]

const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const withPaise = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// Rs 1,200 for whole rupees, Rs 1,200.50 when there are paise.
export const inr = (paise) => '₹' + (paise % 100 ? withPaise : whole).format(Math.abs(paise) / 100)
export const toPaise = (text) => Math.round(parseFloat(String(text).replace(/,/g, '')) * 100) || 0

// Split an amount equally; leftover paise go to the first few people.
export function equalShares(amount, ids) {
  const base = Math.floor(amount / ids.length)
  let extra = amount - base * ids.length
  return Object.fromEntries(ids.map((id) => [id, base + (extra-- > 0 ? 1 : 0)]))
}

// Net position per member: positive means the group owes them.
export function balances(memberIds, expenses, settlements) {
  const bal = Object.fromEntries(memberIds.map((id) => [id, 0]))
  for (const e of expenses) {
    bal[e.paidBy] = (bal[e.paidBy] || 0) + e.amount
    for (const [id, share] of Object.entries(e.shares)) bal[id] = (bal[id] || 0) - share
  }
  for (const s of settlements) {
    bal[s.from] = (bal[s.from] || 0) + s.amount
    bal[s.to] = (bal[s.to] || 0) - s.amount
  }
  return bal
}

// Every "X owes Y" that the expenses created, before any simplifying.
export function rawDebts(expenses, settlements) {
  const owes = new Map()
  const add = (from, to, amt) => {
    if (from === to || !amt) return
    const key = from + '>' + to
    owes.set(key, (owes.get(key) || 0) + amt)
  }
  for (const e of expenses) for (const [id, share] of Object.entries(e.shares)) add(id, e.paidBy, share)
  for (const s of settlements) add(s.to, s.from, s.amount)
  const out = []
  const seen = new Set()
  for (const [key, amt] of owes) {
    if (seen.has(key)) continue
    const [from, to] = key.split('>')
    const back = owes.get(to + '>' + from) || 0
    seen.add(key).add(to + '>' + from)
    if (amt > back) out.push({ from, to, amount: amt - back })
    else if (back > amt) out.push({ from: to, to: from, amount: back - amt })
  }
  return out
}

// Greedy settle-up: repeatedly pair the largest debtor with the largest
// creditor. Produces at most n-1 payments for n people.
export function simplify(bal) {
  const debtors = [], creditors = []
  for (const [id, v] of Object.entries(bal)) {
    if (v < 0) debtors.push({ id, left: -v })
    if (v > 0) creditors.push({ id, left: v })
  }
  const payments = []
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.left - a.left)
    creditors.sort((a, b) => b.left - a.left)
    const d = debtors[0], c = creditors[0]
    const amount = Math.min(d.left, c.left)
    payments.push({ from: d.id, to: c.id, amount })
    d.left -= amount
    c.left -= amount
    if (!d.left) debtors.shift()
    if (!c.left) creditors.shift()
  }
  return payments
}
