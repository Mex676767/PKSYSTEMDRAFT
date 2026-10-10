import { parseRuntimeConfig } from "./runtime-config-values";

export { parseRuntimeConfig } from "./runtime-config-values";
export type { TenantId } from "./runtime-config-values";
export const runtimeConfig = parseRuntimeConfig(process.env);
