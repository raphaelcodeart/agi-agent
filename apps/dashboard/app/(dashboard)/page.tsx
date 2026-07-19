"use client";

import Link from "next/link";
import {
  UsersIcon,
  LinkIcon,
  Share2Icon,
  MegaphoneIcon,
  SendIcon,
  XCircleIcon,
  RotateCcwIcon,
  TrendingUpIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUsers } from "@/hooks/use-users";
import { useBufferConnections } from "@/hooks/use-buffer-connections";
import { useChannels } from "@/hooks/use-channels";
import { useCampaigns } from "@/hooks/use-campaigns";
import { usePublications } from "@/hooks/use-publications";
import { formatCappedCount, formatDateTime, formatPercentage } from "@/lib/format";

const LIST_CAP = 100;

export default function DashboardOverviewPage() {
  const activeUsers = useUsers({ status_filter: "active", limit: LIST_CAP });
  const connections = useBufferConnections();
  const channels = useChannels({});
  const runningCampaigns = useCampaigns({ status_filter: "running", limit: LIST_CAP });
  const recentCampaigns = useCampaigns({ limit: 5 });
  const publishedPubs = usePublications({ status_filter: "published", limit: LIST_CAP });
  const failedPubs = usePublications({ status_filter: "failed", limit: LIST_CAP });
  const retryWaitPubs = usePublications({ status_filter: "retry_wait", limit: LIST_CAP });

  const connectedConnections = connections.data?.filter((c) => c.status === "connected").length;
  const activeChannels = channels.data?.filter((c) => c.is_active).length;

  const publishedCount = publishedPubs.data?.length ?? 0;
  const failedCount = failedPubs.data?.length ?? 0;
  const denominator = publishedCount + failedCount;
  const successRate = denominator > 0 ? (publishedCount / denominator) * 100 : null;

  const isLoadingStats =
    activeUsers.isLoading || connections.isLoading || channels.isLoading || runningCampaigns.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Panoramica in tempo reale della piattaforma di pubblicazione"
        actions={
          <Button asChild>
            <Link href="/campaigns/new">Nuova campagna</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Utenti attivi"
          value={formatCappedCount(activeUsers.data?.length, LIST_CAP)}
          icon={UsersIcon}
          loading={isLoadingStats}
        />
        <StatCard
          label="Account Buffer collegati"
          value={connectedConnections ?? "—"}
          hint={connections.data ? `su ${connections.data.length} totali` : undefined}
          icon={LinkIcon}
          loading={isLoadingStats}
        />
        <StatCard
          label="Canali social attivi"
          value={activeChannels ?? "—"}
          hint={channels.data ? `su ${channels.data.length} totali` : undefined}
          icon={Share2Icon}
          loading={isLoadingStats}
        />
        <StatCard
          label="Campagne in esecuzione"
          value={formatCappedCount(runningCampaigns.data?.length, LIST_CAP)}
          icon={MegaphoneIcon}
          loading={isLoadingStats}
        />
        <StatCard
          label="Pubblicazioni completate"
          value={formatCappedCount(publishedPubs.data?.length, LIST_CAP)}
          icon={SendIcon}
          tone="success"
          loading={publishedPubs.isLoading}
        />
        <StatCard
          label="Pubblicazioni fallite"
          value={formatCappedCount(failedPubs.data?.length, LIST_CAP)}
          icon={XCircleIcon}
          tone="destructive"
          loading={failedPubs.isLoading}
        />
        <StatCard
          label="Retry in attesa"
          value={formatCappedCount(retryWaitPubs.data?.length, LIST_CAP)}
          icon={RotateCcwIcon}
          tone="warning"
          loading={retryWaitPubs.isLoading}
        />
        <StatCard
          label="Tasso di successo"
          value={successRate === null ? "—" : formatPercentage(successRate)}
          hint="Pubblicate vs fallite (ultime 100)"
          icon={TrendingUpIcon}
          tone="success"
          loading={publishedPubs.isLoading || failedPubs.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campagne recenti</CardTitle>
          </CardHeader>
          <CardContent>
            {recentCampaigns.data && recentCampaigns.data.length > 0 ? (
              <ul className="divide-y">
                {recentCampaigns.data.map((campaign) => (
                  <li key={campaign.id} className="py-2.5 first:pt-0 last:pb-0">
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="flex items-center justify-between gap-3 hover:underline"
                    >
                      <span className="min-w-0 truncate text-sm font-medium">{campaign.title}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(campaign.created_at)}
                        </span>
                        <StatusBadge status={campaign.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nessuna campagna ancora creata" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Errori recenti</CardTitle>
          </CardHeader>
          <CardContent>
            {failedPubs.data && failedPubs.data.length > 0 ? (
              <ul className="divide-y">
                {failedPubs.data.slice(0, 5).map((pub) => (
                  <li key={pub.id} className="py-2.5 first:pt-0 last:pb-0">
                    <Link
                      href={`/publications/${pub.id}`}
                      className="flex items-center justify-between gap-3 hover:underline"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {pub.error_message ?? "Errore non specificato"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(pub.updated_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nessun errore recente" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
