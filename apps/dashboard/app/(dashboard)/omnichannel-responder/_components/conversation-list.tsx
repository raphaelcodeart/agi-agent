"use client";

import { useState } from "react";
import { InboxIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConversations } from "@/hooks/use-omnichannel";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChannelIcon } from "./channel-icon";
import type { OmniConversationStatus } from "@/types/api";

const STATUS_OPTIONS: { value: OmniConversationStatus | ""; label: string }[] = [
  { value: "", label: "Tutte" },
  { value: "WAITING_APPROVAL", label: "Bozza da approvare" },
  { value: "AI_PROCESSING", label: "AI in elaborazione" },
  { value: "OPEN", label: "Aperte" },
  { value: "WAITING_CUSTOMER", label: "In attesa del cliente" },
  { value: "RESOLVED", label: "Risolte" },
  { value: "ARCHIVED", label: "Archiviate" },
];

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export function ConversationList({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const [statusFilter, setStatusFilter] = useState<OmniConversationStatus | "">("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data: conversations, isLoading } = useConversations({ status: statusFilter, search: debouncedSearch || undefined });

  return (
    <div className="flex h-full flex-col border-r">
      <div className="space-y-2 border-b p-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Cerca cliente, telefono, email..." />
        <Select value={statusFilter || "__all__"} onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : (v as OmniConversationStatus))}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value || "__all__"} value={opt.value || "__all__"}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3 p-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : !conversations || conversations.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={InboxIcon} title="Nessuna conversazione" description="I nuovi messaggi in arrivo appariranno qui." />
          </div>
        ) : (
          <ul>
            {conversations.map((conv) => (
              <li key={conv.id}>
                <button
                  type="button"
                  onClick={() => onSelect(conv.id)}
                  className={cn(
                    "flex w-full items-start gap-2.5 border-b px-3 py-3 text-left transition-colors hover:bg-muted/50",
                    selectedId === conv.id && "bg-muted"
                  )}
                >
                  <Avatar>
                    <AvatarFallback>{initials(conv.customer.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{conv.customer.name || "Cliente sconosciuto"}</span>
                      <span className="shrink-0 text-[0.7rem] text-muted-foreground">{conv.last_message_at ? formatDateTime(conv.last_message_at).split(" ").slice(-1)[0] : ""}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <ChannelIcon channel={conv.channel} />
                      <p className="truncate text-xs text-muted-foreground">{conv.last_message_preview || "—"}</p>
                    </div>
                    {conv.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {conv.tags.map((tag) => (
                          <Badge key={tag.id} variant="outline" className="px-1.5 py-0 text-[0.65rem]">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {conv.unread_count > 0 && (
                    <Badge className="shrink-0 rounded-full bg-primary px-1.5 text-primary-foreground">{conv.unread_count}</Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
