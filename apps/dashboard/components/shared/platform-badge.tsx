import { cn } from "@/lib/utils";

const PLATFORM_STYLES: Record<string, string> = {
  instagram: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
  facebook: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  linkedin: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  tiktok: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
  youtube: "bg-red-500/10 text-red-600 dark:text-red-400",
  x: "bg-zinc-500/10 text-zinc-900 dark:text-zinc-100",
  threads: "bg-zinc-500/10 text-zinc-900 dark:text-zinc-100",
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  threads: "Threads",
};

interface PlatformBadgeProps {
  platform: string;
  className?: string;
}

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  const key = platform.toLowerCase().trim();
  const style = PLATFORM_STYLES[key] ?? "bg-muted text-muted-foreground";
  const label = PLATFORM_LABELS[key] ?? platform;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        style,
        className
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {label}
    </span>
  );
}
