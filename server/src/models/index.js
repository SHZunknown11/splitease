import mongoose from 'mongoose'

const { Schema } = mongoose
const id = (_doc, ret) => { ret.id = String(ret._id); delete ret._id; delete ret.__v; return ret }
const opts = { toJSON: { transform: id }, timestamps: true }

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
  passwordHash: { type: String, select: false },
  hue: { type: String, required: true },
  onLight: Boolean,
}, opts)
userSchema.set('toJSON', { transform: (_d, ret) => { id(_d, ret); delete ret.passwordHash; delete ret.createdAt; delete ret.updatedAt; return ret } })

const groupSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  hue: { type: String, required: true },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, opts)

const expenseSchema = new Schema({
  groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  amount: { type: Number, required: true, min: 1 },
  paidBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, default: 'other' },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  splitType: { type: String, enum: ['equal', 'exact', 'percent'], default: 'equal' },
  shares: { type: Map, of: Number, required: true },
}, opts)
expenseSchema.set('toJSON', { transform: (_d, ret) => {
  id(_d, ret); ret.groupId = String(ret.groupId); ret.paidBy = String(ret.paidBy)
  ret.shares = Object.fromEntries(Object.entries(ret.shares instanceof Map ? Object.fromEntries(ret.shares) : ret.shares))
  delete ret.createdAt; delete ret.updatedAt; return ret } })

const settlementSchema = new Schema({
  groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  from: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 1 },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
}, opts)
settlementSchema.set('toJSON', { transform: (_d, ret) => {
  id(_d, ret); ret.groupId = String(ret.groupId); ret.from = String(ret.from); ret.to = String(ret.to)
  delete ret.createdAt; delete ret.updatedAt; return ret } })

groupSchema.set('toJSON', { transform: (_d, ret) => { id(_d, ret); ret.members = ret.members.map(String); delete ret.createdAt; delete ret.updatedAt; delete ret.createdBy; return ret } })

export const User = mongoose.models.User || mongoose.model('User', userSchema)
export const Group = mongoose.models.Group || mongoose.model('Group', groupSchema)
export const Expense = mongoose.models.Expense || mongoose.model('Expense', expenseSchema)
export const Settlement = mongoose.models.Settlement || mongoose.model('Settlement', settlementSchema)
