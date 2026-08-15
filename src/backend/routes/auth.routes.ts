import { Router, Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { hashPassword, comparePassword } from '../utils/password';
import { signAuthToken } from '../utils/jwt';
import { requireAuth } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const PUBLIC_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phoneNumber: true,
  role: true,
  isKycVerified: true,
  avatarUrl: true,
  bio: true,
  createdAt: true,
};

function cookieOptions() {
  const isProd = config.nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

// Register as a renter or host
router.post('/auth/signup', async (req: Request, res: Response) => {
  const { fullName, email, phoneNumber, password, role } = req.body;

  if (!fullName || !email || !phoneNumber || !password) {
    return res.status(400).json({ error: 'fullName, email, phoneNumber, and password are required' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const requestedRole = role === Role.SELF_HOST || role === Role.FLEET_OPERATOR ? role : Role.CUSTOMER;

  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { phoneNumber }] } });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email or phone number already exists' });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { id: uuidv4(), fullName, email, phoneNumber, passwordHash, role: requestedRole },
    select: PUBLIC_USER_SELECT,
  });

  const token = signAuthToken({ userId: user.id, role: user.role });
  res.cookie(config.auth.cookieName, token, cookieOptions());
  res.status(201).json({ success: true, data: user });
});

router.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (user.isSuspended) {
    return res.status(403).json({ error: 'This account has been suspended. Contact support@ziyam.in.' });
  }

  const token = signAuthToken({ userId: user.id, role: user.role });
  res.cookie(config.auth.cookieName, token, cookieOptions());

  const { passwordHash: _omit, ...publicUser } = user;
  res.json({ success: true, data: publicUser });
});

router.post('/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie(config.auth.cookieName, { path: '/' });
  res.json({ success: true });
});

router.get('/auth/me', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: PUBLIC_USER_SELECT,
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, data: user });
});

export default router;
