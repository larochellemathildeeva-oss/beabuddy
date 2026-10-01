/**
 * Whether this is the built app (what Canner runs), as opposed to unit tests,
 * the import audit or other scripts run straight from the source.
 *
 * Vite replaces `import.meta.env.PROD` with `true` in a production build.
 * Run from source under Node, `import.meta.env` does not exist, so this is
 * false. Used where a fallback that is right for tests and local tools would
 * be wrong in production: a per-process count standing in for the shared one.
 */
export function isDeployedBuild(): boolean {
  try {
    return import.meta.env.PROD === true;
  } catch {
    return false;
  }
}
