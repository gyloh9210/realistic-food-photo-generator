export function RunContext(props: { prompt: string }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">Describe a dish</h2>
      <p>{props.prompt}</p>
    </section>
  )
}

export function RunGenerationPrompt(props: { generationPrompt: string }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">Prompt used for image</h2>
      <p className="text-muted-foreground">{props.generationPrompt}</p>
    </section>
  )
}
