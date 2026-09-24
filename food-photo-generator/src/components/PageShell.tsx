import type { ReactNode } from 'react'

export function PageShell(props: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      {props.children}
    </main>
  )
}
