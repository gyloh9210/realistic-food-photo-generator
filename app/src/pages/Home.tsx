import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRun } from '../api.js'
import { PageShell } from '@/components/PageShell.js'
import { Alert, AlertDescription } from '@/components/ui/alert.js'
import { Button } from '@/components/ui/button.js'
import { Label } from '@/components/ui/label.js'
import { Textarea } from '@/components/ui/textarea.js'

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
    <PageShell>
      <h1 className="text-2xl font-semibold tracking-tight">Food photo, without the AI slop</h1>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="prompt">Describe a dish</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="nasi lemak with fried chicken"
            rows={3}
          />
        </div>
        <Button type="submit" disabled={submitting || !prompt.trim()}>
          {submitting ? 'Starting…' : 'Generate'}
        </Button>
      </form>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </PageShell>
  )
}
