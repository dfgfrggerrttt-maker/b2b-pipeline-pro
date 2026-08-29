import postgres from "npm:postgres@3.4.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

const dbUrl = Deno.env.get("DATABASE_URL");
const API_SECRET_KEY = Deno.env.get("API_SECRET_KEY") || "b2b_secret_key_prod_9988Supabase1992t";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

if (!dbUrl) {
  throw new Error("DATABASE_URL is required");
}

// In-Memory Rate Limiter (60 req/min)
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW = 60 * 1000;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetInSec: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetInSec: 60 };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetInSec: Math.ceil((record.resetTime - now) / 1000) };
  }

  record.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count, resetInSec: Math.ceil((record.resetTime - now) / 1000) };
}

const sql = postgres(dbUrl, {
  ssl: { rejectUnauthorized: false },
  max: 5,
  idle_timeout: 20,
  prepare: false,
  fetch_types: false,
});

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
      description TEXT,
      budget TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  
  // ترقية الأعمدة لضمان عدم حدوث خطأ 500
  await sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS description TEXT`;
  await sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS budget TEXT`;

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
}

ensureTablesExist().catch((err) => console.warn("DB init warning:", err.message));

function jsonResponse(data: any, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...extraHeaders },
  });
}

async function analyzeCompanyWithAI(company: any) {
  if (!GEMINI_API_KEY) {
    return {
      analysis: {
        digital_maturity: 75,
        pain_points: [{ problem: "Limited digital scaling", evidence: "Market expansion phase", confidence: 85 }],
        opportunities: [{ opportunity: "Cloud infrastructure setup", potential_service: "srv_cloud_arch", confidence: 80 }],
        swot: { strengths: ["Strong Presence"], weaknesses: ["Manual Ops"], opportunities: ["AI Automation"], threats: ["Competitors"] },
      },
      signals: [{ type: "EXPANSION", description: "توسع في العمليات الرقمية", confidence: 90 }],
    };
  }

  const prompt = `أنت مستشار استراتيجي لمبيعات الـ B2B. حلل الشركة التالية وأرجع JSON فقط:
- الاسم: ${company.name}
- القطاع: ${company.industry || "غير محدد"}
- الدولة: ${company.country || "غير محدد"}
- عدد الموظفين: ${company.employee_count || "غير محدد"}
- الموقع: ${company.website || "غير محدد"}

{
  "analysis": {
    "digital_maturity": 75,
    "pain_points": [{"problem": "تحدي تشغيلي أو تقني", "evidence": "الدليل", "confidence": 85}],
    "opportunities": [{"opportunity": "فرصة نمو وتطوير", "potential_service": "الخدمة المقترحة", "confidence": 80}],
    "swot": {"strengths": ["نقطة قوة"], "weaknesses": ["نقطة ضعف"], "opportunities": ["فرصة"], "threats": ["تهديد"]}
  },
  "signals": [{"type": "EXPANSION", "description": "وصف مؤشر النمو بالعربية", "confidence": 90}]
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini API Error: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

function isAuthorized(req: Request): boolean {
  const apiKey = req.headers.get("x-api-key") || req.headers.get("Authorization")?.replace("Bearer ", "");
  return apiKey === API_SECRET_KEY;
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const clientIP = req.headers.get("x-forwarded-for") || "unknown";
  const rateLimit = checkRateLimit(clientIP);

  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: "Too Many Requests", message: `Rate limit exceeded. Try again in ${rateLimit.resetInSec}s` },
      429,
      { "Retry-After": String(rateLimit.resetInSec) }
    );
  }

  if (method === "GET" && url.pathname === "/health") {
    try {
      await sql`SELECT 1`;
      return jsonResponse({
        status: "ok",
        version: "5.0.0",
        storage: "PostgreSQL (Supabase)",
        ai_engine: GEMINI_API_KEY ? "Google Gemini 3.6 Flash" : "Fallback Heuristic",
        rate_limit: `${RATE_LIMIT_MAX} req/min`,
        free_analysis_enabled: true,
      });
    } catch (e: any) {
      return jsonResponse({ status: "error", message: e.message }, 500);
    }
  }

  try {
    await ensureTablesExist();

    // 1. مسارات عامة للموقع
    if (method === "POST" && url.pathname === "/api/v1/companies") {
      const body = await req.json();
      if (!body.name) return jsonResponse({ error: "Company name is required" }, 400);

      const [company] = await sql`
        INSERT INTO companies (tenant_id, name, industry, country, employee_count, website, score, risk_level, pipeline_status)
        VALUES ('public_lead', ${body.name}, ${body.industry || null}, ${body.country || null}, ${body.employee_count || null}, ${body.website || null}, 90, 'LOW', 'DISCOVERED')
        RETURNING *
      `;
      return jsonResponse({ success: true, data: company });
    }

    if (method === "POST" && url.pathname.startsWith("/api/v1/companies/") && url.pathname.endsWith("/analyze")) {
      const id = url.pathname.split("/")[4];
      if (!id) return jsonResponse({ error: "Company ID is required" }, 400);

      const [company] = await sql`SELECT * FROM companies WHERE id = ${id}::uuid`;
      if (!company) return jsonResponse({ error: "Company not found" }, 404);

      const aiResult = await analyzeCompanyWithAI(company);

      await sql`
        UPDATE companies
        SET analysis = ${sql.json(aiResult.analysis)}, buying_signals = ${sql.json(aiResult.signals)}, updated_at = NOW()
        WHERE id = ${id}::uuid
      `;

      return jsonResponse({ success: true, data: aiResult });
    }

    if (method === "POST" && url.pathname === "/api/v1/deals") {
      const body = await req.json();
      if (!body.company_id || !body.service_id) {
        return jsonResponse({ error: "company_id and service_id are required" }, 400);
      }

      const [deal] = await sql`
        INSERT INTO deals (tenant_id, company_id, service_id, status, description, budget)
        VALUES ('public_lead', ${body.company_id}::uuid, ${body.service_id}, 'DISCOVERED', ${body.description || ''}, ${body.budget || ''})
        RETURNING *
      `;
      return jsonResponse({ success: true, data: deal });
    }

    // 2. مسارات محمية
    if (!isAuthorized(req)) {
      return jsonResponse({ error: "Unauthorized: Admin API Key required" }, 401);
    }

    if (method === "POST" && url.pathname.startsWith("/api/v1/deals/") && url.pathname.endsWith("/negotiate")) {
      const dealId = url.pathname.split("/")[4];
      const body = await req.json();
      if (!body.action) return jsonResponse({ error: "action is required" }, 400);

      await sql`
        INSERT INTO negotiations (deal_id, actor, action, new_price, notes)
        VALUES (${dealId}::uuid, 'ADMIN', ${body.action}, ${body.new_price || null}, ${body.notes || null})
      `;
      return jsonResponse({ success: true, message: "Negotiation recorded" });
    }

    if (method === "GET" && url.pathname.startsWith("/api/v1/deals/") && url.pathname.endsWith("/negotiation-summary")) {
      const dealId = url.pathname.split("/")[4];
      const history = await sql`SELECT * FROM negotiations WHERE deal_id = ${dealId}::uuid ORDER BY created_at ASC`;
      const finalPrice = history.find((h: any) => h.action === "ACCEPTED")?.new_price;
      const status = history.length > 0 ? history[history.length - 1].action : "NEGOTIATING";
      return jsonResponse({ success: true, data: { history, final_price: finalPrice, status } });
    }

    return jsonResponse({ error: "Not Found", path: url.pathname }, 404);
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
}

Deno.serve(handler);
