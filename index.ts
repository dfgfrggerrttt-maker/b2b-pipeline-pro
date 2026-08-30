// index.ts - Fixed Gemini AI Analysis with Better Logging
import postgres from "npm:postgres@3.4.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const dbUrl = Deno.env.get("DATABASE_URL");
if (!dbUrl) throw new Error("DATABASE_URL is required");

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
const API_SECRET_KEY = Deno.env.get("API_SECRET_KEY");

console.log("🔑 GEMINI_API_KEY exists:", !!GEMINI_API_KEY);
if (GEMINI_API_KEY) {
  console.log("🔑 Key starts with:", GEMINI_API_KEY.substring(0, 10) + "...");
}

const sql = postgres(dbUrl, {
  ssl: "require",
  max: 5,
  idle_timeout: 20,
  prepare: false,
});

async function sendTelegramNotification(message: string) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' })
    });
  } catch (error) {
    console.error("❌ Telegram failed:", error.message);
  }
}

async function analyzeWithGemini(company: any): Promise<any> {
  console.log(`🔍 Starting analysis for: ${company.name} (${company.industry})`);
  
  if (!GEMINI_API_KEY) {
    console.warn("⚠️ GEMINI_API_KEY not found! Using fallback analysis.");
    return generateFallbackAnalysis(company);
  }

  const prompt = `
أنت خبير استراتيجي في التحول الرقمي. حلل الشركة التالية بعمق:

**بيانات الشركة:**
- الاسم: ${company.name}
- المجال: ${company.industry}
- الدولة: ${company.country}
- عدد الموظفين: ${company.employee_count || 10}
- الموقع: ${company.website || 'غير متوفر'}

**المطلوب:**
قدم تحليلاً مخصصاً لهذا النوع من الشركات في ${company.country}، يتضمن:

1. **مستوى النضج الرقمي** (رقم 0-100)

2. **نقاط الألم** - 3 نقاط محددة لهذا المجال:
   - المشكلة
   - الدليل
   - نسبة الثقة (0-100)

3. **الفرص المتاحة** - 3 فرص عملية:
   - الفرصة
   - الخدمة المقترحة
   - نسبة الثقة (0-100)

4. **تحليل SWOT** مفصل

5. **مؤشرات الشراء** - 2-3 مؤشرات

**أجب بصيغة JSON فقط** بدون أي نص إضافي، بهذا الشكل:
{
  "digital_maturity": 60,
  "pain_points": [
    {"problem": "مشكلة محددة", "evidence": "دليل", "confidence": 80}
  ],
  "opportunities": [
    {"opportunity": "فرصة محددة", "potential_service": "service", "confidence": 75}
  ],
  "swot": {
    "strengths": ["قوة 1", "قوة 2"],
    "weaknesses": ["ضعف 1", "ضعف 2"],
    "opportunities": ["فرصة 1", "فرصة 2"],
    "threats": ["تهديد 1", "تهديد 2"]
  },
  "buying_signals": [
    {"type": "HIRING", "description": "وصف", "confidence": 85}
  ]
}
`;

  try {
    console.log("📡 Sending request to Gemini API...");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
          }
        })
      }
    );

    console.log("📡 Response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Gemini API error:", errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(" Gemini response received");
    
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      const analysisText = data.candidates[0].content.parts[0].text;
      console.log(" Raw response:", analysisText.substring(0, 200) + "...");
      
      // استخراج JSON
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        console.log("✅ Successfully parsed analysis");
        console.log(" Pain points found:", analysis.pain_points?.length || 0);
        console.log(" Opportunities found:", analysis.opportunities?.length || 0);
        return analysis;
      } else {
        console.error("❌ No JSON found in response");
      }
    } else {
      console.error("❌ No valid response from Gemini");
    }
    
    // Fallback
    console.warn("️ Using fallback analysis due to parsing error");
    return generateFallbackAnalysis(company);
    
  } catch (error: any) {
    console.error("❌ Gemini analysis failed:", error.message);
    return generateFallbackAnalysis(company);
  }
}

