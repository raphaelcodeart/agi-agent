import type { LucideIcon } from "lucide-react";
import { HeartIcon, EyeIcon, UserPlusIcon, MousePointerClickIcon, PercentIcon, BarChart3Icon } from "lucide-react";
import type { StatMetricTotals } from "@/types/api";

// Each metric type is shown as its own tile (never summed across different
// types like views+impressions+reach - those measure different things and
// blending them would misrepresent what Buffer actually reported). Ordered so
// the ones the admin cares about most (reactions, views, new follows) lead.
export const METRIC_TILE_CONFIG: { type: string; label: string; icon: LucideIcon }[] = [
  { type: "reactions", label: "Mi piace / Reazioni", icon: HeartIcon },
  { type: "likes", label: "Mi piace (Facebook)", icon: HeartIcon },
  { type: "views", label: "Visualizzazioni", icon: EyeIcon },
  { type: "impressions", label: "Impression", icon: EyeIcon },
  { type: "reach", label: "Copertura (persone raggiunte)", icon: EyeIcon },
  { type: "follows", label: "Nuovi iscritti", icon: UserPlusIcon },
  { type: "clicks", label: "Clic", icon: MousePointerClickIcon },
  { type: "engagementRate", label: "Tasso di coinvolgimento (Buffer)", icon: PercentIcon },
  { type: "comments", label: "Commenti", icon: BarChart3Icon },
  { type: "shares", label: "Condivisioni", icon: BarChart3Icon },
];

// StatMetricTotals (modulo Statistiche, dati persistiti) usa colonne snake_case
// - stessi tipi di METRIC_TILE_CONFIG tranne engagementRate -> engagement_rate.
const TYPE_TO_STAT_COLUMN: Record<string, keyof StatMetricTotals> = {
  reactions: "reactions",
  likes: "likes",
  views: "views",
  impressions: "impressions",
  reach: "reach",
  follows: "follows",
  clicks: "clicks",
  engagementRate: "engagement_rate",
  comments: "comments",
  shares: "shares",
};

/** Le tile da mostrare per un totale persistito, nello stesso ordine/stile di
 * METRIC_TILE_CONFIG - omette i tipi mai riportati (null) invece di un fuorviante 0. */
export function statMetricTiles(totals: StatMetricTotals): { type: string; label: string; icon: LucideIcon; value: number }[] {
  return METRIC_TILE_CONFIG.flatMap((config) => {
    const column = TYPE_TO_STAT_COLUMN[config.type];
    const value = column ? totals[column] : undefined;
    return value === null || value === undefined ? [] : [{ ...config, value }];
  });
}
