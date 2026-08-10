"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CopyIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={value} readOnly onFocus={(e) => e.target.select()} className="font-mono text-xs" />
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast.success("Copiato");
          }}
        >
          <CopyIcon />
        </Button>
      </div>
    </div>
  );
}

export function FacebookWebhookInfoDialog({
  open,
  onOpenChange,
  channelAccountId,
  verifyToken,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelAccountId: string;
  verifyToken: string;
}) {
  const [publicBaseUrl, setPublicBaseUrl] = useState("");
  const webhookUrl = publicBaseUrl
    ? `${publicBaseUrl.replace(/\/$/, "")}/api/v1/omnichannel-responder/webhooks/facebook/${channelAccountId}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Info webhook Facebook</DialogTitle>
          <DialogDescription>
            A differenza di Telegram, qui non c&apos;è una registrazione automatica: incolla questi due valori tu stesso in Meta App Dashboard → Messenger → Impostazioni → Webhooks → &quot;Aggiungi URL callback&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>URL pubblico HTTPS di questa API</Label>
            <Input value={publicBaseUrl} onChange={(e) => setPublicBaseUrl(e.target.value)} placeholder="https://api.tuodominio.it" />
          </div>

          {webhookUrl && <CopyField label="URL di callback" value={webhookUrl} />}
          <CopyField label="Verify Token" value={verifyToken} />

          <p className="text-xs text-muted-foreground">
            Dopo aver salvato in Meta, iscrivi la Pagina agli eventi <code>messages</code> nella stessa schermata — senza quello, i messaggi non arriveranno mai qui anche se il webhook risulta verificato.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
