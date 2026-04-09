/** Normalize Express 5 route params (`string | string[]`) to a single string. */
export function routeParamString(
  value: string | string[] | undefined
): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].length > 0) {
    return value[0];
  }
  return undefined;
}
