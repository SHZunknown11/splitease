import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { CATEGORIES, equalShares, inr, toPaise } from '../lib/settle.js'
import { Avatar, Dialog } from './ui.jsx'

const today = () => new Date().toISOString().slice(0, 10)

export function AddExpenseDialog({ group, onClose }) {
  const { me, byId, createExpense } = useStore()
  const [title, setTitle] = useState('')
  const [amountText, setAmountText] = useState('')
  const [paidBy, setPaidBy] = useState(me.id)
  const [category, setCategory] = useState('food')
  const [date, setDate] = useState(today())
  const [splitType, setSplitType] = useState('equal')
  const [included, setIncluded] = useState(group.members)
  const [parts, setParts] = useState({})
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState('')

  const amount = toPaise(amountText)
  const shares = useMemo(() => {
    if (splitType === 'equal') return included.length ? equalShares(amount, included) : {}
    const out = {}
    for (const id of group.members) {
      const v = parseFloat(parts[id]) || 0
      if (v > 0) out[id] = splitType === 'exact' ? Math.round(v * 100) : Math.round((amount * v) / 100)
    }
    return out
  }, [splitType, included, parts, amount, group.members])

  const assigned = Object.values(shares).reduce((a, b) => a + b, 0)
  const percentTotal = group.members.reduce((a, id) => a + (parseFloat(parts[id]) || 0), 0)
  const left = splitType === 'percent' ? 100 - percentTotal : amount - assigned
  const balanced = splitType === 'percent' ? Math.abs(left) < 0.01 : left === 0
  const valid = title.trim() && amount > 0 && Object.keys(shares).length > 0 && balanced

  let note = 'Splits add up.'
  if (!balanced) {
    const size = splitType === 'percent' ? Math.abs(left).toFixed(1).replace('.0', '') + '%' : inr(left)
    note = left > 0 ? `${size} left to assign` : `${size} over the total`
  }

  async function save(e) {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    // Percent rounding can leave a paisa or two; give it to the payer's share or the first share.
    const fixed = { ...shares }
    const drift = amount - Object.values(fixed).reduce((a, b) => a + b, 0)
    if (drift) { const k = fixed[paidBy] != null ? paidBy : Object.keys(fixed)[0]; fixed[k] += drift }
    try {
      await createExpense({ groupId: group.id, title: title.trim(), amount, paidBy, category, date, splitType, shares: fixed })
      onClose()
    } catch (err) { setServerError(err.message); setBusy(false) }
  }

  return (
    <Dialog title="Add an expense" onClose={onClose}>
      <form onSubmit={save} style={{ display: 'grid', gap: 18 }}>
        <label className="amount-field">
          <span aria-hidden="true">&#8377;</span>
          <input inputMode="decimal" placeholder="0" aria-label="Amount in rupees" value={amountText}
            onChange={(e) => setAmountText(e.target.value.replace(/[^\d.]/g, ''))} />
        </label>
        <label className="field"><span>What was it for?</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dinner, rent, cab fare" />
        </label>
        <div className="grid-2">
          <label className="field"><span>Paid by</span>
            <select className="select" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {group.members.map((id) => <option key={id} value={id}>{id === me.id ? 'You' : byId[id].name}</option>)}
            </select>
          </label>
          <label className="field"><span>Date</span>
            <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <div className="field"><span>Category</span>
          <div className="chips">
            {CATEGORIES.map((c) => (
              <button type="button" key={c.id} className="chip" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
                <i style={{ background: c.hue }} />{c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field"><span>Split</span>
          <div className="switch" style={{ justifySelf: 'start' }}>
            {[['equal', 'Equally'], ['exact', 'Exact amounts'], ['percent', 'Percentages']].map(([id, text]) => (
              <button type="button" key={id} aria-pressed={splitType === id} onClick={() => setSplitType(id)}>{text}</button>
            ))}
          </div>
          <div className="share-list" style={{ marginTop: 8 }}>
            {group.members.map((id) => (
              <label className="share" key={id}>
                <Avatar user={byId[id]} />
                <span>{id === me.id ? 'You' : byId[id].name}</span>
                {splitType === 'equal' ? (
                  <span className="share-equal">
                    <input type="checkbox" checked={included.includes(id)} aria-label={`Include ${byId[id].name}`}
                      onChange={(e) => setIncluded(e.target.checked ? [...included, id] : included.filter((x) => x !== id))} />
                    {' '}{shares[id] ? inr(shares[id]) : '—'}
                  </span>
                ) : (
                  <input className="input" inputMode="decimal" placeholder={splitType === 'exact' ? '₹ 0' : '0 %'}
                    aria-label={`${byId[id].name}'s ${splitType === 'exact' ? 'amount' : 'percentage'}`}
                    value={parts[id] || ''} onChange={(e) => setParts({ ...parts, [id]: e.target.value.replace(/[^\d.]/g, '') })} />
                )}
              </label>
            ))}
          </div>
        </div>
        <div className="dialog-foot">
          <span className={balanced && !serverError ? 'soft small' : 'error'} role="status">{serverError || (amount > 0 ? note : 'Enter an amount to split.')}</span>
          <span style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!valid || busy}>Add expense</button>
          </span>
        </div>
      </form>
    </Dialog>
  )
}

export function SettleDialog({ group, suggestion, onClose }) {
  const { me, byId, createSettlement } = useStore()
  const [from, setFrom] = useState(suggestion?.from || me.id)
  const [to, setTo] = useState(suggestion?.to || group.members.find((id) => id !== me.id))
  const [amountText, setAmountText] = useState(suggestion ? String(suggestion.amount / 100) : '')
  const [settleError, setSettleError] = useState('')
  const amount = toPaise(amountText)
  const valid = amount > 0 && from !== to
  const name = (id) => (id === me.id ? 'You' : byId[id].name)

  async function save(e) {
    e.preventDefault()
    if (!valid) return
    try { await createSettlement({ groupId: group.id, from, to, amount, date: today() }); onClose() }
    catch (err) { setSettleError(err.message) }
  }
  return (
    <Dialog title="Record a payment" onClose={onClose}>
      <form onSubmit={save} style={{ display: 'grid', gap: 18 }}>
        <label className="amount-field">
          <span aria-hidden="true">&#8377;</span>
          <input inputMode="decimal" placeholder="0" aria-label="Amount paid in rupees" value={amountText}
            onChange={(e) => setAmountText(e.target.value.replace(/[^\d.]/g, ''))} />
        </label>
        <div className="grid-2">
          <label className="field"><span>Who paid</span>
            <select className="select" value={from} onChange={(e) => setFrom(e.target.value)}>
              {group.members.map((id) => <option key={id} value={id}>{name(id)}</option>)}
            </select>
          </label>
          <label className="field"><span>Who received it</span>
            <select className="select" value={to} onChange={(e) => setTo(e.target.value)}>
              {group.members.map((id) => <option key={id} value={id}>{name(id)}</option>)}
            </select>
          </label>
        </div>
        <div className="dialog-foot">
          <span className={from === to || settleError ? 'error' : 'soft small'} role="status">
            {settleError ? settleError : from === to ? 'Pick two different people.' : 'This only records the payment. Send the money through UPI or cash.'}
          </span>
          <span style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!valid}>Record payment</button>
          </span>
        </div>
      </form>
    </Dialog>
  )
}

export function NewGroupDialog({ onClose }) {
  const { me, users, createGroup } = useStore()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [picked, setPicked] = useState([])
  const [extra, setExtra] = useState('')
  const [groupError, setGroupError] = useState('')
  const others = users.filter((u) => u.id !== me.id)
  const newNames = extra.split(',').map((s) => s.trim()).filter(Boolean)
  const valid = name.trim() && picked.length + newNames.length > 0

  async function save(e) {
    e.preventDefault()
    if (!valid) return
    try {
      const group = await createGroup(name.trim(), picked, newNames)
      onClose()
      navigate('/groups/' + group.id)
    } catch (err) { setGroupError(err.message) }
  }
  return (
    <Dialog title="Start a group" onClose={onClose}>
      <form onSubmit={save} style={{ display: 'grid', gap: 18 }}>
        <label className="field"><span>Group name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Goa trip, Flat 12, Office lunch" />
        </label>
        <div className="field"><span>People you already split with</span>
          <div className="chips">
            {others.map((u) => (
              <button type="button" key={u.id} className="chip" aria-pressed={picked.includes(u.id)}
                onClick={() => setPicked(picked.includes(u.id) ? picked.filter((x) => x !== u.id) : [...picked, u.id])}>
                {u.name}
              </button>
            ))}
          </div>
        </div>
        <label className="field"><span>Someone new? Type names, separated by commas</span>
          <input className="input" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Riya, Arjun" />
        </label>
        <div className="dialog-foot">
          <span className={groupError ? 'error' : 'soft small'} role="status">{groupError || (valid ? `${picked.length + newNames.length + 1} people including you` : 'Name the group and add at least one person.')}</span>
          <span style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!valid}>Create group</button>
          </span>
        </div>
      </form>
    </Dialog>
  )
}
