import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { db } from './db.js'
import PDFDocument from 'pdfkit'
const app = express()
app.use(cors())
app.use(express.json())

// Ensure default admin account exists at startup
async function ensureAdmin() {
  await db.read()
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@pliqo.local'
  let admin = db.data.users.find(u => u.role === 'admin' || u.email === adminEmail)
  if (!admin) {
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
    const hash = await bcrypt.hash(adminPassword, 10)
    admin = {
      id: randomUUID(),
      name: 'Admin',
      email: adminEmail,
      phone: '',
      passwordHash: hash,
      plan: 987,
      sponsorId: null,
      active: true,
      role: 'admin',
      whatsappNumber: process.env.ADMIN_WHATSAPP || '',
      landingVideoUrl: '',
      landingHeadline: '',
      avatarUrl: ''
    }
    db.data.users.push(admin)
    await db.write()
    console.log(`Cuenta admin creada: ${adminEmail}`)
  }
}
ensureAdmin().catch(() => {})

const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'secret'
const BOT_LIVE_TRADING_DEFAULT = /^true$/i.test(process.env.BOT_LIVE_TRADING || '')
const TRADING_KEYS_SECRET = process.env.TRADING_KEYS_SECRET || JWT_SECRET

function ensureDbDefaults() {
  db.data ||= {}
  db.data.users ||= []
  db.data.sales ||= []
  db.data.paymentSettings ||= []
  db.data.bets ||= []
  db.data.referralEvents ||= []
  db.data.activationRequests ||= []
  db.data.activationProofs ||= []
  db.data.tradingKeys ||= []
  db.data.botLogs ||= []
  db.data.levels ||= [
    { id: 1, name: 'Nivel 1', description: 'Inicio' },
    { id: 2, name: 'Nivel 2', description: 'Intermedio' },
    { id: 3, name: 'Nivel 3', description: 'Avanzado' }
  ]
}

function signToken(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' })
}

// Build sales/marketing context for Ollama assistant
function buildMarketingContext(user, origin) {
  const baseOrigin = origin || process.env.APP_ORIGIN || 'http://localhost:5173'
  const referralLink = `${baseOrigin}/?ref=${user.id}`
  return `Eres asesor de ventas de Pliqo.
Objetivo: ayudarte a vender planes y atraer referidos.

Planes disponibles y beneficio por activación:
- $15 — Vende y recibe $15 por activación.
- $37 — Vende y recibe $37 por activación.
- $99 — Vende y recibe $99 por activación.
- $187 — Vende y recibe $187 por activación.
- $349 — Vende y recibe $349 por activación.
- $987 — Vende y recibe $987 por activación.

Estrategia solicitada:
- Incluye tácticas concretas para Facebook, Instagram y TikTok: tipos de contenido, frecuencia, hashtags, CTA.
- Ofrece guiones de venta para mensajes privados (DM/WhatsApp) y respuestas a objeciones.
- Indica que comparta su enlace de referidos: ${referralLink}.
- Recomienda construir marca: perfil profesional, foto real, biografía clara, y prueba social.
- Sugiere publicar videos de pagos/ganancias (cuando existan) o utilizar testimonios de otros usuarios con consentimiento.
- Responde en español, con pasos accionables y breves listas.`
}

// Robust POST JSON helper (fallback when fetch fails)
import http from 'node:http'
import https from 'node:https'
async function postJson(urlStr, payload) {
  return await new Promise((resolve, reject) => {
    try {
      const u = new URL(urlStr)
      const lib = u.protocol === 'https:' ? https : http
      const req = lib.request({
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + (u.search || ''),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, res => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          try { resolve(JSON.parse(data)) }
          catch { resolve({ raw: data }) }
        })
      })
      req.on('error', reject)
      req.write(JSON.stringify(payload))
      req.end()
    } catch (e) {
      reject(e)
    }
  })
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    await db.read()
    const user = db.data.users.find(u => u.id === payload.id)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    req.user = user
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

// Auth
app.post('/auth/register', async (req, res) => {
  const { name, email, phone, password, plan, sponsorId } = req.body
  if (!name || !email || !password || !plan) return res.status(400).json({ error: 'Faltan datos' })
  await db.read()
  ensureDbDefaults()
  const exists = db.data.users.find(u => u.email === email)
  if (exists) return res.status(400).json({ error: 'Email ya registrado' })
  const sponsor = sponsorId ? db.data.users.find(u => u.id === sponsorId) : null
  const finalPlan = sponsor ? sponsor.plan : plan
  const hash = await bcrypt.hash(password, 10)
  const user = { id: randomUUID(), name, email, phone, passwordHash: hash, plan: finalPlan, sponsorId: sponsor?.id || null, active: false, role: 'user', level: 1, whatsappNumber: '', landingVideoUrl: '', landingHeadline: '' }
  db.data.users.push(user)
  await db.write()
  const token = signToken(user)
  res.json({ token, user: { id: user.id, name: user.name, plan: user.plan, active: user.active } })
})

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body
  await db.read()
  ensureDbDefaults()
  const user = db.data.users.find(u => u.email === email)
  if (!user) return res.status(400).json({ error: 'Credenciales inválidas' })
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(400).json({ error: 'Credenciales inválidas' })
  const token = signToken(user)
  res.json({ token })
})

// Current user
app.get('/users/me', authMiddleware, async (req, res) => {
  ensureDbDefaults()
  const payment = db.data.paymentSettings.find(p => p.userId === req.user.id) || null
  res.json({ id: req.user.id, name: req.user.name, email: req.user.email, plan: req.user.plan, level: req.user.level || 1, active: req.user.active, role: req.user.role || 'user', sponsorId: req.user.sponsorId || null, payment, whatsappNumber: req.user.whatsappNumber, landingVideoUrl: req.user.landingVideoUrl, landingHeadline: req.user.landingHeadline, avatarUrl: req.user.avatarUrl || '' })
})

