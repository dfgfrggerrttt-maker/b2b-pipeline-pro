
import { Application } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { config } from "./src/config.ts";
import { corsMiddleware, rateLimitMiddleware, auditMiddleware } from "./src/middleware/security.ts";
import dealRoutes from "./src/routes/deals.ts";

const app = new Application();

app.use(corsMiddleware);
app.use(rateLimitMiddleware);
app.use(auditMiddleware);

app.use(async (ctx, next) => {
  ctx.response.headers.set("X-Frame-Options", "DENY");
  ctx.response.headers.set("X-Content-Type-Options", "nosniff");
  ctx.response.headers.set("X-XSS-Protection", "1; mode=block");
  await next();
});

app.use(async (ctx, next) => {
  if (ctx.request.url.pathname === "/") {
    ctx.response.body = {
      message: "Welcome to B2B Pipeline Pro v2.0",
      version: "2.0.0",
      human_controlled: true,
      endpoints: {
        health: "/health",
        companies: "/api/v1/companies",
        services: "/api/v1/services",
        deals: "/api/v1/deals",
        communications: "/api/v1/communications"
      },
      features: [
        "🌐 Buying Signals Detection",
        "👥 Decision Maker Mapping",
        "🧪 A/B Testing",
        "📄 Interactive Proposals",
        "🎙️ Call Battlecards",
        "🛡️ Compliance Management",
        "🎯 Intent Discovery",
        "💰 Manual Pricing & Negotiation",
        "✅ Human Approval Required"
      ]
    };
    return;
  }
  await next();
});

app.use(dealRoutes.routes());
app.use(dealRoutes.allowedMethods());

console.log(`🚀 B2B Pipeline Pro v2.0.0 running on port ${config.port}`);
console.log(" Human-in-the-loop enforced. No auto-pricing.");
console.log("🛡️ Compliance checks active.");
console.log("📊 Audit logging enabled.");
await app.listen({ port: config.port });
