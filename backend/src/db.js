import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { join } from 'node:path'

const file = join(process.cwd(), 'data.json')
const adapter = new JSONFile(file)
const db = new Low(adapter, { users: [], sales: [], paymentSettings: [], bets: [] })
await db.read()
// Ensure default collections exist even if existing data.json lacks them
db.data ||= {}
db.data.users ||= []
db.data.sales ||= []
db.data.paymentSettings ||= []
db.data.bets ||= []

export { db }