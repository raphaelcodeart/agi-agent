"use client";

import { use } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { PlatformBadge } from "@/components/shared/platform-badge";
import { RetryButton } from "@/components/shared/retry-button";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePublicationDetail,
  useRetryPublication,
  useCancelPublication,
  useSkipPublication,
} from "@/hooks/use-publications";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/errors";

export default function PublicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const detailQuery = usePublicationDetail(id);
  const retryPublication = useRetryPublication();
  const cancelPublication = useCancelPublication();
  const skipPublication = useSkipPublication();

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return <ErrorState error={detailQuery.error} onRetry={() => detailQuery.refetch()} />;
  }

  const { publication: pub, attempts, resolved_text, channel_name, channel_platform, user_name } = detailQuery.data;
  const canRetry = ["failed", "cancelled", "retry_wait"].includes(pub.status);
  const canCancel = ["pending", "queued", "retry_wait"].includes(pub.status);
  const canSkip = ["pending", "queued", "retry_wait", "failed"].includes(pub.status);

  function notify(promise: Promise<unknown>, message: string) {
    promise
      .then(() => toast.success(message))
      .catch((error) => toast.error(error instanceof ApiError ? error.detail : "Operazione non riuscita"));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Pubblicazione su ${channel_name}`}
        description={`Campagna ${pub.campaign_id} · Utente ${user_name}`}
        actions={
          <>
            {canRetry && (
              <RetryButton
                size="default"
                loading={retryPublication.isPending}
                onRetry={() => notify(retryPublication.mutateAsync(pub.id), "Pubblicazione riaccodata")}
              />
            )}
            {canSkip && (
              <Button
                variant="outline"
                disabled={skipPublication.isPending}
                onClick={() => notify(skipPublication.mutateAsync(pub.id), "Pubblicazione saltata")}
              >
                Salta
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                className="text-destructive"
                disabled={cancelPublication.isPending}
                onClick={() => notify(cancelPublication.mutateAsync(pub.id), "Pubblicazione annullata")}
              >
                Annulla
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Dettagli</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Stato</span>
              <StatusBadge status={pub.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Piattaforma</span>
              <PlatformBadge platform={channel_platform} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">ID Buffer canale</span>
              <span className="text-xs">{pub.external_channel_id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tentativi</span>
              <span>
                {pub.attempt_count}/{pub.max_attempts}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Campagna</span>
              <Link href={`/campaigns/${pub.campaign_id}`} className="hover:underline">
                Apri campagna
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Inviato</span>
              <span>{formatDateTime(pub.submitted_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pubblicato</span>
              <span>{formatDateTime(pub.published_at)}</span>
            </div>
            {pub.external_post_url && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Post pubblicato</span>
                <a
                  href={pub.external_post_url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-primary hover:underline"
                >
                  Visualizza
                </a>
              </div>
            )}
            {pub.error_message && (
              <div className="space-y-1 border-t pt-3">
                <span className="text-muted-foreground">Ultimo errore</span>
                <p className="text-destructive">{pub.error_message}</p>
                {pub.error_category && <p className="text-xs text-muted-foreground">Categoria: {pub.error_category}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Testo risolto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{resolved_text}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cronologia tentativi</CardTitle>
        </CardHeader>
        <CardContent>
          {attempts.length === 0 ? (
            <EmptyState title="Nessun tentativo registrato" />
          ) : (
            <ul className="divide-y">
              {attempts.map((attempt) => (
                <li key={attempt.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  {attempt.success ? (
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <XCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">Tentativo #{attempt.attempt_number}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(attempt.started_at)}</span>
                      {attempt.http_status && (
                        <span className="text-xs text-muted-foreground">HTTP {attempt.http_status}</span>
                      )}
                      {attempt.duration_ms !== null && (
                        <span className="text-xs text-muted-foreground">{attempt.duration_ms}ms</span>
                      )}
                    </div>
                    {attempt.error_message && <p className="text-destructive">{attempt.error_message}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
