import { NextRequest, NextResponse } from 'next/server';
import { verifyStripeWebhookSignature } from '@/lib/billing/stripe';
import { handleStripeEvent } from '@/lib/billing/webhookHandler';

/** Stripe webhook signature verification requires the exact raw request
 *  body — never JSON.parse it before calling verifyStripeWebhookSignature. */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event;
  try {
    event = verifyStripeWebhookSignature(rawBody, signature);
  } catch (error) {
    console.error('[stripe-webhook] signature verification failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[stripe-webhook] handler failed:', error);
    // Return 500 so Stripe retries — this is a processing failure on our
    // side, not an invalid event.
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
