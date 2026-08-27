
import type { Company, BuyingSignal, IntentSignal, DecisionMaker, CompanyAnalysis, PainPoint, Opportunity } from "../types.ts";

// 🌐 1. Buying Signals Detection
export async function detectBuyingSignals(company: Company): Promise<BuyingSignal[]> {
  const signals: BuyingSignal[] = [];
  if (company.employee_count && company.employee_count > 50) {
    signals.push({ type: "HIRING", description: "توسع في فريق الهندسة", detected_at: new Date().toISOString(), confidence: 85 });
  }
  if (company.industry && ["technology", "fintech"].includes(company.industry.toLowerCase())) {
    signals.push({ type: "FUNDING", description: "احتمال حصول على تمويل", detected_at: new Date().toISOString(), confidence: 70 });
  }
  return signals;
}

// 🎯 7. Intent Discovery
export async function scanIntentSignals(keyword: string): Promise<IntentSignal[]> {
  return [{ platform: "X", keyword, url: "https://x.com/example", detected_at: new Date().toISOString() }];
}

// 👥 2. Decision Maker Channel Recommendation
export function recommendBestChannel(contact: DecisionMaker): { channel: string; confidence: number; reason: string } {
  if (contact.persona === "TECHNICAL") return { channel: "LINKEDIN", confidence: 92, reason: "يفضل التفاصيل التقنية" };
  if (contact.persona === "FINANCIAL") return { channel: "EMAIL", confidence: 88, reason: "يفضل ROI والمستندات الرسمية" };
  if (contact.persona === "OPERATIONAL") return { channel: "WHATSAPP", confidence: 75, reason: "يفضل التواصل السريع" };
  return { channel: "EMAIL", confidence: 70, reason: "Default" };
}

//  Company Scoring (0-100)
export function calculateCompanyScore(company: Partial<Company>): number {
  let score = 50;
  if (company.employee_count) {
    if (company.employee_count > 1000) score += 20;
    else if (company.employee_count > 100) score += 15;
    else if (company.employee_count > 10) score += 10;
  }
  if (company.website) score += 10;
  const highPotential = ["technology", "fintech", "healthtech", "ecommerce"];
  if (company.industry && highPotential.includes(company.industry.toLowerCase())) score += 15;
  return Math.min(100, Math.max(0, score));
}

// 📊 Digital Analysis
export function analyzeCompany(company: Company): CompanyAnalysis {
  const painPoints: PainPoint[] = [];
  const opportunities: Opportunity[] = [];
  
  if (!company.website) painPoints.push({ problem: "No website", evidence: "No online presence", confidence: 95, source: "web_scan" });
  if (company.employee_count && company.employee_count > 100 && (!company.technologies || company.technologies.length < 3)) {
    painPoints.push({ problem: "Limited tech adoption", evidence: "Large team, low tech", confidence: 80, source: "analysis" });
  }
  
  if (painPoints.length === 0) painPoints.push({ problem: "No major pain points", evidence: "Company appears healthy", confidence: 70, source: "analysis" });
  
  opportunities.push({ opportunity: "Digital transformation", potential_service: "consulting", reason: "Growth potential", evidence: "Industry trends", confidence: 75 });
  
  return {
    digital_maturity: 60,
    pain_points: painPoints,
    opportunities: opportunities,
    swot: { strengths: ["Established"], weaknesses: painPoints.map(p => p.problem), opportunities: opportunities.map(o => o.opportunity), threats: ["Competition"] },
    analyzed_at: new Date().toISOString()
  };
}

// 🤝 Service Matching
export function matchServices(company: Company, services: any[]): { service: any; score: number; reasons: string[] }[] {
  return services.map(service => {
    let score = 50;
    const reasons: string[] = [];
    if (service.target_industries.includes(company.industry.toLowerCase())) { score += 30; reasons.push("Industry match"); }
    if (company.employee_count && company.employee_count > 100) { score += 20; reasons.push("Company size fit"); }
    return { service, score: Math.min(100, score), reasons };
  }).sort((a, b) => b.score - a.score);
}
