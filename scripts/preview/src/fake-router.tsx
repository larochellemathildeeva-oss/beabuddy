import { useSyncExternalStore } from "react";
// A real href from `to` and `params`, so the checker can see where a link goes.
export function Link({ children, className, to, params, ...rest }: any) {
  const href = typeof to === "string" ? to.replace(/\$(\w+)/g, (_: string, k: string) => params?.[k] ?? k) : undefined;
  const { search: _s, hash: _h, replace: _r, preload: _p, ...attrs } = rest;
  return <a className={className} href={href} {...attrs} onClick={(event) => {
    attrs.onClick?.(event);
    if (new URLSearchParams(location.search).get("sample") === "shell" && href?.startsWith("/")) {
      event.preventDefault();
      location.assign(`/?sample=shell&path=${encodeURIComponent(href)}`);
    }
  }}>{children}</a>;
}
export const useNavigate = () => () => {}; export const useRouter = () => ({ history: { back: () => history.back() } });

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
const searchSnapshot = () => new URLSearchParams(location.search).get("tab") ?? "";
export const createFileRoute = () => (options: any) => ({
  options,
  useSearch: () => {
    const tab = useSyncExternalStore((cb) => (searchListeners.add(cb), () => searchListeners.delete(cb)), searchSnapshot);
    return tab ? { tab } : {};
  },
  useNavigate: () => ({ search }: any) => {
    const url = new URL(location.href);
    if (search?.tab) url.searchParams.set("tab", search.tab);
    else url.searchParams.delete("tab");
    history.replaceState(null, "", url);
    searchListeners.forEach((cb) => cb());
  },
  useParams: () => ({}),
});
