import { OpenAPIHono } from '@hono/zod-openapi';
import { ApiErrorSchema, ErrorCodes } from '@wifiman/shared';
import type { ContextVariableMap } from 'hono';
import type { ZodIssue } from 'zod';

type AppEnv = { Variables: ContextVariableMap };

export const errorSchema = ApiErrorSchema;

export function createOpenApiApp() {
  return new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (result.success) return;
      return c.json(
        {
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: '入力内容が不正です',
            details: {
              target: result.target,
              issues: result.error.issues.map((issue: ZodIssue) => ({
                path: issue.path,
                message: issue.message,
                code: issue.code,
              })),
            },
          },
        },
        400,
      );
    },
  });
}
