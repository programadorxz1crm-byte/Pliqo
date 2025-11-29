import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { join } from 'node:path'

// Permite configurar el directorio de datos vía variable de entorno (Render: /data)
const dataDir = process.env.DATA_DIR || process.cwd()
const file = join(dataDir, 'data.json')
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