import { useSyncExternalStore } from "react";
// A real href from `to` and `params`, so the checker can see where a link goes.
export function Link({ children, className, to, params, ...rest }: any) {
  const path = typeof to === "string" ? to.replace(/\$(\w+)/g, (_: string, k: string) => params?.[k] ?? k) : undefined;
  const { search, hash: _h, replace: _r, preload: _p, ...attrs } = rest;
  // A search object rides on the href, as the real router writes it.
  const query = search && typeof search === "object" ? new URLSearchParams(search).toString() : "";
  const href = path && query ? `${path}?${query}` : path;
  return <a className={className} href={href} {...attrs} onClick={(event) => {
    attrs.onClick?.(event);
    if (new URLSearchParams(location.search).get("sample") === "shell" && href?.startsWith("/")) {
      event.preventDefault();
      location.assign(`/?sample=shell&path=${encodeURIComponent(href)}`);
    }
  }}>{children}</a>;
}
// Records where the page asked to go, so a flow can check the destination.
export const useNavigate = () => (to: unknown) => {
  (window as unknown as { __lastNavigate?: unknown }).__lastNavigate = to;
}; export const useRouter = () => ({ history: { back: () => history.back() }, invalidate: async () => {} });

// The shell is previewed on real route identities, without starting a server.
export const useCanGoBack = () => new URLSearchParams(location.search).get("back") === "yes";
export const useRouterState = ({ select }: any) => select({
  location: { pathname: new URLSearchParams(location.search).get("path") ?? "/profile", href: location.href },
  matches: [{ staticData: { plane: "tab" } }],
});
// A route file's own component, rendered without a router (the Trips sample).
// `?tab=` is the one search key a route reads here (World's views); navigating
// rewrites it in place, so the sample and its state stay.
const searchListeners = new Set<() => void>();
const searchSnapshot = () => location.search;
window.addEventListener("popstate", () => searchListeners.forEach((cb) => cb()));
export const createFileRoute = () => (options: any) => ({
  options,
  useSearch: () => {
    const query = useSyncExternalStore((cb) => (searchListeners.add(cb), () => searchListeners.delete(cb)), searchSnapshot);
    const params = Object.fromEntries(new URLSearchParams(query));
    return options.validateSearch ? options.validateSearch(params) : params;
  },
  useNavigate: () => ({ search }: any) => {
    const url = new URL(location.href);
    if (search?.tab) url.searchParams.set("tab", search.tab);
    else url.searchParams.delete("tab");
    history.replaceState(null, "", url);
    searchListeners.forEach((cb) => cb());
  },
  useParams: () => ({ token: "preview" }),
  // The shared page's loader, with a small plan to show.
  useLoaderData: () => new URLSearchParams(location.search).get("sample") === "page-shared-gone" ? null : ({
    title: "Hiroshima",
    place: "Hiroshima, Japan",
    startDate: "2026-10-07",
    endDate: "2026-10-08",
    following: false,
    days: [
      { day: "2026-10-07", zone: "Asia/Tokyo", stops: [{ time: "09:30", title: "Peace Memorial Park", kind: "activity", address: "1-2 Nakajimacho" }, { time: "12:30", title: "Okonomiyaki at Nagata-ya", kind: "food", address: "1-7-19 Otemachi" }] },
      { day: "2026-10-08", zone: "Asia/Tokyo", stops: [{ time: "10:00", title: "Miyajima ferry", kind: "transit", address: "Miyajimaguchi" }] },
    ],
  }),
});
