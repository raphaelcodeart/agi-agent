"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateChannelAccount } from "@/hooks/use-omnichannel";
import { ApiError } from "@/lib/api/client";
import type { OmniChannel } from "@/types/api";

const CHANNEL_OPTIONS: { value: OmniChannel; label: string; available: boolean }[] = [
  { value: "telegram", label: "Telegram", available: true },
  { value: "mock", label: "Test (mock, nessun account reale)", available: true },
  { value: "whatsapp", label: "WhatsApp Business (non ancora disponibile)", available: false },
  { value: "instagram", label: "Instagram Direct (non ancora disponibile)", available: false },
  { value: "facebook", label: "Facebook Messenger (non ancora disponibile)", available: false },
];

export function CreateChannelDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [channel, setChannel] = useState<OmniChannel>("telegram");
  const [name, setName] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const createChannelAccount = useCreateChannelAccount();

  function reset() {
    setChannel("telegram");
    setName("");
    setAccessToken("");
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("Inserisci un nome per il canale");
      return;
    }
    createChannelAccount.mutate(
      { channel, name, access_token: accessToken || undefined },
      {
        onSuccess: () => {
          toast.success("Canale creato");
          reset();
          onOpenChange(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Impossibile creare il canale"),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuovo canale</DialogTitle>
          <DialogDescription>Collega un canale di messaggistica al tuo inbox unificato.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Canale</Label>
            <Select items={CHANNEL_OPTIONS} value={channel} onValueChange={(v) => setChannel(v as OmniChannel)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} disabled={!opt.available}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Bot assistenza clienti" />
          </div>

          {channel === "telegram" && (
            <div className="space-y-1.5">
              <Label>Bot Token</Label>
              <Input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="123456:ABC-DEF..." type="password" />
              <p className="text-xs text-muted-foreground">
                Crealo con @BotFather su Telegram. Dopo la creazione, registra il webhook dalla lista canali.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={createChannelAccount.isPending}>Crea canale</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