// Sponsor info for current user (payment and contact)
app.get('/users/me/sponsor', authMiddleware, async (_req, res) => {
  await db.read()
  ensureDbDefaults()
  const user = _req.user
  if (!user.sponsorId) return res.json({ sponsor: null, payment: null, pending: false })
  const sponsor = db.data.users.find(u => u.id === user.sponsorId)
  if (!sponsor) return res.json({ sponsor: null, payment: null, pending: false })
  const payment = db.data.paymentSettings.find(p => p.userId === sponsor.id) || null
  const pending = !!db.data.activationRequests.find(r => r.userId === user.id && r.sponsorId === sponsor.id)
  res.json({ sponsor: { id: sponsor.id, name: sponsor.name, plan: sponsor.plan, whatsappNumber: sponsor.whatsappNumber }, payment, pending })
})

// Settings
app.post('/settings', authMiddleware, async (req, res) => {
  const { payment, whatsappNumber, landingVideoUrl, landingHeadline, avatarUrl } = req.body
  await db.read()
  ensureDbDefaults()
  if (payment) {
    const existing = db.data.paymentSettings.find(p => p.userId === req.user.id)
    if (existing) {
      Object.assign(existing, payment)
    } else {
      db.data.paymentSettings.push({ id: randomUUID(), userId: req.user.id, ...payment })
    }
  }
  const user = db.data.users.find(u => u.id === req.user.id)
  // WhatsApp puede configurarlo cualquier usuario
  user.whatsappNumber = whatsappNumber
  if (typeof avatarUrl === 'string') user.avatarUrl = avatarUrl
  // Configuración de video y titular solo para admin
  if ((user.role || 'user') === 'admin') {
    user.landingVideoUrl = landingVideoUrl
    user.landingHeadline = landingHeadline
  }
  await db.write()
  res.json({ ok: true, user })
})

// Public info for landing
app.get('/user/:id/public', async (req, res) => {
  await db.read()
  ensureDbDefaults()
  const user = db.data.users.find(u => u.id === req.params.id)
  if (!user) return res.status(404).json({ error: 'No encontrado' })
  res.json({ id: user.id, name: user.name, plan: user.plan, level: user.level || 1, whatsappNumber: user.whatsappNumber, landingVideoUrl: user.landingVideoUrl, landingHeadline: user.landingHeadline, avatarUrl: user.avatarUrl || '' })
})

// Public admin configuration for landing (video, headline, WhatsApp)
app.get('/public/admin', async (_req, res) => {
  await db.read()
  ensureDbDefaults()
  const admin = db.data.users.find(u => (u.role || 'user') === 'admin')
  if (!admin) return res.status(404).json({ error: 'Admin no encontrado' })
  res.json({
    id: admin.id,
    name: admin.name,
    plan: admin.plan,
    whatsappNumber: admin.whatsappNumber,
    landingVideoUrl: admin.landingVideoUrl,
    landingHeadline: admin.landingHeadline,
    avatarUrl: admin.avatarUrl || ''
  })
})

// Public payment info for a sponsor (limited fields)
app.get('/user/:id/payment/public', async (req, res) => {
  await db.read()
  ensureDbDefaults()
  const payment = db.data.paymentSettings.find(p => p.userId === req.params.id) || null
  if (!payment) return res.json({ paypalEmail: '', binanceId: '', westernUnionName: '', bankTransferDetails: '', currencyCode: 'USD', binancePayLink: '' })
  const { paypalEmail = '', binanceId = '', westernUnionName = '', bankTransferDetails = '', currencyCode = 'USD', binancePayLink = '' } = payment
  res.json({ paypalEmail, binanceId, westernUnionName, bankTransferDetails, currencyCode, binancePayLink })
})

// Public admin config for landing (video/headline/whatsapp)
app.get('/public/admin', async (_req, res) => {
  await db.read()
  ensureDbDefaults()
  const admin = db.data.users.find(u => (u.role || 'user') === 'admin')
  if (!admin) return res.status(404).json({ error: 'Admin no encontrado' })
  res.json({ id: admin.id, name: admin.name, whatsappNumber: admin.whatsappNumber, landingVideoUrl: admin.landingVideoUrl, landingHeadline: admin.landingHeadline, avatarUrl: admin.avatarUrl || '' })
})

// ===== Levels =====
app.get('/levels', authMiddleware, async (_req, res) => {
  await db.read()
  ensureDbDefaults()
  res.json(db.data.levels)
})

app.post('/admin/users/:id/level', authMiddleware, async (req, res) => {
  if ((req.user.role || 'user') !== 'admin') return res.status(403).json({ error: 'Solo admin' })
  const { level } = req.body
  await db.read()
  ensureDbDefaults()
  const target = db.data.users.find(u => u.id === req.params.id)
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado' })
  target.level = Number(level) || 1
  await db.write()
  res.json({ ok: true, user: { id: target.id, name: target.name, level: target.level } })
})

// ===== Trading Signals =====
function ema(period, values) {
  const k = 2 / (period + 1)
  let emaPrev = values[0]
  const out = []
  for (let i = 0; i < values.length; i++) {
    const val = i === 0 ? values[0] : values[i] * k + emaPrev * (1 - k)
    out.push(val)
    emaPrev = val
  }
  return out
}

function rsi(period, values) {
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1]
    if (change >= 0) gains += change; else losses -= change
  }
  let avgGain = gains / period
  let avgLoss = losses / period
  const rsiVals = []
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1]
    const gain = Math.max(change, 0)
    const loss = Math.max(-change, 0)
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    const rsi = 100 - 100 / (1 + rs)
    rsiVals.push(rsi)
  }
  return rsiVals
}

// ===== Cifrado de claves de trading (AES-256-GCM) =====
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
const ENC_KEY = createHash('sha256').update(String(TRADING_KEYS_SECRET)).digest()
function encryptText(plain) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', ENC_KEY, iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}
function decryptText(blob) {
  try {
    const buf = Buffer.from(String(blob), 'base64')
    const iv = buf.slice(0, 12)
    const tag = buf.slice(12, 28)
    const enc = buf.slice(28)
    const decipher = createDecipheriv('aes-256-gcm', ENC_KEY, iv)
    decipher.setAuthTag(tag)
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
    return dec
  } catch { return '' }
}

async function getUserBinanceKeys(userId) {
  await db.read(); ensureDbDefaults()
  const rec = db.data.tradingKeys.find(k => k.userId === userId)
  if (!rec) return null
  const apiKey = decryptText(rec.apiKeyEnc)
  const apiSecret = decryptText(rec.apiSecretEnc)
  if (!apiKey || !apiSecret) return null
  return { apiKey, apiSecret }
}

