import { Progress } from "@/components/ui/progress";
import type { PublicationStatsMap } from "@/types/api";

interface CampaignProgressProps {
  progressPercentage: number;
  stats: PublicationStatsMap;
}

const SEGMENTS: { key: keyof PublicationStatsMap; label: string; className: string }[] = [
  { key: "published", label: "Pubblicate", className: "text-success" },
  { key: "scheduled", label: "Programmate", className: "text-primary" },
  { key: "failed", label: "Fallite", className: "text-destructive" },
  { key: "retry_wait", label: "In retry", className: "text-warning" },
  { key: "pending", label: "In attesa", className: "text-muted-foreground" },
];

export function CampaignProgress({ progressPercentage, stats }: CampaignProgressProps) {
  const total = Object.values(stats).reduce((sum, value) => sum + value, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">Avanzamento</span>
        <span className="tabular-nums text-muted-foreground">{progressPercentage.toFixed(1)}%</span>
      </div>
      <Progress value={progressPercentage} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {SEGMENTS.map((segment) => (
          <div key={segment.key} className="space-y-0.5">
            <p className={`text-lg font-semibold tabular-nums ${segment.className}`}>
              {stats[segment.key] ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">{segment.label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{total} destinazioni totali</p>
    </div>
  );
}
