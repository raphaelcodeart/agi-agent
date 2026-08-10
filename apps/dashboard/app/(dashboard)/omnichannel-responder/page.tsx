"use client";

import { useState } from "react";
import { ConversationList } from "./_components/conversation-list";
import { ChatPanel } from "./_components/chat-panel";
import { CustomerPanel } from "./_components/customer-panel";

export default function OmnichannelResponderPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="-m-4 grid h-[calc(100vh-4rem)] grid-cols-[300px_1fr_280px] overflow-hidden rounded-lg border bg-background sm:-m-6">
      <ConversationList selectedId={selectedId} onSelect={setSelectedId} />
      <ChatPanel conversationId={selectedId} onDeleted={() => setSelectedId(null)} />
      <CustomerPanel conversationId={selectedId} />
    </div>
  );
}
