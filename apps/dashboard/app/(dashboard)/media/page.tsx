"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2Icon, ImagesIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { MediaPreview } from "@/components/shared/media-preview";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { CardGridSkeleton } from "@/components/shared/loading-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMediaList, useDeleteMedia } from "@/hooks/use-media";
import { formatBytes, formatDateTime, formatDuration } from "@/lib/format";
import { ApiError } from "@/lib/api/errors";
import type { MediaResponse } from "@/types/api";
import { UploadDropzone } from "@/components/shared/upload-dropzone";

export default function MediaPage() {
  const mediaQuery = useMediaList();
  const deleteMedia = useDeleteMedia();
  const [deleteTarget, setDeleteTarget] = useState<MediaResponse | null>(null);

  return (
    <div className="space-y-4">
      <PageHeader title="Media" description="Carica e gestisci le risorse multimediali per le campagne" />

      <UploadDropzone />

      {mediaQuery.isLoading && <CardGridSkeleton count={8} />}
      {mediaQuery.isError && <ErrorState error={mediaQuery.error} onRetry={() => mediaQuery.refetch()} />}
      {mediaQuery.data && mediaQuery.data.length === 0 && (
        <EmptyState icon={ImagesIcon} title="Nessun media caricato" description="Trascina un file per iniziare." />
      )}

      {mediaQuery.data && mediaQuery.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mediaQuery.data.map((media) => (
            <Card key={media.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <MediaPreview media={media} className="size-16" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-medium" title={media.original_filename}>
                      {media.original_filename}
                    </p>
                    <p className="text-xs text-muted-foreground">{media.mime_type}</p>
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge status={media.processing_status} />
                      <StatusBadge status={media.validation_status} />
                    </div>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <dt>Dimensione</dt>
                  <dd className="text-right text-foreground">{formatBytes(media.size_bytes)}</dd>
                  {media.width && media.height && (
                    <>
                      <dt>Risoluzione</dt>
                      <dd className="text-right text-foreground">
                        {media.width}×{media.height}
                      </dd>
                    </>
                  )}
                  {media.duration_seconds !== null && (
                    <>
                      <dt>Durata</dt>
                      <dd className="text-right text-foreground">{formatDuration(media.duration_seconds)}</dd>
                    </>
                  )}
                  <dt>Caricato</dt>
                  <dd className="text-right text-foreground">{formatDateTime(media.created_at)}</dd>
                </dl>
                {media.validation_errors && media.validation_errors.length > 0 && (
                  <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                    {media.validation_errors.map((e) => e.message).join("; ")}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive"
                  onClick={() => setDeleteTarget(media)}
                >
                  <Trash2Icon className="size-3.5" />
                  Elimina
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Eliminare questo file multimediale?"
        description="Non è possibile eliminare un media collegato a una campagna attiva."
        confirmLabel="Elimina"
        destructive
        loading={deleteMedia.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMedia.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
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
