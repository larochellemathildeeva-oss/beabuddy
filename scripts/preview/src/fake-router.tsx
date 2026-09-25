// A real href from `to` and `params`, so the checker can see where a link goes.
export function Link({ children, className, to, params, ...rest }: any) {
  const href = typeof to === "string" ? to.replace(/\$(\w+)/g, (_: string, k: string) => params?.[k] ?? k) : undefined;
  const { search: _s, hash: _h, replace: _r, preload: _p, ...attrs } = rest;
  return <a className={className} href={href} {...attrs}>{children}</a>;
}
export const useNavigate = () => () => {}; export const useRouter = () => ({ history: { back() {} } });
