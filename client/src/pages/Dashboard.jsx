import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { useMyBalances } from '../components/Shell.jsx'
import { Avatar } from '../components/ui.jsx'
import { NewGroupDialog } from '../components/dialogs.jsx'
import { CATEGORIES, inr } from '../lib/settle.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Dashboard() {
  const { me, byId, myGroups, expenses } = useStore()
  const mine = useMyBalances()
  const [creating, setCreating] = useState(false)
  const net = Object.values(mine).reduce((a, b) => a + b, 0)

  // Your own share of every expense, by category and by month.
  const { byCat, byMonth, total } = useMemo(() => {
    const ids = new Set(myGroups.map((g) => g.id))
    const cat = {}, month = {}
    let sum = 0
    for (const e of expenses) {
      const share = ids.has(e.groupId) ? e.shares[me.id] || 0 : 0
      if (!share) continue
      cat[e.category] = (cat[e.category] || 0) + share
      month[e.date.slice(0, 7)] = (month[e.date.slice(0, 7)] || 0) + share
      sum += share
    }
    return {
      byCat: CATEGORIES.map((c) => ({ ...c, amount: cat[c.id] || 0 })).filter((c) => c.amount).sort((a, b) => b.amount - a.amount),
      byMonth: Object.entries(month).sort().slice(-6),
      total: sum,
    }
  }, [expenses, myGroups, me])
  const peak = Math.max(1, ...byMonth.map(([, v]) => v))

  if (!myGroups.length) {
    return (
      <div className="empty">
        <h2>No groups yet</h2>
        <p className="soft">A group is the people you share costs with: a flat, a trip, a team. Start one and add the first expense.</p>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>Start a group</button>
        {creating && <NewGroupDialog onClose={() => setCreating(false)} />}
      </div>
    )
  }

  return (
    <>
      <header>
        <p className="soft">
          {net === 0 ? `Across ${myGroups.length} groups, ${me.name}, you are` : net > 0 ? `Across ${myGroups.length} groups you get back` : `Across ${myGroups.length} groups you owe`}
        </p>
        <p className={'standing ' + (net > 0 ? 'pos' : net < 0 ? 'neg' : '')}>{net === 0 ? 'All square' : inr(net)}</p>
      </header>

      <section className="section">
        <div className="section-head">
          <h2>Your groups</h2>
          <button className="btn btn-small" onClick={() => setCreating(true)}>Start a group</button>
        </div>
        <div style={{ borderTop: '1.5px solid var(--ink)' }}>
          {myGroups.map((g) => (
            <Link key={g.id} to={'/groups/' + g.id} className="group-row">
              <span>
                <span className="group-name">{g.name}</span>
                <span className="soft small" style={{ display: 'block' }}>
                  {g.members.length} people, {expenses.filter((e) => e.groupId === g.id).length} expenses
                </span>
              </span>
              <span className="avatar-stack">{g.members.map((id) => <Avatar key={id} user={byId[id]} />)}</span>
              <span className={'row-money ' + (mine[g.id] > 0 ? 'pos' : mine[g.id] < 0 ? 'neg' : 'soft')}>
                <span className="small">{mine[g.id] > 0 ? 'you get back' : mine[g.id] < 0 ? 'you owe' : 'settled'}</span>
                {mine[g.id] !== 0 && <b>{inr(mine[g.id])}</b>}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {total > 0 && (
        <div className="two-col section">
          <section>
            <div className="section-head">
              <h2>Where your share went</h2>
              <span className="soft">{inr(total)} in total</span>
            </div>
            <div className="strip" role="img" aria-label="Your spending by category">
              {byCat.map((c) => <div key={c.id} style={{ background: c.hue, flex: c.amount }} title={`${c.label} ${inr(c.amount)}`} />)}
            </div>
            <ul className="legend">
              {byCat.map((c) => (
                <li key={c.id}><i className="rail-dot" style={{ background: c.hue }} />{c.label}<b>{inr(c.amount)}</b></li>
              ))}
            </ul>
          </section>
          <section>
            <div className="section-head"><h2>Month by month</h2></div>
            <div className="months">
              {byMonth.map(([key, v]) => (
                <div className="month" key={key}>
                  <span>{inr(Math.round(v / 100) * 100)}</span>
                  <i style={{ height: Math.max(4, (v / peak) * 120) }} />
                  <span className="soft">{MONTHS[+key.slice(5) - 1]}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      {creating && <NewGroupDialog onClose={() => setCreating(false)} />}
    </>
  )
}
