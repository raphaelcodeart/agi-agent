"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ActivityIcon, DatabaseIcon, ServerIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ErrorState } from "@/components/shared/error-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useSystemSettings, useUpdateSystemSettings, useHealth } from "@/hooks/use-settings";
import { settingsFormSchema, type SettingsFormValues } from "@/lib/validation/settings";
import { formatBytes, formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/errors";

const FIELDS: {
  name: keyof SettingsFormValues;
  label: string;
  description: string;
  step?: number;
}[] = [
  {
    name: "global_concurrency_limit",
    label: "Concorrenza globale",
    description: "Numero massimo di pubblicazioni elaborate in parallelo su tutta la piattaforma.",
  },
  {
    name: "concurrent_jobs_per_connection",
    label: "Job simultanei per connessione",
    description: "Numero massimo di richieste in parallelo verso la stessa connessione Buffer.",
  },
  {
    name: "pause_between_requests_seconds",
    label: "Pausa tra richieste (secondi)",
    description: "Intervallo minimo tra due richieste consecutive verso Buffer.",
  },
  {
    name: "max_publication_attempts",
    label: "Tentativi massimi",
    description: "Numero massimo di tentativi automatici per una pubblicazione prima del fallimento definitivo.",
  },
];

function HealthTile({ icon: Icon, label, ok, statusOverride }: { icon: LucideIcon; label: string; ok: boolean; statusOverride?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-primary/[0.03]">
      <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", ok ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive")}>
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <StatusBadge status={statusOverride ?? (ok ? "connected" : "error")} />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const settingsQuery = useSystemSettings();
  const updateSettings = useUpdateSystemSettings();
  const healthQuery = useHealth();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      global_concurrency_limit: 5,
      concurrent_jobs_per_connection: 1,
      pause_between_requests_seconds: 10,
      max_publication_attempts: 5,
      upload_max_size_bytes: 104857600,
    },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      form.reset(settingsQuery.data);
    }
  }, [settingsQuery.data, form]);

  function onSubmit(values: SettingsFormValues) {
    updateSettings.mutate(values, {
      onSuccess: () => toast.success("Impostazioni aggiornate"),
      onError: (error) => toast.error(error instanceof ApiError ? error.detail : "Aggiornamento non riuscito"),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Impostazioni" description="Parametri operativi del motore di pubblicazione" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stato del sistema</CardTitle>
          <CardDescription>
            Modalità integrazione Buffer:{" "}
            <span className="font-medium text-foreground">{settingsQuery.data?.buffer_integration_mode ?? "—"}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {healthQuery.isLoading ? (
            <Skeleton className="h-16" />
          ) : healthQuery.data ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <HealthTile icon={DatabaseIcon} label="Database" ok={healthQuery.data.database === "ok"} />
              <HealthTile icon={ServerIcon} label="Redis" ok={healthQuery.data.redis === "ok"} />
              <HealthTile
                icon={ActivityIcon}
                label="Celery worker"
                ok={healthQuery.data.celery_worker === "ok"}
                statusOverride={healthQuery.data.celery_worker === "ok" ? "connected" : healthQuery.data.celery_worker}
              />
              <p className="col-span-full text-xs text-muted-foreground">
                Ultimo controllo: {formatDateTime(healthQuery.data.timestamp)}
              </p>
            </div>
          ) : (
            <ErrorState error={healthQuery.error} onRetry={() => healthQuery.refetch()} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Concorrenza e retry</CardTitle>
          <CardDescription>
            Le modifiche vengono applicate immediatamente ai worker in background tramite Redis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {settingsQuery.isLoading ? (
            <Skeleton className="h-64" />
          ) : settingsQuery.isError ? (
            <ErrorState error={settingsQuery.error} onRetry={() => settingsQuery.refetch()} />
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {FIELDS.map((fieldConfig) => (
                    <FormField
                      key={fieldConfig.name}
                      control={form.control}
                      name={fieldConfig.name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{fieldConfig.label}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(event) => field.onChange(Number(event.target.value))}
                            />
                          </FormControl>
                          <FormDescription>{fieldConfig.description}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                  <FormField
                    control={form.control}
                    name="upload_max_size_bytes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dimensione massima upload</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(event) => field.onChange(Number(event.target.value))}
                          />
                        </FormControl>
                        <FormDescription>Attualmente: {formatBytes(form.watch("upload_max_size_bytes"))}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" disabled={updateSettings.isPending}>
                  {updateSettings.isPending ? "Salvataggio..." : "Salva impostazioni"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
