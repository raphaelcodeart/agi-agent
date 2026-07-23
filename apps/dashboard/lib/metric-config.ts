import type { LucideIcon } from "lucide-react";
import { HeartIcon, EyeIcon, UserPlusIcon, MousePointerClickIcon, PercentIcon, BarChart3Icon } from "lucide-react";

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
