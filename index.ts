// index.ts - Deno Deploy with PostgreSQL (Correct Pool Usage)
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";

let pool: Pool;

try {
  const dbUrl = Deno.env.get("DATABASE_URL");
  
  if (!dbUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  
  // استخدام Pooler (port 6543)
  const poolUrl = dbUrl.replace(":5432/", ":6543/");
  
  pool = new Pool(poolUrl, 10, true);
  console.log("✅ PostgreSQL Pool Connected!");
  
  // إنشاء الجداول باستخدام client من pool
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
  
} catch (error) {
  console.error("❌ Database connection error:", error.message);
  throw error;
}

const cors = oakCors({ origin: "*" });

// دالة مساعدة للاستعلامات
async function query(sql: TemplateStringsArray, ...args: any[]) {
  const client = await pool.connect();
  try {
    return await client.queryObject(sql, ...args);
  } finally {
    client.release();
  }
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;

  if (method === "OPTIONS") return cors(() => new Response(null, { status: 204 }))(req);

  // Health Check
  if (method === "GET" && url.pathname === "/health") {
    try {
      await query`SELECT 1`;
      return new Response(JSON.stringify({ 
        status: "ok", 
        version: "3.0.0", 
        storage: "PostgreSQL (Supabase Pooler)",
        db_connected: true 
      }), { headers: { "Content-Type": "application/json" } });
    } catch (error: any) {
      return new Response(JSON.stringify({ 
        status: "error", 
        error: error.message 
      }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }

  // Create Company
  if (method === "POST" && url.pathname === "/api/v1/companies") {
    try {
      const body = await req.json();
      const score = 90;
      
      const result = await query`
        INSERT INTO companies (tenant_id, name, industry, country, employee_count, website, score, risk_level, pipeline_status)
        VALUES ('tenant_1', ${body.name}, ${body.industry}, ${body.country}, ${body.employee_count}, ${body.website}, ${score}, 'LOW', 'DISCOVERED')
        RETURNING *
      `;
      
      return new Response(JSON.stringify({ success: true, data: result.rows[0] }), { 
        headers: { "Content-Type": "application/json" } 
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { 
        status: 400, headers: { "Content-Type": "application/json" } 
      });
    }
  }

  // Analyze Company
  if (method === "POST" && url.pathname.startsWith("/api/v1/companies/") && url.pathname.endsWith("/analyze")) {
    const id = url.pathname.split("/")[5];
    
    const companyRes = await query`SELECT * FROM companies WHERE id = ${id}`;
    const company = companyRes.rows[0];

    if (!company) {
      return new Response(JSON.stringify({ error: "Company not found" }), { 
        status: 404, headers: { "Content-Type": "application/json" } 
      });
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
      WHERE id = ${id}
    `;

    return new Response(JSON.stringify({ success: true, data: { analysis, signals } }), { 
      headers: { "Content-Type": "application/json" } 
    });
  }

  // Create Deal
  if (method === "POST" && url.pathname === "/api/v1/deals") {
    try {
      const body = await req.json();
      const result = await query`
        INSERT INTO deals (tenant_id, company_id, service_id, status)
        VALUES ('tenant_1', ${body.company_id}, ${body.service_id}, 'DISCOVERED')
        RETURNING *
      `;
      return new Response(JSON.stringify({ success: true, data: result.rows[0] }), { 
        headers: { "Content-Type": "application/json" } 
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { 
        status: 400, headers: { "Content-Type": "application/json" } 
      });
    }
  }

  // Negotiate Deal
  if (method === "POST" && url.pathname.startsWith("/api/v1/deals/") && url.pathname.endsWith("/negotiate")) {
    const dealId = url.pathname.split("/")[5];
    const body = await req.json();
    
    await query`
      INSERT INTO negotiations (deal_id, actor, action, new_price, notes)
      VALUES (${dealId}, 'USER', ${body.action}, ${body.new_price}, ${body.notes})
    `;
    
    return new Response(JSON.stringify({ success: true, message: "Negotiation recorded" }), { 
      headers: { "Content-Type": "application/json" } 
    });
  }

  // Negotiation Summary
  if (method === "GET" && url.pathname.startsWith("/api/v1/deals/") && url.pathname.endsWith("/negotiation-summary")) {
    const dealId = url.pathname.split("/")[5];
    const historyRes = await query`
      SELECT * FROM negotiations WHERE deal_id = ${dealId} ORDER BY created_at ASC
    `;
    
    const history = historyRes.rows;
    const finalPrice = history.find((h: any) => h.action === 'ACCEPTED')?.new_price;
    const status = history.length > 0 ? history[history.length - 1].action : 'NEGOTIATING';

    return new Response(JSON.stringify({ success: true, data: { history, final_price: finalPrice, status } }), { 
      headers: { "Content-Type": "application/json" } 
    });
  }

  return new Response(JSON.stringify({ error: "Not Found" }), { 
    status: 404, headers: { "Content-Type": "application/json" } 
  });
}

console.log("🚀 B2B Pipeline Pro v3.0 running with PostgreSQL Pooler");
Deno.serve(handler);
