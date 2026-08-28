// index.ts - Secure B2B Pipeline API with Real Gemini AI Integration
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

async function analyzeCompanyWithAI(company: any) {
  if (!GEMINI_API_KEY) {
    console.warn("⚠️ GEMINI_API_KEY is not set. Using heuristic fallback.");
    return {
      analysis: {
        digital_maturity: 65,
        pain_points: [{ problem: "Limited cloud migration", evidence: "Legacy stack indicators", confidence: 80 }],
        opportunities: [{ opportunity: "Cloud architecture overhaul", potential_service: "cloud_consulting", confidence: 85 }],
        swot: { strengths: ["Strong Market Presence"], weaknesses: ["Legacy Tech Stack"], opportunities: ["Digital Scaling"], threats: ["Agile Competitors"] },
      },
      signals: [
        { type: "TECH_EXPANSION", description: "طلب متزايد على الكفاءات التقنية", confidence: 80 },
        { type: "MARKET_OPPORTUNITY", description: "فرصة توسع إقليمي سريعة", confidence: 75 },
      ]
    };
  }

  const prompt = `أنت خبير استراتيجي في مبيعات الـ B2B وتحليل الشركات.
قم بتحليل الشركة التالية بناءً على بياناتها:
- اسم الشركة: ${company.name}
- المجال/الصناعة: ${company.industry || "غير محدد"}
- الدولة: ${company.country || "غير محدد"}
- عدد الموظفين: ${company.employee_count || "غير محدد"}
- الموقع الإلكتروني: ${company.website || "غير محدد"}

المطلوب إرجاع كائن JSON حصراً بنفس الهيكل التالي:
{
  "analysis": {
    "digital_maturity": 75,
    "pain_points": [
      { "problem": "اسم المشكلة أو التحدي", "evidence": "الدليل أو المؤشر", "confidence": 85 }
    ],
    "opportunities": [
      { "opportunity": "الفرصة المتاحة", "potential_service": "الخدمة المقترحة", "confidence": 80 }
    ],
    "swot": {
      "strengths": ["نقطة قوة 1", "نقطة قوة 2"],
      "weaknesses": ["نقطة ضعف 1", "نقطة ضعف 2"],
      "opportunities": ["فرصة 1", "فرصة 2"],
      "threats": ["تهديد 1", "تهديد 2"]
    }
  },
  "signals": [
    { "type": "EXPANSION", "description": "وصف مؤشر الشراء باللغة العربية", "confidence": 90 }
  ]
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errText}`);
  }

  const result = await response.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(rawText);
}

function authenticate(req: Request): { authorized: boolean; tenantId: string | null } {
  const authHeader = req.headers.get("Authorization");
  const apiKeyHeader = req.headers.get("x-api-key");

  let token = apiKeyHeader;
  if (!token && authHeader?.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (token && token === API_SECRET_KEY) {
    return { authorized: true, tenantId: "tenant_default" };
  }

  return { authorized: false, tenantId: null };
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (method === "GET" && url.pathname === "/health") {
    try {
      await sql`SELECT 1`;
      return jsonResponse({
        status: "ok",
        version: "3.2.0",
        storage: "PostgreSQL (Supabase)",
        ai_engine: GEMINI_API_KEY ? "Google Gemini 2.5 Flash" : "Fallback Heuristic",
        db_connected: true,
      });
    } catch (e: any) {
      return jsonResponse({ status: "error", message: e.message }, 500);
    }
  }

  const auth = authenticate(req);
  if (!auth.authorized) {
    return jsonResponse({ error: "Unauthorized: Invalid or missing API Key" }, 401);
  }

  const tenantId = auth.tenantId!;

  try {
    await ensureTablesExist();

    // Create Company
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

    // Analyze Company with Live Gemini AI
    if (method === "POST" && url.pathname.startsWith("/api/v1/companies/") && url.pathname.endsWith("/analyze")) {
      const parts = url.pathname.split("/");
      const id = parts[4];
      if (!id) return jsonResponse({ error: "Company ID is required" }, 400);

      const companies = await sql`SELECT * FROM companies WHERE id = ${id}::uuid AND tenant_id = ${tenantId}`;
      const company = companies[0];
      if (!company) return jsonResponse({ error: "Company not found", debug_id: id }, 404);

      console.log(`🤖 Analyzing company: ${company.name} with Gemini...`);
      const aiResult = await analyzeCompanyWithAI(company);

      await sql`
        UPDATE companies 
        SET analysis = ${sql.json(aiResult.analysis)}, buying_signals = ${sql.json(aiResult.signals)}, updated_at = NOW()
        WHERE id = ${id}::uuid AND tenant_id = ${tenantId}
      `;

      return jsonResponse({ success: true, data: aiResult });
    }

    // Create Deal
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

    // Negotiate Deal
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

    // Negotiation Summary
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

console.log("🚀 B2B Pipeline Pro (AI Powered) starting...");
Deno.serve(handler);
