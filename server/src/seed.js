import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { pathToFileURL } from 'node:url'
import { User, Group, Expense, Settlement } from './models/index.js'
import { equalShares } from './lib/settle.js'
import { PALETTE } from './lib/auth.js'

const NAMES = ['Taha', 'Aarav', 'Meher', 'Kabir', 'Zoya', 'Dev']

// Wipes the database and loads the sample groups used in the demo and the report.
export async function seedDatabase() {
  await Promise.all([User, Group, Expense, Settlement].map((m) => m.deleteMany({})))
  const hash = await bcrypt.hash('sample', 10)
  const users = await User.insertMany(NAMES.map((name, i) => ({
    name, email: name.toLowerCase() + '@example.com', passwordHash: hash, ...PALETTE[i],
  })))
  const u = Object.fromEntries(NAMES.map((n, i) => [n, users[i]._id]))
  const nameOf = (id) => NAMES[users.findIndex((x) => x._id.equals(id))]
  const mk = (name, hue, m) => Group.create({ name, hue, members: m.map((n) => u[n]), createdBy: u.Taha })
  const g1 = await mk('Flat 4B', '#9b8ac4', ['Taha', 'Aarav', 'Meher', 'Kabir'])
  const g2 = await mk('Manali trip', '#0e8c9b', ['Taha', 'Aarav', 'Meher', 'Zoya', 'Dev'])
  const g3 = await mk('Friday football', '#f2a20c', ['Taha', 'Kabir', 'Dev'])

  const E = (g, title, rupees, payer, category, date, among) => {
    const ids = (among || g.members.map(nameOf)).map((n) => String(u[n]))
    const amount = rupees * 100
    return { groupId: g._id, title, amount, paidBy: u[payer], category, date, splitType: 'equal', shares: equalShares(amount, ids) }
  }
  await Expense.insertMany([
    E(g1, 'August rent', 32000, 'Aarav', 'rent', '2026-08-03'),
    E(g1, 'Electricity bill', 2840, 'Taha', 'utilities', '2026-08-19'),
    E(g1, 'September rent', 32000, 'Aarav', 'rent', '2026-09-02'),
    E(g1, 'Wi-Fi, three months', 2397, 'Meher', 'utilities', '2026-09-11'),
    E(g1, 'Big Bazaar run', 3615, 'Kabir', 'groceries', '2026-09-27'),
    E(g1, 'October rent', 32000, 'Aarav', 'rent', '2026-10-03'),
    E(g1, 'Diwali lights and sweets', 1850, 'Taha', 'fun', '2026-10-29'),
    E(g1, 'November rent', 32000, 'Aarav', 'rent', '2026-11-02'),
    E(g1, 'Gas cylinder', 1103, 'Meher', 'utilities', '2026-11-08'),
    E(g1, 'Vegetables and milk', 940, 'Taha', 'groceries', '2026-11-13'),
    E(g2, 'Volvo tickets to Manali', 7500, 'Taha', 'travel', '2026-10-09'),
    E(g2, 'Hostel, two nights', 9000, 'Zoya', 'rent', '2026-10-10'),
    E(g2, 'Dinner at Johnson’s', 4200, 'Aarav', 'food', '2026-10-10'),
    E(g2, 'Solang cab', 2600, 'Dev', 'travel', '2026-10-11'),
    E(g2, 'Paragliding', 6000, 'Meher', 'fun', '2026-10-11', ['Taha', 'Meher', 'Zoya']),
    E(g2, 'Momos and chai', 780, 'Taha', 'food', '2026-10-12'),
    E(g3, 'Turf booking', 1800, 'Kabir', 'fun', '2026-11-06'),
    E(g3, 'Energy drinks', 360, 'Taha', 'food', '2026-11-06'),
    E(g3, 'Turf booking', 1800, 'Dev', 'fun', '2026-11-13'),
  ])
  const S = (from, to, rupees, date) => ({ groupId: g1._id, from: u[from], to: u[to], amount: rupees * 100, date })
  await Settlement.insertMany([S('Taha', 'Aarav', 24000, '2026-10-05'), S('Meher', 'Aarav', 24000, '2026-10-06'), S('Kabir', 'Aarav', 16000, '2026-10-20')])
}

// `npm run seed` runs this file directly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/splitease'
  await mongoose.connect(uri)
  await seedDatabase()
  console.log('Sample data loaded into', uri)
  await mongoose.disconnect()
}
