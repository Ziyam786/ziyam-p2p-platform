import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { PayoutEngine } from './services/payoutEngine';
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
import payuCallbackRoutes from './routes/payuCallback.routes';
import wishlistRoutes from './routes/wishlist.routes';
import notificationRoutes from './routes/notification.routes';
import fleetLedgerRoutes from './routes/fleetLedger.routes';
import serviceRequestRoutes from './routes/serviceRequest.routes';
import uploadRoutes from './routes/upload.routes';

const app = express();

app.use(helmet());
app.use(express.urlencoded({ extended: true }));

// PayU posts its success/failure callback as a real browser form navigation
// (not a fetch/XHR call), from PayU's own domain, with no cookies involved.
// Mount it ahead of the CORS middleware below so an unrecognized Origin
// header on that navigation can't cause our strict origin check to reject it.
app.use('/api', payuCallbackRoutes);

// CORS configuration - allow multiple origins
const allowedOrigins = [
  config.clientUrl,
  config.adminUrl,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5000',
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
    
    // Allow all Vercel deployments (ziyam-frontend-*.vercel.app, ziyam-admin-*.vercel.app)
    if (origin.includes('vercel.app') && (origin.includes('ziyam-frontend') || origin.includes('ziyam-admin'))) {
      callback(null, true);
      return;
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

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

app.use('/api', authRoutes);
app.use('/api', carRoutes);
app.use('/api', bookingRoutes);
app.use('/api', hostRoutes);
app.use('/api', userRoutes);
app.use('/api', reviewRoutes);
app.use('/api', kycRoutes);
app.use('/api', adminRoutes);
app.use('/api', settingsRoutes);
app.use('/api', aiRoutes);
app.use('/api', promoCodeRoutes);
app.use('/api', wishlistRoutes);
app.use('/api', notificationRoutes);
app.use('/api', fleetLedgerRoutes);
app.use('/api', serviceRequestRoutes);
app.use('/api', uploadRoutes);

// 404 handler for unmatched API routes
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Centralized error handler (catches anything routes forgot to try/catch)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

// Background N+1 settlement cron
PayoutEngine.initializePayoutCron();

app.listen(config.port, () => {
  console.log(`🚀 ZiyamSelfDrive API running on port ${config.port} (${config.nodeEnv})`);
});
