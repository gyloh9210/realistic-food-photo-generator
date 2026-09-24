# TODO

## Dedup reference-photo search results (Openverse / Wikimedia)

**Problem:** Openverse and Wikimedia sometimes return the same underlying
photo under two different URLs (both providers indexing the same original,
or a mirrored copy), so the human reviewer can see what looks like the same
picture twice. Exact-URL dedup already exists in
`findReferenceCandidates` (`server/search/index.ts`), but it only catches
literal string-identical `sourceUrl`s, not the same photo at a different URL.

**Planned fix:** exact-content dedup — hash the downloaded bytes (SHA-256,
via Node's built-in `crypto`, no new dependency) and drop any candidate
whose content is byte-identical to one already kept (either an
already-`approved` image from a prior round, or another candidate
downloaded in the same batch). Deliberately does *not* attempt
near-duplicate/perceptual dedup (different resolutions, crops, or
re-encodes of the same photo) — see "Future enhancement" below.

**Approach (already designed, not yet implemented):**
1. `downloadImage` (`server/search/download.ts`) returns the SHA-256 hash of
   the bytes it just wrote (signature changes `Promise<void>` →
   `Promise<string>`), hashed from the in-memory buffer, no extra file read.
2. New `server/search/hash.ts` — `hashBuffer(buffer)` and
   `hashFile(filePath)` — small, dedup-specific, no new dependency.
3. `searchReferences.ts` (`server/graph/nodes/`) hashes already-approved
   images from disk to seed a "seen" set, then drops any newly-downloaded
   candidate whose hash is already in that set (logging a count, not
   throwing) before returning.
4. No top-up-after-dedup loop — a dropped duplicate just means the round
   can end with fewer than 5 candidates, same as a failed download does
   today (consistent with the project's "fewer than needed is not an
   error" rule).
5. Related small fix in the same change: `findReferenceCandidates` is
   currently only told to exclude previously-*rejected* URLs; it should
   also exclude URLs already `approved`/`pending` in the current state, so
   a fresh search can't hand back a URL we already have.

**Files:** new `server/search/hash.ts`; modify `server/search/download.ts`,
`server/graph/nodes/searchReferences.ts`, and their test files
(`searchReferences.test.ts` needs care — several existing tests mock
`downloadImage` to resolve the same value for every call, which would need
to become per-URL-unique hashes once dedup is in place, or the new logic
will wrongly collapse distinct candidates; `graph/build.test.ts`'s
multi-round integration test has the same issue and doesn't yet mock
`search/hash.js` at all).

**Verification:** `npm run typecheck`, then
`npx vitest run server/search/hash.test.ts server/search/download.test.ts server/graph/nodes/searchReferences.test.ts server/graph/build.test.ts`,
then the full `npm test`.

**Future enhancement (out of scope for the above):** near-duplicate /
perceptual dedup (catching resized, cropped, or re-encoded copies of the
same photo) would need a new image-processing dependency and a
perceptual-hash + distance-threshold comparison — a materially bigger
change, worth revisiting only if exact-content dedup proves insufficient.
