
import { PricingRepo } from "../repositories/index.ts";
import type { NegotiationHistory, DealPricing, PricingStatus } from "../types.ts";

// ⚠️ قاعدة ذهبية: AI لا يحدد السعر. المستخدم فقط.
export async function recordPriceChange(data: {
  deal_id: string;
  tenant_id: string;
  user_id: string;
  company_id: string;
  service_id: string;
  action: "INITIAL_PRICE" | "CLIENT_OFFER" | "COUNTER_OFFER" | "FINAL_OFFER" | "ACCEPTED" | "REJECTED";
  new_price: number;
  old_price?: number;
  notes: string;
}) {
  const history: Omit<NegotiationHistory, "id" | "created_at" | "updated_at"> = {
    tenant_id: data.tenant_id,
    deal_id: data.deal_id,
    actor: "USER",
    actor_id: data.user_id,
    action: data.action,
    old_price: data.old_price,
    new_price: data.new_price,
    notes: data.notes
  };
  
  await PricingRepo.recordNegotiation(history);
  console.log(` Negotiation Logged: ${data.action} -> $${data.new_price}`);

  const existingPricing = await PricingRepo.findByDeal(data.deal_id);
  
  if (!existingPricing) {
    const newPricing: Omit<DealPricing, "id" | "created_at" | "updated_at"> = {
      tenant_id: data.tenant_id,
      deal_id: data.deal_id,
      company_id: data.company_id,
      service_id: data.service_id,
      initial_price: data.action === "INITIAL_PRICE" ? data.new_price : undefined,
      current_price: data.new_price,
      final_price: data.action === "ACCEPTED" ? data.new_price : undefined,
      currency: "USD",
      pricing_status: getNewStatus(data.action),
      negotiation_notes: data.notes
    };
    await PricingRepo.createPricing(newPricing);
  } else {
    const updateData: Partial<DealPricing> = {
      current_price: data.new_price,
      pricing_status: getNewStatus(data.action),
      negotiation_notes: data.notes
    };
    if (data.action === "ACCEPTED") updateData.final_price = data.new_price;
    if (data.action === "INITIAL_PRICE" && !existingPricing.initial_price) updateData.initial_price = data.new_price;
    await PricingRepo.updatePricing(existingPricing.id, updateData);
  }
}

function getNewStatus(action: string): PricingStatus {
  const statusMap: Record<string, PricingStatus> = {
    "INITIAL_PRICE": "INITIAL_PRICE",
    "CLIENT_OFFER": "NEGOTIATING",
    "COUNTER_OFFER": "NEGOTIATING",
    "FINAL_OFFER": "FINAL_OFFER",
    "ACCEPTED": "ACCEPTED",
    "REJECTED": "REJECTED"
  };
  return statusMap[action] || "NEGOTIATING";
}

export async function calculateWonRevenue(deal_id: string): Promise<number> {
  const finalPrice = await PricingRepo.getFinalPrice(deal_id);
  return finalPrice || 0;
}

export async function getNegotiationSummary(deal_id: string) {
  const history = await PricingRepo.getNegotiationHistory(deal_id);
  const pricing = await PricingRepo.findByDeal(deal_id);
  return { history, initial_price: pricing?.initial_price, current_price: pricing?.current_price, final_price: pricing?.final_price, status: pricing?.pricing_status };
}
