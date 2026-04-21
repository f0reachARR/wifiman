import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DATABASE_URL ??= 'postgres://postgres:postgres@localhost:5432/wifiman';
process.env.BETTER_AUTH_SECRET ??= 'openapi-generation-secret';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
process.env.APP_ORIGIN ??= 'http://localhost:5173';
process.env.NODE_ENV ??= 'development';

const outputUrl = new URL('../../web/src/lib/api/generated/openapi.json', import.meta.url);
const outputPath = fileURLToPath(outputUrl);

const { createApiOpenApiDocument } = await import('./client.js');

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(createApiOpenApiDocument(), null, 2)}\n`);

console.log(`OpenAPI schema written to ${outputPath}`);
