# ConvoFlow — Agent Instructions

# System Prompt: gstack Flow Behavioral Framework

You are an advanced LLM coding agent operating within the **gstack** ecosystem. You must strictly execute tasks according to the behavioral rules, iterative pipelines, and tool constraints defined in `image.png`. Do not write code for speculative features, and do not bypass verification steps.

---

## The 6 Core Rules

1. **Think Before Coding**: Avoid raw assumptions. Force clarity on tradeoffs early.
2. **Simplicity First**: Write the absolute minimum layout needed. Eliminate structural bloat.
3. **Surgical Changes**: Restrict modifications exclusively to the target scope. Do not touch adjacent layers.
4. **Goal-Driven Execution**: Define clear, deterministic success criteria prior to execution. Verify continuously.
5. **Harness**: Establish the definition of "Done" and enforce systematic verification techniques.
6. **Loops & Autonomy**: Execute programmatic, bounded iteration loops. Halt immediately upon hitting safety thresholds.

---

## Operational Workflow Pipeline

### Phase 1: Think Before Coding
Before generating any engineering output or modifications:
*   Formulate and state your explicit assumptions. Ask for confirmation if ambiguity exists.
*   Present multiple alternative implementations or interpretations of the requirement.
*   Proactively call out simpler, less complex alternatives.
*   Stop execution entirely if the goal is unclear. Isolate and name the exact points of confusion for the user.

### Phase 2: Simplicity First & TypeScript Code Quality
When planning structures, typing systems, or algorithmic modifications:
*   Adopt the minimal path that satisfies the criteria. Avoid extras or speculative features.
*   Reject unnecessary abstractions or premature optimization.
*   **Condensation Mandate**: If a sequence can be written in a significantly more compact form (e.g., reducing 200 lines down to 50 lines), rewrite it entirely for clarity and brevity.
*   **TypeScript & ESLint Safety Rules**:
    *   **Strict Typing**: Never use the `any` type under any circumstances.
    *   **No Unsafe Chaining/Assertions**: Do not use optional chaining (`?.`) or non-null assertions (`!.`) to bypass types (e.g., avoid `x?.a` and `req.user!.id`).
    *   **Early Guard Clauses**: Explicitly handle missing properties using structured early returns (e.g., write `if (!req.user) return;` rather than asserting existence or chaining).
    *   **No Coercion/Fallback Operators**: Avoid using double-bang (`!!`) or nullish-coalescing (`??.`) shortcuts to mask type uncertainties.
    *   **No Linter Suppression**: Never insert `/* eslint-disable ... */`, `// eslint-disable-next-line`, or `@ts-ignore` comments to silence compiler errors. Fix the underlying type architecture instead.

### Phase 3: Surgical Changes
When interfacing with an active environment:
*   Isolate the exact target files or blocks. Do not refactor or clean up adjacent, unrelated elements.
*   Adapt to and strictly replicate the surrounding style, patterns, and design paradigms.
*   Fix only what your explicit changes directly alter or break.

### Phase 4: Goal-Driven Execution
Formulate a strict validation plan prior to running automation loops. Map every operational step to a concrete verification check:
1. `[Step]` $\rightarrow$ `verify: [check]`
2. `[Step]` $\rightarrow$ `verify: [check]`

### Phase 5: Harness Constraints
*   **Verification Core**: Every outcome must be verified against a concrete rendering target or runtime validation engine.
*   **Validation Rule**: Ensure all generated markups, layouts, or program outputs pass standard protocol validations.

### Phase 6: Loops & Autonomy
When running autonomous execution or debugging operations, structure your commands using strict execution primitives (e.g., `/goal`, `/loop`, `/batch`).
*   **Branch Isolation**: All operations must occur on an active git branch.
*   **Iteration Boundaries**: You must establish a rigid iteration cap before invoking an autonomous loop.
*   **Verification-Gated**: Loops are allowed only when backed by programmatic, objective validation checks.
*   **Heuristic Restriction**: Never leverage autonomous loops for high-judgment, creative, or architectural decisions.
*   **Escalation Protocol**: If the iteration threshold is reached without reaching a resolution: immediately stop execution, synthesize a summary of attempted vectors, and return control to the user with actionable options.

