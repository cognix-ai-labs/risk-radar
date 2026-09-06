import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getStripeClient } from './stripe';
import { writeAuditLog } from '@/lib/utils/audit';
import type { PlanTier, SubscriptionStatus } from '@prisma/client';

/** Maps a Stripe subscription status string to our internal enum. Stripe's
 *  "trialing"/"active" map straightforwardly; everything else that isn't a
 *  clean success state is treated conservatively. */
function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'trialing':
      return 'TRIALING';
    case 'active':
      return 'ACTIVE';
    case 'past_due':
    case 'unpaid':
      return 'PAST_DUE';
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELED';
    default:
      return 'INCOMPLETE';
  }
}

function planFromPriceId(priceId: string | undefined): PlanTier {
  if (!priceId) return 'TRIAL';
  if (priceId === process.env.STRIPE_PRICE_BUSINESS_MONTHLY) return 'BUSINESS';
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) return 'PRO';
  return 'TRIAL';
}

async function syncSubscriptionFromStripe(subscription: Stripe.Subscription): Promise<void> {
  const workspaceId = subscription.metadata?.workspaceId;
  if (!workspaceId) {
    // Defensive: never silently trust a subscription we can't tie to a
    // workspace — surfaced via audit log for investigation.
    await writeAuditLog({
      action: 'stripe.webhook.missing_workspace_id',
      metadata: { stripeSubscriptionId: subscription.id },
    });
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const plan = planFromPriceId(priceId);
  const status = mapStripeStatus(subscription.status);

  await prisma.subscription.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      plan,
      status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    update: {
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      plan,
      status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });

  await writeAuditLog({
    workspaceId,
    action: 'stripe.subscription.synced',
    metadata: { plan, status, stripeSubscriptionId: subscription.id },
  });
}

/** Processes a verified Stripe event. The caller MUST have already run the
 *  event through verifyStripeWebhookSignature — this function does not
 *  re-verify anything. */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const stripe = getStripeClient();
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await syncSubscriptionFromStripe(subscription);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscriptionFromStripe(subscription);
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const workspaceId = invoice.subscription_details?.metadata?.workspaceId;
      if (workspaceId) {
        await prisma.subscription.updateMany({
          where: { workspaceId },
          data: { status: 'PAST_DUE' },
        });
        await writeAuditLog({ workspaceId, action: 'stripe.invoice.payment_failed', metadata: { invoiceId: invoice.id } });
      }
      break;
    }
    default:
      // Unhandled event types are fine to ignore — Stripe sends many we
      // don't need for this MVP's billing model.
      break;
  }
}
