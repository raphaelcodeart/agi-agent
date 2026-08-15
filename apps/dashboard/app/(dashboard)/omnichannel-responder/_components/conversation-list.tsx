"use client";

import { useState } from "react";
import { InboxIcon, RefreshCwIcon, MegaphoneIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterSelect } from "@/components/shared/filter-bar";
import { useChannelAccounts, useConversations } from "@/hooks/use-omnichannel";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChannelIcon } from "./channel-icon";
import { BroadcastDialog } from "./broadcast-dialog";
import type { OmniConversationStatus } from "@/types/api";

const STATUS_OPTIONS: { value: OmniConversationStatus; label: string }[] = [
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
  // Filters by specific connected account (e.g. one particular Telegram bot),
  // not just by channel type - two bots of the same type would otherwise be
  // indistinguishable in this filter (see conv.channel_account_name below,
  // same reasoning for why each row shows it).
  const [channelAccountFilter, setChannelAccountFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data: conversations, isLoading, isFetching, refetch } = useConversations({
    status: statusFilter,
    channel_account_id: channelAccountFilter || undefined,
    search: debouncedSearch || undefined,
  });
  const { data: channelAccounts } = useChannelAccounts();

  return (
    <div className="flex h-full min-h-0 flex-col border-r">
      <div className="space-y-2 border-b p-3">
        {channelAccounts && channelAccounts.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setChannelAccountFilter("")}
              title="Tutti i canali"
              className={cn(
                "rounded-full border px-2 py-1 text-[0.7rem] font-medium transition-colors",
                channelAccountFilter === "" ? "border-primary bg-primary/10 text-primary" : "border-transparent bg-muted text-muted-foreground hover:bg-muted/70"
              )}
            >
              Tutti
            </button>
            {channelAccounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => setChannelAccountFilter((prev) => (prev === account.id ? "" : account.id))}
                title={account.name}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-1.5 py-1 text-[0.7rem] transition-colors",
                  channelAccountFilter === account.id ? "border-primary bg-primary/10 text-primary" : "border-transparent bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                <ChannelIcon channel={account.channel} />
                <span className="max-w-20 truncate">{account.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Cerca cliente, telefono, email..." className="flex-1" />
          <Button
            size="icon-sm"
            variant="outline"
            title="Aggiorna adesso (si aggiorna comunque da sola ogni pochi secondi)"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCwIcon className={isFetching ? "animate-spin" : ""} />
          </Button>
          <Button size="icon-sm" variant="outline" title="Invio multiplo" onClick={() => setBroadcastOpen(true)}>
            <MegaphoneIcon />
          </Button>
        </div>
        <FilterSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as OmniConversationStatus | "")}
          options={STATUS_OPTIONS}
          placeholder="Stato"
          allLabel="Tutte"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
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
                    <div className="mt-1">
                      <StatusBadge status={conv.status.toLowerCase()} />
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <ChannelIcon channel={conv.channel} />
                      <span className="shrink-0 text-[0.65rem] font-medium text-muted-foreground">{conv.channel_account_name}</span>
                      <span className="text-muted-foreground">·</span>
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

      <BroadcastDialog open={broadcastOpen} onOpenChange={setBroadcastOpen} />
    </div>
  );
}
