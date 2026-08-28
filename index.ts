// index.ts - Deno Deploy with Deno KV + DEBUG MODE
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";

const kv = await Deno.openKv();

function generateUUID(): string {
  return crypto.randomUUID();
}

const cors = oakCors({ origin: "*" });

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (method === "OPTIONS") {
    return cors(() => new Response(null, { status: 204 }))(req);
  }

  if (method === "GET" && path === "/") {
    return new Response(JSON.stringify({ message: "B2B Pipeline Pro v2.0", runtime: "Deno Deploy + KV" }), { headers: { "Content-Type": "application/json" } });
  }

  if (method === "GET" && path === "/health") {
    return new Response(JSON.stringify({ status: "ok", version: "2.0.0" }), { headers: { "Content-Type": "application/json" } });
  }

  if (method === "POST" && path === "/api/v1/companies") {
    try {
      const body = await req.json();
      const company = {
        tenant_id: 'tenant_1',
        ...body,
        score: 90,
        risk_level: "LOW",
        pipeline_status: "DISCOVERED",
        id: generateUUID(),
        created_at: new Date().toISOString()
      };
      
      // حفظ في قاعدة البيانات
      await kv.set(["companies", company.id], company);
      return new Response(JSON.stringify({ success: true, data: company }), { headers: { "Content-Type": "application/json" } });
    } catch (error: any) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
  }

  // 🔍 نقطة التشخيص (DEBUG)
  if (method === "POST" && path.startsWith("/api/v1/companies/") && path.endsWith("/analyze")) {
    const parts = path.split("/");
    const id = parts[4]; 
    
    // 1. محاولة جلب الشركة
    const companyEntry = await kv.get(["companies", id]);
    
    // 2. جلب كل ما هو محفوظ في قاعدة البيانات تحت "companies" للتأكد
    const allKeys = [];
    for await (const entry of kv.list({ prefix: ["companies"] })) {
      allKeys.push({ key: entry.key, saved_id: entry.key[1] });
    }

    return new Response(JSON.stringify({
      debug_info: {
        requested_id: id,
        path_parts: parts,
        found_in_db: companyEntry.value !== null,
        actual_value_in_db: companyEntry.value,
        all_companies_currently_in_db: allKeys
      },
      error: "Company not found. Please check debug_info to see what's in the database."
    }), { 
      status: 404, 
      headers: { "Content-Type": "application/json" } 
    });
  }

  return new Response(JSON.stringify({ error: "Not Found", path: path }), { status: 404, headers: { "Content-Type": "application/json" } });
}

console.log("🚀 B2B Pipeline Pro running with DEBUG mode");
Deno.serve(handler);
