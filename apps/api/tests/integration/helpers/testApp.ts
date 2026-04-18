import { errorHandler } from '../../../src/errors.js';
import type { AuthContext } from '../../../src/middleware/auth.js';
import { createOpenApiApp } from '../../../src/openapi.js';

export function createIntegrationTestApp() {
  const app = createOpenApiApp();

  app.use('/api/*', async (c, next) => {
    const rawAuth = c.req.header('x-test-auth');
    const auth = rawAuth ? (JSON.parse(rawAuth) as AuthContext) : {};
    c.set('auth', auth);
    await next();
  });

  app.onError(errorHandler);

  return app;
}