function generateFallbackAnalysis(company: any): any {
  console.log("🔄 Generating fallback analysis for:", company.industry);
  
  // تحليل مخصص حسب المجال
  const industryAnalysis: any = {
    'مطعم': {
      pain_points: [
        { problem: "عدم وجود منيو رقمي تفاعلي، مما يجعل عملية الطلب معقدة للعملاء", evidence: "Manual menu process", confidence: 90 },
        { problem: "نظام حجز الطاولات يدوي، يؤدي إلى أخطاء وازدحام", evidence: "Manual booking system", confidence: 85 },
        { problem: "عدم وجود نظام ولاء رقمي للعملاء الدائمين", evidence: "No loyalty program", confidence: 80 }
      ],
      opportunities: [
        { opportunity: "تطبيق طلبات إلكتروني مع نظام دفع متكامل", potential_service: "mobile_app", confidence: 90 },
        { opportunity: "منيو رقمي مع QR code في كل طاولة", potential_service: "menu_digital", confidence: 95 },
        { opportunity: "نظام إدارة مخزون ذكي للمواد الغذائية", potential_service: "inventory_system", confidence: 85 }
      ],
      swot: {
        strengths: ["موقع استراتيجي", "جودة الطعام"],
        weaknesses: ["عمليات يدوية", "عدم وجود حضور رقمي"],
        opportunities: ["الطلب المتزايد على التوصيل", "التحول الرقمي في المطاعم"],
        threats: ["منافسة شديدة من تطبيقات التوصيل", "ارتفاع التكاليف"]
      },
      buying_signals: [
        { type: "TECH_UPGRADE", description: "الحاجة إلى نظام طلبات رقمي لتقليل الأخطاء", confidence: 90 },
        { type: "EXPANSION", description: "التوسع في خدمة التوصيل لزيادة المبيعات", confidence: 85 }
      ]
    },
    'متجر': {
      pain_points: [
        { problem: "عدم وجود متجر إلكتروني، مما يفقدك مبيعات كبيرة من الإنترنت", evidence: "No online presence", confidence: 95 },
        { problem: "إدارة المخزون يدوياً تؤدي إلى أخطاء في الجرد", evidence: "Manual inventory", confidence: 85 },
        { problem: "عدم وجود نظام CRM لمتابعة العملاء", evidence: "No customer tracking", confidence: 80 }
      ],
      opportunities: [
        { opportunity: "متجر إلكتروني متكامل مع نظام دفع", potential_service: "ecommerce", confidence: 95 },
        { opportunity: "تطبيق ولاء للعملاء مع نقاط ومكافآت", potential_service: "loyalty_app", confidence: 85 },
        { opportunity: "نظام إدارة مخزون ذكي مع تنبيهات", potential_service: "inventory_system", confidence: 90 }
      ],
      swot: {
        strengths: ["منتجات متنوعة", "موقع فعلي جيد"],
        weaknesses: ["عدم وجود قناة بيع إلكترونية", "إدارة يدوية"],
        opportunities: ["نمو التجارة الإلكترونية", "زيادة الطلب على التسوق أونلاين"],
        threats: ["منافسة المتاجر الإلكترونية الكبرى", "تغير سلوك المستهلك"]
      },
      buying_signals: [
        { type: "REVENUE_LOSS", description: "فقدان مبيعات بسبب عدم وجود متجر إلكتروني", confidence: 95 },
        { type: "EFFICIENCY", description: "الحاجة إلى أتمتة إدارة المخزون", confidence: 85 }
      ]
    },
    'شركة خدمات': {
      pain_points: [
        { problem: "نظام جدولة المواعيد يدوي، يؤدي إلى تضارب وتضييع وقت", evidence: "Manual scheduling", confidence: 90 },
        { problem: "عدم وجود نظام CRM لمتابعة العملاء والمشاريع", evidence: "No CRM system", confidence: 85 },
        { problem: "التقارير المالية والإدارية تُعد يدوياً، تستغرق وقتاً طويلاً", evidence: "Manual reporting", confidence: 80 }
      ],
      opportunities: [
        { opportunity: "نظام حجز مواعيد إلكتروني مع إشعارات تلقائية", potential_service: "booking_system", confidence: 90 },
        { opportunity: "منصة إدارة مشاريع ومتابعة المهام", potential_service: "project_management", confidence: 85 },
        { opportunity: "نظام CRM متكامل لإدارة العلاقات مع العملاء", potential_service: "crm_system", confidence: 90 }
      ],
      swot: {
        strengths: ["فريق متخصص", "خبرة في المجال"],
        weaknesses: ["عمليات يدوية", "عدم وجود أنظمة متكاملة"],
        opportunities: ["الطلب المتزايد على الخدمات الاحترافية", "التحول الرقمي"],
        threats: ["منافسة شركات تقنية ناشئة", "توقعات العملاء المتزايدة"]
      },
      buying_signals: [
        { type: "EFFICIENCY", description: "الحاجة إلى أتمتة الجدولة والتقارير", confidence: 90 },
        { type: "GROWTH", description: "التوسع يحتاج إلى أنظمة قابلة للتوسع", confidence: 85 }
      ]
    },
    'شركة تقنية': {
      pain_points: [
        { problem: "البنية التحتية التقنية قديمة، لا تدعم التوسع", evidence: "Outdated infrastructure", confidence: 85 },
        { problem: "عدم وجود استراتيجية واضحة للذكاء الاصطناعي والأتمتة", evidence: "No AI strategy", confidence: 90 },
        { problem: "عمليات التطوير والنشر (DevOps) غير مؤتمتة", evidence: "Manual DevOps", confidence: 80 }
      ],
      opportunities: [
        { opportunity: "ترحيل البنية إلى السحابة (Cloud Migration)", potential_service: "cloud_migration", confidence: 90 },
        { opportunity: "دمج حلول الذكاء الاصطناعي في المنتجات", potential_service: "ai_integration", confidence: 85 },
        { opportunity: "أتمتة عمليات CI/CD لزيادة الكفاءة", potential_service: "devops_automation", confidence: 90 }
      ],
      swot: {
        strengths: ["فريق تقني متميز", "منتجات مبتكرة"],
        weaknesses: ["بنية تحتية قديمة", "عدم وجود استراتيجية AI"],
        opportunities: ["النمو السريع في مجال AI", "الطلب على الحلول السحابية"],
        threats: ["منافسة شركات عالمية", "سرعة التغير التقني"]
      },
      buying_signals: [
        { type: "TECH_UPGRADE", description: "الحاجة إلى تحديث البنية التقنية", confidence: 85 },
        { type: "INNOVATION", description: "دمج AI للحفاظ على القدرة التنافسية", confidence: 90 }
      ]
    }
  };

  // استخدام التحليل المخصص أو افتراضي
  const analysis = industryAnalysis[company.industry] || {
    pain_points: [
      { problem: `عدم وجود استراتيجية رقمية واضحة في مجال ${company.industry}`, evidence: "No digital strategy", confidence: 75 },
      { problem: "الاعتماد على العمليات اليدوية يقلل الكفاءة", evidence: "Manual processes", confidence: 80 },
      { problem: "عدم وجود حضور رقمي قوي يؤثر على الوصول للعملاء", evidence: "Weak digital presence", confidence: 85 }
    ],
    opportunities: [
      { opportunity: "التحول الرقمي لزيادة الكفاءة التشغيلية", potential_service: "digital_transformation", confidence: 85 },
      { opportunity: "تطوير منصة رقمية لزيادة المبيعات", potential_service: "web_development", confidence: 80 },
      { opportunity: "أتمتة العمليات الروتينية لتوفير الوقت", potential_service: "automation", confidence: 90 }
    ],
    swot: {
      strengths: ["فريق عمل متميز", "خبرة في المجال"],
      weaknesses: ["اعتماد على العمليات اليدوية", "عدم وجود حضور رقمي قوي"],
      opportunities: ["النمو في السوق الرقمي", "زيادة الطلب على الخدمات الإلكترونية"],
      threats: ["منافسة شديدة من الشركات الرقمية", "تغير تفضيلات العملاء"]
    },
    buying_signals: [
      { type: "TECH_UPGRADE", description: "الحاجة إلى تحديث البنية التقنية", confidence: 70 },
      { type: "EFFICIENCY", description: "الحاجة إلى أتمتة العمليات", confidence: 75 }
    ]
  };

  return {
    digital_maturity: Math.floor(Math.random() * 40) + 40, // 40-80
    ...analysis
  };
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
      description TEXT, budget TEXT, phone TEXT, email TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
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

  const authHeader = req.headers.get("Authorization");
  const isValidAdmin = authHeader === `Bearer ${API_SECRET_KEY}`;

  try {
    await ensureTablesExist();

    if (method === "GET" && url.pathname === "/health") {
      await sql`SELECT 1`;
      return jsonResponse({ 
        status: "ok", 
        version: "6.1.0", 
        storage: "PostgreSQL", 
        db_connected: true,
        telegram: !!TELEGRAM_TOKEN,
        gemini: !!GEMINI_API_KEY
      });
    }

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

    if (method === "POST" && url.pathname.startsWith("/api/v1/companies/") && url.pathname.endsWith("/analyze")) {
      const id = url.pathname.split("/")[4];
      if (!id) return jsonResponse({ error: "ID required" }, 400);
      
      const companies = await sql`SELECT * FROM companies WHERE id = ${id}::uuid`;
      const company = companies[0];
      if (!company) return jsonResponse({ error: "Not found" }, 404);

      console.log(`🔍 Analyzing company: ${company.name} (${company.industry})`);
      
      const analysis = await analyzeWithGemini(company);
      const signals = analysis.buying_signals || [];

      await sql`UPDATE companies SET analysis = ${sql.json(analysis)}, buying_signals = ${sql.json(signals)}, updated_at = NOW() WHERE id = ${id}::uuid`;
      
      console.log("✅ Analysis completed and saved");
      return jsonResponse({ success: true, data: { analysis, signals } });
    }

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
      
      const companyRes = await sql`SELECT name, industry FROM companies WHERE id = ${companyId}::uuid`;
      const company = companyRes[0];
      
      const message = `🔔 <b>طلب خدمة جديد!</b>\n\n <b>رقم الصفقة:</b> <code>${deal.id}</code>\n🏢 <b>الشركة:</b> ${company?.name || 'غير معروف'}\n <b>المجال:</b> ${company?.industry || 'غير محدد'}\n🛠️ <b>الخدمة:</b> ${serviceId}\n📞 <b>الهاتف:</b> ${phone || 'غير متوفر'}\n📧 <b>البريد:</b> ${email || 'غير متوفر'}\n\n📝 <b>الوصف:</b>\n${description.substring(0, 200)}${description.length > 200 ? '...' : ''}\n\n⏰ <b>الوقت:</b> ${new Date().toLocaleString('ar-SA')}`;
      
      await sendTelegramNotification(message);
      
      return jsonResponse({ success: true, data: deal });
    }

    if (method === "GET" && url.pathname === "/api/admin/deals") {
      if (!isValidAdmin) return jsonResponse({ error: "Unauthorized" }, 401);
      const deals = await sql`SELECT d.*, c.name as company_name, c.industry as company_industry FROM deals d LEFT JOIN companies c ON d.company_id = c.id ORDER BY d.created_at DESC`;
      return jsonResponse({ success: true, data: deals });
    }

    if (method === "GET" && url.pathname === "/api/admin/stats") {
      if (!isValidAdmin) return jsonResponse({ error: "Unauthorized" }, 401);
      const totalDeals = await sql`SELECT COUNT(*) as count FROM deals`;
      const pendingDeals = await sql`SELECT COUNT(*) as count FROM deals WHERE status = 'DISCOVERED'`;
      const completedDeals = await sql`SELECT COUNT(*) as count FROM deals WHERE status = 'COMPLETED'`;
      const totalCompanies = await sql`SELECT COUNT(*) as count FROM companies`;
      return jsonResponse({ success: true, data: { total_deals: totalDeals[0].count, pending_deals: pendingDeals[0].count, completed_deals: completedDeals[0].count, total_companies: totalCompanies[0].count } });
    }

    if (method === "PUT" && url.pathname.startsWith("/api/admin/deals/")) {
      if (!isValidAdmin) return jsonResponse({ error: "Unauthorized" }, 401);
      const dealId = url.pathname.split("/")[4];
      const body = await req.json();
      await sql`UPDATE deals SET status = ${body.status}, updated_at = NOW() WHERE id = ${dealId}::uuid`;
      return jsonResponse({ success: true, message: "Status updated" });
    }

    if (method === "POST" && url.pathname.startsWith("/api/v1/deals/") && url.pathname.endsWith("/negotiate")) {
      const dealId = url.pathname.split("/")[4];
      const body = await req.json();
      const action = safeValue(body.action, 'UNKNOWN');
      const newPrice = body.new_price ? parseInt(String(body.new_price)) : 0;
      const notes = safeValue(body.notes, '');
      await sql`INSERT INTO negotiations (deal_id, actor, action, new_price, notes) VALUES (${dealId}::uuid, 'USER', ${action}, ${newPrice}, ${notes})`;
      return jsonResponse({ success: true, message: "Recorded" });
    }

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

console.log("🚀 B2B Pipeline Pro v6.1.0 (Fixed AI Analysis with Logging)");
Deno.serve(handler);
