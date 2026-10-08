import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SearchGroundingNote } from "@/components/SearchGroundingNote";
import { findArticles, type FindArticlesResult } from "@/lib/article-search.functions";
import { friendlyError } from "@/lib/friendly-error";

/**
 * "Find recs for {place}": Béa searches the web for articles about the place
 * and the traveller picks one to read (place-lists spec, section 4). Google's
 * suggestions and sources are shown with the answer, as its terms ask.
 */
export function FindRecs({
  name,
  city,
  country,
  onPick,
}: {
  name: string;
  city: string | null;
  country: string | null;
  onPick: (url: string) => void;
}) {
  const find = useServerFn(findArticles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState<FindArticlesResult | null>(null);

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      setFound(await find({ data: { city, country } }));
    } catch (err) {
      setError(friendlyError(err, "Béa couldn't search just now. Paste a link instead."));
    } finally {
      setBusy(false);
    }
  };

  if (found && !found.available) {
    return (
      <p className="text-[14px] text-muted-foreground">
        Béa can't search the web right now. Paste an article link instead.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {!found && (
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="min-h-12 w-full rounded-[var(--r-button)] bg-primary px-4 text-[16px] font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Looking for articles…" : `Find recs for ${name}`}
        </button>
      )}
      {error && (
        <p role="alert" className="text-[14px] text-destructive">
          {error}
        </p>
      )}
      {found && found.articles.length === 0 && (
        <p className="text-[14px] text-muted-foreground">
          Béa found no articles for {name}. Paste one you know instead.
        </p>
      )}
      {found && found.articles.length > 0 && (
        <div className="space-y-2">
          <p className="text-[14px] text-muted-foreground">Pick one and Béa lists its places.</p>
          <ul className="divide-y divide-border border-y border-border">
            {found.articles.map((article) => (
              <li key={article.url}>
                <button
                  type="button"
                  onClick={() => onPick(article.url)}
                  className="flex min-h-14 w-full flex-col justify-center py-2 text-left"
                >
                  <span className="text-[16px] font-semibold">{article.title}</span>
                  <span className="text-[14px] text-muted-foreground">
                    {new URL(article.url).hostname.replace(/^www\./, "")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {found.grounding && <SearchGroundingNote grounding={found.grounding} />}
        </div>
      )}
    </div>
  );
}
