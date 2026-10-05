# AT Protocol service containers

Daily container builds for AT Protocol and Bluesky services. Images are built
from upstream `main` and run on `linux/amd64`.

## Available images

All images use the prefix `ghcr.io/ashex/atproto-containers/`.

| Image | Purpose | Source repository |
| --- | --- | --- |
| `relay` | Collects repository events from PDS instances and serves a firehose | bluesky-social/indigo |
| `rainbow` | Distributes and buffers events from a Relay | bluesky-social/indigo |
| `jetstream` | Provides a JSON event stream and repository archive | bluesky-social/jetstream |
| `appview` | Serves Bluesky application APIs | bluesky-social/atproto |
| `bsync` | Stores and distributes AppView synchronization operations | bluesky-social/atproto |
| `plc` | Hosts the PLC identity directory | did-method-plc/did-method-plc |
| `dataplane` | Stores indexed records and supplies data to AppView | Built from the matching AppView image |

PDS images are not built here. Use the official Bluesky PDS releases.

## Tags and retention

Each successful build publishes two tags:

- `YYYYMMDDTHHMMSSZ-<12-character-upstream-commit>`, such as
  `20261005T031700Z-a1b2c3d4e5f6`.
- `latest`, which points to the most recent successful build.

For example:

```sh
docker pull ghcr.io/ashex/atproto-containers/appview:latest
```

Cleanup keeps the newest three image versions for each service. Both tags on
one image refer to the same version. Older timestamp tags are removed with
their image versions, subject to GHCR deletion restrictions.

## Service dependencies

A complete installation needs a PDS, a PLC directory, persistent storage, and
PostgreSQL databases for Bsync and the dataplane. AppView serves the API; it
does not start the dataplane or index incoming repository events itself.
Run the dataplane and Bsync alongside it.

The services connect as follows:

```text
PDS -> Relay -> Rainbow -> Jetstream
          |        |
          +--------+-> Dataplane -> AppView
                          |
                        Bsync

PLC supplies identity resolution to PDS, Relay, Jetstream, and AppView.
```

Rainbow is optional: Jetstream and the dataplane can connect directly to
Relay. Use separate databases for PLC, Bsync, and indexed AppView data; they
can share one PostgreSQL server. PostgreSQL and other infrastructure images
should come from their official releases.

### PLC

Provide a PostgreSQL database and configure:

- `DB_CREDS_JSON`: database connection credentials.
- `DB_MIGRATE_CREDS_JSON`: credentials permitted to create and update tables.
- `ENABLE_MIGRATIONS=true`: apply database migrations at startup.
- `PORT`: listening port, matching the URL used by the other services.

Keep the PostgreSQL data on a persistent volume.

### Relay

Set `RELAY_PLC_HOST` to the PLC directory URL and register the PDS hosts whose
records should be collected. Configure those PDS instances to notify Relay
through `PDS_CRAWLERS`.

Preserve Relay's database and event log across restarts. SQLite is suitable
for small installations; PostgreSQL is also supported.

### Rainbow

Set `RAINBOW_UPSTREAM_HOST` to Relay. Preserve its event cache and cursor
files across restarts.

The collection-list endpoint needs a separate Collectiondir service. That
service is optional and is not included in this image catalog.

### Jetstream

Configure its upstream relay option and `JETSTREAM_PLC_URL` to point to your
Relay and PLC services. Preserve its data directory across restarts.

Local storage mode needs no separate database or object store. Disaggregated
storage mode requires PostgreSQL and an S3-compatible object store.

### Bsync

Configure:

- `BSYNC_DB_POSTGRES_URL`: connection URL for the Bsync database.
- `BSYNC_API_KEYS`: keys accepted from AppView and the dataplane.
- `BSYNC_DB_MIGRATE=true`: apply database migrations at startup.

The API key supplied by each client must match an accepted Bsync key.

### Dataplane

The `dataplane` image runs the data service, repository indexing, and Bsync
subscriptions. It uses the exact AppView image built in the same workflow
job, and both images receive the same timestamp/hash tag.

Configure:

| Variable | Value |
| --- | --- |
| `BSKY_DB_POSTGRES_URL` | Connection URL for the indexed-record database |
| `BSKY_DID_PLC_URL` | PLC directory URL |
| `BSKY_REPO_PROVIDER` | Relay or Rainbow URL |
| `BSKY_BSYNC_URL` | Bsync URL |
| `BSKY_BSYNC_API_KEY` | An API key accepted by Bsync |
| `BSKY_BSYNC_HTTP_VERSION` | `1.1` by default |
| `BSKY_DATAPLANE_PORT` | Listening port, default `3001` |
| `BSKY_DB_POSTGRES_SCHEMA` | Optional database schema |

Database migrations run at startup. Run one instance. The dataplane serves
HTTP/1.1, so configure AppView to use that protocol.

This entrypoint is intended for development and small isolated installations,
not production. Its repository subscription keeps the cursor in memory and
may replay events after a restart. It does not import historical repositories
or provide a production-scale search service.

### AppView

Configure the connections to its data services:

- `BSKY_DATAPLANE_URLS`: dataplane URL.
- `BSKY_DATAPLANE_HTTP_VERSION=1.1`.
- `BSKY_BSYNC_URL`: Bsync URL.
- `BSKY_BSYNC_API_KEY`: an API key accepted by Bsync.
- `BSKY_BSYNC_HTTP_VERSION=1.1`.
- `BSKY_DID_PLC_URL`: PLC directory URL.

Also provide the registered AppView service DID, signing key, and admin
password. Configure the PDS to use that AppView URL and DID.

Private-network identity and PDS resolution need explicit configuration when
running these services on an isolated network. Do not disable SSRF protection
on services exposed to untrusted users.
