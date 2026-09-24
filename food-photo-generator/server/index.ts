import './env.js'
import express from 'express'
import { PORT, RUNS_ROOT, RUN_FILES_URL_PREFIX } from './env.js'
import { runsRouter } from './routes/runs.js'

export const app = express()
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/runs', runsRouter)
app.use(RUN_FILES_URL_PREFIX, express.static(RUNS_ROOT))

const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`)
  })
}