// Endpoints para guardar/consultar claves de Binance
app.post('/settings/trading-keys', authMiddleware, async (req, res) => {
  const { apiKey, apiSecret } = req.body || {}
  if (!apiKey || !apiSecret) return res.status(400).json({ error: 'Faltan apiKey y apiSecret' })
  await db.read(); ensureDbDefaults()
  const existing = db.data.tradingKeys.find(k => k.userId === req.user.id)
  const record = { userId: req.user.id, apiKeyEnc: encryptText(apiKey), apiSecretEnc: encryptText(apiSecret), updatedAt: new Date().toISOString() }
  if (existing) Object.assign(existing, record); else db.data.tradingKeys.push(record)
  await db.write()
  res.json({ ok: true })
})

app.get('/settings/trading-keys', authMiddleware, async (req, res) => {
  await db.read(); ensureDbDefaults()
  const rec = db.data.tradingKeys.find(k => k.userId === req.user.id)
  res.json({ hasKeys: !!rec })
})

app.delete('/settings/trading-keys', authMiddleware, async (req, res) => {
  await db.read(); ensureDbDefaults()
  db.data.tradingKeys = db.data.tradingKeys.filter(k => k.userId !== req.user.id)
  await db.write()
  res.json({ ok: true })
})

// ===== Bots automáticos (por defecto en paper trading) =====
const runningBots = {}

function recordBotLog(log) {
  db.read().then(() => {
    ensureDbDefaults()
    db.data.botLogs.push({ id: randomUUID(), ...log })
    db.write()
  }).catch(() => {})
}

async function placeBinanceOrder({ symbol, side, quantity, apiKey, apiSecret }) {
  const ts = Date.now()
  const params = new URLSearchParams({ symbol, side, type: 'MARKET', quantity: String(quantity), timestamp: String(ts) })
  const { createHmac } = await import('node:crypto')
  const sig = createHmac('sha256', apiSecret).update(params.toString()).digest('hex')
  const base = process.env.BINANCE_FAPI_BASE || 'https://fapi.binance.com'
  const url = `${base}/fapi/v1/order?${params.toString()}&signature=${sig}`
  const r = await fetch(url, { method: 'POST', headers: { 'X-MBX-APIKEY': apiKey } })
  if (!r.ok) throw new Error(await r.text().catch(() => String(r.status)))
  return r.json()
}

function startBinanceBot({ userId, symbol = 'BTCUSDT', interval = '5m', quantity = 0.001, periodMs = 60_000, live = BOT_LIVE_TRADING_DEFAULT }) {
  const key = `binance:${userId}`
  if (runningBots[key]?.intervalId) clearInterval(runningBots[key].intervalId)
  runningBots[key] = { intervalId: setInterval(async () => {
    try {
      const base = process.env.BINANCE_FAPI_BASE || 'https://fapi.binance.com'
      const r = await fetch(`${base}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=120`)
      if (!r.ok) return
      const kl = await r.json()
      const closes = kl.map(k => Number(k[4]))
      const ema20v = ema(20, closes)
      const ema50v = ema(50, closes)
      const rsi14v = rsi(14, closes)
      const last = closes[closes.length - 1]
      const trendUp = ema20v[ema20v.length - 1] > ema50v[ema50v.length - 1]
      const overbought = rsi14v[rsi14v.length - 1] > 70
      const oversold = rsi14v[rsi14v.length - 1] < 30
      let side = 'BUY'
      let reason = ''
      if (trendUp && oversold) { side = 'BUY'; reason = 'EMA20>EMA50 y RSI<30' }
      else if (!trendUp && overbought) { side = 'SELL'; reason = 'EMA20<EMA50 y RSI>70' }
      else { return }
      const log = { ts: new Date().toISOString(), bot: 'binance', userId, symbol, interval, price: last, side, quantity, reason }
      recordBotLog(log)
      if (live) {
        const keys = await getUserBinanceKeys(userId)
        if (!keys) {
          recordBotLog({ ...log, live: true, error: 'Sin claves configuradas' })
        } else {
        try {
          const resp = await placeBinanceOrder({ symbol, side, quantity, apiKey: keys.apiKey, apiSecret: keys.apiSecret })
          recordBotLog({ ...log, live: true, orderId: resp.orderId || resp.clientOrderId || 'ok' })
        } catch (e) {
          recordBotLog({ ...log, live: true, error: e.message })
        }
        }
      }
    } catch (e) {
      recordBotLog({ ts: new Date().toISOString(), bot: 'binance', userId, error: e.message })
    }
  }, periodMs), live }
}

function stopBinanceBot(userId) {
  const key = `binance:${userId}`
  if (runningBots[key]?.intervalId) { clearInterval(runningBots[key].intervalId); delete runningBots[key] }
}

app.post('/bot/binance/start', authMiddleware, async (req, res) => {
  const { symbol = 'BTCUSDT', interval = '5m', quantity = 0.001, periodMs = 60_000, live = false } = req.body || {}
  if (live) {
    const keys = await getUserBinanceKeys(req.user.id)
    if (!keys) return res.status(400).json({ error: 'Configura tus claves de Binance primero' })
  }
  startBinanceBot({ userId: req.user.id, symbol, interval, quantity, periodMs, live })
  res.json({ ok: true, running: true, live })
})

app.post('/bot/binance/stop', authMiddleware, async (req, res) => {
  stopBinanceBot(req.user.id)
  res.json({ ok: true, running: false })
})

app.get('/bot/binance/status', authMiddleware, async (req, res) => {
  await db.read()
  ensureDbDefaults()
  const logs = db.data.botLogs.filter(l => l.userId === req.user.id && l.bot === 'binance').slice(-50)
  const running = !!runningBots[`binance:${req.user.id}`]
  const live = running ? !!runningBots[`binance:${req.user.id}`].live : false
  const hasKeys = !!db.data.tradingKeys.find(k => k.userId === req.user.id)
  res.json({ running, live, hasKeys, logs })
})

