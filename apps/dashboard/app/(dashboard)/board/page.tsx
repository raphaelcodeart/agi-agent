"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3Icon, ExternalLinkIcon, LayoutGridIcon, XIcon, ZoomInIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PlatformBadge, platformLabel } from "@/components/shared/platform-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { usePublicationFeed } from "@/hooks/use-publications";
import { formatDateTime } from "@/lib/format";
import type { PublicationFeedItem } from "@/types/api";

const ALL_CHANNELS = "all";
// Shared by the channel picker, every feed card and the loading skeletons so
// they all line up at the same width, per the admin's request.
const FEED_WIDTH = "max-w-3xl";

function FeedCard({ item }: { item: PublicationFeedItem }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isVideo = item.media?.mime_type.startsWith("video/");
  const isImage = item.media?.mime_type.startsWith("image/");

  return (
    // Card's own has-[>img:first-child]:pt-0 (see components/ui/card.tsx) only
    // fires when an <img> is Card's *direct* first child - wrapping it in a
    // <button> for the click-to-zoom handler below breaks that detection, so
    // the flush-top/rounded-corner look for image posts is restored explicitly.
    <Card className={`mx-auto w-full ${FEED_WIDTH} ${isImage ? "pt-0" : ""}`}>
      {item.media && isImage && (
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="group relative block w-full cursor-zoom-in"
          title="Ingrandisci"
        >
          {/* Backend-hosted asset with an unpredictable origin/path, same
              reason components/shared/media-preview.tsx uses a plain <img> too. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.media.public_url} alt="" className="max-h-[32rem] w-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-150 group-hover:bg-black/20 group-hover:opacity-100">
            <ZoomInIcon className="size-8 text-white drop-shadow" />
          </span>
        </button>
      )}
      {item.media && isImage && (
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent showCloseButton={false} className="max-w-[92vw] border-none bg-transparent p-0 shadow-none sm:max-w-[92vw]">
            <DialogTitle className="sr-only">Immagine ingrandita</DialogTitle>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.media.public_url} alt="" className="mx-auto max-h-[90vh] w-auto rounded-lg object-contain" />
            <DialogClose className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
              <XIcon className="size-5" />
              <span className="sr-only">Chiudi</span>
            </DialogClose>
          </DialogContent>
        </Dialog>
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
              {/* Same pattern as the "Canali social" list (app/(dashboard)/channels/page.tsx):
                  channel name links out to the real profile/page when Buffer exposed it,
                  falls back to plain text otherwise. */}
              {item.channel_external_link ? (
                <a
                  href={item.channel_external_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium leading-tight text-foreground hover:underline"
                >
                  {item.channel_name}
                  <ExternalLinkIcon className="size-3 text-muted-foreground" />
                </a>
              ) : (
                <p className="text-sm font-medium leading-tight">{item.channel_name}</p>
              )}
              <p className="text-xs text-muted-foreground">{formatDateTime(item.published_at)}</p>
            </div>
          </div>
          <PlatformBadge platform={item.platform} />
        </div>

        {item.text && <p className="whitespace-pre-wrap text-sm">{item.text}</p>}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
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
          {/* Same detail page as the "Pubblicazioni" table view - its
              "Carica/Aggiorna statistiche" button is where likes/views/ecc.
              actually load (on-demand from Buffer, see GET /publications/{id}/metrics) - not duplicated here. */}
          <Button variant="outline" size="sm" asChild className="h-7 gap-1.5 px-2.5 text-xs">
            <Link href={`/publications/${item.id}`}>
              <BarChart3Icon className="size-3.5" />
              Statistiche
            </Link>
          </Button>
        </div>
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
      // "Nome canale (Nome utente) - Piattaforma" (es. "Algarve Beach Resort
      // (Mario Rossi) - Instagram") - il nome canale da solo non basta a
      // distinguere due canali simili, né a capire di quale cliente sono.
      else byChannel.set(item.social_channel_id, { label: `${item.channel_name} (${item.user_name}) - ${platformLabel(item.platform)}`, count: 1 });
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
      <PageHeader title="Bacheca" description="Tutte le pubblicazioni andate a buon fine, più recenti in cima." />

      {channelOptions.length > 0 && (
        <div className={`mx-auto flex w-full ${FEED_WIDTH} flex-col items-center gap-2 rounded-2xl border bg-card px-6 py-5 text-center shadow-sm`}>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Scegli il canale</p>
          <Select items={selectItems} value={effectiveChannelId} onValueChange={setSelectedChannelId}>
            <SelectTrigger className="h-14 w-full justify-center rounded-xl border-2 px-6 text-lg font-semibold">
              {/* SelectValue defaults to flex-1/text-left, which would fill the
                  whole bar and defeat justify-center on the trigger - overridden
                  here so the label+chevron sit together as one centered group. */}
              <SelectValue className="flex-none text-center" />
            </SelectTrigger>
            <SelectContent>
              {selectItems.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="py-2.5 text-base">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {feedQuery.isLoading && (
        <div className={`mx-auto w-full ${FEED_WIDTH} space-y-4`}>
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
