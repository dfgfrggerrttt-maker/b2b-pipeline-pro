
import { Context, Next } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { AuditRepo } from "../repositories/index.ts";

// 🔐 Auth & RBAC
export async function authMiddleware(ctx: Context, next: Next) {
  const auth = ctx.request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    ctx.response.status = 401;
    ctx.response.body = { success: false, error: "Unauthorized" };
    return;
  }
  // Mock user - في الإنتاج يتم التحقق من JWT
  ctx.state.user = { id: "user_123", role: "SALES", tenant_id: "tenant_1", email: "test@example.com" };
  await next();
}

export function requireRole(roles: string[]) {
  return async (ctx: Context, next: Next) => {
    if (!ctx.state.user || !roles.includes(ctx.state.user.role)) {
      ctx.response.status = 403;
      ctx.response.body = { success: false, error: "Forbidden" };
      return;
    }
    await next();
  };
}

// 🛡️ Audit Logging
export async function auditMiddleware(ctx: Context, next: Next) {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  
  if (ctx.state.user) {
    await AuditRepo.log({
      tenant_id: ctx.state.user.tenant_id,
      user_id: ctx.state.user.id,
      action: `${ctx.request.method} ${ctx.request.url.pathname}`,
      resource_type: ctx.request.url.pathname.split("/")[2] || "unknown",
      resource_id: ctx.request.url.pathname.split("/")[3] || "",
      ip_address: ctx.request.headers.get("X-Forwarded-For") || "unknown",
      user_agent: ctx.request.headers.get("User-Agent") || "",
      request_id: crypto.randomUUID()
    });
  }
  console.log(`[AUDIT] ${ctx.state.user?.id} ${ctx.request.method} ${ctx.request.url.pathname} - ${duration}ms`);
}

// ⚡ Rate Limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
export async function rateLimitMiddleware(ctx: Context, next: Next) {
  const ip = ctx.request.headers.get("X-Forwarded-For") || "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (entry && entry.resetAt > now) {
    if (entry.count >= 100) {
      ctx.response.status = 429;
      ctx.response.body = { success: false, error: "Too many requests" };
      return;
    }
    entry.count++;
  } else {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 900000 });
  }
  await next();
}

// 🌐 CORS
export async function corsMiddleware(ctx: Context, next: Next) {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204;
    return;
  }
  await next();
}
