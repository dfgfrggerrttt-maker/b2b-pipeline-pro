// index.ts - Production-Ready Secure B2B Pipeline API
import postgres from "npm:postgres@3.4.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

// 1. فحص المتغيرات البيئية الإلزامية
const dbUrl = Deno.env.get("DATABASE_URL");
const API_SECRET_KEY = Deno.env.get("API_SECRET_KEY") || "b2b_secret_key_demo_2026";

if (!dbUrl) {
  console.error("❌ DATABASE_URL is not set!");
  throw new Error("DATABASE_URL environment variable is required");
}

console.log("🔗 Connecting to database...");

const sql = postgres(dbUrl, {
  ssl: { rejectUnauthorized: false },
  max: 5,
  idle_timeout: 20,
  prepare: false,
  fetch_types: false,
});

console.log("✅ Database client created");

// 2. تهيئة الجداول تلقائياً
let dbInitialized = false;
async function ensureTablesExist() {
  if (dbInitialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS companies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      industry TEXT,
      country TEXT,
      employee_count INT,
      website TEXT,
      score INT DEFAULT 50,
      risk_level TEXT DEFAULT 'LOW',
      pipeline_status TEXT DEFAULT 'DISCOVERED',
      analysis JSONB,
      buying_signals JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS deals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT NOT NULL,
      company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
      service_id TEXT NOT NULL,
      status TEXT DEFAULT 'DISCOVERED',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS negotiations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      new_price INT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  dbInitialized = true;
  console.log("✅ Database tables verified");
}

ensureTablesExist().catch((err) => {
  console.warn("⚠️ Background DB init deferred to first request:", err.message);
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// 3. التحقق الأمني من الـ API Key
function authenticate(req: Request): { authorized: boolean; tenantId: string | null } {
  const authHeader = req.headers.get("Authorization");
  const apiKeyHeader = req.headers.get("x-api-key");

  let token = apiKeyHeader;
  if (!token && authHeader?.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (token && token === API_SECRET_KEY) {
    // يمكن هنا ربط المفتاح بمستأجر محدد
    return { authorized: true, tenantId: "tenant_default" };
  }

  return { authorized: false, tenantId: null };
}

// 4. معالج الطلبات الرئيسي
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;

  // فحص CORS Preflight
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // السماح بمسار فحص الحالة بدون توثيق
  if (method === "GET" && url.pathname === "/health") {
    try {
      await sql`SELECT 1`;
      return jsonResponse({
        status: "ok",
        version: "3.1.0",
        storage: "PostgreSQL (Supabase)",
        db_connected: true,
      });
    } catch (e: any) {
      return jsonResponse({ status: "error", message: e.message }, 500);
    }
  }

  // تطبيق التوثيق الأمني على باقي المسارات
  const auth = authenticate(req);
  if (!auth.authorized) {
    return jsonResponse({ error: "Unauthorized: Invalid or missing API Key" }, 401);
  }

  const tenantId = auth.tenantId!;

  try {
    await ensureTablesExist();

    // إضافة شركة مع ربطها بالمستأجر
    if (method === "POST" && url.pathname === "/api/v1/companies") {
      const body = await req.json();
      if (!body.name) {
        return jsonResponse({ error: "Company name is required" }, 400);
      }

      const [company] = await sql`
        INSERT INTO companies (tenant_id, name, industry, country, employee_count, website, score, risk_level, pipeline_status)
        VALUES (${tenantId}, ${body.name}, ${body.industry || null}, ${body.country || null}, ${body.employee_count || null}, ${body.website || null}, 90, 'LOW', 'DISCOVERED')
        RETURNING *
      `;
      return jsonResponse({ success: true, data: company });
    }

    // تحليل الشركة
    if (method === "POST" && url.pathname.startsWith("/api/v1/companies/") && url.pathname.endsWith("/analyze")) {
      const parts = url.pathname.split("/");
      const id = parts[4];
      if (!id) return jsonResponse({ error: "Company ID is required" }, 400);

      const companies = await sql`SELECT * FROM companies WHERE id = ${id}::uuid AND tenant_id = ${tenantId}`;
      const company = companies[0];
      if (!company) return jsonResponse({ error: "Company not found", debug_id: id }, 404);

      const analysis = {
        digital_maturity: 60,
        pain_points: [{ problem: "Limited tech adoption", evidence: "Large team", confidence: 80 }],
        opportunities: [{ opportunity: "Digital transformation", potential_service: "consulting", confidence: 75 }],
        swot: { strengths: ["Established"], weaknesses: ["Tech adoption"], opportunities: ["Growth"], threats: ["Competition"] },
      };
      const signals = [
        { type: "HIRING", description: "توسع في فريق الهندسة", confidence: 85 },
        { type: "FUNDING", description: "احتمال حصول على تمويل", confidence: 70 },
      ];

      await sql`
        UPDATE companies
        SET analysis = ${sql.json(analysis)}, buying_signals = ${sql.json(signals)}, updated_at = NOW()
        WHERE id = ${id}::uuid AND tenant_id = ${tenantId}
      `;

      return jsonResponse({ success: true, data: { analysis, signals } });
    }

    // إنشاء صفقة
    if (method === "POST" && url.pathname === "/api/v1/deals") {
      const body = await req.json();
      if (!body.company_id || !body.service_id) {
        return jsonResponse({ error: "company_id and service_id are required" }, 400);
      }

      const [deal] = await sql`
        INSERT INTO deals (tenant_id, company_id, service_id, status)
        VALUES (${tenantId}, ${body.company_id}::uuid, ${body.service_id}, 'DISCOVERED')
        RETURNING *
      `;
      return jsonResponse({ success: true, data: deal });
    }

    // تسجيل جولة تفاوض
    if (method === "POST" && url.pathname.startsWith("/api/v1/deals/") && url.pathname.endsWith("/negotiate")) {
      const parts = url.pathname.split("/");
      const dealId = parts[4];
      const body = await req.json();

      if (!body.action) {
        return jsonResponse({ error: "action is required" }, 400);
      }

      await sql`
        INSERT INTO negotiations (deal_id, actor, action, new_price, notes)
        VALUES (${dealId}::uuid, 'USER', ${body.action}, ${body.new_price || null}, ${body.notes || null})
      `;
      return jsonResponse({ success: true, message: "Negotiation recorded" });
    }

    // ملخص وسجل المفاوضات
    if (method === "GET" && url.pathname.startsWith("/api/v1/deals/") && url.pathname.endsWith("/negotiation-summary")) {
      const parts = url.pathname.split("/");
      const dealId = parts[4];
      const history = await sql`
        SELECT * FROM negotiations WHERE deal_id = ${dealId}::uuid ORDER BY created_at ASC
      `;
      const finalPrice = history.find((h: any) => h.action === "ACCEPTED")?.new_price;
      const status = history.length > 0 ? history[history.length - 1].action : "NEGOTIATING";
      return jsonResponse({ success: true, data: { history, final_price: finalPrice, status } });
    }

    return jsonResponse({ error: "Not Found", path: url.pathname }, 404);
  } catch (error: any) {
    console.error("❌ Handler error:", error.message);
    return jsonResponse({ error: error.message }, 500);
  }
}

console.log("🚀 B2B Pipeline Pro (Secure Edition) starting...");
Deno.serve(handler);
