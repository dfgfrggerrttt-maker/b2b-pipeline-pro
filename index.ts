// index.ts - Deno Deploy with Supabase PostgreSQL (Clean Version)
import postgres from "npm:postgres@3.4.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const dbUrl = Deno.env.get("DATABASE_URL");
if (!dbUrl) {
  console.error("❌ DATABASE_URL is not set!");
  throw new Error("DATABASE_URL environment variable is required");
}

console.log("🔗 Connecting to Supabase PostgreSQL...");

const sql = postgres(dbUrl, {
  ssl: "require",
  max: 5,
  idle_timeout: 20,
  prepare: false,
});

console.log("✅ Database client created successfully");

let dbInitialized = false;
async function ensureTablesExist() {
  if (dbInitialized) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS companies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT, name TEXT, industry TEXT, country TEXT,
      employee_count INT, website TEXT, score INT, risk_level TEXT,
      pipeline_status TEXT, analysis JSONB, buying_signals JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    
    await sql`CREATE TABLE IF NOT EXISTS deals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT, company_id UUID, service_id TEXT,
      status TEXT DEFAULT 'DISCOVERED',
      description TEXT,
      budget TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    
    await sql`CREATE TABLE IF NOT EXISTS negotiations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id UUID, actor TEXT, action TEXT,
      new_price INT, notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    
    // إصلاح للأعمدة المفقودة في حال وجود جداول قديمة
    try {
      await sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS description TEXT`;
      await sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS budget TEXT`;
    } catch (e) { /* تجاهل الخطأ إذا كانت الأعمدة موجودة */ }
    
    dbInitialized = true;
    console.log("✅ Database tables verified");
  } catch (err: any) {
    console.error("❌ DB Init Error:", err.message);
  }
}

ensureTablesExist().catch((err) => console.warn("⚠️ Background DB init deferred:", err.message));

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), { 
    status, 
    headers: { "Content-Type": "application/json", ...corsHeaders } 
  });
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;
  
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    await ensureTablesExist();

    if (method === "GET" && url.pathname === "/health") {
      await sql`SELECT 1`;
      return jsonResponse({ status: "ok", version: "4.2.0", storage: "PostgreSQL (Supabase)", db_connected: true });
    }

    if (method === "POST" && url.pathname === "/api/v1/companies") {
      const body = await req.json();
      const [company] = await sql`INSERT INTO companies (tenant_id, name, industry, country, employee_count, website, score, risk_level, pipeline_status) VALUES ('tenant_1', ${body.name}, ${body.industry}, ${body.country}, ${body.employee_count || 10}, ${body.website}, 90, 'LOW', 'DISCOVERED') RETURNING *`;
      return jsonResponse({ success: true, data: company });
    }

    if (method === "POST" && url.pathname.startsWith("/api/v1/companies/") && url.pathname.endsWith("/analyze")) {
      const id = url.pathname.split("/")[4];
      if (!id) return jsonResponse({ error: "Company ID is required" }, 400);
      const companies = await sql`SELECT * FROM companies WHERE id = ${id}::uuid`;
      const company = companies[0];
      if (!company) return jsonResponse({ error: "Company not found", debug_id: id }, 404);

      const analysis = { digital_maturity: 60, pain_points: [{ problem: "Limited tech adoption", evidence: "Large team", confidence: 80 }], opportunities: [{ opportunity: "Digital transformation", potential_service: "consulting", confidence: 75 }], swot: { strengths: ["Established"], weaknesses: ["Tech adoption"], opportunities: ["Growth"], threats: ["Competition"] } };
      const signals = [{ type: "HIRING", description: "توسع في فريق الهندسة", confidence: 85 }, { type: "FUNDING", description: "احتمال حصول على تمويل", confidence: 70 }];

      await sql`UPDATE companies SET analysis = ${sql.json(analysis)}, buying_signals = ${sql.json(signals)}, updated_at = NOW() WHERE id = ${id}::uuid`;
      return jsonResponse({ success: true, data: { analysis, signals } });
    }

    if (method === "POST" && url.pathname === "/api/v1/deals") {
      const body = await req.json();
      console.log("📥 New deal request:", body);
      const [deal] = await sql`INSERT INTO deals (tenant_id, company_id, service_id, status, description, budget) VALUES ('tenant_1', ${body.company_id}::uuid, ${body.service_id}, 'DISCOVERED', ${body.description || ''}, ${body.budget || ''}) RETURNING *`;
      console.log("✅ Deal created:", deal);
      return jsonResponse({ success: true, data: deal });
    }

    if (method === "POST" && url.pathname.startsWith("/api/v1/deals/") && url.pathname.endsWith("/negotiate")) {
      const dealId = url.pathname.split("/")[4];
      const body = await req.json();
      await sql`INSERT INTO negotiations (deal_id, actor, action, new_price, notes) VALUES (${dealId}::uuid, 'USER', ${body.action}, ${body.new_price}, ${body.notes})`;
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
    console.error("❌ Handler error:", error.message);
    return jsonResponse({ error: error.message }, 500);
  }
}

console.log("🚀 B2B Pipeline Pro v4.2.0 starting (Supabase Only)...");
Deno.serve(handler);
