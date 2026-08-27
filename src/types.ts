
export type Role = "ADMIN" | "SALES" | "ANALYST" | "VIEWER";
export type PricingStatus = "NOT_SET" | "INITIAL_PRICE" | "NEGOTIATING" | "FINAL_OFFER" | "ACCEPTED" | "REJECTED" | "CANCELLED";
export type CommStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "SENT" | "REPLIED" | "UNSUBSCRIBED";
export type Persona = "TECHNICAL" | "FINANCIAL" | "OPERATIONAL";
export type NegotiationAction = "INITIAL_PRICE" | "CLIENT_OFFER" | "COUNTER_OFFER" | "FINAL_OFFER" | "ACCEPTED" | "REJECTED";

export interface BaseEntity { 
  id: string; 
  tenant_id: string; 
  created_at: string; 
  updated_at: string; 
}

// ===== User =====
export interface User extends BaseEntity {
  email: string;
  password_hash: string;
  full_name: string;
  role: Role;
  status: "ACTIVE" | "INACTIVE";
}

// ===== Company =====
export interface Company extends BaseEntity {
  name: string;
  industry: string;
  country: string;
  city?: string;
  website?: string;
  employee_count?: number;
  revenue?: number;
  technologies?: string[];
  score: number;
  score_confidence: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  pipeline_status: string;
  buying_signals: BuyingSignal[];
  analysis?: CompanyAnalysis;
}

export interface CompanyAnalysis {
  digital_maturity: number;
  pain_points: PainPoint[];
  opportunities: Opportunity[];
  swot: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  analyzed_at: string;
}

export interface PainPoint {
  problem: string;
  evidence: string;
  confidence: number;
  source: string;
}

export interface Opportunity {
  opportunity: string;
  potential_service: string;
  reason: string;
  evidence: string;
  confidence: number;
}

// 🌐 1. Buying Signals
export interface BuyingSignal { 
  type: "HIRING" | "FUNDING" | "TECH_CHANGE"; 
  description: string; 
  detected_at: string; 
  confidence: number; 
}

export interface IntentSignal { 
  platform: string; 
  keyword: string; 
  url: string; 
  detected_at: string; 
}

// 👥 2. Decision Maker
export interface DecisionMaker extends BaseEntity {
  company_id: string;
  name: string;
  role: string;
  linkedin_url?: string;
  email?: string;
  persona: Persona;
  communication_preference: string;
}

// 🛡️ 6. Compliance
export interface ComplianceRecord extends BaseEntity {
  company_id: string;
  is_blacklisted: boolean;
  unsubscribe_reason?: string;
  risk_score: number;
  notes: string;
}

// 💰 Deal & Pricing
export interface Deal extends BaseEntity {
  company_id: string;
  service_id: string;
  status: string;
  pricing_id?: string;
  probability: number;
  expected_close_date?: string;
  notes?: string;
}

export interface DealPricing extends BaseEntity {
  deal_id: string;
  company_id: string;
  service_id: string;
  initial_price?: number;
  current_price?: number;
  final_price?: number;
  currency: string;
  pricing_status: PricingStatus;
  client_offer?: number;
  counter_offer?: number;
  discount_amount?: number;
  discount_percentage?: number;
  negotiation_notes?: string;
  price_reason?: string;
  agreed_at?: string;
}

export interface NegotiationHistory extends BaseEntity {
  deal_id: string;
  actor: "USER" | "CLIENT" | "SYSTEM";
  actor_id?: string;
  action: NegotiationAction;
  old_price?: number;
  new_price?: number;
  client_offer?: number;
  counter_offer?: number;
  discount_amount?: number;
  notes: string;
}

//  Communication
export interface Communication extends BaseEntity {
  company_id: string;
  deal_id?: string;
  channel: string;
  direction: "INBOUND" | "OUTBOUND";
  sender: string;
  recipient: string;
  subject?: string;
  message: string;
  status: CommStatus;
  variant_id?: string;
}

// 🧪 3. A/B Testing
export interface MessageVariant extends BaseEntity {
  campaign_id: string;
  subject: string;
  body: string;
  sent_count: number;
  reply_count: number;
  win_rate: number;
}

// 📄 4. Proposal & Micro-site
export interface Proposal extends BaseEntity {
  deal_id: string;
  company_id: string;
  scope: string;
  deliverables: string[];
  timeline_days: number;
  terms: string;
  price_display: string;
  final_agreed_price?: number;
  status: string;
  microsite_url: string;
  human_approval_by?: string;
  human_approval_at?: string;
}

export interface ProposalView extends BaseEntity {
  proposal_id: string;
  viewer_ip: string;
  section_viewed: string;
  duration_seconds: number;
  viewed_at: string;
}

// 🎙️ 5. Call Log & Battlecard
export interface CallLog extends BaseEntity {
  deal_id: string;
  date: string;
  battlecard_notes: string;
  ai_summary: string;
  action_items: string[];
}

// Service Catalog
export interface ServiceCatalog extends BaseEntity {
  name: string;
  description: string;
  category: string;
  target_industries: string[];
  features: string[];
  deliverables: string[];
  estimated_duration_days?: number;
  internal_notes?: string;
  pricing_notes?: string;
  is_active: boolean;
}

// Audit Log
export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id: string;
  old_value?: any;
  new_value?: any;
  ip_address?: string;
  user_agent?: string;
  request_id: string;
  timestamp: string;
}
