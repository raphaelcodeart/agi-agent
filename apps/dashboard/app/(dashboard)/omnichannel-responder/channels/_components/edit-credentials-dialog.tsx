"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateChannelAccount } from "@/hooks/use-omnichannel";
import { ApiError } from "@/lib/api/client";
import type { OmniChannelAccountResponse } from "@/types/api";

const META_TOKEN_LABEL: Record<string, string> = {
  facebook: "Page Access Token",
  instagram: "Page/IG Access Token",
  whatsapp: "Access Token (Cloud API)",
};

/**
 * Fills in or rotates credentials on a channel created without them - e.g. a
 * WhatsApp/Meta channel created with just a name to get its webhook_secret
 * for Meta's Webhooks screen (see create-channel-dialog.tsx) before the real
 * Access Token/App Secret/Phone Number ID were even available yet.
 */
export function EditCredentialsDialog({
  open,
  onOpenChange,
  account,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: OmniChannelAccountResponse;
}) {
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState(account.external_account_id ?? "");
  const updateChannelAccount = useUpdateChannelAccount();
  const isTelegram = account.channel === "telegram";

  function handleSubmit() {
    updateChannelAccount.mutate(
      {
        id: account.id,
        payload: {
          access_token: accessToken || undefined,
          app_secret: !isTelegram ? appSecret || undefined : undefined,
          external_account_id: account.channel === "whatsapp" ? phoneNumberId : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Credenziali aggiornate");
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Impossibile aggiornare le credenziali"),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifica credenziali — {account.name}</DialogTitle>
          <DialogDescription>
            Lascia vuoto un campo per non modificarlo. Le credenziali già salvate non vengono mai mostrate qui, per
            sicurezza.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{isTelegram ? "Bot Token" : META_TOKEN_LABEL[account.channel] ?? "Access Token"}</Label>
            <Input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="Lascia vuoto per non cambiarlo" type="password" />
          </div>
          {account.channel === "whatsapp" && (
            <div className="space-y-1.5">
              <Label>Phone Number ID</Label>
              <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="Da WhatsApp Manager" />
            </div>
          )}
          {!isTelegram && (
            <div className="space-y-1.5">
              <Label>App Secret</Label>
              <Input value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="Lascia vuoto per non cambiarlo" type="password" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={updateChannelAccount.isPending}>Salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
