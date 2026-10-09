import { useState } from "react";
import { Check, Sparkles } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { AI_PLAN_PROMPT } from "@/lib/ai-plan-prompt";

/**
 * The prompt to copy into another assistant, so its plan imports cleanly.
 * It lived only at the bottom of Help, where nobody planning a trip looked;
 * the planner opens it in a pop-up now, and Help shows the same card.
 */
export function AiPromptCopy() {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(AI_PLAN_PROMPT);
      setError("");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy — select the text and copy it yourself.");
    }
  };
  return (
    <div className="space-y-3">
      <div className="plan-panel px-4 py-3">
        <p className="text-[12px] leading-[17px] text-foreground">Prompt</p>
        <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap font-sans text-[14px] leading-[20px] text-foreground">
          {AI_PLAN_PROMPT}
        </pre>
      </div>
      <div className="plan-panel px-4 py-3">
        <p className="text-[12px] leading-[17px] text-foreground">Use elsewhere</p>
        <p className="mt-1 text-[16px] leading-[22px]">Copy into your preferred AI tool</p>
        <p className="mt-1 text-[14px] leading-[20px] text-muted-foreground">
          ChatGPT, Gemini, Claude or whichever you use: fill in the brackets, then paste its answer
          into Plan with Béa → Import your plan. It asks for one place per line with a time and a
          street address, the shape Béa reads straight, so each stop gets its own pin.
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="btn-primary flex w-full items-center justify-center gap-2 px-4"
      >
        {copied ? <Check className="size-4" aria-hidden /> : null}
        {copied ? "Copied" : "Copy prompt"}
      </button>
      {error && (
        <p role="alert" className="text-[14px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** A button on the planner screens that opens the prompt over them. */
export function AiPromptButton({
  className = "",
  label = "Planning with ChatGPT or another AI? Get the prompt",
  variant = "pill",
}: {
  className?: string;
  /** The button's words; Plan with Béa's forms use a shorter "Get the prompt". */
  label?: string;
  /** `banner`: a full-width row that says what the prompt is for, hard to miss. */
  variant?: "pill" | "banner";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "banner" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`block w-full border-b border-border py-3 text-start ${className}`}
        >
          <span className="block text-[16px] leading-[22px]">{label}</span>
          <span className="mt-1 block text-[14px] leading-[20px] text-muted-foreground">
            To use in ChatGPT or any AI
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-semibold text-primary ${className}`}
        >
          <Sparkles className="size-4" aria-hidden />
          {label}
        </button>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        page
        hint="AI prompt"
        title="Take the prompt"
        crumb="Back"
        above
      >
        <AiPromptCopy />
      </Sheet>
    </>
  );
}
