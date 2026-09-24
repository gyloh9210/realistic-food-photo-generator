import path from 'node:path'
import chokidar, { type FSWatcher } from 'chokidar'
import { READY_SPEC_DIR } from '../env.js'
import { isSpecMarkdownFile, slugFromFilename } from '../../shared/slug.js'
import { hasActiveJob } from './registry.js'
import { appendLog } from './logs.js'
import { moveSpecToInProgress } from './specLifecycle.js'
import type { JobQueue } from './jobQueue.js'
import { stat } from 'node:fs/promises'

const pickingUp = new Set<string>()

async function waitForStableFile(filePath: string, attempts = 5): Promise<void> {
  let last = -1
  for (let i = 0; i < attempts; i++) {
    const s = await stat(filePath)
    if (s.size === last && last >= 0) return
    last = s.size
    await new Promise((r) => setTimeout(r, 200))
  }
}

export function startReadySpecWatcher(queue: JobQueue): FSWatcher {
  const watcher = chokidar.watch(READY_SPEC_DIR, {
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    ignored: (p) => {
      const base = path.basename(p)
      return base === 'README.md' || base.endsWith('.example.md')
    },
  })

  const handle = async (filePath: string) => {
    const filename = path.basename(filePath)
    if (!isSpecMarkdownFile(filename)) return

    let slug: string
    try {
      slug = slugFromFilename(filename)
    } catch {
      return
    }

    if (pickingUp.has(slug)) return
    if (await hasActiveJob(slug)) {
      console.warn(`[agent-workflow] Skipping ${filename}: job ${slug} already active`)
      return
    }

    pickingUp.add(slug)
    try {
      await waitForStableFile(filePath)
      const dest = await moveSpecToInProgress(filename, filePath)
      await appendLog(slug, `Picked up from ready-spec → ${dest}`)
      await queue.enqueueNewFromPickup({ slug, specAbsolutePath: dest, filename })
      console.log(`[agent-workflow] Queued job ${slug} from ${filename}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[agent-workflow] Failed to pick up ${filename}:`, message)
      await appendLog(slug, `Pickup failed: ${message}`).catch(() => {})
    } finally {
      pickingUp.delete(slug)
    }
  }

  watcher.on('add', (p) => void handle(p))
  watcher.on('change', (p) => void handle(p))

  console.log(`[agent-workflow] Watching ${READY_SPEC_DIR}`)
  return watcher
}
