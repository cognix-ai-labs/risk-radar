process.env.ENCRYPTION_KEY ??= 'a'.repeat(64);
process.env.SLACK_SIGNING_SECRET ??= 'test-signing-secret';
process.env.NEXTAUTH_SECRET ??= 'test-secret';
process.env.APP_URL ??= 'http://localhost:3000';
process.env.STRIPE_PRICE_PRO_MONTHLY ??= 'price_pro_test';
process.env.STRIPE_PRICE_BUSINESS_MONTHLY ??= 'price_business_test';
