#!/usr/bin/env node
import { readdir } from 'node:fs/promises'
import { SPECS_IN_PROGRESS_DIR, WORKFLOW_ROOT } from '../server/env.js'
import { jobQueue } from '../server/services/jobQueue.js'
import { getJob, listJobs } from '../server/services/registry.js'
import { getGitSummary } from '../server/services/gitStatus.js'
import { listWorktrees } from '../server/services/worktrees.js'
import { slugFromFilename } from '../shared/slug.js'

const [, , command, arg] = process.argv

async function cmdList(): Promise<void> {
  const jobs = await listJobs()
  if (jobs.length === 0) {
    console.log('No jobs.')
    return
  }
  for (const job of jobs) {
    console.log(`${job.id}\t${job.status}\t${job.branch}\t${job.title}`)
  }
}

async function cmdStatus(id: string): Promise<void> {
  const job = await getJob(id)
  if (!job) {
    console.error(`Job not found: ${id}`)
    process.exit(1)
  }
  const git = await getGitSummary(job.worktreePath)
  console.log(JSON.stringify({ job, git }, null, 2))
}

async function cmdReconcile(): Promise<void> {
  const inProgress = await readdir(SPECS_IN_PROGRESS_DIR).catch(() => [] as string[])
  const worktrees = await listWorktrees()
  const jobs = await listJobs()
  console.log(`in-progress specs: ${inProgress.length}`)
  console.log(`worktrees: ${worktrees.length}`)
  console.log(`registry jobs: ${jobs.length}`)
  const jobIds = new Set(jobs.map((j) => j.id))
  for (const file of inProgress) {
    if (!file.endsWith('.md')) continue
    const slug = slugFromFilename(file)
    if (!jobIds.has(slug)) {
      console.warn(`  orphan spec (no job): ${file}`)
    }
  }
}

async function cmdRun(id: string): Promise<void> {
  await jobQueue.retry(id)
  console.log(`Re-queued ${id}`)
}

async function main(): Promise<void> {
  switch (command) {
    case 'list':
      await cmdList()
      break
    case 'status':
      if (!arg) {
        console.error('Usage: npm run feature -- status <job-id>')
        process.exit(1)
      }
      await cmdStatus(arg)
      break
    case 'reconcile':
      await cmdReconcile()
      break
    case 'run':
      if (!arg) {
        console.error('Usage: npm run feature -- run <job-id>')
        process.exit(1)
      }
      await cmdRun(arg)
      break
    default:
      console.log(`Agent workflow CLI (${WORKFLOW_ROOT})`)
      console.log('  npm run feature -- list')
      console.log('  npm run feature -- status <id>')
      console.log('  npm run feature -- reconcile')
      console.log('  npm run feature -- run <id>')
  }
}

void main()
