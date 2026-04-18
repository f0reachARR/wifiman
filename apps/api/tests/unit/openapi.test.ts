import { createRoute, z } from '@hono/zod-openapi';
import { describe, expect, it } from 'vitest';
import { createOpenApiApp } from '../../src/openapi.js';

describe('createOpenApiApp', () => {
  it('Zod validation error を共通 ApiError 形式で返す', async () => {
    const app = createOpenApiApp();
    const route = createRoute({
      method: 'post',
      path: '/example',
      request: {
        body: {
          content: {
            'application/json': {
              schema: z.object({ name: z.string().min(1) }),
            },
          },
          required: true,
        },
      },
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({ ok: z.boolean() }),
            },
          },
          description: 'ok',
        },
        400: {
          content: {
            'application/json': {
              schema: z.object({
                error: z.object({
                  code: z.string(),
                  message: z.string(),
                  details: z.unknown().optional(),
                }),
              }),
            },
          },
          description: 'validation error',
        },
      },
    });

    app.openapi(route, (c) => c.json({ ok: true }, 200));

    const res = await app.request('/example', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: '入力内容が不正です',
        details: {
          target: 'json',
        },
      },
    });
  });
});
