import { Link } from "@tanstack/react-router";
import { Sparkles, UserCheck, Info } from "lucide-react";

/** Small inline badge to mark an AI-assisted surface. */
export function AITransparencyBadge({ label = "AI-assisted", className = "" }: { label?: string; className?: string }) {
  return (
    <Link
      to="/legal/$slug"
      params={{ slug: "ai-transparency" }}
      title="Learn how CornerOps AI assists this experience"
      className={`inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground ${className}`}
    >
      <Sparkles className="h-3 w-3" /> {label}
    </Link>
  );
}

/** Notice that the user can request a human review of an AI-assisted decision. */
export function AIHumanReviewNotice({ context }: { context?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
      <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>
        {context ? `${context} ` : ""}If an AI-assisted decision materially affects you, you can request a human review at{" "}
        <a href="mailto:support@cornermex.ae" className="underline">support@cornermex.ae</a>. See our{" "}
        <Link to="/legal/$slug" params={{ slug: "ai-transparency" }} className="underline">AI Transparency Notice</Link>.
      </p>
    </div>
  );
}

/** Disclaimer to attach to AI-generated content surfaces. */
export function AIAssistedContentDisclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-center gap-1.5 text-[11px] text-muted-foreground ${className}`}>
      <Info className="h-3 w-3" />
      AI-assisted content. May be reviewed or edited by humans.{" "}
      <Link to="/legal/$slug" params={{ slug: "ai-transparency" }} className="underline">Learn more</Link>
    </p>
  );
}