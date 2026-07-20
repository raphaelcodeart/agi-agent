"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { PauseIcon, PlayIcon, XIcon, RotateCcwIcon, CopyIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { CampaignProgress } from "@/components/shared/campaign-progress";
import { MediaPreview } from "@/components/shared/media-preview";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { RetryButton } from "@/components/shared/retry-button";
import { ErrorState } from "@/components/shared/error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCampaignDetail,
  usePauseCampaign,
  useResumeCampaign,
  useCancelCampaign,
} from "@/hooks/use-campaigns";
import { usePublications, useRetryPublication, useRetryCampaignFailures } from "@/hooks/use-publications";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/errors";
import type { PublicationResponse } from "@/types/api";

const LIMIT = 20;

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [skip, setSkip] = useState(0);

  const isTerminal = (status?: string) =>
    status === "completed" || status === "cancelled" || status === "failed";

  const campaignQuery = useCampaignDetail(id, {
    refetchInterval: (query) => (isTerminal(query.state.data?.campaign.status) ? false : 5000),
  });
  const publicationsQuery = usePublications({ campaign_id: id, skip, limit: LIMIT });

  const pauseCampaign = usePauseCampaign(id);
  const resumeCampaign = useResumeCampaign(id);
  const cancelCampaign = useCancelCampaign(id);
  const retryPublication = useRetryPublication();
  const retryCampaignFailures = useRetryCampaignFailures();

  function withToast(promise: Promise<unknown>, successMessage: string) {
    promise
      .then(() => toast.success(successMessage))
      .catch((error) => toast.error(error instanceof ApiError ? error.detail : "Operazione non riuscita"));
  }

  const columns = useMemo<ColumnDef<PublicationResponse, unknown>[]>(
    () => [
      {
        id: "channel",
        header: "Canale",
        cell: ({ row }) => (
          <Link href={`/publications/${row.original.id}`} className="hover:underline">
            {row.original.external_channel_id}
          </Link>
        ),
      },
      {
        accessorKey: "status",
        header: "Stato",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "attempts",
        header: "Tentativi",
        cell: ({ row }) => `${row.original.attempt_count}/${row.original.max_attempts}`,
      },
      {
        accessorKey: "error_message",
        header: "Ultimo errore",
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-56 text-destructive">{row.original.error_message ?? "—"}</span>
        ),
      },
      {
        id: "sent_at",
        header: "Data invio",
        cell: ({ row }) => formatDateTime(row.original.submitted_at ?? row.original.published_at),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          ["failed", "cancelled", "retry_wait"].includes(row.original.status) ? (
            <RetryButton
              loading={retryPublication.isPending}
              onRetry={() =>
                withToast(retryPublication.mutateAsync(row.original.id), "Pubblicazione riaccodata")
              }
            />
          ) : (
            <Link href={`/publications/${row.original.id}`} className="text-sm text-muted-foreground hover:underline">
              Dettaglio
            </Link>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [retryPublication.isPending]
  );

  if (campaignQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (campaignQuery.isError || !campaignQuery.data) {
    return <ErrorState error={campaignQuery.error} onRetry={() => campaignQuery.refetch()} />;
  }

  const { campaign, media, stats, progress_percentage } = campaignQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={campaign.title}
        description={`Modalità: ${campaign.publishing_mode} · Destinatari: ${campaign.targeting_mode}`}
        actions={
          <>
            <Button variant="outline" onClick={() => router.push(`/campaigns/new?duplicate=${campaign.id}`)}>
              <CopyIcon className="size-4" />
              Duplica
            </Button>
            {campaign.status === "running" && (
              <Button
                variant="outline"
                disabled={pauseCampaign.isPending}
                onClick={() => withToast(pauseCampaign.mutateAsync(), "Campagna in pausa")}
              >
                <PauseIcon className="size-4" />
                Pausa
              </Button>
            )}
            {campaign.status === "paused" && (
              <Button
                variant="outline"
                disabled={resumeCampaign.isPending}
                onClick={() => withToast(resumeCampaign.mutateAsync(), "Campagna ripresa")}
              >
                <PlayIcon className="size-4" />
                Riprendi
              </Button>
            )}
            {stats.failed > 0 && (
              <Button
                variant="outline"
                disabled={retryCampaignFailures.isPending}
                onClick={() =>
                  withToast(retryCampaignFailures.mutateAsync(campaign.id), "Retry delle pubblicazioni fallite avviato")
                }
              >
                <RotateCcwIcon className="size-4" />
                Riprova falliti
              </Button>
            )}
            {!["completed", "cancelled"].includes(campaign.status) && (
              <Button
                variant="outline"
                className="text-destructive"
                disabled={cancelCampaign.isPending}
                onClick={() => withToast(cancelCampaign.mutateAsync(), "Campagna annullata")}
              >
                <XIcon className="size-4" />
                Annulla
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Avanzamento</CardTitle>
          </CardHeader>
          <CardContent>
            <CampaignProgress progressPercentage={progress_percentage} stats={stats} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dettagli</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Stato</span>
              <StatusBadge status={campaign.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Creata</span>
              <span>{formatDateTime(campaign.created_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Programmata</span>
              <span>{formatDateTime(campaign.scheduled_at, campaign.timezone)}</span>
            </div>
            {media && (
              <div className="flex items-center gap-2 border-t pt-3">
                <MediaPreview media={media} className="size-10" />
                <span className="truncate text-xs text-muted-foreground">{media.original_filename}</span>
              </div>
            )}
            <div className="border-t pt-3">
              <p className="mb-1 text-muted-foreground">Testo predefinito</p>
              <p className="line-clamp-4">{campaign.default_text}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pubblicazioni</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <DataTable
            columns={columns}
            data={publicationsQuery.data}
            isLoading={publicationsQuery.isLoading}
            isError={publicationsQuery.isError}
            error={publicationsQuery.error}
            onRetry={() => publicationsQuery.refetch()}
            emptyTitle="Nessuna pubblicazione"
          />
          {publicationsQuery.data && (
            <Pagination skip={skip} limit={LIMIT} count={publicationsQuery.data.length} onSkipChange={setSkip} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
