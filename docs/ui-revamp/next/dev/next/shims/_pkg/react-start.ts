// Preview-only stand-in for @tanstack/react-start in the browser bundle: a
// server function answers null (the screens then show their offline/empty state).
type Chain = { [k: string]: (...a: unknown[]) => Chain } & ((
  ...a: unknown[]
) => Promise<null>);
const chain = (): Chain =>
  new Proxy((async () => null) as unknown as Chain, {
    get: (_t, k) => (k === "then" ? undefined : () => chain()),
  });
export const createServerFn = chain;
export const createIsomorphicFn = chain;
export const createServerOnlyFn = chain;
export const createClientOnlyFn = chain;
export const createMiddleware = chain;
export const useServerFn = <T>(fn: T) => fn;
