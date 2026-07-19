"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUsers } from "@/hooks/use-users";
import { useBufferConnections, useConnectOAuthUrl } from "@/hooks/use-buffer-connections";
import { ApiError } from "@/lib/api/errors";

interface ConnectUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectUserDialog({ open, onOpenChange }: ConnectUserDialogProps) {
  const usersQuery = useUsers({ status_filter: "active", limit: 100 });
  const connectionsQuery = useBufferConnections();
  const oauthUrl = useConnectOAuthUrl();
  const [userId, setUserId] = useState<string>("");

  const connectedUserIds = new Set(connectionsQuery.data?.map((c) => c.user_id));
  const availableUsers = usersQuery.data?.filter((user) => !connectedUserIds.has(user.id)) ?? [];

  function handleConnect() {
    if (!userId) return;
    oauthUrl.mutate(userId, {
      onSuccess: (data) => {
        window.location.href = data.url;
      },
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.detail : "Impossibile avviare il collegamento Buffer");
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Collega account Buffer</DialogTitle>
          <DialogDescription>
            Seleziona l&apos;utente da collegare: verrai reindirizzato all&apos;autorizzazione Buffer.
          </DialogDescription>
        </DialogHeader>
        <Select value={userId} onValueChange={(value) => setUserId(value ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleziona utente" />
          </SelectTrigger>
          <SelectContent>
            {availableUsers.length > 0 ? (
              availableUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="__none__" disabled>
                Nessun utente disponibile
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button disabled={!userId || oauthUrl.isPending} onClick={handleConnect}>
            {oauthUrl.isPending ? "Attendere..." : "Continua"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
