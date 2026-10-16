# Design tokens and primitives

`src/tokens.css` is the one place where Béa's space, type, radius, height and
action colours are written. Screens reach them through Tailwind utilities
(`text-body`, `bg-action`, `h-(--h-md)`) and through the primitives in
`src/components/ui/`.

## Tokens

| Group  | Tokens                                                                                                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Space  | `--space-1` … `--space-12` (4px grid); `--gutter` 16, `--card-pad` 16, `--stack` 12, `--section` 32                                                                           |
| Type   | `--fs-12/14/16/20/28/40` with line heights `--lh-*`, scaled by `--text-scale`; utilities `text-caption`, `text-small`, `text-body`, `text-title`, `text-display`, `text-hero` |
| Radius | `--r-sm` 6, `--r-md` 8, `--r-lg` 20 (sheet tops), `--r-pill`                                                                                                                  |
| Height | `--h-lg` 48 (the one primary, full width), `--h-md` 40, `--h-sm` 32, `--h-field` 44, `--tap` 44                                                                               |
| Colour | `--surface-0/1/2`, `--ink`, `--ink-muted`, `--line`, `--line-strong`, `--action`, `--action-ink`, `--accent-mark`, `--link`, `--danger`, `--focus`                            |

`--accent-mark` is the traveller's accent used as a mark (active tab bar,
next pin, progress). It is not `--accent`, which is shadcn's hover fill.
The older names in `styles.css` (`--card`, `--primary` …) stay until the
screens have moved over.

## Primitives

- `Button` (`button.tsx`): `primary`, `secondary`, `ghost`, `danger`,
  `google`; sizes `lg` (full width), `md`, `sm`, `icon`. `blockedReason`
  keeps an unavailable button focusable and says why when tapped.
- `Segmented` (`segmented.tsx`): switches between views of the same thing.
- `ActionBar` (`action-bar.tsx`): two to four actions, icon over label.
- `Heading` (`heading.tsx`): `page`, `section`, `card`, with an optional `aside` link.

## Rules

1. One filled (`primary`) button per screen.
2. One row of tabs per screen.
3. Segmented is for views; ActionBar is for actions.
4. Never a card inside a card.

## Drift guard

`npm run check:drift` (CI, after lint) counts hand-sized text, arbitrary
radii and heights, raw `<button>`s, hex colours in components, tracking
overrides, `[class*=` selectors and `!important` in `styles.css`, its line
count and literal scrims, and fails when any goes up from
`scripts/design-drift-baseline.json`. When a change brings counts down, run
`npm run check:drift -- --save` in the same pull request. No new selector in
`styles.css` should target a utility class: change the component instead.
