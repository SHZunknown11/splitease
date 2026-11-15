// Data access for the UI: every call goes to the Express API under /api.
// Vite proxies /api to http://localhost:5000 in development.
const TOKEN_KEY = 'splitease:token'

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
const setToken = (t) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* private mode */ }
}

async function call(method, path, body) {
  let res
  try {
    res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Cannot reach the server. Check that it is running, then try again.')
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && getToken()) setToken(null)
    throw new Error(data.error || 'Something went wrong. Try again.')
  }
  return data
}

const empty = { session: null, users: [], groups: [], expenses: [], settlements: [] }

export const api = {
  async getState() {
    if (!getToken()) return empty
    try { return await call('GET', '/state') } catch (err) {
      if (!getToken()) return empty // session expired: show the login screen
      throw err
    }
  },

  async login(email, password) {
    const { token } = await call('POST', '/auth/login', { email, password })
    setToken(token)
    return api.getState()
  },
  async register(name, email, password) {
    const { token } = await call('POST', '/auth/register', { name, email, password })
    setToken(token)
    return api.getState()
  },
  async logout() { setToken(null); return empty },
  async updateProfile(name) { await call('PATCH', '/me', { name }); return api.getState() },

  async createGroup(name, memberIds, newNames) { return call('POST', '/groups', { name, memberIds, newNames }) },
  async createExpense(e) { await call('POST', `/groups/${e.groupId}/expenses`, e); return api.getState() },
  async deleteExpense(id) { await call('DELETE', '/expenses/' + id); return api.getState() },
  async createSettlement(s) { await call('POST', `/groups/${s.groupId}/settlements`, s); return api.getState() },
  async reset() { await call('POST', '/reset-demo'); setToken(null); return empty },
}
