import Link from "next/link";
import { CompassIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        <CompassIcon className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Pagina non trovata</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          La pagina che cerchi non esiste o è stata spostata.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Torna alla dashboard</Link>
      </Button>
    </div>
  );
}
