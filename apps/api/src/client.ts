import { createOpenApiApp } from './openapi.js';
import authSessionRoutes from './routes/authSessions.js';
import bestPracticeRoutes from './routes/bestPractices.js';
import deviceSpecRoutes from './routes/deviceSpecs.js';
import issueReportRoutes from './routes/issueReports.js';
import noticeRoutes from './routes/notices.js';
import observedWifiRoutes from './routes/observedWifis.js';
import teamAccessRoutes from './routes/teamAccesses.js';
import teamRoutes from './routes/teams.js';
import tournamentRoutes from './routes/tournaments.js';
import wifiConfigRoutes from './routes/wifiConfigs.js';

const api = createOpenApiApp()
  .route('/', authSessionRoutes)
  .route('/', tournamentRoutes)
  .route('/', teamRoutes)
  .route('/', teamAccessRoutes)
  .route('/', wifiConfigRoutes)
  .route('/', deviceSpecRoutes)
  .route('/', observedWifiRoutes)
  .route('/', issueReportRoutes)
  .route('/', bestPracticeRoutes)
  .route('/', noticeRoutes);

export const API_BASE_PATH = '/api';

export type AppType = typeof api;
