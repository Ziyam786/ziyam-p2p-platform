import { Router, Request, Response } from 'express';
import { PrismaClient, Role, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from '../services/authService';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Roles a visitor may self-select at signup. FLEET_OPERATOR/ADMIN require manual/admin provisioning.
const SELF_SIGNUP_ROLES: Role[] = [Role.CUSTOMER, Role.SELF_HOST];

function sanitizeUser(user: { id: string; fullName: string; email: string; phoneNumber: string; role: Role; isKycVerified: boolean }) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    isKycVerified: user.isKycVerified,
  };
}

// Register a new customer or self-host account
router.post('/auth/register', async (req: Request, res: Response) => {
  const { fullName, email, phoneNumber, password, role } = req.body ?? {};

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
    return res.status(400).json({ error: 'fullName is required (min 2 characters)' });
  }
  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim().length < 8) {
    return res.status(400).json({ error: 'A valid phoneNumber is required' });
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }
  const resolvedRole: Role = SELF_SIGNUP_ROLES.includes(role) ? role : Role.CUSTOMER;

  try {
    const passwordHash = await AuthService.hashPassword(password);
    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        phoneNumber: phoneNumber.trim(),
        passwordHash,
        role: resolvedRole,
        isKycVerified: false,
      },
    });

    const accessToken = AuthService.signAccessToken({ sub: user.id, role: user.role, email: user.email });
    const refreshToken = await AuthService.issueRefreshToken(user.id);

    res.status(201).json({ success: true, data: sanitizeUser(user), accessToken, refreshToken });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'An account with this email or phone number already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Log in with email + password
router.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const validPassword = await AuthService.verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const accessToken = AuthService.signAccessToken({ sub: user.id, role: user.role, email: user.email });
  const refreshToken = await AuthService.issueRefreshToken(user.id);

  res.json({ success: true, data: sanitizeUser(user), accessToken, refreshToken });
});

// Exchange a valid refresh token for a new access + refresh token pair
router.post('/auth/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  const rotated = await AuthService.rotateRefreshToken(refreshToken);
  if (!rotated) {
    return res.status(401).json({ error: 'Invalid, expired, or revoked refresh token' });
  }

  const { user, refreshToken: newRefreshToken } = rotated;
  const accessToken = AuthService.signAccessToken({ sub: user.id, role: user.role, email: user.email });

  res.json({ success: true, accessToken, refreshToken: newRefreshToken });
});

// Revoke a refresh token (logout of the current session)
router.post('/auth/logout', async (req: Request, res: Response) => {
  const { refreshToken } = req.body ?? {};
  if (refreshToken && typeof refreshToken === 'string') {
    await AuthService.revokeRefreshToken(refreshToken);
  }
  res.json({ success: true, message: 'Logged out' });
});

// Current authenticated user's profile
router.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, data: sanitizeUser(user) });
});

export default router;
