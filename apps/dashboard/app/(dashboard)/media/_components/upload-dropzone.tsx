"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { UploadCloudIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUploadMedia } from "@/hooks/use-media";
import { ApiError } from "@/lib/api/errors";

export function UploadDropzone() {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMedia = useUploadMedia();

  const uploadFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      Array.from(files).forEach((file) => {
        uploadMedia.mutate(file, {
          onSuccess: () => toast.success(`${file.name} caricato`),
          onError: (error) =>
            toast.error(
              `${file.name}: ${error instanceof ApiError ? error.detail : "caricamento non riuscito"}`
            ),
        });
      });
    },
    [uploadMedia]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(event) => event.key === "Enter" && inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        uploadFiles(event.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
      )}
    >
      <UploadCloudIcon className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">
        Trascina i file qui oppure clicca per selezionarli
      </p>
      <p className="text-xs text-muted-foreground">Immagini, video e audio supportati dalla piattaforma</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => uploadFiles(event.target.files)}
      />
    </div>
  );
}
