import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { PayoutEngine } from './services/payoutEngine';
import { initializeYieldAutoApplyCron } from './services/yieldEngine';
import { initializeDocExpiryCron } from './services/carVerificationService';
import { apiRateLimiter } from './middleware/rateLimit';
import { requireCsrfToken } from './middleware/csrf';
import { safeErrorMessage } from './utils/errorResponse';
import authRoutes from './routes/auth.routes';
import carRoutes from './routes/car.routes';
import bookingRoutes from './routes/booking.routes';
import hostRoutes from './routes/host.routes';
import userRoutes from './routes/user.routes';
import reviewRoutes from './routes/review.routes';
import kycRoutes from './routes/kyc.routes';
import adminRoutes from './routes/admin.routes';
import settingsRoutes from './routes/settings.routes';
import aiRoutes from './routes/ai.routes';
import promoCodeRoutes from './routes/promoCode.routes';
import razorpayWebhookRoutes from './routes/razorpayWebhook.routes';
import razorpayVerifyRoutes from './routes/razorpayVerify.routes';
import wishlistRoutes from './routes/wishlist.routes';
import notificationRoutes from './routes/notification.routes';
import fleetLedgerRoutes from './routes/fleetLedger.routes';
import serviceRequestRoutes from './routes/serviceRequest.routes';
import uploadRoutes from './routes/upload.routes';
import agentRoutes from './routes/agent.routes';
import opsTripRoutes from './routes/opsTrip.routes';
import financeErpRoutes from './routes/financeErp.routes';
import itineraryRoutes from './routes/itinerary.routes';
import planRoutes from './routes/plan.routes';
import damageClaimRoutes from './routes/damageClaim.routes';
import disputeSupportRoutes from './routes/disputeSupport.routes';
import refundRequestRoutes from './routes/refundRequest.routes';
import hostReviewRoutes from './routes/hostReview.routes';

const app = express();

app.use(helmet());
// Gzips every JSON/text response over ~1KB — car listings, admin tables, and
// the AI chat payload all shrink meaningfully on the wire for free.
app.use(compression());
app.use(express.urlencoded({ extended: true }));

// Razorpay posts its webhook as a real server-to-server call from Razorpay's
// own infrastructure, with no cookies involved. Mount it ahead of the CORS
// middleware below so an unrecognized Origin header can't cause our strict
// origin check to reject it, and ahead of express.json() since the webhook
// route parses its own raw body for signature verification.
app.use('/api', razorpayWebhookRoutes);

// CORS configuration - allow multiple origins
const allowedOrigins = [
  config.clientUrl,
  config.adminUrl,
  config.agentUrl,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5000',
  // mobile/ Flutter app's web dev build (`flutter run -d chrome --web-port=8765`) —
  // real devices/emulators aren't browser-origin requests so don't need an entry here.
  'http://localhost:8765',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without Origin header (same-origin requests)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // Check hardcoded origins
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    
    // Allow all Vercel deployments (ziyam-frontend-*.vercel.app, ziyam-admin-*.vercel.app, ziyam-agent-*.vercel.app)
    if (origin.includes('vercel.app') && (origin.includes('ziyam-frontend') || origin.includes('ziyam-admin') || origin.includes('ziyam-agent'))) {
      callback(null, true);
      return;
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '8mb' }));

// Cookie-auth API: parse cookies and run double-submit CSRF on the same
// router before any route handler. The Razorpay webhook is mounted on `app` above this, so
// it never hits cookieParser. /health and /uploads stay off this router.
const api = express.Router();
api.use(cookieParser());
api.use(requireCsrfToken);
api.use(apiRateLimiter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'ZiyamSelfDrive API' }));

// Uploaded photos/documents are fetched cross-origin by the renter/host/admin
// apps (each on their own domain), so relax helmet's default same-origin
// Cross-Origin-Resource-Policy just for this path.
app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(config.uploadDir)
);

app.use('/api', api);
api.use(authRoutes);
api.use(carRoutes);
api.use(bookingRoutes);
api.use(hostRoutes);
api.use(userRoutes);
api.use(reviewRoutes);
api.use(kycRoutes);
api.use(adminRoutes);
api.use(settingsRoutes);
api.use(aiRoutes);
api.use(promoCodeRoutes);
api.use(razorpayVerifyRoutes);
api.use(wishlistRoutes);
api.use(notificationRoutes);
api.use(fleetLedgerRoutes);
api.use(serviceRequestRoutes);
api.use(uploadRoutes);
api.use(agentRoutes);
api.use(opsTripRoutes);
api.use(financeErpRoutes);
api.use(itineraryRoutes);
api.use(planRoutes);
api.use(damageClaimRoutes);
api.use(disputeSupportRoutes);
api.use(refundRequestRoutes);
api.use(hostReviewRoutes);

// 404 handler for unmatched API routes
api.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Centralized error handler (catches anything routes forgot to try/catch)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: safeErrorMessage(err, 'Internal server error') });
});

// Background N+1 settlement cron
PayoutEngine.initializePayoutCron();
PayoutEngine.initializeDepositReleaseCron();
PayoutEngine.initializeHostReviewTimeoutCron();
PayoutEngine.initializeReservationTimeoutCron();
initializeYieldAutoApplyCron();
initializeDocExpiryCron();

app.listen(config.port, () => {
  console.log(`🚀 ZiyamSelfDrive API running on port ${config.port} (${config.nodeEnv})`);
});
