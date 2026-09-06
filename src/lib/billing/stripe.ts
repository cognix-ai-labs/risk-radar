import Stripe from 'stripe';

let cached: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  cached = new Stripe(key, { apiVersion: '2024-06-20' });
  return cached;
}

export async function createCheckoutSession(params: {
  workspaceId: string;
  workspaceName: string;
  customerEmail: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  existingStripeCustomerId?: string | null;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: params.existingStripeCustomerId ?? undefined,
    customer_email: params.existingStripeCustomerId ? undefined : params.customerEmail,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    // Ties the Stripe subscription back to our workspace unambiguously —
    // read on webhook events, never trusted from the client.
    client_reference_id: params.workspaceId,
    subscription_data: {
      metadata: { workspaceId: params.workspaceId },
    },
    metadata: { workspaceId: params.workspaceId, workspaceName: params.workspaceName },
  });
}

export async function createBillingPortalSession(params: {
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripeClient();
  return stripe.billingPortal.sessions.create({
    customer: params.stripeCustomerId,
    return_url: params.returnUrl,
  });
}

export function verifyStripeWebhookSignature(rawBody: string, signature: string): Stripe.Event {
  const stripe = getStripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  // Throws if the signature doesn't match — callers must not catch this
  // and proceed anyway.
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
