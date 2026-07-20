"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  campaignWizardSchema,
  WIZARD_STEP_FIELDS,
  WIZARD_STEPS,
  buildTargetingParams,
  campaignToWizardDefaults,
  toCampaignCreatePayload,
  type CampaignWizardValues,
} from "@/lib/validation/campaigns";
import { useCreateCampaign, useLaunchCampaign, useCampaignDetail } from "@/hooks/use-campaigns";
import { ApiError } from "@/lib/api/errors";
import { WizardStepper } from "./_components/wizard-stepper";
import { StepInfo } from "./_components/step-info";
import { StepText } from "./_components/step-text";
import { StepMedia } from "./_components/step-media";
import { StepRecipients } from "./_components/step-recipients";
import { StepScheduling } from "./_components/step-scheduling";
import { StepSummary } from "./_components/step-summary";

function NewCampaignForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateId = searchParams.get("duplicate");
  const [step, setStep] = useState(1);
  const createCampaign = useCreateCampaign();
  const duplicateSource = useCampaignDetail(duplicateId ?? undefined);
  const hasPrefilled = useRef(false);

  const form = useForm<CampaignWizardValues>({
    resolver: zodResolver(campaignWizardSchema),
    defaultValues: {
      title: "",
      default_text: "",
      instagram_text: "",
      facebook_text: "",
      linkedin_text: "",
      tiktok_text: "",
      youtube_title: "",
      youtube_description: "",
      x_text: "",
      threads_text: "",
      media_file_id: null,
      targeting_mode: "all_active_channels",
      user_ids: [],
      group_ids: [],
      channel_ids: [],
      platform_names: [],
      publishing_mode: "immediate",
      scheduled_at: null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  const launchCampaign = useLaunchCampaign();

  useEffect(() => {
    if (duplicateSource.data && !hasPrefilled.current) {
      hasPrefilled.current = true;
      form.reset(campaignToWizardDefaults(duplicateSource.data.campaign));
      toast.info("Campagna precompilata: rivedi testo, media e scelte di pubblicazione prima di lanciarla.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateSource.data]);

  async function goNext() {
    const fields = WIZARD_STEP_FIELDS[step - 1];
    const valid = fields.length === 0 || (await form.trigger(fields));
    if (valid) setStep((s) => Math.min(WIZARD_STEPS.length, s + 1));
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSubmit(values: CampaignWizardValues) {
    try {
      const campaign = await createCampaign.mutateAsync(toCampaignCreatePayload(values));
      if (values.publishing_mode === "draft") {
        toast.success("Campagna salvata come bozza");
        router.push(`/campaigns/${campaign.id}`);
        return;
      }
      await launchCampaign.mutateAsync({
        campaignId: campaign.id,
        targetingParams: buildTargetingParams(values),
      });
      toast.success("Campagna creata e lanciata");
      router.push(`/campaigns/${campaign.id}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.detail : "Impossibile creare la campagna");
    }
  }

  const isLastStep = step === WIZARD_STEPS.length;
  const isSubmitting = createCampaign.isPending || launchCampaign.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title={duplicateId ? "Duplica campagna" : "Nuova campagna"}
        description={
          duplicateId
            ? "Testo, media e destinatari precompilati dalla campagna originale: correggi ciò che serve e scegli come pubblicare."
            : "Crea una campagna di pubblicazione multi-piattaforma"
        }
      />

      <WizardStepper currentStep={step} />

      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {step === 1 && <StepInfo form={form} />}
              {step === 2 && <StepText form={form} />}
              {step === 3 && <StepMedia form={form} />}
              {step === 4 && <StepRecipients form={form} />}
              {step === 5 && <StepScheduling form={form} />}
              {step === 6 && <StepSummary form={form} />}

              <div className="flex items-center justify-between border-t pt-4">
                <Button type="button" variant="outline" onClick={goBack} disabled={step === 1}>
                  <ArrowLeftIcon className="size-4" />
                  Indietro
                </Button>
                {isLastStep ? (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2Icon className="size-4 animate-spin" />}
                    {form.watch("publishing_mode") === "draft" ? "Salva bozza" : "Crea e lancia campagna"}
                  </Button>
                ) : (
                  <Button type="button" onClick={goNext}>
                    Avanti
                    <ArrowRightIcon className="size-4" />
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewCampaignPage() {
  return (
    <Suspense>
      <NewCampaignForm />
    </Suspense>
  );
}
