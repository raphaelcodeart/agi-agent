"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PhoneIcon, MailIcon, TagIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConversationDetail, useUpdateCustomer, useTags, useAddConversationTag, useRemoveConversationTag } from "@/hooks/use-omnichannel";
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";

export function CustomerPanel({ conversationId }: { conversationId: string | null }) {
  const { data: conversation, isLoading } = useConversationDetail(conversationId);
  const { data: tags } = useTags();
  const updateCustomer = useUpdateCustomer(conversationId ?? "");
  const addTag = useAddConversationTag(conversationId ?? "");
  const removeTag = useRemoveConversationTag(conversationId ?? "");

  const [notes, setNotes] = useState("");

  useEffect(() => {
    setNotes(conversation?.customer.notes ?? "");
  }, [conversation?.customer.id, conversation?.customer.notes]);

  if (!conversationId) return <div className="border-l p-4" />;

  if (isLoading || !conversation) {
    return (
      <div className="space-y-3 border-l p-4">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  const customer = conversation.customer;
  const availableTags = (tags ?? []).filter((t) => !conversation.tags.some((ct) => ct.id === t.id));

  function saveNotes() {
    updateCustomer.mutate(
      { customerId: customer.id, payload: { notes } },
      { onError: (err) => toast.error(err instanceof ApiError ? err.message : "Impossibile salvare le note") }
    );
  }

  return (
    <div className="h-full space-y-5 overflow-y-auto border-l p-4">
      <div>
        <p className="text-sm font-semibold">{customer.name || "Cliente sconosciuto"}</p>
        <p className="text-xs text-muted-foreground">Cliente dal {formatDateTime(customer.created_at)}</p>
      </div>

      <div className="space-y-2 text-sm">
        {customer.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <PhoneIcon className="size-3.5" /> {customer.phone}
          </div>
        )}
        {customer.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MailIcon className="size-3.5" /> {customer.email}
          </div>
        )}
      </div>

      <div>
        <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <TagIcon className="size-3.5" /> Tag
        </p>
        <div className="flex flex-wrap gap-1.5">
          {conversation.tags.map((tag) => (
            <Badge key={tag.id} variant="outline" className="cursor-pointer gap-1" onClick={() => removeTag.mutate(tag.id)}>
              {tag.name} ×
            </Badge>
          ))}
          {availableTags.length > 0 && (
            <Select items={availableTags.map((t) => ({ value: t.id, label: t.name }))} onValueChange={(tagId) => addTag.mutate(tagId as string)}>
              <SelectTrigger size="sm" className="h-6 gap-1 px-2 text-xs">
                <PlusIcon className="size-3" />
                <SelectValue placeholder="Aggiungi" />
              </SelectTrigger>
              <SelectContent>
                {availableTags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Canali collegati</p>
        <div className="space-y-1 text-xs text-muted-foreground">
          {customer.identities.map((identity) => (
            <div key={identity.id}>
              {identity.channel}: {identity.display_name || identity.external_user_id}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Note</p>
          {notes !== (customer.notes ?? "") && (
            <Button size="xs" variant="ghost" onClick={saveNotes} disabled={updateCustomer.isPending}>
              Salva
            </Button>
          )}
        </div>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Note interne sul cliente..." />
      </div>
    </div>
  );
}
