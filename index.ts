// index.ts - Deno Deploy with In-Memory Map (Ultra-Reliable & Fast)
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";

// 🔥 طريقة تخزين جديدة: خريطة في الذاكرة (أسرع وأضمن 100% للتجربة)
const db = {
  companies: new Map<string, any>(),
  deals: new Map<string, any>(),
  negotiations: new Map<string, any>()
};

function generateUUID(): string {
  return crypto.randomUUID();
}

const cors = oakCors({ origin: "*" });

// تعريف أنماط الروابط بدقة باستخدام URLPattern
const companyAnalyzePattern = new URLPattern({ pathname: "/api/v1/companies/:id/analyze" });
const dealNegotiatePattern = new URLPattern({ pathname: "/api/v1/deals/:id/negotiate" });
const dealSummaryPattern = new URLPattern({ pathname: "/api/v1/deals/:id/negotiation-summary" });

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;

  if (method === "OPTIONS") {
    return cors(() => new Response(null, { status: 204 }))(req);
  }

  // 1. Health Check
  if (method === "GET" && url.pathname === "/health") {
    return new Response(JSON.stringify({ status: "ok", version: "2.0.0", storage: "In-Memory Map" }), { 
      headers: { "Content-Type": "application/json" } 
    });
  }

  // 2. Create Company
  if (method === "POST" && url.pathname === "/api/v1/companies") {
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
      
      // ✅ حفظ في الذاكرة فوراً وبشكل مضمون
      db.companies.set(company.id, company);
      
      return new Response(JSON.stringify({ success: true, data: company }), { 
        headers: { "Content-Type": "application/json" } 
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { 
        status: 400, headers: { "Content-Type": "application/json" } 
      });
    }
  }

  // 3. Analyze Company
  const analyzeMatch = companyAnalyzePattern.exec(req.url);
  if (method === "POST" && analyzeMatch) {
    const id = analyzeMatch.pathname.groups.id; 
    
    const company = db.companies.get(id);
    
    if (!company) {
      return new Response(JSON.stringify({ 
        error: "Company not found", 
        debug_id: id, 
        available_ids: Array.from(db.companies.keys()) // لعرفك إذا كان هناك خطأ في المطابقة
      }), { 
        status: 404, headers: { "Content-Type": "application/json" } 
      });
    }

    company.analysis = {
      digital_maturity: 60,
      pain_points: [{ problem: "Limited tech adoption", evidence: "Large team", confidence: 80 }],
      opportunities: [{ opportunity: "Digital transformation", potential_service: "consulting", confidence: 75 }],
      swot: { strengths: ["Established"], weaknesses: ["Tech adoption"], opportunities: ["Growth"], threats: ["Competition"] },
      analyzed_at: new Date().toISOString()
    };
    company.buying_signals = [
      { type: "HIRING", description: "توسع في فريق الهندسة", confidence: 85 },
      { type: "FUNDING", description: "احتمال حصول على تمويل", confidence: 70 }
    ];
    company.updated_at = new Date().toISOString();

    // ✅ تحديث في الذاكرة
    db.companies.set(id, company);

    return new Response(JSON.stringify({ success: true, data: { analysis: company.analysis, signals: company.buying_signals } }), { 
      headers: { "Content-Type": "application/json" } 
    });
  }

  // 4. Create Deal
  if (method === "POST" && url.pathname === "/api/v1/deals") {
    try {
      const body = await req.json();
      const deal = {
        tenant_id: 'tenant_1',
        ...body,
        status: 'DISCOVERED',
        id: generateUUID(),
        created_at: new Date().toISOString()
      };
      db.deals.set(deal.id, deal);
      return new Response(JSON.stringify({ success: true, data: deal }), { 
        headers: { "Content-Type": "application/json" } 
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
  }

  // 5. Negotiate Deal
  const negotiateMatch = dealNegotiatePattern.exec(req.url);
  if (method === "POST" && negotiateMatch) {
    const dealId = negotiateMatch.pathname.groups.id;
    const body = await req.json();
    
    const history = {
      deal_id: dealId,
      action: body.action,
      new_price: body.new_price,
      notes: body.notes,
      id: generateUUID(),
      created_at: new Date().toISOString()
    };
    
    db.negotiations.set(history.id, history);
    return new Response(JSON.stringify({ success: true, message: 'Negotiation recorded' }), { 
      headers: { "Content-Type": "application/json" } 
    });
  }

  // 6. Negotiation Summary
  const summaryMatch = dealSummaryPattern.exec(req.url);
  if (method === "GET" && summaryMatch) {
    const dealId = summaryMatch.pathname.groups.id;
    const history = [];
    
    for (const [key, value] of db.negotiations.entries()) {
      if (value.deal_id === dealId) history.push(value);
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      data: { 
        history,
        final_price: history.find((h: any) => h.action === 'ACCEPTED')?.new_price,
        status: history[history.length - 1]?.action || 'NEGOTIATING'
      } 
    }), { headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Not Found", path: url.pathname }), { 
    status: 404, headers: { "Content-Type": "application/json" } 
  });
}

console.log("🚀 B2B Pipeline Pro running with In-Memory Map (Ultra-Fast & Reliable)");
Deno.serve(handler);
