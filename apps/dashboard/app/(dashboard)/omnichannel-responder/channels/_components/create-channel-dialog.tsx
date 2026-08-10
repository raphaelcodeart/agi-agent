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
  { value: "facebook", label: "Facebook Messenger", available: true },
  { value: "mock", label: "Test (mock, nessun account reale)", available: true },
  { value: "whatsapp", label: "WhatsApp Business (non ancora disponibile)", available: false },
  { value: "instagram", label: "Instagram Direct (non ancora disponibile)", available: false },
];

export function CreateChannelDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [channel, setChannel] = useState<OmniChannel>("telegram");
  const [name, setName] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const createChannelAccount = useCreateChannelAccount();

  function reset() {
    setChannel("telegram");
    setName("");
    setAccessToken("");
    setAppSecret("");
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("Inserisci un nome per il canale");
      return;
    }
    if (channel === "facebook" && (!accessToken.trim() || !appSecret.trim())) {
      toast.error("Per Facebook servono sia il Page Access Token sia l'App Secret");
      return;
    }
    createChannelAccount.mutate(
      { channel, name, access_token: accessToken || undefined, app_secret: channel === "facebook" ? appSecret : undefined },
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

          {channel === "facebook" && (
            <>
              <div className="space-y-1.5">
                <Label>Page Access Token</Label>
                <Input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="EAAxxxxx..." type="password" />
              </div>
              <div className="space-y-1.5">
                <Label>App Secret</Label>
                <Input value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="App Dashboard → Impostazioni → Basic" type="password" />
              </div>
              <p className="text-xs text-muted-foreground">
                Entrambi si trovano nell&apos;app Meta collegata alla tua Pagina Facebook (developers.facebook.com). Dopo la creazione, apri &quot;Info webhook&quot; dalla lista canali per l&apos;URL e il token da incollare nelle impostazioni Messenger dell&apos;app.
              </p>
            </>
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
