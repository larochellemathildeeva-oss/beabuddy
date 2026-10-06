# Home widgets

Home keeps its existing modules and Customize home switches. In Customize home,
choose **Arrange widgets**, drag a handle (touch or mouse), or focus a handle and
use Space, arrow keys, Space. Escape cancels a drag. Choose a module's size and
tap **Done**. Content links are inactive while arranging.

The two-column grid uses Small (half width), Wide (full width), and Large (full width, taller). Rows follow their content, so a short module leaves no empty space, with 12px
gutters and the existing 16px Home inset. Unsupported sizes are omitted from
that module's picker. Long lists and notes scroll inside their widget. Reduced
motion from either the operating system or Béa's Reading settings disables the
wiggle. Drag handles, size pickers and Done have 44px minimum targets.

The `homeLayout` account setting now includes `sizes` alongside `order` and `on`.
It uses the existing account-settings sync, including its debounce and offline
retry. Old switch-only or order-only layouts keep their choices and receive
module-appropriate sizes. Reset restores the default grid. No database change
or migration is needed.

## Design reference

Before implementation, searched for “iOS widgets UI kit” and reviewed Doist's
[Apple Widgets UI Kit for Figma](https://www.figma.com/community/file/857332868558500566/Apple-Widgets-UI-Kit)
through its author's [published preview](https://dribbble.com/shots/12254829-Apple-Widgets-UI-Kit-for-Figma).
The Community page was blocked in this environment. The reference informed the
square / wide / large size family and consistent gutter/inset rhythm; 12px gaps
and 16px insets adapt that rhythm to Béa's existing spacing rather than claiming
exact measurements from the Figma file. All imagery is Béa's existing imagery;
no kit assets were copied.

## Verification and screenshots

The screenshots show the real Home route at 390×844 with the repository's
sample account and travel data, using the production stylesheet. They demonstrate
the same saved arrangement in normal and Customize modes in each theme.

To reproduce the browser checks and screenshots:

```sh
npm run build
PREVIEW_RENDER_ONLY=1 node scripts/preview/check.mjs
CHROMIUM_PATH=/usr/bin/chromium node scripts/preview/home-widgets.mjs
```

The browser check covers keyboard, mouse and touch reorder, drag cancellation,
sizes, on/off switches, reset, reload, the synced-save payload, reduced motion,
44px controls, and all three trip states at 320, 390 and 768px. Pure layout tests
cover legacy loading, invalid sizes, save/load through the synced setting, and
default grid packing without overlapping cells.
