"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { PlusIcon, CopyIcon, Trash2Icon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { FilterBar, FilterSelect } from "@/components/shared/filter-bar";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useCampaigns, useDeleteCampaign } from "@/hooks/use-campaigns";
import { useCampaignDetail } from "@/hooks/use-campaigns";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/errors";
import type { CampaignResponse, CampaignStatus } from "@/types/api";

const STATUS_OPTIONS: { value: CampaignStatus; label: string }[] = [
  { value: "draft", label: "Bozza" },
  { value: "preparing", label: "Preparazione" },
  { value: "queued", label: "In coda" },
  { value: "running", label: "In corso" },
  { value: "paused", label: "In pausa" },
  { value: "partially_completed", label: "Parziale" },
  { value: "completed", label: "Completata" },
  { value: "failed", label: "Fallita" },
  { value: "cancelled", label: "Annullata" },
];

const LIMIT = 20;

function DestinationsCell({ campaignId }: { campaignId: string }) {
  const detail = useCampaignDetail(campaignId);
  if (detail.isLoading || !detail.data) {
    return <span className="text-muted-foreground">…</span>;
  }
  const { stats } = detail.data;
  const total = Object.values(stats).reduce((sum, value) => sum + value, 0);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-foreground">{total} totali</span>
      <span className="text-success">{stats.published + stats.scheduled} riuscite</span>
      <span className="text-destructive">{stats.failed} fallite</span>
      <span className="text-warning">{stats.retry_wait} retry</span>
    </div>
  );
}

export default function CampaignsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "">("");
  const [skip, setSkip] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<CampaignResponse | null>(null);

  const campaignsQuery = useCampaigns({ status_filter: statusFilter || undefined, skip, limit: LIMIT });
  const deleteCampaign = useDeleteCampaign();

  const columns = useMemo<ColumnDef<CampaignResponse, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Campagna",
        cell: ({ row }) => (
          <Link href={`/campaigns/${row.original.id}`} className="font-medium hover:underline">
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: "status",
        header: "Stato",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "destinations",
        header: "Destinazioni",
        cell: ({ row }) => <DestinationsCell campaignId={row.original.id} />,
      },
      {
        accessorKey: "created_at",
        header: "Data creazione",
        cell: ({ row }) => formatDateTime(row.original.created_at),
      },
      {
        accessorKey: "scheduled_at",
        header: "Data programmata",
        cell: ({ row }) => formatDateTime(row.original.scheduled_at, row.original.timezone),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Duplica campagna"
              onClick={() => router.push(`/campaigns/new?duplicate=${row.original.id}`)}
            >
              <CopyIcon className="size-3.5" />
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/campaigns/${row.original.id}`}>Apri</Link>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Elimina campagna"
              className="text-destructive"
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Campagne"
        description="Crea e monitora le campagne di pubblicazione multi-piattaforma"
        actions={
          <Button asChild>
            <Link href="/campaigns/new">
              <PlusIcon className="size-4" />
              Nuova campagna
            </Link>
          </Button>
        }
      />

      <FilterBar>
        <FilterSelect
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value as CampaignStatus | "");
            setSkip(0);
          }}
          placeholder="Stato"
          options={STATUS_OPTIONS}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={campaignsQuery.data}
        isLoading={campaignsQuery.isLoading}
        isError={campaignsQuery.isError}
        error={campaignsQuery.error}
        onRetry={() => campaignsQuery.refetch()}
        emptyTitle="Nessuna campagna trovata"
        emptyDescription="Crea la tua prima campagna per iniziare a pubblicare sui canali social."
      />

      {campaignsQuery.data && (
        <Pagination skip={skip} limit={LIMIT} count={campaignsQuery.data.length} onSkipChange={setSkip} />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Eliminare "${deleteTarget?.title}"?`}
        description="Elimina definitivamente la campagna e tutti i suoi dati: destinatari risolti, pubblicazioni e relativi tentativi - anche se è già stata pubblicata su alcuni canali. Questa azione non può essere annullata."
        confirmLabel="Elimina definitivamente"
        destructive
        loading={deleteCampaign.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteCampaign.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success("Campagna eliminata");
              setDeleteTarget(null);
            },
            onError: (error) => {
              toast.error(error instanceof ApiError ? error.detail : "Eliminazione non riuscita");
              setDeleteTarget(null);
            },
          });
        }}
      />
    </div>
  );
}
