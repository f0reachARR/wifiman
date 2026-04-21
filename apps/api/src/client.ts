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

export const API_BASE_PATH = '/api';
export const OPENAPI_DOCUMENT_CONFIG = {
  openapi: '3.1.0',
  info: { title: 'WiFiMan API', version: '1.0.0' },
  servers: [{ url: API_BASE_PATH, description: 'WiFiMan API server' }],
};

export function createApiRouteApp() {
  return createOpenApiApp()
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
}

type ApiRouteApp = ReturnType<typeof createApiRouteApp>;

export function createApiOpenApiDocument(): ReturnType<ApiRouteApp['getOpenAPI31Document']> {
  return createApiRouteApp().getOpenAPI31Document(OPENAPI_DOCUMENT_CONFIG);
}

const api = createApiRouteApp();

export type AppType = typeof api;
