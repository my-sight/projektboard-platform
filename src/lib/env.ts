import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().optional(),
  CSRF_SECRET: z.string().min(32),
  RATE_LIMIT_WINDOW_MS: z.string().optional(),
  RATE_LIMIT_MAX: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export const rateLimitWindowMs = Number(env.RATE_LIMIT_WINDOW_MS ?? 10000);
export const rateLimitMax = Number(env.RATE_LIMIT_MAX ?? 60);
