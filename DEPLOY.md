# Risk Radar — deploy & monetize runbook

Slack has no marketplace-billing system like GitHub does — the App Directory is a
discovery listing only. Monetization here is entirely the Stripe integration
already built into the app (`src/lib/billing/*`). This runbook has three
independent tracks: **host the app**, **create and configure the Slack app**,
**go live with Stripe** — plus a final Slack Directory submission once the app
actually works end-to-end.

Several steps below are account-creation, OAuth-app-creation, or
financial-onboarding flows. Those need to be done by you, hands-on, in your own
browser — not because of arbitrary caution, but because (a) they need real
credentials/business info no assistant should handle, and (b) provider
bot-detection reliably blocks scripted submissions on exactly these flows.

---

## 1. Host the app on Railway

1. Create a Railway account at https://railway.app (GitHub login is fastest).
2. **New Project → Deploy from GitHub repo** — push this repo to GitHub first if it isn't already:
   ```bash
   cd "C:\Anthropic\Slack\Risk_Radar"
   git init && git add -A && git commit -m "Initial Risk Radar MVP"
   # create a repo on GitHub, then:
   git remote add origin https://github.com/<you>/risk-radar.git
   git push -u origin main
   ```
3. In the new Railway project, **+ New → Database → PostgreSQL**. Railway gives you a `DATABASE_URL` — copy it.
4. **+ New → GitHub Repo** (same repo) twice, to create two services from the same source:
   - **Service "web"**: Settings → Deploy → Start Command: leave as `npm run start:web` (from `railway.json` — this runs `prisma migrate deploy` before starting, so migrations apply automatically on every deploy).
   - **Service "worker"**: Settings → Deploy → Start Command: override to `npm run worker`.
5. On **both** services, set environment variables (Settings → Variables) — copy every key from `.env.example`. Use the Postgres `DATABASE_URL` from step 3 for both. Generate real values for `NEXTAUTH_SECRET` and `ENCRYPTION_KEY`:
   ```bash
   openssl rand -base64 32   # NEXTAUTH_SECRET
   openssl rand -hex 32      # ENCRYPTION_KEY
   ```
   Set `DEMO_MODE=false` once Slack/AI credentials are in place (leave `true` if you want to keep the demo dashboard live while you finish setup).
6. On the **web** service, Settings → Networking → **Generate Domain**. This gives you a public URL like `risk-radar-production.up.railway.app` (or attach your own custom domain here). This is your `APP_URL` and `NEXTAUTH_URL` — set both env vars to it (with `https://`) on both services, then redeploy.

At this point `https://<your-domain>` should load the landing page.

---

## 2. Create the Slack app

1. Create a Slack workspace (if you don't have one) at https://slack.com/get-started — free, takes a minute. **Do this yourself directly in your browser.**
2. Open [`slack-manifest.json`](slack-manifest.json) in this repo and replace every `REPLACE_WITH_YOUR_DOMAIN` with your real Railway domain from step 1.6.
3. Go to https://api.slack.com/apps → **Create New App → From an app manifest** → select your workspace → paste the edited manifest JSON → **Create**.
4. **Basic Information** → copy the **Signing Secret** → set as `SLACK_SIGNING_SECRET` on both Railway services.
5. **OAuth & Permissions** → copy **Client ID** / **Client Secret** → set as `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` on both services.
6. Redeploy both services so the new env vars take effect.
7. Back in your Risk Radar dashboard (`https://<your-domain>/register`), sign up, then Settings → Integrations → connect Slack, or go through `/dashboard/onboarding`. This exercises the real OAuth flow, event subscription, and slash command against your live deployment.
8. Test `/risk` and `@RiskRadar what do I need to worry about today?` in a channel you selected during onboarding.

If Slack's Event Subscriptions page complains it can't verify the Request URL, redeploy first — Slack calls that URL once immediately to verify it responds correctly.

---

## 3. Go live with Stripe

You said you already have a Stripe account — good, that's the hard part done elsewhere. From here:

1. In Stripe (test mode first), **Products** → create "Risk Radar Pro" ($29/mo recurring) and "Risk Radar Business" ($99/mo recurring). Copy each Price ID.
2. Set `STRIPE_PRICE_PRO_MONTHLY` / `STRIPE_PRICE_BUSINESS_MONTHLY` on both Railway services.
3. Stripe Dashboard → **Developers → Webhooks → Add endpoint** → URL: `https://<your-domain>/api/stripe/webhook` → events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.
4. Set `STRIPE_SECRET_KEY` (test mode `sk_test_...` first) on both services.
5. Test the full loop: Settings → Billing → Upgrade to Pro → complete Stripe test checkout (card `4242 4242 4242 4242`) → confirm the workspace's plan updates and Pro features (Ghost Work, Decision Drift, GitHub) unlock.
6. **Going live**: switch Stripe to live mode, repeat steps 1–4 with live keys/price IDs/webhook. Live mode requires Stripe's own business verification (bank account, tax info) — that's a Stripe-hosted flow only you can complete; nothing in this codebase needs to change for it.

Subscription status is always read server-side (`src/lib/billing/entitlement.ts`) — there's nothing to configure here to keep that safe, it's already how the app works.

---

## 4. Submit to the Slack App Directory

Only do this once steps 1–2 work end-to-end in production — Slack reviews a working app, not a manifest.

1. In your app's Slack API page → **Manage Distribution** → complete the checklist (it will ask for things already true here: OAuth working, no unused scopes, etc.).
2. You'll need: an app icon (512×512 PNG), a short + long description (draft below), a support URL, and — for the Directory specifically — your public **Privacy Policy** and **Terms of Service** URLs, now live at `https://<your-domain>/privacy` and `https://<your-domain>/terms`.
   - **Read those two pages before submitting** — I drafted them from what the app actually does, but they're boilerplate. Get real legal review before this goes in front of Slack's reviewers and real customers, especially given Slack messages are sensitive company data.
3. Submit for review from that same page. Slack's review can take one to a few weeks and may come back with requested changes (most commonly: scope justification, or requiring a support email that actually works).
4. Once approved, the listing is public and installable by any workspace — separately from that, your own Stripe checkout is still what actually charges anyone.

---

## Quick reference: env vars per service

| Variable | web | worker |
|---|---|---|
| `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `APP_URL`, `ENCRYPTION_KEY` | ✅ | ✅ |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` | ✅ | ✅ (worker posts Slack messages too) |
| `AI_PROVIDER`, `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | not required | ✅ (analysis runs in the worker) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | ✅ | not required |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | ✅ | ✅ (worker creates issues on task creation) |
| `DEMO_MODE` | ✅ | ✅ (must match on both) |

Simplest in practice: set the same full variable set on both services rather than tracking which is strictly required where.
