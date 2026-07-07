# Connection & Pooling — Guide for Interns

## Goal

Explain how the database connection and pooling currently work, common issues you may see in logs, how to triage them, and concrete steps to fix or improve the system.

## Where to look in the code

- Pool + Prisma adapter: `backend/src/lib/connectionPoolClient.ts`
- Websocket message path: `backend/ws/websocket.ts`
- Auth routes (Prisma heavy): `backend/src/routes/auth*.ts`
- Pool health check: `backend/src/lib/healthCheckPool.ts`
- Graceful shutdown: `backend/src/lib/gracefulShutDown.ts`

## Current architecture (short)

- A single `pg.Pool` is created in `backend/src/lib/connectionPoolClient.ts` and exported as `pool` and `prisma` (PrismaClient).
- `PrismaClient` is constructed with a `PrismaPg` adapter that reuses the same `pg.Pool` instance.
- Two main access patterns share that pool:
  - Direct Prisma ORM via `prisma.*` (used by all routes and websocket message persistence)
  - Raw SQL via `pool.query()` (used sparingly, primarily in health checks)
- Graceful shutdown is implemented: `shutdownDb()` calls `prisma.$disconnect()` then `pool.end()`. Handlers are registered for `SIGINT` and `SIGTERM`.

Symptoms you might see (and what they mean)

- "timeout of 2s exceeded" or "connection timeout": connectionTimeoutMillis is low (2s). Under transient DB latency, new connections fail fast.
- High rate of errors during socket bursts: all pool clients are busy; waiting queue grows -> starvation.
- Long GC pauses or restart spikes: frequent connection churn (short idleTimeoutMillis) can increase reconnection overhead.
- "too many connections" errors on DB server: pool.max or combined app connections may exceed DB limits.

Immediate triage checklist (fast)

1. Reproduce locally with a lightweight load: open many socket connections and send messages in bursts.
2. Tail server logs for DB errors (look for connectionTimeout, ECONNRESET, or PSQL errors).
3. Inspect pool stats at runtime (if instrumented): pool.totalCount, pool.idleCount, pool.waitingCount.
4. Run quick SQL health check: SELECT 1; and check latency.

Quick code pointers (what to change and where)

- Graceful shutdown (already implemented in `backend/src/lib/connectionPoolClient.ts`):
  - `shutdownDb()` calls `prisma.$disconnect()` then `pool.end()`
  - Handlers for `SIGINT` and `SIGTERM` registered
  - Also wired into `server.js`'s shutdown sequence which stops WebSocket before DB

- Instrument pool metrics (backend/src/lib/connectionPoolClient.ts):
  - Expose a helper `getPoolStats()` returning `{ totalCount, idleCount, waitingCount }`.
  - Use prom-client (or the existing `/metrics` endpoint) to expose gauges and a histogram for query latency.

- Websocket path (backend/ws/websocket.ts):
  - Already uses Prisma directly for message persistence (`prisma.standardChatMessages.create`)
  - Avoid long-running synchronous work in socket handlers.
  - Consider buffering messages into an in-memory queue or Redis stream and persisting via a worker.
  - Add limited retries for transient insert failures.

Design options to reduce contention

1) Increase pool.max (only after measuring). Pros: immediate relief; Cons: may exceed DB limits.
2) Isolate pools: run a dedicated pool for high-throughput writes (messages) and keep Prisma using its pool for transactional work. This requires changing where Prisma is used for message inserts (use raw pool for messages).
3) Use an asynchronous write queue/worker: sockets push messages to a queue, a worker performs batched inserts.

Recommended starting config (tune via load tests)

- connectionTimeoutMillis: 5000 ms
- idleTimeoutMillis: 60000 ms (1 min) or 300000 ms (5 min) depending on traffic
- pool.max: start 20-40 depending on DB server capacity — confirm DB limit first

Observability & testing

- Add /health/db endpoint (SELECT 1) for readiness checks.
- Add a /metrics endpoint using prom-client and export pool stats.
- Run k6 or artillery scripts that simulate socket bursts + typical auth flows and collect connection/waiting metrics.

Playbook for interns (starter tasks)

1. Add a small metric: export pool.totalCount, pool.idleCount, pool.waitingCount as a quick Prometheus gauge.
   - This is low-risk, visible, and a good first PR.
2. Add graceful shutdown hooks in the server entry file and validate by restarting the server locally.
3. Create a tiny load test that opens 100 sockets and sends messages in bursts; run it against local env and collect metrics.
4. Implement an insert retry wrapper for websocket writes limited to 2 retries with exponential backoff.

If you see errors while working

- Capture a sample log line, time window, and the related request (socket id or request id) and add it to a new issue.
- Don’t change pool.max without approval — propose a change and include load test evidence.

Where to ask for help

- Open a PR and request review from Senior Backend or the on-call DBA.
- For urgent incidents (production outages), notify the team via the on-call channel and attach logs and metric screenshots.

## Appendix: Useful code references

- `connectionPoolClient.ts`: currently defines pool and prisma; add getPoolStats and instrumentation there.
- `websocket.ts`: WebSocket server message persistence path (quick path to reproduce socket inserts)
- `auth*.ts`: example Prisma usage patterns
- `healthCheckPool.ts`: existing pool health check logic
- `gracefulShutDown.ts`: graceful shutdown orchestration

