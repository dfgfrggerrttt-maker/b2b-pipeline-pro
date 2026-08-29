// index.ts - Deno Deploy with Telegram Notifications
import postgres from "npm:postgres@3.4.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const dbUrl = Deno.env.get("DATABASE_URL");
if (!dbUrl) throw new Error("DATABASE_URL is required");

const sql = postgres(dbUrl, {
  ssl: "require",
  max: 5,
  idle_timeout: 20,
  prepare: false,
});

// Telegram Config
const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
const API_SECRET_KEY = Deno.env.get("API_SECRET_KEY");

// إرسال إشعار Telegram
async function sendTelegramNotification(message: string) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("⚠️ Telegram not configured");
    return;
  }
  
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });
    
    if (res.ok) {
      console.log("✅ Telegram notification sent");
    } else {
      console.error("❌ Telegram error:", await res.text());
    }
  } catch (error: any) {
    console.error("❌ Telegram failed:", error.message);
  }
}

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
      phone TEXT,
      email TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    
    await sql`CREATE TABLE IF NOT EXISTS negotiations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id UUID, actor TEXT, action TEXT,
      new_price INT, notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    
    try {
      await sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS description TEXT`;
      await sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS budget TEXT`;
      await sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS phone TEXT`;
      await sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS email TEXT`;
    } catch (e) { }
    
    dbInitialized = true;
    console.log("✅ Tables ready");
  } catch (err: any) {
    console.error(" DB Error:", err.message);
  }
}

ensureTablesExist();

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), { 
    status, 
    headers: { "Content-Type": "application/json", ...corsHeaders } 
  });
}

function safeValue(val: any, defaultVal: string = ''): string {
  return val === undefined || val === null ? defaultVal : String(val);
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;
  
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  // التحقق من API Key للـ Admin Endpoints
  const authHeader = req.headers.get("Authorization");
  const isValidAdmin = authHeader === `Bearer ${API_SECRET_KEY}`;

  try {
    await ensureTablesExist();

    // Health Check
    if (method === "GET" && url.pathname === "/health") {
      await sql`SELECT 1`;
      return jsonResponse({ status: "ok", version: "5.0.0", storage: "PostgreSQL", db_connected: true, telegram: !!TELEGRAM_TOKEN });
    }

    // إنشاء شركة
    if (method === "POST" && url.pathname === "/api/v1/companies") {
      const body = await req.json();
      const name = safeValue(body.name, 'Unknown');
      const industry = safeValue(body.industry, 'General');
      const country = safeValue(body.country, 'Unknown');
      const employeeCount = body.employee_count ? parseInt(String(body.employee_count)) : 10;
      const website = safeValue(body.website, 'https://example.com');
      
      const [company] = await sql`
        INSERT INTO companies (tenant_id, name, industry, country, employee_count, website, score, risk_level, pipeline_status) 
        VALUES ('tenant_1', ${name}, ${industry}, ${country}, ${employeeCount}, ${website}, 90, 'LOW', 'DISCOVERED') 
        RETURNING *
      `;
      return jsonResponse({ success: true, data: company });
    }

    // تحليل شركة
    if (method === "POST" && url.pathname.startsWith("/api/v1/companies/") && url.pathname.endsWith("/analyze")) {
      const id = url.pathname.split("/")[4];
      if (!id) return jsonResponse({ error: "ID required" }, 400);
      
      const companies = await sql`SELECT * FROM companies WHERE id = ${id}::uuid`;
      const company = companies[0];
      if (!company) return jsonResponse({ error: "Not found" }, 404);

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

      await sql`UPDATE companies SET analysis = ${sql.json(analysis)}, buying_signals = ${sql.json(signals)}, updated_at = NOW() WHERE id = ${id}::uuid`;
      return jsonResponse({ success: true, data: { analysis, signals } });
    }

    // إنشاء صفقة (Deal) - مع إشعار Telegram
    if (method === "POST" && url.pathname === "/api/v1/deals") {
      const body = await req.json();
      
      const companyId = safeValue(body.company_id, '');
      const serviceId = safeValue(body.service_id, 'custom');
      const description = safeValue(body.description, '');
      const budget = safeValue(body.budget, '');
      const phone = safeValue(body.phone, '');
      const email = safeValue(body.email, '');
      
      const [deal] = await sql`
        INSERT INTO deals (tenant_id, company_id, service_id, status, description, budget, phone, email) 
        VALUES ('tenant_1', ${companyId}::uuid, ${serviceId}, 'DISCOVERED', ${description}, ${budget}, ${phone}, ${email}) 
        RETURNING *
      `;
      
      // جلب بيانات الشركة للإشعار
      const companyRes = await sql`SELECT name, industry FROM companies WHERE id = ${companyId}::uuid`;
      const company = companyRes[0];
      
      // إرسال إشعار Telegram
      const message = `
 <b>طلب خدمة جديد!</b>

