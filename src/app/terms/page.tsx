export const metadata = { title: 'Terms of Service — Risk Radar' };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 prose-sm">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mb-8 text-sm text-muted-foreground">Last updated: {new Date().toISOString().slice(0, 10)}</p>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="mb-2 text-lg font-semibold">The service</h2>
          <p>
            Risk Radar analyzes Slack conversations you authorize it to read and surfaces project risk findings.
            Findings are AI-generated inferences based on conversation content and should be treated as decision
            support, not as guaranteed fact — always distinguish an observed statement from an inferred risk.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Accounts and workspaces</h2>
          <p>
            You must have authority to connect the Slack workspace you install Risk Radar into. You are responsible
            for the accuracy of information your team posts in Slack and for how your organization acts on Risk
            Radar&rsquo;s findings.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Subscriptions and billing</h2>
          <p>
            Paid plans are billed monthly via Stripe. You can upgrade, downgrade, or cancel at any time from
            Settings → Billing. Cancelling stops future billing; access continues until the end of the current
            billing period. We do not store your card details — Stripe handles all payment data.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Acceptable use</h2>
          <p>
            Don&apos;t use Risk Radar to process data you don&apos;t have the right to process, to attempt to disrupt the
            service, or to circumvent plan limits. We may suspend accounts that violate this.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Disclaimer</h2>
          <p>
            Risk Radar is provided &ldquo;as is.&rdquo; AI-generated findings can be incomplete or wrong; they are not
            a substitute for your own project judgment. We are not liable for decisions made based on Risk
            Radar&rsquo;s output.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Contact</h2>
          <p>legal@riskradar.example (replace with your real support address before publishing).</p>
        </section>
      </div>
    </div>
  );
}
