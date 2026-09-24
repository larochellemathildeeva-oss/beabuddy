export const useServerFn = <F,>(f: F) => f;
export const createServerFn = () => { const b: any = { middleware: () => b, inputValidator: () => b, validator: () => b, handler: () => async () => ({}) }; return b; };
export const createMiddleware = () => { const b: any = { server: () => b, client: () => b, middleware: () => b }; return b; };
export const getRequest = () => null; export const getRequestHeader = () => null;
