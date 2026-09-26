import { suggestionsDocument, type SearchGrounding } from "@/lib/search-grounding";

/**
 * What Béa checked on the web for this plan. Google asks that a grounded
 * answer shows its Search Suggestions exactly as sent, so they sit in a
 * sandboxed frame (no scripts; links open in a new tab), with the sources
 * listed beneath.
 */
export function SearchGroundingNote({ grounding }: { grounding: SearchGrounding }) {
  return (
    <div className="space-y-1.5">
      {grounding.suggestionsHtml && (
        <iframe
          title="Google Search suggestions"
          srcDoc={suggestionsDocument(grounding.suggestionsHtml)}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          className="block h-[60px] w-full border-0"
        />
      )}
      {grounding.sources.length > 0 && (
        <p className="break-words text-[12px] text-muted-foreground">
          Checked on the web:{" "}
          {grounding.sources.map((source, i) => (
            <span key={source.url}>
              {i > 0 && ", "}
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                {source.title}
              </a>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
