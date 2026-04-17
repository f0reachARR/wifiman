import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * 安全なランダムアクセストークンを生成する (64 文字 hex = 256 bit)。
 */
export function generateAccessToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * アクセストークンを SHA-256 でハッシュ化する。
 * DB には本体ではなくこのハッシュのみ保存する。
 */
export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * トークン本体とDBのハッシュを timing-safe に比較する。
 * 長さが異なる場合は false を返す。
 */
export function verifyAccessToken(token: string, storedHash: string): boolean {
  const tokenHash = hashAccessToken(token);
  const a = Buffer.from(tokenHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * アクセストークンが有効か確認する (失効していないか)。
 */
export function isTokenValid(revokedAt: string | null | undefined): boolean {
  return revokedAt == null;
}
