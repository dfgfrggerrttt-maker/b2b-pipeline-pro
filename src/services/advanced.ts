
import type { MessageVariant, ProposalView, DecisionMaker } from "../types.ts";

// 🧪 3. A/B Testing
export function getWinningVariant(variants: MessageVariant[]): MessageVariant {
  return variants.sort((a, b) => b.win_rate - a.win_rate)[0];
}

export function calculateWinRate(variant: MessageVariant): number {
  if (variant.sent_count === 0) return 0;
  return (variant.reply_count / variant.sent_count) * 100;
}

// 🛡️ 6. Compliance Check
export function checkComplianceBeforeSend(isBlacklisted: boolean, hasUnsubscribed: boolean): { allowed: boolean; reason?: string } {
  if (isBlacklisted) return { allowed: false, reason: "Company is blacklisted" };
  if (hasUnsubscribed) return { allowed: false, reason: "Contact has unsubscribed" };
  return { allowed: true };
}

// 📄 4. Interactive Proposal Tracking
export function trackProposalView(view: ProposalView) {
  console.log(`👁️ Proposal viewed: Section '${view.section_viewed}' for ${view.duration_seconds}s`);
}

// 🎙️ 5. Call Battlecards & Summaries
export function generateCallBattlecard(companyIndustry: string, contactPersona: string): string {
  return `Battlecard for ${companyIndustry} (${contactPersona}): Focus on ROI and risk mitigation. Avoid deep technical jargon.`;
}

export function summarizeCall(transcript: string): string {
  return `AI Summary: Discussion covered key points. Client showed interest in pricing and timeline.`;
}

//  Intent Discovery Response Generator
export function generateIntentResponse(intent: { keyword: string; platform: string }): string {
  return `Hi! We noticed you're looking for ${intent.keyword} services. We'd love to discuss how we can help. Would you be open to a brief call?`;
}

// 👥 Persona-based Message Tone
export function getMessageToneForPersona(persona: string): string {
  if (persona === "TECHNICAL") return "technical_detailed";
  if (persona === "FINANCIAL") return "roi_focused";
  if (persona === "OPERATIONAL") return "practical_brief";
  return "balanced";
}
