/**
 * The sheets open right now, oldest first. Escape and the focus trap belong
 * to the top one only: with a listener each, one Escape closed a
 * confirmation and the settings sheet under it together.
 */
const openSheets: symbol[] = [];

/**
 * Join the stack of open sheets: the body stops scrolling while any is open,
 * and `isTop` says whether this one owns Escape. For an overlay drawn
 * without `Sheet` (the trip menu), so a sheet opened over it takes the key
 * first and closing it leaves the page held.
 */
export function joinSheetStack(): { isTop: () => boolean; leave: () => void } {
  const me = Symbol("sheet");
  openSheets.push(me);
  // Pages outside the app frame scroll the body; hold it while any sheet
  // is open, and let go only when the last one closes.
  if (openSheets.length === 1) document.body.style.overflow = "hidden";
  return {
    isTop: () => openSheets[openSheets.length - 1] === me,
    leave: () => {
      const at = openSheets.indexOf(me);
      if (at !== -1) openSheets.splice(at, 1);
      if (openSheets.length === 0) document.body.style.overflow = "";
    },
  };
}
