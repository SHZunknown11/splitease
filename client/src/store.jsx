import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { api, getToken } from './api/client.js'

const Store = createContext(null)
export const useStore = () => useContext(Store)

const blank = { session: null, users: [], groups: [], expenses: [], settlements: [] }

export function StoreProvider({ children }) {
  const [db, setDb] = useState(null)
  const [problem, setProblem] = useState('')
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('splitease:theme') || 'light' } catch { return 'light' }
  })

  const refresh = useCallback(async () => {
    try { setDb(await api.getState()); setProblem('') } catch (err) { setProblem(err.message); setDb((d) => d || blank) }
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('splitease:theme', theme) } catch { /* not essential */ }
  }, [theme])

  // Live updates: when anyone in a group changes something, fetch the new state.
  const signedIn = Boolean(db && db.session)
  useEffect(() => {
    if (!signedIn) return undefined
    const socket = io({ auth: { token: getToken() } })
    socket.on('group:changed', refresh)
    return () => socket.disconnect()
  }, [signedIn, refresh])

  // Run an API call, then use its result if it is a full state, otherwise reload.
  const run = useCallback(async (call) => {
    const result = await call
    if (result && result.users) setDb(result)
    else await refresh()
    return result
  }, [refresh])

  const value = useMemo(() => {
    if (!db) return null
    const byId = Object.fromEntries(db.users.map((u) => [u.id, u]))
    const me = db.session ? byId[db.session] : null
    const myGroups = me ? db.groups.filter((g) => g.members.includes(me.id)) : []
    return {
      ...db, me, byId, myGroups, theme, setTheme, problem,
      login: (e, p) => run(api.login(e, p)),
      register: (n, e, p) => run(api.register(n, e, p)),
      logout: () => run(api.logout()),
      updateProfile: (n) => run(api.updateProfile(n)),
      createGroup: (n, ids, names) => run(api.createGroup(n, ids, names)),
      createExpense: (x) => run(api.createExpense(x)),
      deleteExpense: (id) => run(api.deleteExpense(id)),
      createSettlement: (s) => run(api.createSettlement(s)),
      reset: () => run(api.reset()),
    }
  }, [db, theme, problem, run])

  if (!value) return null
  return <Store.Provider value={value}>{children}</Store.Provider>
}
