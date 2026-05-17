import express from 'express'
import pg from 'pg'
import cors from 'cors'

const app = express()
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

app.use(cors({
  origin: ['https://pettitecourt.com', 'https://court-bice.vercel.app', 'http://localhost:5173']
}))
app.use(express.json({ limit: '20mb' }))

// Auto-create table on startup
pool.query(`
  CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).then(() => console.log('Table ready'))
  .catch(e => console.error('Table error:', e))

// Health check
app.get('/', (req, res) => res.json({ status: 'Pettite Court API is in session' }))

// Get a case by ID
app.get('/case/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM cases WHERE id = $1', [req.params.id.toUpperCase()])
    if (!result.rows.length) return res.status(404).json({ error: 'Case not found' })
    res.json(JSON.parse(result.rows[0].data))
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Create or update a case
app.post('/case', async (req, res) => {
  try {
    const { id, data } = req.body
    if (!id || !data) return res.status(400).json({ error: 'Missing id or data' })
    await pool.query(
      `INSERT INTO cases (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = $2`,
      [id.toUpperCase(), JSON.stringify(data)]
    )
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Pettite Court API running on port ${PORT}`))
