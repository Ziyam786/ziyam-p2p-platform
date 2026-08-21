import { Router, Request, Response } from 'express';
import { AxonSupplyGateway } from '../services/axonSupplyGateway';
import { AxonPricingEngine } from '../services/axonPricingEngine';

const router = Router();

// GET /api/v1/axon/search - Search available fleet in real time
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { city, category, pickupTime, dropTime } = req.query;

    if (!city || !pickupTime || !dropTime) {
      return res.status(400).json({ error: 'city, pickupTime, and dropTime are required' });
    }

    const availableCars = await AxonSupplyGateway.searchAvailableFleet({
      city: String(city),
      category: category ? String(category) : undefined,
      pickupTime: new Date(String(pickupTime)),
      dropTime: new Date(String(dropTime)),
    });

    return res.json({
      success: true,
      count: availableCars.length,
      vehicles: availableCars,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Axon search failed' });
  }
});

// POST /api/v1/axon/pricing/quote - Get exact fare breakdown
router.post('/pricing/quote', (req: Request, res: Response) => {
  try {
    const { dailyRate, pickupTime, dropTime } = req.body;

    if (!dailyRate || !pickupTime || !dropTime) {
      return res.status(400).json({ error: 'dailyRate, pickupTime, and dropTime are required' });
    }

    const quote = AxonPricingEngine.calculateFare({
      dailyRate: Number(dailyRate),
      pickupTime: new Date(pickupTime),
      dropTime: new Date(dropTime),
    });

    return res.json({
      success: true,
      quote,
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// GET /api/v1/axon/calendar/:carId/feed.ics - iCal feed for aggregators (Zoomcar, Revv)
router.get('/calendar/:carId/feed.ics', async (req: Request, res: Response) => {
  try {
    const { carId } = req.params;
    const icsContent = await AxonSupplyGateway.generateICalendarFeed(carId);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ziyam-car-${carId}.ics"`);
    return res.send(icsContent);
  } catch (error: any) {
    return res.status(500).send('Error generating calendar feed');
  }
});

export default router;