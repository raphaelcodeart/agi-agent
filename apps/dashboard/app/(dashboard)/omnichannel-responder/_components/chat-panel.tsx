"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SendIcon, StickyNoteIcon, CheckCircle2Icon, ArchiveIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useArchiveConversation, useConversationDetail, useResolveConversation, useAddNote, useSendManualMessage } from "@/hooks/use-omnichannel";
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChannelIcon, channelLabel } from "./channel-icon";
import { AIDraftCard } from "./ai-draft-card";

export function ChatPanel({ conversationId }: { conversationId: string | null }) {
  const { data: conversation, isLoading } = useConversationDetail(conversationId);
  const [composerText, setComposerText] = useState("");
  const [noteMode, setNoteMode] = useState(false);
  const sendMessage = useSendManualMessage(conversationId ?? "");
  const addNote = useAddNote(conversationId ?? "");
  const resolveConversation = useResolveConversation(conversationId ?? "");
  const archiveConversation = useArchiveConversation(conversationId ?? "");

  if (!conversationId) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState icon={SparklesIcon} title="Seleziona una conversazione" description="Scegli una conversazione dalla lista per vedere i messaggi e le proposte AI." />
      </div>
    );
  }

  if (isLoading || !conversation) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  const activeDraft = [...conversation.drafts].reverse().find((d) => !["SENT", "REJECTED"].includes(d.status));

  function handleSend() {
    if (!composerText.trim()) return;
    if (noteMode) {
      addNote.mutate(
        { text: composerText },
        {
          onSuccess: () => setComposerText(""),
          onError: (err) => toast.error(err instanceof ApiError ? err.message : "Impossibile salvare la nota"),
        }
      );
    } else {
      sendMessage.mutate(composerText, {
        onSuccess: () => setComposerText(""),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : "Impossibile inviare il messaggio"),
      });
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ChannelIcon channel={conversation.channel} />
          <div>
            <p className="text-sm font-semibold">{conversation.customer.name || "Cliente sconosciuto"}</p>
            <p className="text-xs text-muted-foreground">{channelLabel(conversation.channel)}</p>
          </div>
          <StatusBadge status={conversation.status.toLowerCase()} className="ml-2" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => resolveConversation.mutate()} disabled={conversation.status === "RESOLVED"}>
            <CheckCircle2Icon /> Risolvi
          </Button>
          <Button size="sm" variant="outline" onClick={() => archiveConversation.mutate()} disabled={conversation.status === "ARCHIVED"}>
            <ArchiveIcon /> Archivia
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {conversation.messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nessun messaggio in questa conversazione.</p>
        )}
        {conversation.messages.map((message) => {
          const isCustomer = message.sender_type === "customer";
          return (
            <div key={message.id} className={cn("flex", isCustomer ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                  isCustomer ? "bg-muted" : message.sender_type === "ai" ? "bg-primary/10" : "bg-primary text-primary-foreground"
                )}
              >
                <p className="whitespace-pre-wrap">{message.text || <span className="italic opacity-70">[{message.message_type}]</span>}</p>
                <div className="mt-1 flex items-center gap-1 text-[0.65rem] opacity-70">
                  {message.sender_type === "ai" && <SparklesIcon className="size-3" />}
                  {formatDateTime(message.created_at)}
                </div>
              </div>
            </div>
          );
        })}

        {conversation.notes.map((note) => (
          <div key={note.id} className="flex justify-center">
            <div className="max-w-[85%] rounded-lg border border-dashed border-warning/50 bg-warning/10 px-3 py-2 text-xs text-warning-foreground dark:text-warning">
              <span className="flex items-center gap-1 font-medium"><StickyNoteIcon className="size-3" /> Nota interna</span>
              <p className="mt-0.5 whitespace-pre-wrap">{note.text}</p>
            </div>
          </div>
        ))}

        {activeDraft && <AIDraftCard conversationId={conversation.id} draft={activeDraft} />}
      </div>

      <div className="border-t p-3">
        <div className="mb-2 flex gap-2 text-xs">
          <button type="button" onClick={() => setNoteMode(false)} className={cn("rounded-full px-2.5 py-1", !noteMode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            Messaggio
          </button>
          <button type="button" onClick={() => setNoteMode(true)} className={cn("rounded-full px-2.5 py-1", noteMode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            Nota interna
          </button>
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            placeholder={noteMode ? "Scrivi una nota visibile solo al team..." : "Scrivi un messaggio manuale al cliente..."}
            rows={2}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!composerText.trim() || sendMessage.isPending || addNote.isPending}>
            <SendIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
