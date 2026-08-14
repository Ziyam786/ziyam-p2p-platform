import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { PrismaClient, Role } from '@prisma/client';
import { config } from '../config';

const prisma = new PrismaClient();

export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
  email: string;
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, config.auth.bcryptSaltRounds);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static signAccessToken(payload: AccessTokenPayload): string {
    const options: SignOptions = { expiresIn: config.auth.jwtExpiresIn as SignOptions['expiresIn'] };
    return jwt.sign(payload, config.auth.jwtSecret, options);
  }

  static verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, config.auth.jwtSecret) as AccessTokenPayload;
  }

  /** Generates an opaque refresh token, stores only its SHA-256 hash, and returns the raw token to the client. */
  static async issueRefreshToken(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + config.auth.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });

    return rawToken;
  }

  /** Validates a raw refresh token, rotates it (revokes old, issues new), and returns the user + new raw token. */
  static async rotateRefreshToken(rawToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const record = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      return null;
    }

    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const newRawToken = await this.issueRefreshToken(record.userId);
    return { user: record.user, refreshToken: newRawToken };
  }

  static async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
