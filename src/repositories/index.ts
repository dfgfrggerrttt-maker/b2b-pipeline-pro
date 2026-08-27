
import { dbAdapter } from "../database/adapter.ts";
import type { 
  Company, Deal, DealPricing, NegotiationHistory, 
  ComplianceRecord, DecisionMaker, Proposal, ServiceCatalog,
  Communication, MessageVariant, ProposalView, CallLog, AuditLog
} from "../types.ts";

export const CompanyRepo = {
  async findById(id: string, tenant_id: string): Promise<Company | undefined> {
    const companies = await dbAdapter.getAll<Company>("companies");
    return companies.find(c => c.id === id && c.tenant_id === tenant_id);
  },
  async findByTenant(tenant_id: string): Promise<Company[]> {
    const companies = await dbAdapter.getAll<Company>("companies");
    return companies.filter(c => c.tenant_id === tenant_id);
  },
  async create(company: Omit<Company, "id" | "created_at" | "updated_at">): Promise<Company> {
    return await dbAdapter.insert<Company>("companies", company as Company);
  },
  async update(id: string, data: Partial<Company>): Promise<Company | undefined> {
    return await dbAdapter.update<Company>("companies", id, data);
  },
  async checkCompliance(company_id: string, tenant_id: string): Promise<{ allowed: boolean; reason?: string }> {
    const records = await dbAdapter.getAll<ComplianceRecord>("compliance");
    const record = records.find(r => r.company_id === company_id && r.tenant_id === tenant_id);
    if (!record) return { allowed: true };
    if (record.is_blacklisted) return { allowed: false, reason: "Company is blacklisted" };
    return { allowed: true };
  },
  async addToBlacklist(company_id: string, tenant_id: string, reason: string): Promise<ComplianceRecord> {
    return await dbAdapter.insert<ComplianceRecord>("compliance", {
      tenant_id, company_id, is_blacklisted: true,
      unsubscribe_reason: reason, risk_score: 100, notes: reason
    } as ComplianceRecord);
  }
};

export const DealRepo = {
  async findById(id: string, tenant_id: string): Promise<Deal | undefined> {
    const deals = await dbAdapter.getAll<Deal>("deals");
    return deals.find(d => d.id === id && d.tenant_id === tenant_id);
  },
  async findByCompany(company_id: string, tenant_id: string): Promise<Deal[]> {
    const deals = await dbAdapter.getAll<Deal>("deals");
    return deals.filter(d => d.company_id === company_id && d.tenant_id === tenant_id);
  },
  async create(deal: Omit<Deal, "id" | "created_at" | "updated_at">): Promise<Deal> {
    return await dbAdapter.insert<Deal>("deals", deal as Deal);
  },
  async update(id: string, data: Partial<Deal>): Promise<Deal | undefined> {
    return await dbAdapter.update<Deal>("deals", id, data);
  }
};

export const PricingRepo = {
  async createPricing(pricing: Omit<DealPricing, "id" | "created_at" | "updated_at">): Promise<DealPricing> {
    return await dbAdapter.insert<DealPricing>("deal_pricing", pricing as DealPricing);
  },
  async findByDeal(deal_id: string): Promise<DealPricing | undefined> {
    const pricings = await dbAdapter.getAll<DealPricing>("deal_pricing");
    return pricings.find(p => p.deal_id === deal_id);
  },
  async updatePricing(id: string, data: Partial<DealPricing>): Promise<DealPricing | undefined> {
    return await dbAdapter.update<DealPricing>("deal_pricing", id, data);
  },
  async getFinalPrice(deal_id: string): Promise<number | undefined> {
    const pricing = await this.findByDeal(deal_id);
    return pricing?.final_price;
  },
  async recordNegotiation(history: Omit<NegotiationHistory, "id" | "created_at" | "updated_at">): Promise<NegotiationHistory> {
    return await dbAdapter.insert<NegotiationHistory>("negotiation_history", history as NegotiationHistory);
  },
  async getNegotiationHistory(deal_id: string): Promise<NegotiationHistory[]> {
    const history = await dbAdapter.getAll<NegotiationHistory>("negotiation_history");
    return history.filter(h => h.deal_id === deal_id);
  }
};

export const ContactRepo = {
  async findByCompany(company_id: string): Promise<DecisionMaker[]> {
    const contacts = await dbAdapter.getAll<DecisionMaker>("decision_makers");
    return contacts.filter(c => c.company_id === company_id);
  },
  async create(contact: Omit<DecisionMaker, "id" | "created_at" | "updated_at">): Promise<DecisionMaker> {
    return await dbAdapter.insert<DecisionMaker>("decision_makers", contact as DecisionMaker);
  }
};

export const ProposalRepo = {
  async findById(id: string, tenant_id: string): Promise<Proposal | undefined> {
    const proposals = await dbAdapter.getAll<Proposal>("proposals");
    return proposals.find(p => p.id === id && p.tenant_id === tenant_id);
  },
  async findByDeal(deal_id: string): Promise<Proposal | undefined> {
    const proposals = await dbAdapter.getAll<Proposal>("proposals");
    return proposals.find(p => p.deal_id === deal_id);
  },
  async create(proposal: Omit<Proposal, "id" | "created_at" | "updated_at">): Promise<Proposal> {
    return await dbAdapter.insert<Proposal>("proposals", proposal as Proposal);
  },
  async update(id: string, data: Partial<Proposal>): Promise<Proposal | undefined> {
    return await dbAdapter.update<Proposal>("proposals", id, data);
  }
};

export const ServiceRepo = {
  async findAll(): Promise<ServiceCatalog[]> {
    return await dbAdapter.getAll<ServiceCatalog>("services");
  },
  async findById(id: string): Promise<ServiceCatalog | undefined> {
    return await dbAdapter.getById<ServiceCatalog>("services", id);
  },
  async create(service: Omit<ServiceCatalog, "id" | "created_at" | "updated_at">): Promise<ServiceCatalog> {
    return await dbAdapter.insert<ServiceCatalog>("services", service as ServiceCatalog);
  }
};

export const CommunicationRepo = {
  async findByCompany(company_id: string): Promise<Communication[]> {
    const comms = await dbAdapter.getAll<Communication>("communications");
    return comms.filter(c => c.company_id === company_id);
  },
  async create(comm: Omit<Communication, "id" | "created_at" | "updated_at">): Promise<Communication> {
    return await dbAdapter.insert<Communication>("communications", comm as Communication);
  },
  async update(id: string, data: Partial<Communication>): Promise<Communication | undefined> {
    return await dbAdapter.update<Communication>("communications", id, data);
  }
};

export const AuditRepo = {
  async log(log: Omit<AuditLog, "id" | "timestamp">): Promise<AuditLog> {
    return await dbAdapter.insert<AuditLog>("audit_logs", { ...log, timestamp: new Date().toISOString() } as AuditLog);
  },
  async findByTenant(tenant_id: string): Promise<AuditLog[]> {
    const logs = await dbAdapter.getAll<AuditLog>("audit_logs");
    return logs.filter(l => l.tenant_id === tenant_id);
  }
};
