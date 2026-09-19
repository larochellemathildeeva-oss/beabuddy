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
High personality only on: save, empty states, Near, plan complete, milestones, memory import,
and the waits — placing stops, building a trip, comparing places, importing photos.
Keep auth, legal, settings, expenses, and delete confirmations utilitarian.

### Béa is a dog, and the app speaks about her

**Third person, always. She never says "I".**

She is a small French bulldog in a bandana, not an assistant with a notebook. "Béa has an
opinion" is in character; "I have an opinion" makes her a chatbot wearing a dog. The app had
both for a while and she read as two characters on adjacent screens. A test in
`bea-voice.test.ts` now fails any pool line using first person.

The dog gives the copy a vocabulary that is playful without being childish, and it is often
literally accurate — she really is *following the scent* and *checking one more corner* when
she is geocoding stops one a second:

> sniffing out · following the scent · on the trail · nose down · scouting ahead ·
> one more corner · little legs · tiny legs, big thoughts

Known exception, not yet resolved: `BEA_TAGLINES.companion` in `bea-voice.ts` is still
"I remember travel things so you don't have to." It is a brand line rather than a pool line,
so the test does not cover it — but it contradicts the rule and should be settled.

Signature lines and rotating copy live in `src/lib/bea-voice.ts`.
