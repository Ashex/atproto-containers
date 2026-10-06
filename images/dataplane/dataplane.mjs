import assert from 'node:assert/strict'
import { once } from 'node:events'
import { Database, DataPlaneServer, RepoSubscription, BsyncSubscription } from '@atproto/bsky'

const databaseUrl = process.env.BSKY_DB_POSTGRES_URL
const plcUrl = process.env.BSKY_DID_PLC_URL
const firehoseUrl = process.env.BSKY_REPO_PROVIDER
const bsyncUrl = process.env.BSKY_BSYNC_URL
const port = Number(process.env.BSKY_DATAPLANE_PORT || 3001)
assert(databaseUrl, 'BSKY_DB_POSTGRES_URL is required')
assert(plcUrl, 'BSKY_DID_PLC_URL is required')
assert(firehoseUrl, 'BSKY_REPO_PROVIDER is required')
assert(bsyncUrl, 'BSKY_BSYNC_URL is required')
assert(Number.isInteger(port) && port > 0 && port <= 65535, 'Invalid dataplane port')

const shutdown = new AbortController()
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => shutdown.abort())
}
const database = new Database({
  url: databaseUrl,
  schema: process.env.BSKY_DB_POSTGRES_SCHEMA,
  poolSize: 10,
})
let dataplane
let repositorySubscription
let bsyncSubscription
try {
  await database.migrateToLatestOrThrow()
  dataplane = await DataPlaneServer.create(
    database,
    port,
    plcUrl,
    process.env.BSKY_DISABLE_SSRF_PROTECTION === 'true' ? globalThis.fetch : undefined,
  )
  repositorySubscription = new RepoSubscription({
    db: database,
    service: firehoseUrl,
    idResolver: dataplane.idResolver,
  })
  bsyncSubscription = new BsyncSubscription({
    db: database,
    config: {
      bsyncUrl,
      bsyncApiKey: process.env.BSKY_BSYNC_API_KEY,
      bsyncHttpVersion: process.env.BSKY_BSYNC_HTTP_VERSION || '1.1',
      bsyncIgnoreBadTls: false,
    },
  })
  bsyncSubscription.start()
  await repositorySubscription.start()
  if (!shutdown.signal.aborted) {
    await once(shutdown.signal, 'abort')
  }
} finally {
  const timeout = setTimeout(() => process.exit(1), 15000)
  timeout.unref()
  const results = await Promise.allSettled([
    repositorySubscription?.destroy(),
    bsyncSubscription?.destroy(),
    dataplane?.destroy(),
  ])
  await database.close()
  clearTimeout(timeout)
  if (results.some((result) => result.status === 'rejected')) {
    process.exitCode = 1
  }
}
