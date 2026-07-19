"use client";

import { useState } from "react";
import { PlusIcon, UsersRoundIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { CardGridSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGroups } from "@/hooks/use-users";
import { formatDateTime } from "@/lib/format";
import { GroupFormDialog } from "./_components/group-form-dialog";

export default function GroupsPage() {
  const groupsQuery = useGroups();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gruppi"
        description="Organizza gli utenti in gruppi per indirizzare le campagne"
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <PlusIcon className="size-4" />
            Nuovo gruppo
          </Button>
        }
      />

      {groupsQuery.isLoading && <CardGridSkeleton count={6} />}

      {groupsQuery.isError && <ErrorState error={groupsQuery.error} onRetry={() => groupsQuery.refetch()} />}

      {groupsQuery.data && groupsQuery.data.length === 0 && (
        <EmptyState
          icon={UsersRoundIcon}
          title="Nessun gruppo creato"
          description="Crea un gruppo per iniziare a segmentare i tuoi utenti."
        />
      )}

      {groupsQuery.data && groupsQuery.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groupsQuery.data.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle className="text-base">{group.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{group.description || "Nessuna descrizione"}</p>
                <p className="text-xs text-muted-foreground">Creato il {formatDateTime(group.created_at)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <GroupFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
