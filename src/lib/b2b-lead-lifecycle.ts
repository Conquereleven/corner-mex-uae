export const B2B_LEAD_STATUSES = ["new", "contacted", "quoting", "won", "lost"] as const;

export type B2bLeadStatus = (typeof B2B_LEAD_STATUSES)[number];

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
