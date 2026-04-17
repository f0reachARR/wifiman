import { Hono } from 'hono';
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

export function createApp() {
  const app = new Hono();

  // CORS
  app.use(
    '/api/*',
    cors({
      origin: [env.APP_ORIGIN, 'http://localhost:5173'],
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
  const api = new Hono();

  api.route('/tournaments', tournamentRoutes);
  api.route('/', teamRoutes);
  api.route('/', teamAccessRoutes);
  api.route('/', wifiConfigRoutes);
  api.route('/', deviceSpecRoutes);
  api.route('/', observedWifiRoutes);
  api.route('/', issueReportRoutes);
  api.route('/', bestPracticeRoutes);
  api.route('/', noticeRoutes);

  app.route('/api', api);

  // グローバルエラーハンドラ
  app.onError(errorHandler);

  // 404
  app.notFound((c) => {
    return c.json({ error: { code: 'NOT_FOUND', message: 'エンドポイントが見つかりません' } }, 404);
  });

  return app;
}
