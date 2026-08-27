import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";
await load({ export: true });

export const config = {
  appEnv: Deno.env.get("APP_ENV") || "development",
  port: parseInt(Deno.env.get("PORT") || "8080"),
  dbUrl: Deno.env.get("DATABASE_URL") || "mock",
  jwtSecret: Deno.env.get("JWT_SECRET") || "change-me-now",
  jwtExpiresIn: parseInt(Deno.env.get("JWT_EXPIRES_IN") || "86400"),
  corsOrigins: JSON.parse(Deno.env.get("CORS_ORIGINS") || '["*"]'),
  adminEmail: Deno.env.get("ADMIN_EMAIL") || "dfgfrggerrttt@gmail.com",
};
