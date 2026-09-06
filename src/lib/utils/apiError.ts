import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { UnauthorizedError, ForbiddenError } from '@/lib/auth/workspace';
import { EntitlementError } from '@/lib/billing/entitlement';

/** Converts a thrown error into a consistent, safe HTTP response. Never
 *  leaks internal error details (stack traces, DB errors) to the client —
 *  only known, intentionally-thrown error types get a specific message. */
export function toApiErrorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof EntitlementError) {
    return NextResponse.json({ error: error.message }, { status: 402 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: 'Invalid request', details: error.flatten() }, { status: 400 });
  }

  console.error('[api] unhandled error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