🆔 <b>رقم الصفقة:</b> <code>${deal.id}</code>
🏢 <b>الشركة:</b> ${company?.name || 'غير معروف'}
 <b>المجال:</b> ${company?.industry || 'غير محدد'}
️ <b>الخدمة:</b> ${serviceId}
📞 <b>الهاتف:</b> ${phone || 'غير متوفر'}
📧 <b>البريد:</b> ${email || 'غير متوفر'}

📝 <b>الوصف:</b>
${description.substring(0, 200)}${description.length > 200 ? '...' : ''}

⏰ <b>الوقت:</b> ${new Date().toLocaleString('ar-SA')}
      `;
      
      await sendTelegramNotification(message);
      
      return jsonResponse({ success: true, data: deal });
    }

    // ==================== ADMIN ENDPOINTS ====================
    
    // جلب جميع الطلبات (Admin فقط)
    if (method === "GET" && url.pathname === "/api/admin/deals") {
      if (!isValidAdmin) return jsonResponse({ error: "Unauthorized" }, 401);
      
      const deals = await sql`
        SELECT d.*, c.name as company_name, c.industry as company_industry
        FROM deals d
        LEFT JOIN companies c ON d.company_id = c.id
        ORDER BY d.created_at DESC
      `;
      return jsonResponse({ success: true, data: deals });
    }

    // جلب إحصائيات (Admin فقط)
    if (method === "GET" && url.pathname === "/api/admin/stats") {
      if (!isValidAdmin) return jsonResponse({ error: "Unauthorized" }, 401);
      
      const totalDeals = await sql`SELECT COUNT(*) as count FROM deals`;
      const pendingDeals = await sql`SELECT COUNT(*) as count FROM deals WHERE status = 'DISCOVERED'`;
      const completedDeals = await sql`SELECT COUNT(*) as count FROM deals WHERE status = 'COMPLETED'`;
      const totalCompanies = await sql`SELECT COUNT(*) as count FROM companies`;
      
      return jsonResponse({ 
        success: true, 
        data: {
          total_deals: totalDeals[0].count,
          pending_deals: pendingDeals[0].count,
          completed_deals: completedDeals[0].count,
          total_companies: totalCompanies[0].count
        }
      });
    }

    // تحديث حالة الطلب (Admin فقط)
    if (method === "PUT" && url.pathname.startsWith("/api/admin/deals/")) {
      if (!isValidAdmin) return jsonResponse({ error: "Unauthorized" }, 401);
      
      const dealId = url.pathname.split("/")[4];
      const body = await req.json();
      
      await sql`
        UPDATE deals 
        SET status = ${body.status}, updated_at = NOW()
        WHERE id = ${dealId}::uuid
      `;
      
      return jsonResponse({ success: true, message: "Status updated" });
    }

    // Negotiate Deal
    if (method === "POST" && url.pathname.startsWith("/api/v1/deals/") && url.pathname.endsWith("/negotiate")) {
      const dealId = url.pathname.split("/")[4];
      const body = await req.json();
      
      const action = safeValue(body.action, 'UNKNOWN');
      const newPrice = body.new_price ? parseInt(String(body.new_price)) : 0;
      const notes = safeValue(body.notes, '');
      
      await sql`INSERT INTO negotiations (deal_id, actor, action, new_price, notes) VALUES (${dealId}::uuid, 'USER', ${action}, ${newPrice}, ${notes})`;
      return jsonResponse({ success: true, message: "Recorded" });
    }

    // Negotiation Summary
    if (method === "GET" && url.pathname.startsWith("/api/v1/deals/") && url.pathname.endsWith("/negotiation-summary")) {
      const dealId = url.pathname.split("/")[4];
      const history = await sql`SELECT * FROM negotiations WHERE deal_id = ${dealId}::uuid ORDER BY created_at ASC`;
      const finalPrice = history.find((h: any) => h.action === "ACCEPTED")?.new_price;
      const status = history.length > 0 ? history[history.length - 1].action : "NEGOTIATING";
      return jsonResponse({ success: true, data: { history, final_price: finalPrice, status } });
    }

    return jsonResponse({ error: "Not Found" }, 404);
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    return jsonResponse({ error: error.message }, 500);
  }
}

console.log("🚀 B2B Pipeline Pro v5.0.0 (with Telegram Notifications)");
Deno.serve(handler);
