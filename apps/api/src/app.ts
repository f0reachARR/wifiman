import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth } from './auth.js';
import { createApiRouteApp, OPENAPI_DOCUMENT_CONFIG } from './client.js';
import { env } from './env.js';
import { errorHandler } from './errors.js';
import { setAuthContext } from './middleware/auth.js';
import { createOpenApiApp } from './openapi.js';

export function createApp() {
  const app = createOpenApiApp();

  // CORS
  const corsOrigins = [
    env.APP_ORIGIN,
    ...(env.CORS_ORIGINS
      ? env.CORS_ORIGINS.split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []),
  ];
  app.use(
    '/api/*',
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );

  // Logger
  app.use('*', logger());

  // 認証コンテキストをセット
  app.use('/api/*', setAuthContext);

  // Routes
  const api = createApiRouteApp();

  // OpenAPI ドキュメント
  api.doc('/openapi.json', OPENAPI_DOCUMENT_CONFIG);

  // Swagger UI
  api.get('/docs', swaggerUI({ url: '/api/openapi.json' }));

  app.route('/api', api);

  // Better Auth の catch-all は custom auth routes より後に登録する。
  app.on(['POST', 'GET'], '/api/auth/**', (c) => {
    return auth.handler(c.req.raw);
  });

  // グローバルエラーハンドラ
  app.onError(errorHandler);

  // 404
  app.notFound((c) => {
    return c.json({ error: { code: 'NOT_FOUND', message: 'エンドポイントが見つかりません' } }, 404);
  });

  return app;
}
