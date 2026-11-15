import { useMemo, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useStore } from '../store.jsx'
import { balances, inr } from '../lib/settle.js'
import { Avatar, Logo } from './ui.jsx'
import { NewGroupDialog } from './dialogs.jsx'

// Your net position in each of your groups, keyed by group id.
export function useMyBalances() {
  const { me, myGroups, expenses, settlements } = useStore()
  return useMemo(() => Object.fromEntries(myGroups.map((g) => {
    const bal = balances(g.members, expenses.filter((e) => e.groupId === g.id), settlements.filter((s) => s.groupId === g.id))
    return [g.id, bal[me.id] || 0]
  })), [me, myGroups, expenses, settlements])
}

export default function Shell() {
  const { me, myGroups } = useStore()
  const mine = useMyBalances()
  const [creating, setCreating] = useState(false)
  const link = ({ isActive }) => 'rail-link' + (isActive ? ' active' : '')

  return (
    <div className="shell">
      <aside className="rail">
        <NavLink to="/" className="wordmark"><Logo />SplitEase</NavLink>
        <nav className="rail-nav" aria-label="Main">
          <NavLink to="/" end className={link}>Overview</NavLink>
        </nav>
        <nav className="rail-nav" aria-label="Your groups">
          <span className="rail-heading">Your groups</span>
          {myGroups.map((g) => (
            <NavLink key={g.id} to={'/groups/' + g.id} className={link}>
              <i className="rail-dot" style={{ background: g.hue }} />
              {g.name}
              {mine[g.id] !== 0 && <span className={'amt ' + (mine[g.id] > 0 ? 'pos' : 'neg')}>{inr(mine[g.id])}</span>}
            </NavLink>
          ))}
        </nav>
        <button className="btn btn-small btn-newgroup" onClick={() => setCreating(true)}>Start a group</button>
        <NavLink to="/settings" className="rail-foot">
          <Avatar user={me} />
          <span>{me.name}</span>
        </NavLink>
      </aside>
      <main className="main"><Outlet /></main>
      {creating && <NewGroupDialog onClose={() => setCreating(false)} />}
    </div>
  )
}
