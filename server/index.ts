import 'dotenv/config'
import express from 'express'
import { PORT } from './env.js'

export const app = express()
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`)
  })
}
