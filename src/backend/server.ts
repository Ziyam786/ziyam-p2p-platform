import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { PayoutEngine } from './services/payoutEngine';
import authRoutes from './routes/auth.routes';
import bookingRoutes from './routes/booking.routes';
import hostRoutes from './routes/host.routes';

const app = express();

app.use(helmet());

// CORS configuration - allow multiple origins
const allowedOrigins = [
  config.clientUrl,
  'http://localhost:3000',
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
    
    // Allow all Vercel deployments (ziyam-frontend-*.vercel.app)
    if (origin.includes('vercel.app') && origin.includes('ziyam-frontend')) {
      callback(null, true);
      return;
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'ZiyamSelfDrive API' }));

app.use('/api', authRoutes);
app.use('/api', bookingRoutes);
app.use('/api', hostRoutes);

// Background N+1 settlement cron
PayoutEngine.initializePayoutCron();

app.listen(config.port, () => {
  console.log(`🚀 ZiyamSelfDrive API running on port ${config.port} (${config.nodeEnv})`);
});
