"use client";

import { ExternalLinkIcon, LayoutGridIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PlatformBadge } from "@/components/shared/platform-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicationFeed } from "@/hooks/use-publications";
import { formatDateTime } from "@/lib/format";
import type { PublicationFeedItem } from "@/types/api";

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
  const feedQuery = usePublicationFeed({ limit: 30 });

  return (
    <div className="space-y-4">
      <PageHeader title="Bacheca" description="Tutte le pubblicazioni andate a buon fine, più recenti in cima." />

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

      {feedQuery.data && feedQuery.data.length > 0 && (
        <div className="space-y-4">
          {feedQuery.data.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
