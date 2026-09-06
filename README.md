# Risk Radar

An AI agent for Slack that turns unstructured team conversation into structured project intelligence: blockers, dependencies, deadline risk, untracked ("ghost") work, and decision drift — each backed by real evidence, never fabricated.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · PostgreSQL · Prisma · Slack Web API · Stripe · pluggable LLM provider (OpenAI / Anthropic / mock).

## Architecture

```
src/
  app/            UI pages (App Router) + API route handlers
  components/     UI (dashboard, landing, ui primitives)
  lib/
    auth.ts, auth/workspace.ts   NextAuth + workspace-scoped authorization
    slack/                       OAuth, signature verification, client, event/mention handling
    ai/                          Provider abstraction (mock/openai/anthropic), prompts, schema validation
    risk-engine/                 Analysis orchestration, task creation
    billing/                     Stripe client, plan definitions, server-side entitlement checks
    integrations/                GitHub (Jira/Linear can implement the same TaskTrackerIntegration interface)
    jobs/                        Background job enqueue (worker in scripts/worker.ts)
    utils/                       Rate limiting, audit logging, API error mapping
prisma/
  schema.prisma   All data models
  seed.ts         Demo data (see "Demo mode" below)
scripts/
  worker.ts       Polls for pending AnalysisRun jobs and processes them
```

Analysis never runs inline in an HTTP request — API routes enqueue an `AnalysisRun` row and return immediately; `npm run worker` (a separate process) picks it up. This is what "background jobs for Slack analysis" means here: a deliberately simple DB-polling queue rather than Redis/BullMQ, chosen so the MVP has one fewer piece of infrastructure to run locally. The enqueue/consume boundary (`lib/jobs/queue.ts` + `scripts/worker.ts`) is where a real queue would slot in later without touching call sites.

## Demo mode (no Slack, no LLM key, no Stripe required)

Everything below works with real credentials, but you can explore the full dashboard without any of them:

```bash
cp .env.example .env
# leave DEMO_MODE=true and AI_PROVIDER=mock (the defaults)
docker compose up -d          # starts Postgres
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Sign in with **demo@riskradar.dev / demopassword123** — the seeded workspace already has example risks (the payment-launch scenario from the product spec, a Ghost Work finding, and a Decision Drift finding) so the dashboard has content immediately.

`DEMO_MODE=true` forces the AI provider to the deterministic, keyword-based `MockAIProvider` (`src/lib/ai/providers/mock.ts`) regardless of `AI_PROVIDER` — no network calls, no API key.

## Full local setup

### 1. Database

```bash
docker compose up -d
npm run db:migrate
```

### 2. Encryption key

Slack/GitHub tokens are encrypted at rest (AES-256-GCM). Generate a key and put it in `.env`:

```bash
openssl rand -hex 32
```

### 3. Slack app

1. Create an app at https://api.slack.com/apps ("From scratch").
2. **OAuth & Permissions** → Redirect URL: `{APP_URL}/api/slack/oauth/callback`.
3. **OAuth & Permissions** → Bot Token Scopes: `channels:history`, `channels:read`, `groups:history`, `groups:read`, `chat:write`, `commands`, `app_mentions:read`, `users:read`. (Kept intentionally minimal — see `src/lib/slack/oauth.ts` for why each scope exists.)
4. **Slash Commands** → Create `/risk` → Request URL: `{APP_URL}/api/slack/commands`.
5. **Event Subscriptions** → enable, Request URL: `{APP_URL}/api/slack/events` → Subscribe to bot events: `app_mention`, `message.channels`.
6. **Basic Information** → copy the **Signing Secret** → `SLACK_SIGNING_SECRET`.
7. **OAuth & Permissions** → copy **Client ID** / **Client Secret** → `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`.
8. Set `AI_PROVIDER=openai` or `anthropic` and `DEMO_MODE=false` once you're ready to analyze real messages.

In local dev, Slack needs a public URL to reach your machine — use a tunnel (e.g. `ngrok http 3000`) and set `APP_URL` to the tunnel URL.

### 4. LLM provider

Set one of:

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
# or
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

Providers implement `src/lib/ai/types.ts#AIProvider` — adding a new one is a new file in `src/lib/ai/providers/` plus one line in `src/lib/ai/provider.ts`.

### 5. Stripe

1. Create two recurring Prices in test mode (Pro $29/mo, Business $99/mo) → put their IDs in `STRIPE_PRICE_PRO_MONTHLY` / `STRIPE_PRICE_BUSINESS_MONTHLY`.
2. `STRIPE_SECRET_KEY` from the Stripe dashboard (test mode).
3. Webhook: `stripe listen --forward-to localhost:3000/api/stripe/webhook` locally, or add a dashboard webhook endpoint pointed at `{APP_URL}/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`. Put the signing secret it gives you in `STRIPE_WEBHOOK_SECRET`.

Subscription status is **always** read server-side from the database (`src/lib/billing/entitlement.ts`), never trusted from the client or from a Stripe redirect URL.

### 6. GitHub OAuth (optional, Pro/Business only)

Create an OAuth App at https://github.com/settings/developers, callback URL `{APP_URL}/api/github/oauth/callback`, put the Client ID/Secret in `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.

### 7. Run it

```bash
npm run dev      # Next.js app
npm run worker   # background analysis worker — run alongside dev in a second terminal
```

## Testing

```bash
npm test
```

Covers Slack signature verification, AI schema validation/evidence-grounding, entitlement/usage-limit logic, workspace tenant isolation, and Stripe webhook event mapping — see `tests/`.

## Deployment notes

- Run `npm run build && npm start` for the web process, and `npm run worker` as a **separate** long-running process/container — both need the same env vars and DB connection.
- `npm run db:deploy` applies migrations without prompting (use in CI/CD instead of `db:migrate`).
- Point the Stripe webhook and Slack app's Request URLs at your production `APP_URL` before going live.
