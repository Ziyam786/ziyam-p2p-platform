import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { PayoutEngine } from './services/payoutEngine';
import bookingRoutes from './routes/booking.routes';
import hostRoutes from './routes/host.routes';

const app = express();

app.use(helmet());

// CORS configuration - allow multiple origins
const allowedOrigins = [
  config.clientUrl,
  'https://ziyam-frontend-ab3r-git-main-ziyam786s-projects.vercel.app',
  'https://ziyam-frontend-ab3r-n951nxyb-ziyam786s-projects.vercel.app',
  'https://ziyam-frontend-production.vercel.app',
  'http://localhost:3000',
  'http://localhost:5000',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'ZiyamSelfDrive API' }));

app.use('/api', bookingRoutes);
app.use('/api', hostRoutes);

// Background N+1 settlement cron
PayoutEngine.initializePayoutCron();

app.listen(config.port, () => {
  console.log(`🚀 ZiyamSelfDrive API running on port ${config.port} (${config.nodeEnv})`);
});
