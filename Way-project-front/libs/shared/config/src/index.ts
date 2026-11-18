import { z } from 'zod';

const appConfigSchema = z.object({
  apiBaseUrl: z.string().url().default('http://localhost:3000'),
  /** Base URL of the Discord bot's read-only API (bot dashboard). Optional. */
  botApiUrl: z.string().url().optional(),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export function readAppConfig(env: Record<string, string | undefined>): AppConfig {
  return appConfigSchema.parse({
    apiBaseUrl: env['VITE_API_BASE_URL'],
    botApiUrl: env['VITE_BOT_API_URL'] || undefined,
  });
}
