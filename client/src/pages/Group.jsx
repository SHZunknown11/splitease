import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '../store.jsx'
import DebtGraph from '../components/DebtGraph.jsx'
import { Avatar } from '../components/ui.jsx'
import { AddExpenseDialog, SettleDialog } from '../components/dialogs.jsx'
import { balances, categoryOf, inr, rawDebts, simplify } from '../lib/settle.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const SHORT = MONTHS.map((m) => m.slice(0, 3))
const dayLabel = (iso) => `${+iso.slice(8)} ${SHORT[+iso.slice(5, 7) - 1]}`

export default function Group() {
  const { id } = useParams()
  const { me, byId, myGroups, expenses, settlements, deleteExpense } = useStore()
  const group = myGroups.find((g) => g.id === id)
  const [adding, setAdding] = useState(false)
  const [settling, setSettling] = useState(null) // null, {} for blank, or a suggested payment
  const [simplified, setSimplified] = useState(true)

  const data = useMemo(() => {
    if (!group) return null
    const ex = expenses.filter((e) => e.groupId === group.id).sort((a, b) => b.date.localeCompare(a.date))
    const st = settlements.filter((s) => s.groupId === group.id)
    const bal = balances(group.members, ex, st)
    const activity = [
      ...ex.map((e) => ({ date: e.date, text: `${e.paidBy === me.id ? 'You' : byId[e.paidBy].name} paid ${inr(e.amount)} for ${e.title}` })),
      ...st.map((s) => ({ date: s.date, text: `${s.from === me.id ? 'You' : byId[s.from].name} paid ${s.to === me.id ? 'you' : byId[s.to].name} ${inr(s.amount)}` })),
    ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)
    return { ex, bal, raw: rawDebts(ex, st), clean: simplify(bal), activity, total: ex.reduce((a, e) => a + e.amount, 0) }
  }, [group, expenses, settlements, byId, me])

  if (!group) {
    return <div className="empty"><h2>This group is not in your list</h2><p className="soft">It may have been removed, or the link is wrong. Pick a group from the left.</p></div>
  }
  const { ex, bal, raw, clean, activity, total } = data
  const members = group.members.map((m) => byId[m])
  const mine = bal[me.id] || 0
  const widest = Math.max(1, ...Object.values(bal).map(Math.abs))
  const name = (uid) => (uid === me.id ? 'You' : byId[uid].name)

  function exportCsv() {
    const lines = [['Date', 'Title', 'Category', 'Paid by', 'Amount (INR)', ...members.map((m) => m.name + ' share')]]
    for (const e of [...ex].reverse()) {
      lines.push([e.date, e.title, categoryOf(e.category).label, byId[e.paidBy].name, e.amount / 100, ...members.map((m) => (e.shares[m.id] || 0) / 100)])
    }
    const csv = lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = group.name.replace(/\W+/g, '-').toLowerCase() + '-expenses.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  let lastMonth = ''
  return (
    <>
      <header className="page-head">
        <div>
          <h1>{group.name}</h1>
          <p className={mine > 0 ? 'pos' : mine < 0 ? 'neg' : 'soft'} style={{ fontWeight: 600, fontSize: '1.125rem', marginTop: 6 }}>
            {mine > 0 ? `You get back ${inr(mine)}` : mine < 0 ? `You owe ${inr(mine)}` : 'You are all square here'}
          </p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => setSettling({})} disabled={!clean.length}>Record a payment</button>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>Add an expense</button>
        </div>
      </header>

      <div className="two-col">
        <section>
          <div className="section-head">
            <h2>Expenses</h2>
            {ex.length > 0 && <span className="soft">{inr(total)} spent <button className="linkish" onClick={exportCsv} style={{ marginLeft: 10 }}>Download CSV</button></span>}
          </div>
          {ex.length === 0 ? (
            <div className="empty">
              <p className="soft">Nothing here yet. Add the first thing someone paid for and SplitEase will start keeping score.</p>
              <button className="btn btn-primary" onClick={() => setAdding(true)}>Add an expense</button>
            </div>
          ) : (
            <ul className="ledger">
              {ex.map((e) => {
                const month = e.date.slice(0, 7)
                const heading = month !== lastMonth
                lastMonth = month
                const share = e.shares[me.id] || 0
                const lent = e.paidBy === me.id ? e.amount - share : -share
                return (
                  <li key={e.id}>
                    {heading && <div className="ledger-month">{MONTHS[+month.slice(5) - 1]} {month.slice(0, 4)}</div>}
                    <div className="row">
                      <span className="row-date"><b>{+e.date.slice(8)}</b><span>{SHORT[+e.date.slice(5, 7) - 1]}</span></span>
                      <span className="row-cat" style={{ background: categoryOf(e.category).hue }} title={categoryOf(e.category).label} />
                      <span style={{ minWidth: 0 }}>
                        <span className="row-title" style={{ display: 'block' }}>{e.title}</span>
                        <span className="soft small">
                          {name(e.paidBy)} paid {inr(e.amount)}
                          <button className="linkish row-del small" style={{ marginLeft: 10 }} onClick={() => deleteExpense(e.id).catch((err) => window.alert(err.message))} aria-label={`Delete ${e.title}`}>Delete</button>
                        </span>
                      </span>
                      <span className={'row-money ' + (lent > 0 ? 'pos' : lent < 0 ? 'neg' : 'soft')}>
                        <span className="small">{lent > 0 ? 'you lent' : lent < 0 ? 'you borrowed' : 'not involved'}</span>
                        {lent !== 0 && <b>{inr(lent)}</b>}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <aside className="sticky-col">
          <section>
            <div className="section-head"><h2>Balances</h2></div>
            <div className="beam">
              {members.map((m) => (
                <div className="beam-row" key={m.id}>
                  <span>{name(m.id)}</span>
                  <span className="beam-track">
                    {bal[m.id] !== 0 && <span className={'beam-bar ' + (bal[m.id] > 0 ? 'pos' : 'neg')} style={{ width: (Math.abs(bal[m.id]) / widest) * 50 + '%' }} />}
                  </span>
                  <span className={'beam-amt ' + (bal[m.id] > 0 ? 'pos' : bal[m.id] < 0 ? 'neg' : 'soft')}>{bal[m.id] === 0 ? 'square' : inr(bal[m.id])}</span>
                </div>
              ))}
            </div>
            <p className="soft small" style={{ marginTop: 10 }}>Bars to the right are owed money. Bars to the left owe it.</p>
          </section>

          <section>
            <div className="section-head">
              <h2>Settle up</h2>
              {clean.length > 0 && (
                <span className="switch">
                  <button aria-pressed={!simplified} onClick={() => setSimplified(false)}>{raw.length} debts</button>
                  <button aria-pressed={simplified} onClick={() => setSimplified(true)}>{clean.length} {clean.length === 1 ? 'payment' : 'payments'}</button>
                </span>
              )}
            </div>
            {clean.length === 0 ? (
              <p className="soft">Everyone is square. Nothing to pay.</p>
            ) : (
              <>
                <DebtGraph members={members} raw={raw} clean={clean} simplified={simplified}
                  label={simplified ? `${clean.length} payments settle this group` : `${raw.length} separate debts in this group`} />
                <ul className="pay-list">
                  {clean.map((p) => (
                    <li className="pay" key={p.from + p.to}>
                      <Avatar user={byId[p.from]} />
                      <span>{name(p.from)} {p.from === me.id ? 'pay' : 'pays'} {p.to === me.id ? 'you' : byId[p.to].name}</span>
                      <b>{inr(p.amount)}</b>
                      <button className="btn btn-small" onClick={() => setSettling(p)}>Record</button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {activity.length > 0 && (
            <section>
              <div className="section-head"><h2>Latest</h2></div>
              <ul className="activity">
                {activity.map((a, i) => <li key={i}><time dateTime={a.date}>{dayLabel(a.date)}</time>{a.text}</li>)}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {adding && <AddExpenseDialog group={group} onClose={() => setAdding(false)} />}
      {settling && <SettleDialog group={group} suggestion={settling.from ? settling : null} onClose={() => setSettling(null)} />}
    </>
  )
}