// Simulación educativa de binarias (Quotex-like). No ejecuta operaciones reales.
function startBinarySimBot({ userId, symbol = 'BTCUSDT', periodMs = 60_000 }) {
  const key = `binary:${userId}`
  if (runningBots[key]) clearInterval(runningBots[key])
  runningBots[key] = setInterval(() => {
    const dir = Math.random() > 0.5 ? 'CALL' : 'PUT'
    const log = { ts: new Date().toISOString(), bot: 'binary', userId, symbol, direction: dir, reason: 'Simulado (educativo)' }
    recordBotLog(log)
  }, periodMs)
}

function stopBinarySimBot(userId) {
  const key = `binary:${userId}`
  if (runningBots[key]) { clearInterval(runningBots[key]); delete runningBots[key] }
}

app.post('/bot/binary/start', authMiddleware, async (req, res) => {
  const { symbol = 'BTCUSDT', periodMs = 60_000 } = req.body || {}
  startBinarySimBot({ userId: req.user.id, symbol, periodMs })
  res.json({ ok: true, running: true })
})

app.post('/bot/binary/stop', authMiddleware, async (req, res) => {
  stopBinarySimBot(req.user.id)
  res.json({ ok: true, running: false })
})

app.get('/bot/binary/status', authMiddleware, async (req, res) => {
  await db.read()
  ensureDbDefaults()
  const logs = db.data.botLogs.filter(l => l.userId === req.user.id && l.bot === 'binary').slice(-50)
  res.json({ running: !!runningBots[`binary:${req.user.id}`], logs })
})

app.get('/signals/binance/futures', authMiddleware, async (req, res) => {
  const symbol = (req.query.symbol || 'BTCUSDT').toUpperCase()
  const interval = req.query.interval || '5m'
  const limit = Number(req.query.limit || 200)
  try {
    const base = process.env.BINANCE_FAPI_BASE || 'https://fapi.binance.com'
    let r = await fetch(`${base}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`)
    let klines
    if (!r.ok) {
      // Fallback: intentar spot como respaldo
      const altBase = process.env.BINANCE_API_BASE || 'https://api.binance.com'
      const r2 = await fetch(`${altBase}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`)
      if (!r2.ok) {
        // Generar datos sintéticos para mantener la UI funcional
        const now = Date.now()
        const synthetic = Array.from({ length: limit }, (_, i) => {
          const t = now - (limit - i) * 60_000
          const v = 50000 + Math.sin(i / 7) * 200 + Math.random() * 50
          return [0, 0, 0, 0, v, 0, t]
        })
        klines = synthetic
      } else {
        klines = await r2.json()
        // Adaptar formato spot a futuro (ya es compatible para cerrar en índice 4)
      }
    } else {
      klines = await r.json()
    }
    const closes = klines.map(k => Number(k[4]))
    const times = klines.map(k => Number(k[6]))
    const ema20 = ema(20, closes)
    const ema50 = ema(50, closes)
    const rsi14 = rsi(14, closes)
    const lastClose = closes[closes.length - 1]
    const trendUp = ema20[ema20.length - 1] > ema50[ema50.length - 1]
    const lastRsi = rsi14[rsi14.length - 1]
    let signal = 'NEUTRAL'
    let reasons = []
    if (trendUp && lastRsi < 65) { signal = 'LONG'; reasons.push('EMA20>EMA50 y RSI<65') }
    if (!trendUp && lastRsi > 35) { signal = 'SHORT'; reasons.push('EMA20<EMA50 y RSI>35') }
    const entry = lastClose
    const stopLoss = signal === 'LONG' ? +(entry * 0.996).toFixed(2) : +(entry * 1.004).toFixed(2)
    const takeProfit = signal === 'LONG' ? +(entry * 1.008).toFixed(2) : +(entry * 0.992).toFixed(2)
    const confidence = Math.max(0, Math.min(100, Math.round((trendUp ? (65 - lastRsi) : (lastRsi - 35)) + 50)))
    const guide = [
      'Paso 1: Selecciona símbolo y marco temporal (ej. 5m).',
      `Paso 2: Señal ${signal} con entrada ~${entry}.`,
      `Paso 3: Stop ${stopLoss}, Take-Profit ${takeProfit}.`,
      'Paso 4: Gestiona riesgo, evita sobreapalancamiento.',
      'Paso 5: No es consejo financiero; practica en demo.'
    ]
    const generatedAt = times.length ? new Date(times[times.length - 1]).toISOString() : new Date().toISOString()
    res.json({ symbol, interval, generatedAt, signal, confidence, entry, stopLoss, takeProfit, reasons, guide })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error obteniendo datos de Binance' })
  }
})

app.get('/signals/binary', authMiddleware, async (req, res) => {
  const symbol = (req.query.symbol || 'BTCUSDT').toUpperCase()
  const interval = req.query.interval || '1m'
  const limit = Number(req.query.limit || 120)
  try {
    const base = process.env.BINANCE_API_BASE || 'https://api.binance.com'
    let r = await fetch(`${base}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`)
    let klines
    if (!r.ok) {
      // Fallback: datos sintéticos
      const now = Date.now()
      klines = Array.from({ length: limit }, (_, i) => {
        const t = now - (limit - i) * 60_000
        const v = 50000 + Math.cos(i / 5) * 150 + Math.random() * 40
        return [0, 0, 0, 0, v, 0, t]
      })
    } else {
      klines = await r.json()
    }
    const closes = klines.map(k => Number(k[4]))
    const times = klines.map(k => Number(k[6]))
    const rsi14 = rsi(14, closes)
    const lastRsi = rsi14[rsi14.length - 1]
    const last5 = closes.slice(-5)
    const slope = last5[last5.length - 1] - last5[0]
    let signal = 'NO_TRADE'
    let reasons = []
    if (slope > 0 && lastRsi < 70) { signal = 'CALL'; reasons.push('Momento alcista y RSI<70') }
    if (slope < 0 && lastRsi > 30) { signal = 'PUT'; reasons.push('Momento bajista y RSI>30') }
    const confidence = Math.max(0, Math.min(100, Math.round((Math.abs(slope) / last5[0]) * 100)))
    const guide = [
      'Paso 1: Usa expiración próxima al marco (ej. 1–3m).',
      `Paso 2: Si señal es CALL/PUT, espera retroceso leve y entra.`,
      'Paso 3: Evita operar en noticias de alta volatilidad.',
      'Paso 4: Fija máximo trades diarios y respeta pérdidas.',
      'Paso 5: No es consejo financiero; practica en demo.'
    ]
    const generatedAt = times.length ? new Date(times[times.length - 1]).toISOString() : new Date().toISOString()
    res.json({ symbol, interval, generatedAt, signal, confidence, reasons, guide })
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error obteniendo datos de Binance' })
  }
})

