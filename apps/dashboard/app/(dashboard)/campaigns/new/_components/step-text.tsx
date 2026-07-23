import type { UseFormReturn } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import type { CampaignWizardValues } from "@/lib/validation/campaigns";
import { AIGenerateDialog } from "./ai-generate-dialog";
import type { AIGenerateTextResponse } from "@/types/api";

const PLATFORM_TABS: { value: keyof CampaignWizardValues; label: string; maxLength: number }[] = [
  { value: "instagram_text", label: "Instagram", maxLength: 5000 },
  { value: "facebook_text", label: "Facebook", maxLength: 5000 },
  { value: "linkedin_text", label: "LinkedIn", maxLength: 5000 },
  { value: "tiktok_text", label: "TikTok", maxLength: 5000 },
  { value: "x_text", label: "X", maxLength: 280 },
  { value: "threads_text", label: "Threads", maxLength: 500 },
];

export function StepText({ form }: { form: UseFormReturn<CampaignWizardValues> }) {
  function handleGenerated(result: AIGenerateTextResponse) {
    form.setValue("default_text", result.default_text, { shouldDirty: true, shouldValidate: true });
    form.setValue("instagram_text", result.instagram_text, { shouldDirty: true, shouldValidate: true });
    form.setValue("facebook_text", result.facebook_text, { shouldDirty: true, shouldValidate: true });
    form.setValue("linkedin_text", result.linkedin_text, { shouldDirty: true, shouldValidate: true });
    form.setValue("tiktok_text", result.tiktok_text, { shouldDirty: true, shouldValidate: true });
    form.setValue("x_text", result.x_text, { shouldDirty: true, shouldValidate: true });
    form.setValue("threads_text", result.threads_text, { shouldDirty: true, shouldValidate: true });
    form.setValue("youtube_title", result.youtube_title, { shouldDirty: true, shouldValidate: true });
    form.setValue("youtube_description", result.youtube_description, { shouldDirty: true, shouldValidate: true });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Scrivi il testo a mano oppure genera una bozza con AI da un argomento e poi modificala.
        </p>
        <AIGenerateDialog onGenerated={handleGenerated} />
      </div>

      <FormField
        control={form.control}
        name="default_text"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Testo predefinito</FormLabel>
            <FormControl>
              <Textarea rows={4} maxLength={5000} placeholder="Testo utilizzato per le piattaforme senza un override specifico" {...field} />
            </FormControl>
            <FormDescription>{(field.value ?? "").length}/5000 caratteri</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Override per piattaforma (opzionale)</p>
        <Tabs defaultValue="instagram_text">
          <TabsList>
            {PLATFORM_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
            <TabsTrigger value="youtube">YouTube</TabsTrigger>
          </TabsList>
          {PLATFORM_TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="pt-3">
              <FormField
                control={form.control}
                name={tab.value}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        rows={3}
                        maxLength={tab.maxLength}
                        placeholder={`Testo specifico per ${tab.label} (lascia vuoto per usare il testo predefinito)`}
                        {...field}
                        value={(field.value as string) ?? ""}
                      />
                    </FormControl>
                    <FormDescription>
                      {((field.value as string) ?? "").length}/{tab.maxLength} caratteri
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>
          ))}
          <TabsContent value="youtube" className="space-y-3 pt-3">
            <FormField
              control={form.control}
              name="youtube_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titolo YouTube</FormLabel>
                  <FormControl>
                    <Input maxLength={100} {...field} value={(field.value as string) ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="youtube_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrizione YouTube</FormLabel>
                  <FormControl>
                    <Textarea rows={3} maxLength={5000} {...field} value={(field.value as string) ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
