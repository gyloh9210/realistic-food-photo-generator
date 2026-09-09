import 'dotenv/config'
import express from 'express'
import { PORT, RUNS_ROOT } from './env.js'
import { runsRouter } from './routes/runs.js'

export const app = express()
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/runs', runsRouter)
app.use('/runs', express.static(RUNS_ROOT))

const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`)
  })
}
