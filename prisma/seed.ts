import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data...');

  const passwordHash = await bcrypt.hash('demopassword123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'demo@riskradar.dev' },
    update: {},
    create: { email: 'demo@riskradar.dev', name: 'Demo User', passwordHash },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: { name: 'Acme Inc (Demo)', slug: 'demo-workspace', ownerId: user.id },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: {},
    create: { workspaceId: workspace.id, userId: user.id, role: 'OWNER' },
  });

  await prisma.subscription.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: {
      workspaceId: workspace.id,
      plan: 'PRO',
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const project = await prisma.project.upsert({
    where: { id: 'demo-project-payment-launch' },
    update: {},
    create: { id: 'demo-project-payment-launch', workspaceId: workspace.id, name: 'Payment Launch', trend: 'INCREASING' },
  });

  const channelDefs = [
    { slackChannelId: 'C_DEMO_1', name: 'payment-launch' },
    { slackChannelId: 'C_DEMO_2', name: 'backend-eng' },
    { slackChannelId: 'C_DEMO_3', name: 'product' },
  ];

  const channels: Record<string, string> = {};
  for (const c of channelDefs) {
    const channel = await prisma.channel.upsert({
      where: { workspaceId_slackChannelId: { workspaceId: workspace.id, slackChannelId: c.slackChannelId } },
      update: {},
      create: {
        workspaceId: workspace.id,
        slackChannelId: c.slackChannelId,
        name: c.name,
        isSelected: true,
        projectId: c.name === 'payment-launch' ? project.id : undefined,
      },
    });
    channels[c.name] = channel.id;
  }

  const now = Date.now();
  const messagesSeed = [
    { channel: 'payment-launch', ts: '1', user: 'Priya', text: 'The payment API is still not ready.' },
    { channel: 'payment-launch', ts: '2', user: 'Marcus', text: "QA can't test because staging is broken." },
    { channel: 'payment-launch', ts: '3', user: 'Dana', text: 'Waiting for design approval.' },
    { channel: 'payment-launch', ts: '4', user: 'Priya', text: 'Can we move the launch?' },
    { channel: 'backend-eng', ts: '5', user: 'Rahul', text: 'Still debugging the payment API.' },
    { channel: 'backend-eng', ts: '6', user: 'Rahul', text: 'Spent most of today trying to reproduce it.' },
    { channel: 'backend-eng', ts: '7', user: 'Rahul', text: 'No ticket exists for this.' },
    { channel: 'product', ts: '8', user: 'Dana', text: "Let's lock the pricing page at 3 tiers. Decided." },
    { channel: 'product', ts: '9', user: 'Marcus', text: "Actually, didn't we already decide on 4 tiers back in March?" },
  ];

  const messageIds: Record<string, string> = {};
  for (const [i, m] of messagesSeed.entries()) {
    const row = await prisma.slackMessage.upsert({
      where: { channelId_slackMessageTs: { channelId: channels[m.channel], slackMessageTs: m.ts } },
      update: {},
      create: {
        workspaceId: workspace.id,
        channelId: channels[m.channel],
        slackMessageTs: m.ts,
        slackUserId: `U_${m.user.toUpperCase()}`,
        userDisplayName: m.user,
        text: m.text,
        postedAt: new Date(now - (messagesSeed.length - i) * 60 * 60 * 1000),
      },
    });
    messageIds[m.ts] = row.id;
  }

  const run = await prisma.analysisRun.create({
    data: {
      workspaceId: workspace.id,
      status: 'COMPLETED',
      trigger: 'MANUAL',
      channelIds: Object.values(channels),
      messagesAnalyzed: messagesSeed.length,
      risksFound: 3,
      startedAt: new Date(now - 5 * 60 * 1000),
      completedAt: new Date(now),
    },
  });

  const risk1 = await prisma.risk.create({
    data: {
      workspaceId: workspace.id,
      projectId: project.id,
      analysisRunId: run.id,
      type: 'deadline_risk',
      severity: 'High',
      confidence: 0.82,
      title: 'Multiple unresolved dependencies indicate a potential launch delay',
      description:
        'There is a high likelihood of delay based on 3 unresolved dependencies: the payment API, the QA environment, and design approval.',
      affectedPeople: ['Priya', 'Marcus', 'Dana'],
      affectedDeadline: 'Payment Launch',
    },
  });

  await prisma.riskEvidence.createMany({
    data: [
      { riskId: risk1.id, slackMessageId: messageIds['1'], quote: 'The payment API is still not ready.' },
      { riskId: risk1.id, slackMessageId: messageIds['2'], quote: "QA can't test because staging is broken." },
      { riskId: risk1.id, slackMessageId: messageIds['3'], quote: 'Waiting for design approval.' },
    ],
  });

  await prisma.recommendation.createMany({
    data: [
      { riskId: risk1.id, text: 'Assign API blocker' },
      { riskId: risk1.id, text: 'Escalate staging issue' },
      { riskId: risk1.id, text: 'Confirm design approval' },
    ],
  });

  const risk2 = await prisma.risk.create({
    data: {
      workspaceId: workspace.id,
      projectId: project.id,
      analysisRunId: run.id,
      type: 'ghost_work',
      severity: 'Medium',
      confidence: 0.62,
      title: 'Rahul appears to be doing untracked work on the payment API',
      description:
        'Rahul appears to be spending significant time investigating the payment API issue. No ticket is mentioned, but confidence is moderate since this is inferred from conversation alone.',
      affectedPeople: ['Rahul'],
      affectedDeadline: null,
    },
  });

  await prisma.riskEvidence.createMany({
    data: [
      { riskId: risk2.id, slackMessageId: messageIds['5'], quote: 'Still debugging the payment API.' },
      { riskId: risk2.id, slackMessageId: messageIds['6'], quote: 'Spent most of today trying to reproduce it.' },
      { riskId: risk2.id, slackMessageId: messageIds['7'], quote: 'No ticket exists for this.' },
    ],
  });

  await prisma.recommendation.create({ data: { riskId: risk2.id, text: 'Create task to track this investigation' } });

  const risk3 = await prisma.risk.create({
    data: {
      workspaceId: workspace.id,
      type: 'decision_drift',
      severity: 'Medium',
      confidence: 0.55,
      title: 'Pricing tier decision may be re-opening',
      description:
        'A decision to lock pricing at 3 tiers appears to be questioned again without clear resolution, risking rework on the pricing page.',
      affectedPeople: ['Dana', 'Marcus'],
      affectedDeadline: null,
      analysisRunId: run.id,
    },
  });

  await prisma.riskEvidence.createMany({
    data: [
      { riskId: risk3.id, slackMessageId: messageIds['8'], quote: "Let's lock the pricing page at 3 tiers. Decided." },
      { riskId: risk3.id, slackMessageId: messageIds['9'], quote: "Didn't we already decide on 4 tiers back in March?" },
    ],
  });

  await prisma.recommendation.create({ data: { riskId: risk3.id, text: 'Re-confirm the pricing tier decision with all stakeholders' } });

  console.log(`Seed complete. Sign in with demo@riskradar.dev / demopassword123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