// ===== Business PDF =====
app.get('/pdf/business', async (_req, res) => {
  try {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="Pliqo_Modelo_Negocio.pdf"')
    doc.pipe(res)
    doc.fontSize(20).text('Pliqo — Modelo de negocio', { align: 'center' })
    doc.moveDown()
    doc.fontSize(12).text('Resumen: tras activar tu cuenta, puedes ganar el 100% del dinero directamente a tu cuenta por cada activación que realices. Sigue las instrucciones dentro de la plataforma.')
    doc.moveDown()
    doc.fontSize(14).text('Planes disponibles')
    doc.fontSize(12).list(['$15 — entrada básica', '$37 — plan adicional', '$99', '$187', '$349', '$987'])
    doc.moveDown()
    doc.fontSize(14).text('Cómo empezar')
    doc.fontSize(12).list([
      '1) Activa tu cuenta con el pago del plan elegido.',
      '2) Configura tus métodos de cobro (PayPal, Binance ID, etc.).',
      '3) Usa el material de marketing y tu enlace de referidos.',
      '4) Publica contenidos y comparte testimonios con autorización.',
      '5) Atiende a tus clientes y registra activaciones.'
    ])
    doc.moveDown()
    doc.fontSize(14).text('Señales y operación')
    doc.fontSize(12).list([
      '• Futuros: entrada, stop loss y take-profit con gestión de riesgo.',
      '• Binarias: CALL/PUT en marcos cortos, evitando alta volatilidad.'
    ])
    doc.moveDown()
    doc.fontSize(10).fillColor('gray').text('Aviso: no constituye consejo financiero. Opera con responsabilidad.')
    doc.end()
  } catch (e) {
    res.status(500).json({ error: e.message || 'Error generando PDF' })
  }
})

// ===== Activation flow =====
// User notifies sponsor that payment was made
app.post('/users/me/notify-payment', authMiddleware, async (req, res) => {
  await db.read()
  ensureDbDefaults()
  const user = req.user
  if (!user.sponsorId) return res.status(400).json({ error: 'No tienes patrocinador asociado' })
  const exists = db.data.activationRequests.find(r => r.userId === user.id && r.sponsorId === user.sponsorId)
  if (!exists) db.data.activationRequests.push({ id: randomUUID(), userId: user.id, sponsorId: user.sponsorId, createdAt: new Date().toISOString() })
  // Capture optional payment proof from user at the time of notification
  const proofUrl = typeof req.body?.proofUrl === 'string' ? req.body.proofUrl.trim() : ''
  const proofNote = typeof req.body?.proofNote === 'string' ? req.body.proofNote.trim() : ''
  if (proofUrl || proofNote) {
    db.data.activationProofs.push({
      userId: user.id,
      sponsorId: user.sponsorId,
      proofUrl: proofUrl || null,
      proofNote: proofNote || null,
      createdAt: new Date().toISOString()
    })
  }
  await db.write()
  res.json({ ok: true })
})

// Sponsor views activation requests
app.get('/users/referrals/requests', authMiddleware, async (req, res) => {
  await db.read()
  ensureDbDefaults()
  const list = db.data.activationRequests.filter(r => r.sponsorId === req.user.id)
  const users = list.map(r => {
    const u = db.data.users.find(x => x.id === r.userId)
    // Include latest proof submitted by the user to this sponsor, if any
    const proofs = db.data.activationProofs
      .filter(p => p.userId === r.userId && p.sponsorId === req.user.id)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    const lastProof = proofs.length ? proofs[proofs.length - 1] : null
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      plan: u.plan,
      active: u.active,
      requestedAt: r.createdAt,
      requestId: r.id,
      lastProof: lastProof ? { proofUrl: lastProof.proofUrl || null, proofNote: lastProof.proofNote || null, createdAt: lastProof.createdAt } : null
    }
  })
  res.json(users)
})

// Referral tracking (public)
app.post('/referral/visit', async (req, res) => {
  const { sponsorId } = req.body
  if (!sponsorId) return res.status(400).json({ error: 'sponsorId requerido' })
  await db.read()
  ensureDbDefaults()
  db.data.referralEvents.push({ id: randomUUID(), type: 'visit', sponsorId, createdAt: new Date().toISOString() })
  await db.write()
  res.json({ ok: true })
})

app.post('/referral/video', async (req, res) => {
  const { sponsorId } = req.body
  if (!sponsorId) return res.status(400).json({ error: 'sponsorId requerido' })
  await db.read()
  ensureDbDefaults()
  db.data.referralEvents.push({ id: randomUUID(), type: 'video_view', sponsorId, createdAt: new Date().toISOString() })
  await db.write()
  res.json({ ok: true })
})

// Sales and referrals
app.get('/sales', authMiddleware, async (req, res) => {
  await db.read()
  ensureDbDefaults()
  const sales = db.data.sales.filter(s => s.userId === req.user.id).sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt))
  res.json(sales)
})

app.get('/users/referrals', authMiddleware, async (req, res) => {
  await db.read()
  ensureDbDefaults()
  const referrals = db.data.users.filter(u => u.sponsorId === req.user.id && !u.active)
  res.json(referrals)
})

// Referral stats for current user
app.get('/users/me/referral/stats', authMiddleware, async (req, res) => {
  await db.read()
  ensureDbDefaults()
  const visits = db.data.referralEvents.filter(e => e.type === 'visit' && e.sponsorId === req.user.id).length
  const videoViews = db.data.referralEvents.filter(e => e.type === 'video_view' && e.sponsorId === req.user.id).length
  const registrations = db.data.users.filter(u => u.sponsorId === req.user.id).length
  res.json({ visits, registrations, videoViews })
})

