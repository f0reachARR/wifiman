import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { ContextVariableMap } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth } from './auth.js';
import { env } from './env.js';
import { errorHandler } from './errors.js';
import { setAuthContext } from './middleware/auth.js';
import bestPracticeRoutes from './routes/bestPractices.js';
import deviceSpecRoutes from './routes/deviceSpecs.js';
import issueReportRoutes from './routes/issueReports.js';
import noticeRoutes from './routes/notices.js';
import observedWifiRoutes from './routes/observedWifis.js';
import teamAccessRoutes from './routes/teamAccesses.js';
import teamRoutes from './routes/teams.js';
import tournamentRoutes from './routes/tournaments.js';
import wifiConfigRoutes from './routes/wifiConfigs.js';

type AppEnv = { Variables: ContextVariableMap };

export function createApp() {
  const app = new OpenAPIHono<AppEnv>();

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

  // Better Auth
  app.on(['POST', 'GET'], '/api/auth/**', (c) => {
    return auth.handler(c.req.raw);
  });

  // 認証コンテキストをセット
  app.use('/api/*', setAuthContext);

  // Routes
  const api = new OpenAPIHono<AppEnv>();

  api.route('/', tournamentRoutes);
  api.route('/', teamRoutes);
  api.route('/', teamAccessRoutes);
  api.route('/', wifiConfigRoutes);
  api.route('/', deviceSpecRoutes);
  api.route('/', observedWifiRoutes);
  api.route('/', issueReportRoutes);
  api.route('/', bestPracticeRoutes);
  api.route('/', noticeRoutes);

  // OpenAPI ドキュメント
  api.doc('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'WiFiMan API', version: '1.0.0' },
    servers: [{ url: '/api', description: 'WiFiMan API server' }],
  });

  // Swagger UI
  api.get('/docs', swaggerUI({ url: '/api/openapi.json' }));

  app.route('/api', api);

  // グローバルエラーハンドラ
  app.onError(errorHandler);

  // 404
  app.notFound((c) => {
    return c.json({ error: { code: 'NOT_FOUND', message: 'エンドポイントが見つかりません' } }, 404);
  });

  return app;
}