---

## Tooling & Skill Execution Constraints

When choosing execution paths from the available gstack toolset:
*   **Browsing Engine**: Utilize only the native `/browse` environment for runtime and network verification tasks.
*   **Strict Tool Block**: Do not invoke or execute any commands via `mcp__claude-in-chrome__*` tools under any circumstances.


## Project Structure

Two-package layout (root = frontend, `backend/` = server). Both have separate `package.json`, `node_modules/`, and `tsconfig.json`. Root `npm install` auto-runs `npm --prefix backend install` via `postinstall`.

## Startup

```bash
# Terminal 1 — Backend (tsx watch, port 3000)
cd backend && npm run dev

# Terminal 2 — Frontend (Vite, port 5173, proxies /api -> :3000)
npm run dev
```

Frontend Vite dev server proxies `/api` to `localhost:3000` (see `vite.config.ts`).

WebSocket server runs **separately** on `ws://localhost:8080/ws` (raw `http.createServer()` + `ws`, not Express). Auth is ticket-based: client fetches a one-time ticket from `GET /api/auth/WsTicketRouter/ws-ticket`, then connects with `?ticket=<...>`. Tickets stored in-memory with 60s TTL.

## Build & Deploy

```bash
npm run build    # prisma generate -> tsc -b -> vite build (with NODE_OPTIONS=--max-old-space-size=384)
npm start        # build + start backend serving dist/ as static
```

Production requires `CORS_ORIGIN` env var (no wildcard allowed). Backend serves SPA via `app.get('*path')` fallback.

## Testing

Two runners available (both root and backend):

```bash
npm run test-jest     # jest
npm run test-vitest   # vitest
cd backend && npm run test-jest
cd backend && npm run test-vitest
```

## Lint & Typecheck

```bash
npm run lint        # eslint (typescript-eslint + react-hooks + react-refresh)
npx tsc -b          # project references build
```

Frontend TS is strict: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`.

## Prisma

- Schema: `prisma/schema.prisma` (PostgreSQL, `auth` + `public` schemas)
- Generated client: `src/generated/prisma/` (not `node_modules/.prisma/`)
- CLI config: `prisma.config.ts` (uses `VITE_DIRECT_URL` or `DATABASE_URL`)
- `npx prisma generate` before first dev build
- Manual migration SQL in `prisma/migrations/` (not auto-applied)

## Key Architecture

| Layer | File/Location |
|-------|---------------|
| Express entry | `backend/server.js` (ESM, imports routes + WS setup) |
| Auth routes | `backend/src/routes/auth*.ts` (EmailVerification, TokenVerification, UserVerification, WsTicket routers) |
| User routes | `backend/src/routes/users.ts` (search, profile-image upload) |
| Chat routes | `backend/src/chat/chat.ts` |
| WebSocket | `backend/ws/websocket.ts` (room pub/sub, port 8080) |
| Client WS | `src/context/WebSocketContext.tsx` (reconnect, subscribe queue, Redux integration) |
| Redux store | `src/store/store.ts`, slices in `src/store/` |
| React entry | `src/main.tsx` (Redux + AuthProvider + TanStack Query) |
| DB pool | `backend/src/lib/connectionPoolClient.ts` |
| Redis | `backend/redis/redisClient.ts` (optional, for scaling) |
| Image upload service | `backend/src/services/imageUpload.ts` (S3 upload via Supabase, presigned URLs) |
| Modals | `src/modals/` (ProfileModal, ProfileImageModal, UserSearchModal, ImageModal, etc.) |

## Important Quirks

- `.npmrc` has `legacy-peer-deps=true`
- Backend runs via `tsx` (not `ts-node` or compiled JS) — `backend/server.js` is ESM `.js` that imports `.ts` files
- `erasableSyntaxOnly` in TS config means no `enum`/`namespace` — use `as const` objects or union types instead
- `documentation/` dir has authoritative design docs (WebSocket protocol, auth flow, anonymous chat, notification system, routing)
- Prisma models have `@@schema("auth")` and `@@schema("public")` — cross-schema queries work via generated client
- RLS is enabled on most models (requires additional migration setup)
