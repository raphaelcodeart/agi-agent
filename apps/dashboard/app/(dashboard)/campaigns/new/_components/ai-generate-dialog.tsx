"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useGenerateCampaignText } from "@/hooks/use-ai";
import { ApiError } from "@/lib/api/errors";
import type { AIGenerateTextResponse } from "@/types/api";

interface AIGenerateDialogProps {
  onGenerated: (result: AIGenerateTextResponse) => void;
}

export function AIGenerateDialog({ onGenerated }: AIGenerateDialogProps) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const generate = useGenerateCampaignText();

  function handleGenerate() {
    if (!topic.trim()) return;
    generate.mutate(topic.trim(), {
      onSuccess: (result) => {
        onGenerated(result);
        toast.success("Testo generato: rivedi e modifica prima di lanciare la campagna");
        setOpen(false);
        setTopic("");
      },
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.detail : "Generazione non riuscita"),
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles className="size-4" />
        Genera con AI
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Genera testo con AI</DialogTitle>
            <DialogDescription>
              Descrivi l&apos;argomento: verranno compilati automaticamente il testo predefinito e le versioni
              specifiche per ogni piattaforma (rispettando le lunghezze consentite). Potrai comunque modificare
              tutto a mano dopo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ai-topic">Argomento</Label>
            <Textarea
              id="ai-topic"
              rows={4}
              placeholder='Es. "genera una pubblicazione dedicata alle aziende nel 2026 con utilizzo AI"'
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button disabled={!topic.trim() || generate.isPending} onClick={handleGenerate}>
              {generate.isPending && <Loader2Icon className="size-4 animate-spin" />}
              {generate.isPending ? "Generazione..." : "Genera"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
