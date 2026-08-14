import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { PayoutEngine } from './services/payoutEngine';
import bookingRoutes from './routes/booking.routes';
import hostRoutes from './routes/host.routes';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.clientUrl }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'ZiyamSelfDrive API' }));

app.use('/api', bookingRoutes);
app.use('/api', hostRoutes);

// Background N+1 settlement cron
PayoutEngine.initializePayoutCron();

app.listen(config.port, () => {
  console.log(`🚀 ZiyamSelfDrive API running on port ${config.port} (${config.nodeEnv})`);
});
