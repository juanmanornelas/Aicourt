import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000
const DATA_DIR = fs.existsSync('/data') ? '/data' : __dirname
const DATA_FILE = path.join(DATA_DIR, 'pettite-court.json')
const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000

app.use(cors())
app.use(express.json({ limit: '20mb' }))

function readStore() {
  if (!fs.existsSync(DATA_FILE)) return {}
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) }
  catch(e) { return {} }
}

function writeStore(store) {
  try { if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, DATA_FILE + '.bak') } catch(e) {}
  fs.writeFileSync(DATA_FILE, JSON.stringify(store))
}

function purgeOldCases() {
  const store = readStore()
  const now = Date.now()
  let removed = 0
  for (const id of Object.keys(store)) {
    if (now - new Date(store[id].filedAt).getTime() > THREE_MONTHS_MS) {
      delete store[id]
      removed++
    }
  }
  if (removed > 0) { writeStore(store); console.log(`Purged ${removed} old case(s)`) }
}

purgeOldCases()
setInterval(purgeOldCases, 24 * 60 * 60 * 1000)

app.get('/', (req, res) => {
  res.json({ status: 'Pettite Court API is in session', cases: Object.keys(readStore()).length })
})

app.get('/case/:id', (req, res) => {
  try {
    const store = readStore()
    const id = req.params.id.toUpperCase()
    if (!store[id]) return res.status(404).json({ error: 'Case not found' })
    res.json(store[id])
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.post('/case', (req, res) => {
  try {
    const { id, data } = req.body
    if (!id || !data) return res.status(400).json({ error: 'Missing id or data' })
    const store = readStore()
    store[id.toUpperCase()] = { ...data, filedAt: new Date().toISOString() }
    writeStore(store)
    console.log(`CASE FILED: ${id.toUpperCase()}`)
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
})

app.listen(PORT, () => {
  console.log(`Pettite Court server running on port ${PORT}`)
  console.log(`Persistent: ${fs.existsSync('/data') ? 'YES' : 'NO'}`)
})
