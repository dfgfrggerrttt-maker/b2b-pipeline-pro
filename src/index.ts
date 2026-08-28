// index.ts - Deno Deploy with PostgreSQL (Direct Connection)
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

let pool: Pool;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

try {
  const dbUrl = Deno.env.get("DATABASE_URL");
  
  if (!dbUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  
  console.log("🔗 Connecting to database...");
  
  // ✅ استخدم الرابط مباشرة بدون تغيير المنفذ
  // Deno Deploy يتصل تلقائياً بشكل صحيح
  pool = new Pool(dbUrl, 5, true);
  
  console.log("✅ PostgreSQL Pool Connected!");
  
  // اختبار الاتصال وإنشاء الجداول
  const client = await pool.connect();
  try {
    await client.queryObject`
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id TEXT,
        name TEXT,
        industry TEXT,
        country TEXT,
        employee_count INT,
        website TEXT,
        score INT,
        risk_level TEXT,
        pipeline_status TEXT,
        analysis JSONB,
        buying_signals JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    
    await client.queryObject`
      CREATE TABLE IF NOT EXISTS deals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id TEXT,
        company_id UUID,
        service_id TEXT,
        status TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    
    await client.queryObject`
      CREATE TABLE IF NOT EXISTS negotiations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id UUID,
        actor TEXT,
        action TEXT,
        new_price INT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    
    console.log("✅ Tables Created Successfully!");
  } finally {
    client.release();
  }
  
} catch (error: any) {
  console.error("❌ Database connection error:", error.message);
  console.error("Full error:", error);
  throw error;
}

async function query(strings: TemplateStringsArray, ...values: any[]) {
  const client = await pool.connect();
  try {
    return await client.queryObject(strings, ...values);
  } finally {
    client.release();
  }
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (method === "GET" && url.pathname === "/health") {
    try {
      await query`SELECT 1`;
      return jsonResponse({ 
        status: "ok", 
        version: "3.0.0", 
        storage: "PostgreSQL (Direct Connection)",
        db_connected: true 
      });
    } catch (error: any) {
      return jsonResponse({ status: "error", error: error.message }, 500);
    }
  }

  if (method === "POST" && url.pathname === "/api/v1/companies") {
    try {
      const body = await req.json();
      const score = 90;
      
      const result = await query`
        INSERT INTO companies (tenant_id, name, industry, country, employee_count, website, score, risk_level, pipeline_status)
        VALUES ('tenant_1', ${body.name}, ${body.industry}, ${body.country}, ${body.employee_count}, ${body.website}, ${score}, 'LOW', 'DISCOVERED')
        RETURNING *
      `;
      
      return jsonResponse({ success: true, data: result.rows[0] });
    } catch (error: any) {
      return jsonResponse({ success: false, error: error.message }, 400);
    }
  }

  if (method === "POST" && url.pathname.startsWith("/api/v1/companies/") && url.pathname.endsWith("/analyze")) {
    try {
      const id = url.pathname.split("/")[4];
      
      const companyRes = await query`SELECT * FROM companies WHERE id = ${id}::uuid`;
      const company = companyRes.rows[0];

      if (!company) {
        return jsonResponse({ error: "Company not found" }, 404);
      }

      const analysis = {
        digital_maturity: 60,
        pain_points: [{ problem: "Limited tech adoption", evidence: "Large team", confidence: 80 }],
        opportunities: [{ opportunity: "Digital transformation", potential_service: "consulting", confidence: 75 }],
        swot: { strengths: ["Established"], weaknesses: ["Tech adoption"], opportunities: ["Growth"], threats: ["Competition"] }
      };
      
      const signals = [
        { type: "HIRING", description: "توسع في فريق الهندسة", confidence: 85 },
        { type: "FUNDING", description: "احتمال حصول على تمويل", confidence: 70 }
      ];

      await query`
        UPDATE companies 
        SET analysis = ${JSON.stringify(analysis)}, buying_signals = ${JSON.stringify(signals)}, updated_at = NOW()
        WHERE id = ${id}::uuid
      `;

      return jsonResponse({ success: true, data: { analysis, signals } });
    } catch (error: any) {
      return jsonResponse({ success: false, error: error.message }, 400);
    }
  }

  if (method === "POST" && url.pathname === "/api/v1/deals") {
    try {
      const body = await req.json();
      const result = await query`
        INSERT INTO deals (tenant_id, company_id, service_id, status)
        VALUES ('tenant_1', ${body.company_id}::uuid, ${body.service_id}, 'DISCOVERED')
        RETURNING *
      `;
      return jsonResponse({ success: true, data: result.rows[0] });
    } catch (error: any) {
      return jsonResponse({ success: false, error: error.message }, 400);
    }
  }

  if (method === "POST" && url.pathname.startsWith("/api/v1/deals/") && url.pathname.endsWith("/negotiate")) {
    try {
      const dealId = url.pathname.split("/")[4];
      const body = await req.json();
      
      await query`
        INSERT INTO negotiations (deal_id, actor, action, new_price, notes)
        VALUES (${dealId}::uuid, 'USER', ${body.action}, ${body.new_price}, ${body.notes})
      `;
      
      return jsonResponse({ success: true, message: "Negotiation recorded" });
    } catch (error: any) {
      return jsonResponse({ success: false, error: error.message }, 400);
    }
  }

  if (method === "GET" && url.pathname.startsWith("/api/v1/deals/") && url.pathname.endsWith("/negotiation-summary")) {
    try {
      const dealId = url.pathname.split("/")[4];
      const historyRes = await query`
        SELECT * FROM negotiations WHERE deal_id = ${dealId}::uuid ORDER BY created_at ASC
      `;
      
      const history = historyRes.rows as any[];
      const finalPrice = history.find((h) => h.action === 'ACCEPTED')?.new_price;
      const status = history.length > 0 ? history[history.length - 1].action : 'NEGOTIATING';

      return jsonResponse({ success: true, data: { history, final_price: finalPrice, status } });
    } catch (error: any) {
      return jsonResponse({ success: false, error: error.message }, 400);
    }
  }

  return jsonResponse({ error: "Not Found" }, 404);
}

console.log("🚀 B2B Pipeline Pro running on Deno Deploy");
Deno.serve(handler);
