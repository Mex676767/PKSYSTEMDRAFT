# Voice reliability on DigitalOcean

The existing tenant APIs and PostgreSQL queues coordinate WebRTC calls. Coturn
on the existing Droplet relays media when direct peer connections cannot work.
Calls still use a peer mesh; this update does not introduce an SFU or increase
the practical group-size limit.

## Changes

- Confirm membership before publishing the joined state or initiating peers.
- Fetch TURN credentials alongside microphone setup, with an eight-second
  credential timeout and the existing STUN fallback.
- Serialize outgoing signals per peer and presence updates across leave/rejoin.
- Poll without overlapping requests; abort reads on teardown and back off during
  outages. Poll signaling every 500 ms while connecting and 1.5 seconds when
  stable. Idle channel occupancy polls every 10 seconds instead of 3 seconds.
- Use `/voice/:channelId/signals/exchange` with an explicit list of acknowledged
  IDs. A lost response leaves messages available for the next request. One
  invalid signal cannot discard the rest of its batch. IDs remain strings to
  preserve PostgreSQL bigint precision.
- Read messages in numeric ID order, reject messages older than 60 seconds, and
  periodically remove abandoned signals older than five minutes. Cleanup removes
  at most 1,000 signals per minute per tenant.
- Retain the old signal endpoint for browsers still running the previous build.
- Retry initial negotiation and release stuck peers so presence discovery can
  establish a fresh connection. Do not log full ICE candidates in the browser.

## Rollout

Deploy the API first, then the frontend: the new client requires the exchange
endpoint. No schema migration or new service is needed. Preserve existing
tenant env files, secrets, uploads, databases, and Coturn configuration. Rebuild
only `c9-api` and `c6-api` using the existing `digitalocean` Compose project.

The public frontends continue to use their own tenant's proxied `/api` routes.
Never route callers across C9 and C6. Keep the current voice access restriction.

## Validation

- Run `pnpm --filter @workspace/api-server test` and
  `pnpm --filter @workspace/engagement-hub test:voice`.
- Run both app type checks and production builds (frontend needs `PORT` and
  `BASE_PATH=/`).
- With the local Vite server running, open `/tests/voice-channel.html` and click
  **Run two-client test**. It uses synthetic microphones and real local WebRTC
  connections, with 900 ms membership writes, 700 ms signaling polls, and a lost
  nonempty response for each caller. It verifies bidirectional audio packets,
  no premature signaling, no overlapping polls, mute/deafen, leave, and rejoin.
- `/tests/voice-media.html` covers the existing bidirectional screen sender.
- Production acceptance still requires two distinct approved accounts in the
  same tenant, preferably on different networks: join, hear both directions,
  mute/deafen, share a screen, switch channels, and recover after a brief network
  outage. Local synthetic tests do not prove real-network TURN traversal or
  human-perceived audio quality.

For rollback, restore the prior frontend first, then the prior API image. The
old frontend works against either API; the new frontend needs the new API.
