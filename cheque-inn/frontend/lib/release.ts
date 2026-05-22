import pkg from "../package.json";

/** Coordinated web release (see repo release.json). */
export const RELEASE = {
  productName: "Cheque-Inn",
  phase: "V2",
  version: typeof pkg.version === "string" ? pkg.version : "2.0.0",
} as const;

/** User-visible version label, e.g. v2.0.0 */
export function versionLabel(version: string = RELEASE.version): string {
  return `v${version}`;
}

export const VERSION_LABEL = versionLabel();
