ARG APPVIEW_IMAGE=ghcr.io/ashex/atproto-containers/appview:latest
FROM ${APPVIEW_IMAGE}
COPY --chown=node:node dataplane.mjs /app/services/bsky/dataplane.mjs
EXPOSE 3001
CMD ["node", "--enable-source-maps", "dataplane.mjs"]
