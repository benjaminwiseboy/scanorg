import type { CampaignStatus } from "@/generated/prisma/enums";

const LABELS: Record<CampaignStatus, [string, string]> = {
  DRAFT: ["Brouillon", "bg-surface-2 text-muted"],
  OPEN: ["En cours", "bg-accent-soft text-accent"],
  CLOSED: ["Fermée — non publiée", "bg-warn-soft text-renforcer"],
  PUBLISHED: ["Analyse publiée", "bg-surface-2 text-solide"],
};

export function StatusBadge({ status }: { status: CampaignStatus }) {
  const [label, cls] = LABELS[status];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
