// Server functions as plain async functions: validate, then run the handler.
type Validator = (input: unknown) => unknown;
export const createServerFn = () => {
  let validate: Validator = (x) => x;
  const b = {
    middleware: () => b,
    inputValidator: (v: Validator) => ((validate = v), b),
    validator: (v: Validator) => ((validate = v), b),
    handler:
      (h: (args: { data: unknown; context: object }) => unknown) =>
      async (args: { data: unknown }) =>
        h({ data: validate(args?.data), context: {} }),
  };
  return b;
};
export const createMiddleware = () => {
  const b: Record<string, () => unknown> = {};
  b["server"] = b["client"] = b["middleware"] = () => b;
  return b;
};
export const useServerFn = <F>(f: F) => f;
export const getRequest = () => null;
export const getRequestHeader = () => null;
