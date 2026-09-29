import { useState } from "react";
import { Check, Copy, Sparkles } from "@/components/icons";
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
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        Copy this into ChatGPT, Gemini, Claude or whichever you use, fill in the brackets, and paste
        its answer into Plan with Béa → I already have a plan.
      </p>
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        It asks for one place per line with a time and a street address, and no travel lines — the
        shape Béa reads straight, so each stop gets its own pin.
      </p>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-[12.5px] leading-relaxed text-foreground">
        {AI_PLAN_PROMPT}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[14px] font-medium text-primary-foreground"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy the prompt"}
      </button>
      {error && <p className="text-[13px] text-destructive">{error}</p>}
    </div>
  );
}

/** A button on the planner screens that opens the prompt over them. */
export function AiPromptButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-semibold text-primary ${className}`}
      >
        <Sparkles className="size-4" aria-hidden />
        Planning with ChatGPT or another AI? Get the prompt
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="A prompt for another AI"
        hint="Its answer pastes straight into Béa"
        above
      >
        <AiPromptCopy />
      </Sheet>
    </>
  );
}
