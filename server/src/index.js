import http from 'node:http'
import mongoose from 'mongoose'
import { createApp } from './app.js'
import { attachSockets } from './lib/realtime.js'
import { User } from './models/index.js'
import { seedDatabase } from './seed.js'

const PORT = process.env.PORT || 5000
const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/splitease'

await mongoose.connect(URI)
// First run on an empty database: load the sample data so the app is not blank.
if ((await User.estimatedDocumentCount()) === 0) {
  await seedDatabase()
  console.log('Empty database: loaded sample data.')
}
const server = http.createServer(createApp())
attachSockets(server)
server.listen(PORT, () => console.log(`SplitEase API on http://localhost:${PORT}`))
