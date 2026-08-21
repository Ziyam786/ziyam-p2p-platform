// Config is read at import time by the modules under test, so the env has to
// be populated before any of them load. These are deliberately fake, fixed
// secrets: the signature tests assert real HMACs computed against exactly
// these values, so changing them will (correctly) fail those tests.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'test-jwt-secret-not-used-in-production';
process.env.RAZORPAY_KEY_ID ??= 'rzp_test_key_id';
process.env.RAZORPAY_KEY_SECRET ??= 'rzp_test_key_secret';
process.env.RAZORPAY_WEBHOOK_SECRET ??= 'rzp_test_webhook_secret';
process.env.GOOGLE_MAPS_SERVER_API_KEY ??= 'test-google-maps-key';
