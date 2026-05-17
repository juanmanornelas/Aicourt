import express from 'express'
import pg from 'pg'
import cors from 'cors'

const app = express()
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

app.use(cors())
app.use(express.json({ limit: '20mb' }))

// Create table if it doesn't exist
pool.query(`CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, data TEXT NOT NULL)`)

app.get('/', (req, res) => res.json({ status: 'Pettite Court API is in session' }))

app.get('/case/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM cases WHERE id = $1', [req.params.id])
    if (!result.rows.length) return res.status(404).json({ error: 'Case not found' })
    res.json(JSON.parse(result.rows[0].data))
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

app.post('/case', async (req, res) => {
  try {
    const { id, data } = req.body
    await pool.query(
      `INSERT INTO cases (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2`,
      [id, JSON.stringify(data)]
    )
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
})

app.listen(process.env.PORT || 3000)
