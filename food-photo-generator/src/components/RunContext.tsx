import { Label } from '@/components/ui/label.js'

export function RunContext(props: { prompt: string }) {
  const { prompt } = props
  return (
    <section className="space-y-2">
      <Label className="text-base">Describe a dish</Label>
      <p className="text-muted-foreground">{prompt}</p>
    </section>
  )
}
