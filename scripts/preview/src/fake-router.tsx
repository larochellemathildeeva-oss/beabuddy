export function Link({ children, className }: any) { return <a className={className}>{children}</a>; }
export const useNavigate = () => () => {}; export const useRouter = () => ({ history: { back() {} } });
