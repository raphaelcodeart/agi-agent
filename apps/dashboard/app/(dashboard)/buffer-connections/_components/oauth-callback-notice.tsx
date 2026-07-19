"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function OAuthCallbackNotice() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (success === "true") {
      toast.success("Account Buffer collegato correttamente");
      router.replace("/buffer-connections");
    } else if (error) {
      toast.error(`Collegamento Buffer non riuscito: ${error}`);
      router.replace("/buffer-connections");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}
