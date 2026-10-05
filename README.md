# AT Protocol bsky service containers

Every day a workflow builds the following containers:


| Service | Upstream repository | Dockerfile | Image |
| --- | --- | --- | --- |
| Relay | bluesky-social/indigo | cmd/relay/Dockerfile | ghcr.io/ashex/atproto-containers/relay |
| Rainbow | bluesky-social/indigo | cmd/rainbow/Dockerfile | ghcr.io/ashex/atproto-containers/rainbow |
| Jetstream | bluesky-social/jetstream | Dockerfile | ghcr.io/ashex/atproto-containers/jetstream |
| AppView | bluesky-social/atproto | services/bsky/Dockerfile | ghcr.io/ashex/atproto-containers/appview |

Images target `linux/amd64` and are built using upstream Dockerfiles with the
upstream repository root as context. Each publication has both:

- `YYYYMMDDTHHMMSSZ-<12-character-upstream-commit>`, for example
  `20261005T031700Z-a1b2c3d4e5f6`.
- `latest`, pointing to the newest successfully published build.

## Retention

The last 3 images of each service are retained.