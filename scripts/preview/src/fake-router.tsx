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
