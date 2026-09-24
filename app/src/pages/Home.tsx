import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRun } from '../api.js'

export function Home() {
  const [prompt, setPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!prompt.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { runId } = await createRun(prompt.trim())
      navigate(`/runs/${runId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start run')
      setSubmitting(false)
    }
  }

  return (
    <main>
      <h1>Food photo, without the AI slop</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="prompt">Describe a dish</label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="nasi lemak with fried chicken"
          rows={3}
        />
        <button type="submit" disabled={submitting || !prompt.trim()}>
          {submitting ? 'Starting…' : 'Generate'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </main>
  )
}
