import { readFileSync } from "fs";
import { join } from "path";

function readPackageVersion(): string {
  try {
    const raw = readFileSync(join(__dirname, "../../package.json"), "utf8");
    const pkg = JSON.parse(raw) as { version?: string };
    return typeof pkg.version === "string" ? pkg.version : "2.0.0";
  } catch {
    return "2.0.0";
  }
}

/** Coordinated Cheque-Inn V2 API release metadata (see repo release.json). */
export const RELEASE = {
  productName: "Cheque-Inn",
  phase: "V2",
  version: readPackageVersion(),
  apiVersion: readPackageVersion(),
} as const;

export function releaseInfoPayload(): {
  product: string;
  phase: string;
  version: string;
  apiVersion: string;
} {
  return {
    product: RELEASE.productName,
    phase: RELEASE.phase,
    version: RELEASE.version,
    apiVersion: RELEASE.apiVersion,
  };
}
