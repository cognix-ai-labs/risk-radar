import Link from 'next/link';
import { ArrowRight, Github, Ghost, GitBranch, ShieldCheck, Lock, KeyRound, Eye, PlayCircle } from 'lucide-react';
import { LandingNav } from '@/components/landing/landing-nav';
import { SlackMockup } from '@/components/landing/slack-mockup';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SeverityBadge } from '@/components/ui/badge';

export default function LandingPage() {
  return (
    <div className="bg-background">
      <LandingNav />
      <Hero />
      <HowItWorks />
      <ExampleDetection />
      <GhostWorkSection />
      <DecisionDriftSection />
      <GitHubSection />
      <Pricing />
      <Security />
      <FAQ />
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20 pt-20 md:pt-28">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div>
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Now analyzing Slack conversations in real time
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Catch project risks before they become delays.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            Risk Radar turns Slack conversations into early warnings, actionable insights, and project intelligence.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/register">
              <Button size="lg">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button size="lg" variant="outline">
                <PlayCircle className="h-4 w-4" />
                See How It Works
              </Button>
            </a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">14-day free trial · No credit card required</p>
        </div>

        <SlackMockup
          className="animate-fade-in"
          channel="payment-launch"
          messages={[
            { name: 'Priya', color: 'indigo', time: '9:14 AM', text: 'The payment API is still not ready.' },
            { name: 'Marcus', color: 'rose', time: '9:16 AM', text: "QA can't test because staging is broken." },
            { name: 'Dana', color: 'amber', time: '9:20 AM', text: 'Waiting for design approval.' },
            { name: 'Priya', color: 'indigo', time: '9:41 AM', text: 'Can we move the launch?' },
          ]}
        />
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h2>
      {description && <p className="mt-3 text-muted-foreground">{description}</p>}
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { title: 'Connect Slack', description: 'Install Risk Radar and choose exactly which channels it can read.' },
    { title: 'It listens, quietly', description: 'No bots interrupting standups — Risk Radar reads conversation the way a sharp PM would.' },
    { title: 'Get proactive alerts', description: 'Risks, blockers, and untracked work land in your dashboard and Slack — before they become delays.' },
  ];

  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20">
      <SectionHeading
        eyebrow="How it works"
        title="From scattered messages to project intelligence"
        description="Risk Radar isn't a chatbot you have to ask. It proactively turns unstructured conversation into structured, evidence-backed findings."
      />
      <div className="grid gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <Card key={s.title}>
            <CardContent className="p-6">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {i + 1}
              </div>
              <h3 className="mb-1.5 font-semibold">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function ExampleDetection() {
  return (
    <section className="border-y border-border bg-muted/30 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Example risk detection"
          title="Real conversation in, structured risk out"
          description="Every finding cites the exact messages that produced it — nothing is fabricated."
        />
        <div className="grid items-center gap-8 md:grid-cols-2">
          <SlackMockup
            channel="payment-launch"
            messages={[
              { name: 'Priya', color: 'indigo', time: '9:14 AM', text: 'The payment API is still not ready.' },
              { name: 'Marcus', color: 'rose', time: '9:16 AM', text: "QA can't test because staging is broken." },
              { name: 'Dana', color: 'amber', time: '9:20 AM', text: 'Waiting for design approval.' },
              { name: 'Priya', color: 'indigo', time: '9:41 AM', text: 'Can we move the launch?' },
            ]}
          />

          <Card className="border-high/30">
            <CardContent className="p-6">
              <div className="mb-3 flex items-center gap-2">
                <SeverityBadge severity="High" />
                <span className="text-xs font-medium text-muted-foreground">Payment Launch</span>
              </div>
              <p className="mb-1 text-sm font-semibold">Multiple unresolved dependencies indicate a potential launch delay.</p>
              <p className="mb-4 text-xs text-muted-foreground">There is a high likelihood of delay based on 3 unresolved dependencies.</p>

              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Signals</p>
              <ul className="mb-4 space-y-1 text-sm">
                <li>• Payment API blocked</li>
                <li>• QA environment unavailable</li>
                <li>• Design approval pending</li>
              </ul>

              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended actions</p>
              <ul className="space-y-1 text-sm">
                <li>• Assign API blocker</li>
                <li>• Escalate staging issue</li>
                <li>• Confirm design approval</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

function GhostWorkSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Ghost className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Ghost Work detection</h2>
          <p className="mt-3 text-muted-foreground">
            Real effort that never becomes a ticket is invisible to every project tool except the conversation where
            it happened. Risk Radar surfaces it — with a confidence level, never a false claim.
          </p>
        </div>
        <SlackMockup
          channel="backend-eng"
          messages={[
            { name: 'Rahul', color: 'sky', time: '2:03 PM', text: 'Still debugging the payment API.' },
            { name: 'Rahul', color: 'sky', time: '4:47 PM', text: 'Spent most of today trying to reproduce it.' },
            { name: 'Rahul', color: 'sky', time: '4:48 PM', text: 'No ticket exists for this.' },
          ]}
        />
      </div>
      <Card className="mt-8 border-medium/30">
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <Ghost className="h-5 w-5 text-medium" />
            <div>
              <p className="text-sm font-semibold">Ghost Work Detected — 62% confidence</p>
              <p className="text-sm text-muted-foreground">Rahul appears to be spending significant time investigating the payment API issue.</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="shrink-0">Create task</Button>
        </CardContent>
      </Card>
    </section>
  );
}

function DecisionDriftSection() {
  return (
    <section className="border-y border-border bg-muted/30 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <SlackMockup
            channel="product"
            messages={[
              { name: 'Dana', color: 'amber', time: 'Mon', text: "Let's lock the pricing page at 3 tiers. Decided." },
              { name: 'Marcus', color: 'rose', time: 'Wed', text: "Actually, didn't we already decide on 4 tiers back in March?" },
              { name: 'Dana', color: 'amber', time: 'Wed', text: 'Hmm, let me re-check with the team.' },
            ]}
          />
          <div>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GitBranch className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Decision Drift</h2>
            <p className="mt-3 text-muted-foreground">
              Decisions quietly re-open all the time — in a different thread, days later, with nobody noticing until
              it costs real rework. Risk Radar flags it while it&rsquo;s still cheap to fix.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function GitHubSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Github className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Turn a risk into a GitHub issue in one click</h2>
          <p className="mt-3 text-muted-foreground">
            Every recommended action can become a real GitHub issue — pre-filled with the evidence and Slack context
            that produced it. Jira and Linear are next.
          </p>
        </div>
        <Card>
          <CardContent className="p-5">
            <p className="mb-1 text-xs font-medium text-muted-foreground">github.com/acme/payments · new issue</p>
            <p className="mb-3 font-semibold">[Risk Radar] Assign API blocker</p>
            <p className="mb-3 text-sm text-muted-foreground">
              There is a high likelihood of delay based on 3 unresolved dependencies for the Payment Launch project.
            </p>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence from Slack</p>
            <blockquote className="mb-3 border-l-2 border-border pl-3 text-sm text-muted-foreground">
              &ldquo;The payment API is still not ready.&rdquo;
            </blockquote>
            <p className="text-xs text-muted-foreground">Created automatically by Risk Radar.</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    { name: 'Free Trial', price: '$0', period: '14 days', features: ['1 Slack workspace', '3 channels', 'Limited AI analyses'] },
    {
      name: 'Pro',
      price: '$29',
      period: '/month',
      features: ['More channels', 'Unlimited analysis (fair use)', 'Ghost Work detection', 'Decision Drift', 'GitHub integration'],
      highlight: true,
    },
    {
      name: 'Business',
      price: '$99',
      period: '/month',
      features: ['Multiple teams/projects', 'Advanced analytics', 'Higher limits', 'Priority support', 'Admin controls'],
    },
  ];

  return (
    <section id="pricing" className="border-y border-border bg-muted/30 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading eyebrow="Pricing" title="Simple, predictable pricing" description="Start free. Upgrade when Risk Radar is already saving you time." />
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.name} className={p.highlight ? 'border-primary ring-1 ring-primary' : undefined}>
              <CardContent className="flex flex-col gap-4 p-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{p.name}</p>
                  <p className="text-3xl font-semibold">
                    {p.price} <span className="text-base font-normal text-muted-foreground">{p.period}</span>
                  </p>
                </div>
                <ul className="flex flex-1 flex-col gap-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-low" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button className="w-full" variant={p.highlight ? 'primary' : 'outline'}>
                    Start Free Trial
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function Security() {
  const points = [
    { icon: Lock, title: 'Least-privilege Slack scopes', description: 'We request only the permissions each feature actually needs — nothing more.' },
    { icon: KeyRound, title: 'Encrypted tokens at rest', description: 'Slack and GitHub credentials are encrypted with AES-256-GCM, never logged.' },
    { icon: Eye, title: 'Your data stays yours', description: 'Slack content is never used to train models, and workspaces are fully isolated from each other.' },
  ];

  return (
    <section id="security" className="mx-auto max-w-6xl px-6 py-20">
      <SectionHeading eyebrow="Security" title="Built for sensitive company data" />
      <div className="grid gap-6 md:grid-cols-3">
        {points.map((p) => (
          <Card key={p.title}>
            <CardContent className="p-6">
              <p.icon className="mb-4 h-6 w-6 text-primary" />
              <h3 className="mb-1.5 font-semibold">{p.title}</h3>
              <p className="text-sm text-muted-foreground">{p.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    { q: 'Does Risk Radar post noisy messages in every channel?', a: 'No — it posts findings only where you ask it to (via /risk, @RiskRadar, or the dashboard), and reads only channels you explicitly select.' },
    { q: 'Will it ever invent a risk that never happened?', a: "Every finding must cite real Slack messages as evidence. If the model can't ground a claim in real conversation, it's dropped before it reaches you." },
    { q: 'Can I disconnect Slack and delete my data?', a: 'Yes, anytime, from Settings → Integrations. Disconnecting deletes stored messages and channel data immediately.' },
    { q: 'Is my Slack data used to train AI models?', a: 'No. Your conversations are never used for model training, by us or by our AI provider.' },
  ];

  return (
    <section id="faq" className="border-t border-border py-20">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />
        <div className="divide-y divide-border rounded-2xl border border-border">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="cursor-pointer list-none font-medium marker:content-none">{f.q}</summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} Risk Radar.</span>
        <div className="flex gap-6">
          <Link href="/login">Sign in</Link>
          <a href="#security">Security</a>
          <a href="#faq">FAQ</a>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
