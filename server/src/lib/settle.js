// Money maths for SplitEase. Every amount is an integer number of paise,
// so sums never drift. Kept free of any framework so it can be unit-tested alone.

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

// Greedy settle-up: pair the largest debtor with the largest creditor until
// everyone is square. Produces at most n-1 payments for n people.
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

// Returns an error message when the shares are not a valid split of the amount.
export function checkShares(amount, shares, memberIds) {
  const entries = Object.entries(shares || {})
  if (!entries.length) return 'Add at least one person to the split.'
  let sum = 0
  for (const [id, v] of entries) {
    if (!memberIds.includes(id)) return 'Everyone in the split must be a member of the group.'
    if (!Number.isInteger(v) || v < 0) return 'Each share must be a whole number of paise, zero or more.'
    sum += v
  }
  if (sum !== amount) return 'The shares must add up to the expense amount.'
  return null
}
