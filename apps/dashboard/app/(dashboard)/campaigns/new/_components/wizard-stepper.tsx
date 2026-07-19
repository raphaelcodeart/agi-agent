import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_STEPS } from "@/lib/validation/campaigns";

export function WizardStepper({ currentStep }: { currentStep: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
      {WIZARD_STEPS.map((label, index) => {
        const stepNumber = index + 1;
        const isDone = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;
        return (
          <li key={label} className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                isDone && "bg-primary text-primary-foreground",
                isCurrent && "bg-primary/15 text-primary ring-2 ring-primary",
                !isDone && !isCurrent && "bg-muted text-muted-foreground"
              )}
            >
              {isDone ? <CheckIcon className="size-3.5" /> : stepNumber}
            </div>
            <span className={cn("text-sm", isCurrent ? "font-medium text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
            {stepNumber < WIZARD_STEPS.length && <span className="mx-1 h-px w-6 bg-border sm:w-10" />}
          </li>
        );
      })}
    </ol>
  );
}
