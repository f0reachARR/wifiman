import { describe, expect, it } from 'vitest';
import {
  generateAccessToken,
  hashAccessToken,
  isTokenValid,
  verifyAccessToken,
} from '../../src/domain/teamAccess.js';

describe('generateAccessToken', () => {
  it('64 文字の hex 文字列を返す', () => {
    const token = generateAccessToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('毎回異なるトークンを返す', () => {
    const t1 = generateAccessToken();
    const t2 = generateAccessToken();
    expect(t1).not.toBe(t2);
  });
});

describe('hashAccessToken', () => {
  it('同じトークンは同じハッシュを返す', () => {
    const token = generateAccessToken();
    const h1 = hashAccessToken(token);
    const h2 = hashAccessToken(token);
    expect(h1).toBe(h2);
  });

  it('異なるトークンは異なるハッシュを返す', () => {
    const t1 = generateAccessToken();
    const t2 = generateAccessToken();
    expect(hashAccessToken(t1)).not.toBe(hashAccessToken(t2));
  });

  it('64 文字の hex 文字列 (SHA-256) を返す', () => {
    const hash = hashAccessToken(generateAccessToken());
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('verifyAccessToken', () => {
  it('正しいトークンは true を返す', () => {
    const token = generateAccessToken();
    const hash = hashAccessToken(token);
    expect(verifyAccessToken(token, hash)).toBe(true);
  });

  it('誤ったトークンは false を返す', () => {
    const token = generateAccessToken();
    const otherToken = generateAccessToken();
    const hash = hashAccessToken(token);
    expect(verifyAccessToken(otherToken, hash)).toBe(false);
  });

  it('空文字は false を返す', () => {
    const token = generateAccessToken();
    const hash = hashAccessToken(token);
    expect(verifyAccessToken('', hash)).toBe(false);
  });

  it('ハッシュが改ざんされた場合は false を返す', () => {
    const token = generateAccessToken();
    const hash = hashAccessToken(token);
    const tamperedHash = hash.replace(hash[0] ?? 'a', hash[0] === 'a' ? 'b' : 'a');
    expect(verifyAccessToken(token, tamperedHash)).toBe(false);
  });
});

describe('isTokenValid', () => {
  it('revokedAt が null の場合は有効', () => {
    expect(isTokenValid(null)).toBe(true);
  });

  it('revokedAt が undefined の場合は有効', () => {
    expect(isTokenValid(undefined)).toBe(true);
  });

  it('revokedAt が設定されている場合は無効', () => {
    expect(isTokenValid(new Date().toISOString())).toBe(false);
  });
});
