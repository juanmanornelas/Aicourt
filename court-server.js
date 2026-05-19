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

const SYSTEM = `You are The Honorable J. Ustice, Chief Justice of the Supreme Court of Petty Disputes. You are completely impartial — the plaintiff has NO advantage for filing the case. You will rule against them without hesitation if their case is weak, if they provoked the situation, or if the defendant's position is more defensible. If a defendant pleaded guilty, acknowledge it but still determine a proportionate remedy.

Treat every case with absolute gravity and zero irony. Heavy legal Latin and courtroom jargon throughout. If photographic evidence was submitted by either party, examine each exhibit carefully and reference it explicitly as Exhibit A, B, C (plaintiff) or Exhibit W, X, Y (defendant).

Format your ruling EXACTLY using these markers:

%%CASE_FILING%%
[Formal case name and number: e.g. "TORRES v. KIM, Case No. SPD-2026-5512 | Supreme Court of Petty Disputes"]

%%CHARGES%%
[1-2 formal charges in dramatic legal language — or a counter-finding against plaintiff if they are in the wrong]

%%PLAINTIFF_OPENING%%
[2-3 sentences presenting the plaintiff's position formally]

%%DEFENSE_OPENING%%
[2-3 sentences presenting the defendant's position — if guilty plea, note this formally]

%%EVIDENCE%%
[3-5 bullet points. Reference any exhibits specifically. Start each with —]

%%DELIBERATION%%
[2-3 sentences of sharp, honest judicial reasoning. Do not pull punches.]

%%VERDICT%%
[GUILTY / NOT GUILTY / PARTIALLY LIABLE / PLAINTIFF IN CONTEMPT — then em dash — then one devastating sentence]

%%REMEDY%%
[Specific, formal, court-ordered remedy. Seriousness of tone makes mundane remedies funnier.]

%%FINAL_WORD%%
[One unforgettable, quotable closing line. Make it hit.]`

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
      delete store[id]; removed++
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

app.post('/verdict', async (req, res) => {
  try {
    const { caseId, userText, plaintiffImgs, defImgs } = req.body

    const imageBlocks = []
    for (const img of (plaintiffImgs || [])) {
      imageBlocks.push({ type: 'image', source: { type: 'base64', media_type: img.type, data: img.data } })
    }
    for (const img of (defImgs || [])) {
      imageBlocks.push({ type: 'image', source: { type: 'base64', media_type: img.type, data: img.data } })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYSTEM,
        messages: [{ role: 'user', content: [...imageBlocks, { type: 'text', text: userText }] }]
      })
    })

    const data = await response.json()
    const raw = data.content?.find(b => b.type === 'text')?.text || ''

    // Parse verdict
    const sections = ["CASE_FILING","CHARGES","PLAINTIFF_OPENING","DEFENSE_OPENING","EVIDENCE","DELIBERATION","VERDICT","REMEDY","FINAL_WORD"]
    const parsed = {}
    sections.forEach((k, i) => {
      const a = `%%${k}%%`, b = sections[i+1] ? `%%${sections[i+1]}%%` : null
      const s = raw.indexOf(a); if (s < 0) return
      parsed[k] = raw.slice(s + a.length, (b && raw.indexOf(b) > -1) ? raw.indexOf(b) : undefined).trim()
    })

    // Save verdict to case
    const store = readStore()
    if (store[caseId]) {
      store[caseId] = { ...store[caseId], status: 'decided', verdict: parsed }
      writeStore(store)
    }

    res.json({ ok: true, verdict: parsed })
  } catch(e) {
    console.error('Verdict error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.listen(PORT, () => {
  console.log(`Pettite Court server running on port ${PORT}`)
  console.log(`Persistent: ${fs.existsSync('/data') ? 'YES' : 'NO'}`)
})
