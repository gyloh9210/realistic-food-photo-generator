import path from 'node:path'
import { screenReferenceImages } from '../../agents/screenReferences.js'
import { getCursorApiKey, runDir } from '../../env.js'
import type { GraphState } from '../state.js'

export async function screenReferencesNode(state: GraphState): Promise<Partial<GraphState>> {
  const unscreened = state.referenceImages.filter((image) => image.cursorNote === undefined)
  if (unscreened.length === 0) {
    return { runStatus: 'paused-references' }
  }

  const notesPath = path.join(runDir(state.runId), 'references', 'notes.json')
  const notes = await screenReferenceImages({
    apiKey: getCursorApiKey(),
    prompt: state.prompt,
    images: unscreened,
    notesPath,
  })

  const referenceImages = state.referenceImages.map((image) =>
    notes[image.id] ? { ...image, cursorNote: notes[image.id] } : image,
  )
  return { referenceImages, runStatus: 'paused-references' }
}