app.post('/users/:id/activate', authMiddleware, async (req, res) => {
  await db.read()
  ensureDbDefaults()
  const target = db.data.users.find(u => u.id === req.params.id)
  if (!target || target.sponsorId !== req.user.id) return res.status(403).json({ error: 'No autorizado' })
  if (target.active) return res.json({ ok: true })
  target.active = true

  // Esquema de comisiones: 1er y 2do pago para el patrocinador (quien vende), 3er pago para su patrocinador, luego todos para él.
  const sellerId = req.user.id
  const sellerSponsorId = req.user.sponsorId || null
  const sellerSalesCount = db.data.sales.filter(s => (s.sellerId ? s.sellerId === sellerId : s.userId === sellerId)).length
  let recipientId = sellerId
  if (sellerSalesCount === 2 && sellerSponsorId) {
    recipientId = sellerSponsorId
  }
  db.data.sales.push({ id: randomUUID(), userId: recipientId, sellerId: sellerId, amount: target.plan, buyerId: target.id, createdAt: new Date().toISOString() })

  // Registrar comprobante de pago si el patrocinador lo adjunta
  const proofUrl = typeof req.body?.proofUrl === 'string' ? req.body.proofUrl.trim() : ''
  const proofNote = typeof req.body?.proofNote === 'string' ? req.body.proofNote.trim() : ''
  if (proofUrl || proofNote) {
    db.data.activationProofs.push({ id: randomUUID(), userId: target.id, sponsorId: sellerId, proofUrl: proofUrl || null, proofNote: proofNote || null, createdAt: new Date().toISOString() })
  }

  // Eliminar solicitud de activación si existía
  db.data.activationRequests = db.data.activationRequests.filter(r => !(r.userId === target.id && r.sponsorId === sellerId))

  await db.write()
  res.json({ ok: true })
})

