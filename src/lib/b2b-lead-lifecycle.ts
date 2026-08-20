export const B2B_LEAD_STATUSES = ["new", "contacted", "quoting", "won", "lost"] as const;
export const B2B_LEAD_PRIORITIES = ["unassigned", "low", "medium", "high"] as const;

export type B2bLeadStatus = (typeof B2B_LEAD_STATUSES)[number];
export type B2bLeadPriority = (typeof B2B_LEAD_PRIORITIES)[number];

const NEXT_STATUS: Readonly<Record<B2bLeadStatus, readonly B2bLeadStatus[]>> = {
  new: ["contacted", "lost"],
  contacted: ["quoting", "lost"],
  quoting: ["won", "lost"],
  won: [],
  lost: [],
};

export function allowedB2bLeadTransitions(status: B2bLeadStatus): readonly B2bLeadStatus[] {
  return NEXT_STATUS[status];
}

export function b2bLeadStatusLabel(status: B2bLeadStatus): string {
  return {
    new: "New",
    contacted: "Contacted",
    quoting: "Quoting",
    won: "Won",
    lost: "Lost",
  }[status];
}

export function b2bLeadPriorityLabel(priority: B2bLeadPriority): string {
  return {
    unassigned: "Unassigned",
    low: "Low",
    medium: "Medium",
    high: "High",
  }[priority];
}

export type B2bLeadRiskFlag =
  | "OWNER_MISSING"
  | "PROVENANCE_MISSING"
  | "NEXT_ACTION_MISSING"
  | "FOLLOW_UP_OVERDUE"
  | "BLOCKED"
  | "FIRST_ORDER_UNLINKED";

type RiskLead = {
  status: B2bLeadStatus;
  owner: string | null;
  source_url: string | null;
  next_action: string | null;
  next_action_at: string | null;
  blocker: string | null;
  first_order_id: string | null;
};

export function b2bLeadRiskFlags(lead: RiskLead, nowMs = Date.now()): B2bLeadRiskFlag[] {
  if (lead.status === "lost") return [];
  if (lead.status === "won") {
    return lead.first_order_id ? [] : ["FIRST_ORDER_UNLINKED"];
  }

  const flags: B2bLeadRiskFlag[] = [];
  if (!lead.owner?.trim()) flags.push("OWNER_MISSING");
  if (!lead.source_url?.trim()) flags.push("PROVENANCE_MISSING");
  if (!lead.next_action?.trim()) flags.push("NEXT_ACTION_MISSING");
  if (lead.next_action_at && new Date(lead.next_action_at).getTime() < nowMs) {
    flags.push("FOLLOW_UP_OVERDUE");
  }
  if (lead.blocker?.trim()) flags.push("BLOCKED");
  return flags;
}

export function b2bLeadRiskLabel(flag: B2bLeadRiskFlag): string {
  return {
    OWNER_MISSING: "Owner missing",
    PROVENANCE_MISSING: "Provenance missing",
    NEXT_ACTION_MISSING: "Next action missing",
    FOLLOW_UP_OVERDUE: "Follow-up overdue",
    BLOCKED: "Blocked",
    FIRST_ORDER_UNLINKED: "First purchase unlinked",
  }[flag];
}
