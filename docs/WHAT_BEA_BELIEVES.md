# What Béa Believes

Internal product philosophy — not user-facing. Test every new feature against this list
before it ships. If it fails the triangle, it does not belong in the core product.

## The triangle

**Past You** captures.  
**Present You** decides.  
**Future You** benefits.

## Beliefs

1. Travel inspiration is valuable.
2. Recommendations are assets.
3. Memories become more valuable over time.
4. Future You deserves help from Present You.
5. Good travel decisions begin with your own history.
6. A saved place should eventually become a real experience.

## Feature litmus

| Idea | Passes when… |
| --- | --- |
| Near | A saved place becomes a real experience. |
| Recs | Recommendations are treated as assets. |
| Help me choose | Decisions start from the user's own history. |
| Let Béa plan | Plans are assembled from saved ideas + preferences. |
| Random AI “top 10 in Paris” | **Fails** — not based on the user's history. |

## Voice (architecture, not decoration)

Philosophy → voice → UI.

Modes: Companion · Archivist · Scout · Planner · Honest AI · Curator.

Every line should **explain**, **encourage**, or **reassure**. Humor is a bonus.
High personality only on: save, empty states, Near, plan complete, milestones, memory import.
Keep auth, legal, settings, expenses, and delete confirmations utilitarian.

Signature lines and rotating copy live in `src/lib/bea-voice.ts`.