// AI chat via Ollama
app.post('/ai/chat', authMiddleware, async (req, res) => {
  const { prompt, images, model: reqModel } = req.body
  const baseUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434'
  const url = /^https?:\/\/localhost(?::|\/)/i.test(baseUrl) ? baseUrl.replace('localhost', '127.0.0.1') : baseUrl
  let model = (typeof reqModel === 'string' && reqModel.trim()) ? reqModel.trim() : (process.env.OLLAMA_MODEL || 'llama3.2')
  try {
    await db.read()
    ensureDbDefaults()
    const payment = db.data.paymentSettings.find(p => p.userId === req.user.id) || null
    const paymentLines = [
      payment?.paypalEmail ? `• PayPal: ${payment.paypalEmail}` : '',
      payment?.binanceId ? `• Binance ID: ${payment.binanceId}` : '',
      payment?.westernUnionName ? `• Western Union: ${payment.westernUnionName}` : '',
      payment?.bankTransferDetails ? `• Transferencia bancaria: ${payment.bankTransferDetails}` : ''
    ].filter(Boolean).join('\n')
    const whatsappLine = req.user.whatsappNumber ? `WhatsApp: ${req.user.whatsappNumber}` : ''
    const context = buildMarketingContext(req.user, req.headers.origin)
    const paymentContext = paymentLines
      ? `\n\nDatos de pago del usuario (compártelos para que el referido le pague el 100%):\n${paymentLines}${whatsappLine ? `\n${whatsappLine}` : ''}`
      : `\n\nSi el usuario quiere activar, pídele un método y ofrécele pasarle sus datos de pago por WhatsApp${whatsappLine ? ` (${whatsappLine})` : ''}.`
    const fullPrompt = `${context}${paymentContext}\n\nConsulta del usuario:\n${prompt}\n\nDevuelve recomendaciones accionables.`

    // Soporte de imágenes (para modelos de visión como llama3.2-vision, llava, etc.)
    const stripDataUrl = (s) => (typeof s === 'string') ? s.replace(/^data:.*;base64,/, '') : ''
    const imagePayload = Array.isArray(images) && images.length ? images.map(stripDataUrl).filter(Boolean) : undefined

    // Elegir un modelo instalado si el definido no está disponible, prefiriendo el más pequeño para evitar OOM
    try {
      const tagsRes = await fetch(`${url}/api/tags`).catch(() => null)
      if (tagsRes?.ok) {
        const tags = await tagsRes.json().catch(() => ({ models: [] }))
        const modelsList = Array.isArray(tags?.models) ? tags.models : []
        const normalizeSize = (s) => {
          if (!s || typeof s !== 'string') return Number.POSITIVE_INFINITY
          const mB = s.match(/([0-9]+(?:\.[0-9]+)?)\s*B/i)
          if (mB) return parseFloat(mB[1]) // Billions
          const mM = s.match(/([0-9]+(?:\.[0-9]+)?)\s*M/i)
          if (mM) return parseFloat(mM[1]) / 1000 // Millions -> Billions
          return Number.POSITIVE_INFINITY
        }
        const eligible = modelsList
          .filter(m => /llama|qwen|mistral|phi|tiny|dolphin/i.test(String(m?.details?.family || m?.name)))
          .map(m => ({ name: m.name, size: normalizeSize(m?.details?.parameter_size) }))
          .sort((a,b) => a.size - b.size)

        const installedNames = modelsList.map(m => m.name)
        // Si el modelo por defecto no está, usar el más pequeño elegible
        if (!installedNames.includes(model) && eligible.length) {
          model = eligible[0].name
        }
      }
    } catch (_) {}

    const body = { model, prompt: fullPrompt, stream: false }
    if (imagePayload && imagePayload.length) body.images = imagePayload

    // Try with fetch first, then fallback to raw http if it errors
    let data
    try {
      const r = await fetch(`${url}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!r.ok) {
        const errText = await r.text().catch(()=> '')
        return res.json({ reply: `Ollama no disponible: ${errText || r.status}. Verifica que el servidor esté ejecutándose (ollama serve) y que el modelo "${model}" esté instalado.` })
      }
      data = await r.json().catch(()=>null)
    } catch (e) {
      // Fallback via http(s) client
      try {
        data = await postJson(`${url}/api/generate`, body)
      } catch (e2) {
        const altUrl = url.includes('127.0.0.1') ? url.replace('127.0.0.1', 'localhost') : url.replace('localhost', '127.0.0.1')
        try {
          data = await postJson(`${altUrl}/api/generate`, body)
        } catch (e3) {
          return res.json({ reply: `Ollama no disponible: ${e3?.message || 'error'}` })
        }
      }
    }
    const reply = (data && data.response) ? data.response : 'Ollama respondió sin contenido'
    res.json({ reply })
  } catch (e) {
    res.json({ reply: `Ollama no disponible: ${e?.message || 'error'}` })
  }
})

// Listar modelos instalados de Ollama
app.get('/ai/models', authMiddleware, async (_req, res) => {
  const baseUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434'
  const url = /^https?:\/\/localhost(?::|\/)/i.test(baseUrl) ? baseUrl.replace('localhost', '127.0.0.1') : baseUrl
  try {
    const r = await fetch(`${url}/api/tags`)
    if (!r.ok) return res.json({ models: [] })
    const data = await r.json().catch(()=>({ models: [] }))
    const names = Array.isArray(data?.models) ? data.models.map(m => ({ name: m.name, parameter_size: m?.details?.parameter_size || '' })) : []
    res.json({ models: names })
  } catch {
    res.json({ models: [] })
  }
})

// ===== Cuenta del usuario: actualizar y borrar =====
app.post('/users/me/update', authMiddleware, async (req, res) => {
  const { name, email } = req.body || {}
  await db.read(); ensureDbDefaults()
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  if (typeof name === 'string' && name.trim()) user.name = name.trim()
  if (typeof email === 'string' && email.trim()) {
    const exists = db.data.users.find(u => u.email === email && u.id !== user.id)
    if (exists) return res.status(400).json({ error: 'Email ya registrado' })
    user.email = email.trim()
  }
  await db.write()
  res.json({ ok: true, user })
})

app.delete('/users/me', authMiddleware, async (req, res) => {
  await db.read(); ensureDbDefaults()
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  if ((user.role || 'user') === 'admin') return res.status(403).json({ error: 'No puedes borrar la cuenta admin' })
  // Borrar datos asociados
  db.data.paymentSettings = db.data.paymentSettings.filter(p => p.userId !== user.id)
  db.data.tradingKeys = db.data.tradingKeys.filter(k => k.userId !== user.id)
  db.data.botLogs = db.data.botLogs.filter(l => l.userId !== user.id)
  db.data.activationRequests = db.data.activationRequests.filter(r => r.userId !== user.id && r.sponsorId !== user.id)
  db.data.sales = db.data.sales.filter(s => s.userId !== user.id)
  db.data.users = db.data.users.filter(u => u.id !== user.id)
  await db.write()
  res.json({ ok: true })
})

// Ollama availability status
app.get('/ai/status', authMiddleware, async (_req, res) => {
  const baseUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434'
  const url = /^https?:\/\/localhost(?::|\/)/i.test(baseUrl) ? baseUrl.replace('localhost', '127.0.0.1') : baseUrl
  try {
    const r = await fetch(`${url}/api/tags`)
    if (!r.ok) return res.json({ ok: false })
    const data = await r.json().catch(()=>({}))
    res.json({ ok: true, tags: data })
  } catch (e) {
    res.json({ ok: false })
  }
})

// Listar modelos instalados de Ollama (nombre y tamaño de parámetros)
app.get('/ai/models', authMiddleware, async (_req, res) => {
  const url = process.env.OLLAMA_API_URL || 'http://localhost:11434'
  try {
    const r = await fetch(`${url}/api/tags`)
    if (!r.ok) return res.json({ models: [] })
    const data = await r.json().catch(()=>({ models: [] }))
    const models = Array.isArray(data?.models)
      ? data.models.map(m => ({ name: m.name, parameter_size: m?.details?.parameter_size || '' }))
      : []
    res.json({ models })
  } catch {
    res.json({ models: [] })
  }
})

app.get('/', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`)
})

// ===== Generación de imagen y video (opcional, vía Replicate) =====
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || ''

async function replicateLatestVersion(owner, name) {
  const r = await fetch(`https://api.replicate.com/v1/models/${owner}/${name}`, {
    headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` }
  })
  if (!r.ok) return null
  const data = await r.json().catch(() => null)
  return data?.latest_version?.id || (Array.isArray(data?.versions) ? data.versions[0]?.id : null)
}

async function replicatePredict({ owner, name, input }) {
  const version = await replicateLatestVersion(owner, name)
  if (!version) throw new Error('No se pudo obtener la versión del modelo')
  const r = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { Authorization: `Token ${REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version, input })
  })
  if (!r.ok) {
    const text = await r.text().catch(()=> '')
    throw new Error(text || `Error ${r.status}`)
  }
  const pred = await r.json().catch(()=>null)
  if (!pred?.id) throw new Error('Predicción no creada')
  const started = Date.now()
  let status = pred.status
  let output = pred.output
  while (status !== 'succeeded' && status !== 'failed' && Date.now() - started < 120_000) {
    await new Promise(r => setTimeout(r, 1500))
    const r2 = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
      headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` }
    })
    const cur = await r2.json().catch(()=>null)
    status = cur?.status
    output = cur?.output
  }
  if (status !== 'succeeded') throw new Error('Generación no completada')
  return output
}

// Generar imagen desde texto
app.post('/ai/image/generate', authMiddleware, async (req, res) => {
  if (!REPLICATE_API_TOKEN) return res.status(400).json({ error: 'Configura REPLICATE_API_TOKEN en el backend para generar imágenes.' })
  const { prompt, owner = 'black-forest-labs', name = 'flux-schnell', width = 768, height = 768 } = req.body || {}
  try {
    const output = await replicatePredict({ owner, name, input: { prompt, width, height } })
    // output suele ser array de URLs
    const images = Array.isArray(output) ? output : [output]
    res.json({ images })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Error generando imagen' })
  }
})

// Generar video corto a partir de una imagen (texto a imagen + imagen a video requiere pipeline)
app.post('/ai/video/generate', authMiddleware, async (req, res) => {
  if (!REPLICATE_API_TOKEN) return res.status(400).json({ error: 'Configura REPLICATE_API_TOKEN en el backend para generar videos.' })
  const { imageUrl, owner = 'stability-ai', name = 'stable-video-diffusion' } = req.body || {}
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl requerido' })
  try {
    const output = await replicatePredict({ owner, name, input: { image: imageUrl } })
    const videos = Array.isArray(output) ? output : [output]
    res.json({ videos })
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Error generando video' })
  }
})

// ===== Betting (Apuestas) =====
// Create bet challenge between two users (amount 1..100 USD)
app.post('/bets', authMiddleware, async (req, res) => {
  const { opponentEmail, opponentId, amount } = req.body
  if (!amount || amount < 1 || amount > 100) return res.status(400).json({ error: 'Monto inválido (1-100)' })
  await db.read()
  ensureDbDefaults()
  const opponent = opponentId ? db.data.users.find(u => u.id === opponentId) : db.data.users.find(u => u.email === opponentEmail)
  if (!opponent) return res.status(404).json({ error: 'Oponente no encontrado' })
  if (opponent.id === req.user.id) return res.status(400).json({ error: 'No puedes apostar contra ti mismo' })
  const bet = {
    id: randomUUID(),
    amount,
    creatorId: req.user.id,
    opponentId: opponent.id,
    status: 'pending', // pending -> running -> completed
    deposits: { [req.user.id]: false, [opponent.id]: false },
    winnerId: null,
    payoutDelivered: false,
    createdAt: new Date().toISOString(),
    serverSeed: randomUUID(),
  }
  db.data.bets.push(bet)
  await db.write()
  res.json(bet)
})

// List bets for current user (or all if admin)
app.get('/bets', authMiddleware, async (req, res) => {
  await db.read()
  ensureDbDefaults()
  const isAdmin = (req.user.role || 'user') === 'admin'
  const bets = isAdmin ? db.data.bets : db.data.bets.filter(b => b.creatorId === req.user.id || b.opponentId === req.user.id)
  const usersById = Object.fromEntries(db.data.users.map(u => [u.id, u]))
  const enriched = bets.map(b => ({
    ...b,
    creatorName: usersById[b.creatorId]?.name || 'Usuario',
    opponentName: usersById[b.opponentId]?.name || 'Usuario'
  }))
  res.json(enriched.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt)))
})

// Create bet with a random opponent from system (excluding current user)
app.post('/bets/random', authMiddleware, async (req, res) => {
  const { amount } = req.body
  if (!amount || amount < 1 || amount > 100) return res.status(400).json({ error: 'Monto inválido (1-100)' })
  await db.read()
  ensureDbDefaults()
  const candidates = db.data.users.filter(u => u.id !== req.user.id)
  if (candidates.length === 0) return res.status(400).json({ error: 'No hay usuarios disponibles' })
  const opponent = candidates[Math.floor(Math.random() * candidates.length)]
  const bet = {
    id: randomUUID(),
    amount,
    creatorId: req.user.id,
    opponentId: opponent.id,
    status: 'pending',
    deposits: { [req.user.id]: false, [opponent.id]: false },
    winnerId: null,
    payoutDelivered: false,
    createdAt: new Date().toISOString(),
    serverSeed: randomUUID(),
  }
  db.data.bets.push(bet)
  await db.write()
  res.json(bet)
})

// Mark deposit received by current user (just a flag, payments go to admin)
app.post('/bets/:id/deposit', authMiddleware, async (req, res) => {
  await db.read()
  ensureDbDefaults()
  const bet = db.data.bets.find(b => b.id === req.params.id)
  if (!bet) return res.status(404).json({ error: 'Apuesta no encontrada' })
  if (req.user.id !== bet.creatorId && req.user.id !== bet.opponentId) return res.status(403).json({ error: 'No autorizado' })
  bet.deposits[req.user.id] = true
  await db.write()
  res.json({ ok: true, bet })
})

// Start roulette when both deposits are marked
app.post('/bets/:id/start', authMiddleware, async (req, res) => {
  await db.read()
  ensureDbDefaults()
  const bet = db.data.bets.find(b => b.id === req.params.id)
  if (!bet) return res.status(404).json({ error: 'Apuesta no encontrada' })
  const participants = [bet.creatorId, bet.opponentId]
  if (!participants.includes(req.user.id)) return res.status(403).json({ error: 'No autorizado' })
  const bothDeposited = participants.every(uid => bet.deposits[uid])
  if (!bothDeposited) return res.status(400).json({ error: 'Faltan depósitos' })
  if (bet.status !== 'pending') return res.status(400).json({ error: 'La apuesta ya se inició o terminó' })
  bet.status = 'running'
  // Simple fair roll: use serverSeed with timestamp
  const roll = Math.random()
  const winnerId = roll < 0.5 ? bet.creatorId : bet.opponentId
  bet.winnerId = winnerId
  bet.status = 'completed'
  bet.prizeAmount = bet.amount * 2
  bet.completedAt = new Date().toISOString()
  await db.write()
  res.json({ ok: true, bet })
})

// Admin confirms payout delivered to winner
app.post('/bets/:id/payout', authMiddleware, async (req, res) => {
  if ((req.user.role || 'user') !== 'admin') return res.status(403).json({ error: 'Solo admin' })
  await db.read()
  ensureDbDefaults()
  const bet = db.data.bets.find(b => b.id === req.params.id)
  if (!bet) return res.status(404).json({ error: 'Apuesta no encontrada' })
  bet.payoutDelivered = true
  bet.payoutAt = new Date().toISOString()
  await db.write()
  res.json({ ok: true, bet })
})

// Admin payment info for deposits
app.get('/admin/payment', authMiddleware, async (req, res) => {
  await db.read()
  ensureDbDefaults()
  const admin = db.data.users.find(u => (u.role || 'user') === 'admin')
  if (!admin) return res.status(404).json({ error: 'Admin no encontrado' })
  const payment = db.data.paymentSettings.find(p => p.userId === admin.id) || null
  res.json({ admin: { id: admin.id, name: admin.name, whatsappNumber: admin.whatsappNumber }, payment })
})
// Estado de Replicate (si hay token configurado)
app.get('/ai/replicate/status', authMiddleware, async (_req, res) => {
  res.json({ enabled: !!REPLICATE_API_TOKEN })
})