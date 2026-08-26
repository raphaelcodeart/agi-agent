"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronRightIcon, DownloadIcon, ArrowLeftIcon, Share2Icon, SendIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { SyncButton } from "@/components/shared/sync-button";
import { PlatformIcon } from "@/components/shared/platform-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserStatistics, useSyncUserMutation } from "@/hooks/use-statistics";
import { userExportUrl } from "@/services/statistics";
import { statMetricTiles } from "@/lib/metric-config";
import { formatDateTime, formatMetricValue } from "@/lib/format";

export default function UserStatisticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const userQuery = useUserStatistics(id);
  const syncUser = useSyncUserMutation();

  if (userQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (userQuery.isError || !userQuery.data) {
    return <ErrorState error={userQuery.error} onRetry={() => userQuery.refetch()} />;
  }

  const data = userQuery.data;
  const tiles = statMetricTiles(data.totals);

  return (
    <div className="space-y-6">
      <Link href="/statistics" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" /> Torna alla classifica generale
      </Link>

      <PageHeader
        title={data.user_name}
        description={data.company_name || undefined}
        actions={
          <Button variant="outline" size="sm" render={<a href={userExportUrl(id)} />}>
            <DownloadIcon className="size-4" />
            Esporta Excel
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Share2Icon className="size-4" /> {data.channels.length} canali
            </span>
            <span className="flex items-center gap-1.5">
              <SendIcon className="size-4" /> {data.channels.reduce((sum, c) => sum + c.post_count, 0)} post
            </span>
          </div>
          <SyncButton
            label="Sincronizza utente"
            dispatch={() => syncUser.mutateAsync(id)}
            lastSyncedAt={data.last_synced_at}
          />
        </CardContent>
      </Card>

      {tiles.length === 0 ? (
        <EmptyState title="Nessuna statistica ancora sincronizzata per questo utente" />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((tile) => (
            <StatCard key={tile.type} label={tile.label} value={formatMetricValue(tile.type, tile.value)} icon={tile.icon} />
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {data.channels.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState title="Nessun canale sincronizzato" description="Sincronizza l'utente per popolare i suoi canali social." />
            </div>
          ) : (
            <ul className="divide-y">
              {data.channels.map((channel) => (
                <li key={channel.social_channel_id}>
                  <Link
                    href={`/statistics/users/${id}/channels/${channel.social_channel_id}`}
                    className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-muted/50"
                  >
                    <PlatformIcon platform={channel.platform} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{channel.channel_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {channel.username ? `@${channel.username}` : "—"} · {channel.post_count} post
                      </p>
                    </div>
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      Sync: {formatDateTime(channel.last_synced_at)}
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
