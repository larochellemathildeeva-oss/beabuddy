/**
 * Reading a place name that was not written in English.
 *
 * Béa's place-matching grew up on Latin text and picked up two habits from
 * it. It decided a phrase "looks like a name" by testing the first character
 * against `[A-Z0-9À-ÖØ-öø-ÿ]`, and it threw away anything shorter than four
 * characters as too vague. Both are reasonable for English and wrong almost
 * everywhere else: 浅草の寺, Эрмитажная площадь, 서울 강남구 and مسجد الشيخ زايد
 * all failed the first test, and 京都 — a city of 1.5 million — failed the
 * second.
 *
 * The rules underneath were sound; only their alphabet was too small.
 */

/** Scripts with no capital letters, where "starts with a capital" cannot apply. */
function isCaseless(char: string): boolean {
  return char.toUpperCase() === char.toLowerCase();
}

/**
 * Does this read as a name rather than a sentence?
 *
 * The original test was "starts with a capital", which is a decent proxy for
 * a proper noun and is why "browse the market" was rejected. Kept, but asked
 * in a way every script can answer: a capital where the script has capitals,
 * any letter where it does not. Japanese cannot shout, and should not have to
 * in order to be believed.
 */
export function startsLikeAName(text: string): boolean {
  const first = [...text.trim()][0];
  if (!first) return false;
  if (/\p{N}/u.test(first)) return true;
  if (!/\p{L}/u.test(first)) return false;
  return isCaseless(first) || first === first.toUpperCase();
}

/**
 * The shortest string worth looking up, in the script it is written in.
 *
 * Four characters of English is barely a word. Four characters of Japanese is
 * a sentence — 京都 is two, 清水寺 is three — so a rule tuned to alphabets
 * silently discarded whole cities. Scripts that pack a word into each
 * character get a lower bar.
 */
export function minimumNameLength(text: string): number {
  return hasDenseScript(text) ? 2 : 4;
}

/** Han, kana, Korean: one character carries about as much as an English word. */
export function hasDenseScript(text: string): boolean {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(text);
}

/**
 * Roughly how many words, for rules that cap phrase length.
 *
 * Scripts that do not space their words would otherwise count as one word no
 * matter how long, so a whole paragraph of Japanese looked like a tidy name.
 * Counting characters in that case keeps the cap meaningful.
 */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  if (hasDenseScript(trimmed) && !trimmed.includes(" ")) {
    return Math.ceil([...trimmed].length / 3);
  }
  return trimmed.split(/\s+/).length;
}
