import { Server } from 'socket.io'
import { Group } from '../models/index.js'
import { verifyToken } from './auth.js'

let io = null

export function attachSockets(httpServer) {
  io = new Server(httpServer, { cors: { origin: true } })
  io.use((socket, next) => {
    try { socket.userId = verifyToken(socket.handshake.auth?.token || ''); next() }
    catch { next(new Error('unauthorised')) }
  })
  io.on('connection', async (socket) => {
    const groups = await Group.find({ members: socket.userId }, '_id')
    for (const g of groups) socket.join('group:' + g._id)
    socket.join('user:' + socket.userId)
  })
  return io
}

// Tell everyone in a group that something changed; clients re-fetch.
export const notifyGroup = (groupId) => io && io.to('group:' + groupId).emit('group:changed', { groupId: String(groupId) })

// A new group needs the members' open sockets to join its room.
export async function joinRoom(userIds, groupId) {
  if (!io) return
  for (const uid of userIds) {
    const sockets = await io.in('user:' + uid).fetchSockets()
    sockets.forEach((s) => s.join('group:' + groupId))
    io.to('user:' + uid).emit('group:changed', { groupId: String(groupId) })
  }
}
