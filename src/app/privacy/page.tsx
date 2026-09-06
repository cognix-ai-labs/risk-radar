export const metadata = { title: 'Privacy Policy — Risk Radar' };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 prose-sm">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mb-8 text-sm text-muted-foreground">Last updated: {new Date().toISOString().slice(0, 10)}</p>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-foreground/90">
        <section>
          <h2 className="mb-2 text-lg font-semibold">What Risk Radar accesses</h2>
          <p>
            When you connect a Slack workspace, Risk Radar reads messages only in the channels you explicitly
            select during onboarding. We do not read direct messages, and we do not read any channel you have not
            selected. We also read basic workspace and user information (display names) needed to attribute
            findings to the right people and channels.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">How your data is used</h2>
          <p>
            Selected channel messages are analyzed to detect project risks, blockers, untracked work, and related
            findings, which are shown in your dashboard and, if you use them, in Slack via <code>/risk</code> and{' '}
            <code>@RiskRadar</code>. Your Slack content is <strong>never used to train AI models</strong>, by us or
            by any AI provider we call on your behalf.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Where your data goes</h2>
          <p>
            Message text is sent to the AI provider configured for your workspace (OpenAI or Anthropic, or kept
            entirely on our infrastructure if you use the mock/offline analysis mode) solely to produce the risk
            analysis for that request. It is not shared with any other third party, and not sold under any
            circumstances.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Storage and security</h2>
          <p>
            Slack and GitHub access tokens are encrypted at rest (AES-256-GCM) and are never logged. Each
            workspace&rsquo;s data is isolated from every other workspace; access requires an authenticated session tied
            to that specific workspace&rsquo;s membership.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Your control over your data</h2>
          <p>
            You can disconnect Slack at any time from Settings → Integrations. Disconnecting immediately deletes
            all stored Slack messages and channel records for your workspace. Risk findings already generated are
            retained as your workspace&rsquo;s own intelligence output unless you request full deletion by contacting us.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Contact</h2>
          <p>Questions about this policy or a data deletion request: privacy@riskradar.example (replace with your real support address before publishing).</p>
        </section>
      </div>
    </div>
  );
}
