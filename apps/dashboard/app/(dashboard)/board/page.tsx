"use client";

import { useMemo, useState } from "react";
import { ExternalLinkIcon, LayoutGridIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PlatformBadge } from "@/components/shared/platform-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePublicationFeed } from "@/hooks/use-publications";
import { formatDateTime } from "@/lib/format";
import type { PublicationFeedItem } from "@/types/api";

const ALL_CHANNELS = "all";

function FeedCard({ item }: { item: PublicationFeedItem }) {
  const isVideo = item.media?.mime_type.startsWith("video/");
  const isImage = item.media?.mime_type.startsWith("image/");

  return (
    <Card className="mx-auto w-full max-w-xl">
      {item.media && isImage && (
        // Backend-hosted asset with an unpredictable origin/path, same reason
        // components/shared/media-preview.tsx uses a plain <img> too.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.media.public_url} alt="" className="max-h-[32rem] w-full object-cover" />
      )}
      {item.media && isVideo && (
        <video src={item.media.public_url} className="max-h-[32rem] w-full bg-black" controls preload="metadata" playsInline />
      )}

      <CardContent className="space-y-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {item.channel_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.channel_avatar_url} alt="" className="size-8 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                {item.channel_name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-medium leading-tight">{item.channel_name}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(item.published_at)}</p>
            </div>
          </div>
          <PlatformBadge platform={item.platform} />
        </div>

        {item.text && <p className="whitespace-pre-wrap text-sm">{item.text}</p>}

        {item.external_post_url && (
          <a
            href={item.external_post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <ExternalLinkIcon className="size-3.5" />
            Vedi post originale
          </a>
        )}
      </CardContent>
    </Card>
  );
}

export default function BoardPage() {
  // Higher than the other list views' default (30) so a less-active channel
  // still has enough items to show once filtered - this is the only page
  // stayed within the endpoint's normal skip/limit shape (max 100).
  const feedQuery = usePublicationFeed({ limit: 100 });
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  // One option per distinct channel actually present in the feed, ranked by
  // how many posts it has (most first) - no separate "list all channels"
  // endpoint call, this is derived straight from the feed data already
  // loaded.
  const channelOptions = useMemo(() => {
    if (!feedQuery.data) return [];
    const byChannel = new Map<string, { label: string; count: number }>();
    for (const item of feedQuery.data) {
      const existing = byChannel.get(item.social_channel_id);
      if (existing) existing.count += 1;
      else byChannel.set(item.social_channel_id, { label: item.channel_name, count: 1 });
    }
    return [...byChannel.entries()].sort((a, b) => b[1].count - a[1].count).map(([id, { label }]) => ({ value: id, label }));
  }, [feedQuery.data]);

  // Default view: the channel with the most publications, not everything
  // mixed together - computed at render time rather than synced into state
  // via an effect, so an explicit choice the admin already made is never
  // silently overridden by a later refetch (and no cascading-render effect).
  const effectiveChannelId = selectedChannelId ?? channelOptions[0]?.value ?? ALL_CHANNELS;

  const selectItems = useMemo(() => [{ value: ALL_CHANNELS, label: "Tutti i canali" }, ...channelOptions], [channelOptions]);

  const visibleItems = useMemo(() => {
    if (!feedQuery.data) return [];
    if (effectiveChannelId === ALL_CHANNELS) return feedQuery.data;
    return feedQuery.data.filter((item) => item.social_channel_id === effectiveChannelId);
  }, [feedQuery.data, effectiveChannelId]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bacheca"
        description="Tutte le pubblicazioni andate a buon fine, più recenti in cima."
        actions={
          channelOptions.length > 0 && (
            <Select items={selectItems} value={effectiveChannelId} onValueChange={setSelectedChannelId}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {selectItems.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
      />

      {feedQuery.isLoading && (
        <div className="mx-auto w-full max-w-xl space-y-4">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      )}

      {feedQuery.isError && <ErrorState error={feedQuery.error} onRetry={() => feedQuery.refetch()} />}

      {feedQuery.data && feedQuery.data.length === 0 && (
        <EmptyState
          icon={LayoutGridIcon}
          title="Nessuna pubblicazione ancora"
          description="Le campagne pubblicate con successo appariranno qui, come un feed social."
        />
      )}

      {feedQuery.data && feedQuery.data.length > 0 && visibleItems.length === 0 && (
        <EmptyState icon={LayoutGridIcon} title="Nessuna pubblicazione per questo canale" />
      )}

      {visibleItems.length > 0 && (
        <div className="space-y-4">
          {visibleItems.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
