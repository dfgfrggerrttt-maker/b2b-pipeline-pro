
import { Router, Context } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { authMiddleware, requireRole } from "../middleware/security.ts";
import { recordPriceChange, calculateWonRevenue, getNegotiationSummary } from "../services/negotiation.ts";
import { CompanyRepo, DealRepo, PricingRepo } from "../repositories/index.ts";
import { detectBuyingSignals, calculateCompanyScore, analyzeCompany, matchServices } from "../services/discovery.ts";
import { checkComplianceBeforeSend } from "../services/advanced.ts";
import { ServiceRepo } from "../repositories/index.ts";

const router = new Router();

// 🏥 Health Check
router.get("/health", (ctx: Context) => {
  ctx.response.body = { status: "ok", version: "2.0.0", human_controlled: true };
});

// 🏢 Companies
router.get("/api/v1/companies", authMiddleware, async (ctx: Context) => {
  const companies = await CompanyRepo.findByTenant(ctx.state.user.tenant_id);
  ctx.response.body = { success: true, data: companies };
});

router.post("/api/v1/companies", authMiddleware, requireRole(["SALES", "ADMIN"]), async (ctx: Context) => {
  const body = await ctx.request.body().value;
  const score = calculateCompanyScore(body);
  const company = await CompanyRepo.create({
    tenant_id: ctx.state.user.tenant_id,
    ...body,
    score,
    score_confidence: 85,
    risk_level: score >= 70 ? "LOW" : score >= 40 ? "MEDIUM" : "HIGH",
    pipeline_status: "DISCOVERED",
    buying_signals: []
  });
  ctx.response.status = 201;
  ctx.response.body = { success: true, data: company };
});

router.post("/api/v1/companies/:id/analyze", authMiddleware, async (ctx: Context) => {
  const company = await CompanyRepo.findById(ctx.params.id, ctx.state.user.tenant_id);
  if (!company) { ctx.response.status = 404; ctx.response.body = { error: "Not found" }; return; }
  const analysis = analyzeCompany(company);
  const signals = await detectBuyingSignals(company);
  await CompanyRepo.update(ctx.params.id, { analysis, buying_signals: signals });
  ctx.response.body = { success: true, data: { analysis, signals } };
});

// 🤝 Services
router.get("/api/v1/services", authMiddleware, async (ctx: Context) => {
  const services = await ServiceRepo.findAll();
  ctx.response.body = { success: true, data: services };
});

router.post("/api/v1/services/match", authMiddleware, async (ctx: Context) => {
  const { company_id } = await ctx.request.body().value;
  const company = await CompanyRepo.findById(company_id, ctx.state.user.tenant_id);
  if (!company) { ctx.response.status = 404; ctx.response.body = { error: "Not found" }; return; }
  const services = await ServiceRepo.findAll();
  const matches = matchServices(company, services);
  ctx.response.body = { success: true, data: matches };
});

// 💰 Deals & Negotiation (Human-Controlled)
router.post("/api/v1/deals", authMiddleware, requireRole(["SALES", "ADMIN"]), async (ctx: Context) => {
  const body = await ctx.request.body().value;
  const deal = await DealRepo.create({
    tenant_id: ctx.state.user.tenant_id,
    ...body,
    status: "DISCOVERED",
    probability: 50
  });
  ctx.response.status = 201;
  ctx.response.body = { success: true, data: deal };
});

router.post("/api/v1/deals/:id/negotiate", authMiddleware, requireRole(["SALES", "ADMIN"]), async (ctx: Context) => {
  const body = await ctx.request.body().value;
  const deal = await DealRepo.findById(ctx.params.id, ctx.state.user.tenant_id);
  if (!deal) { ctx.response.status = 404; ctx.response.body = { error: "Not found" }; return; }
  
  await recordPriceChange({
    deal_id: ctx.params.id,
    tenant_id: ctx.state.user.tenant_id,
    user_id: ctx.state.user.id,
    company_id: deal.company_id,
    service_id: deal.service_id,
    ...body
  });
  
  ctx.response.body = { success: true, message: "Negotiation recorded" };
});

router.get("/api/v1/deals/:id/negotiation-summary", authMiddleware, async (ctx: Context) => {
  const summary = await getNegotiationSummary(ctx.params.id);
  ctx.response.body = { success: true, data: summary };
});

router.get("/api/v1/deals/:id/revenue", authMiddleware, async (ctx: Context) => {
  const revenue = await calculateWonRevenue(ctx.params.id);
  ctx.response.body = { success: true, data: { revenue } };
});

// 📞 Communication (Human Approval Required)
router.post("/api/v1/communications", authMiddleware, requireRole(["SALES", "ADMIN"]), async (ctx: Context) => {
  const body = await ctx.request.body().value;
  const compliance = await CompanyRepo.checkCompliance(body.company_id, ctx.state.user.tenant_id);
  if (!compliance.allowed) {
    ctx.response.status = 403;
    ctx.response.body = { success: false, error: compliance.reason };
    return;
  }
  ctx.response.body = { status: "PENDING_APPROVAL", message: "Draft saved. Awaiting human approval." };
});

router.post("/api/v1/communications/:id/approve", authMiddleware, requireRole(["SALES", "ADMIN"]), async (ctx: Context) => {
  console.log(`✅ Human approved communication ${ctx.params.id}`);
  ctx.response.body = { status: "SENT", message: "Message sent successfully" };
});

// 🛡️ Compliance
router.post("/api/v1/compliance/blacklist", authMiddleware, requireRole(["ADMIN"]), async (ctx: Context) => {
  const { company_id, reason } = await ctx.request.body().value;
  await CompanyRepo.addToBlacklist(company_id, ctx.state.user.tenant_id, reason);
  ctx.response.body = { success: true, message: "Company blacklisted" };
});

export default router;
