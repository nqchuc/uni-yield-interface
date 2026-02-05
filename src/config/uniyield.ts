/**
 * UniYield protocol config from env.
 * TODO: Set VITE_UNIYIELD_VAULT_ADDRESS and VITE_CHAIN_ID when deploying.
 * Optional: VITE_USDC_ADDRESS (if unset, read from vault.asset() when connected).
 * Optional: VITE_LIFI_API_KEY for future LiFi integration.
 */

export const DEMO_MODE =
  import.meta.env.VITE_DEMO_MODE === "true";

/** TODO: Replace with deployed Diamond address. Fallback for dev/demo. */
export const UNIYIELD_VAULT_ADDRESS: string =
  import.meta.env.VITE_UNIYIELD_VAULT_ADDRESS ??
  "0x0000000000000000000000000000000000000000";

export const DEFAULT_CHAIN_ID: number = Number(
  import.meta.env.VITE_CHAIN_ID ?? "1"
);

/** Optional. If absent, USDC is read from vault.asset() once connected. */
export const USDC_ADDRESS: string | undefined =
  import.meta.env.VITE_USDC_ADDRESS ?? undefined;

/** Optional. TODO: Add when integrating LiFi API. */
export const LIFI_API_KEY: string | undefined =
  import.meta.env.VITE_LIFI_API_KEY ?? undefined;

/** Known strategy ids (bytes32 hex) to display names. Unknown ids shown as truncated hex. */
export const STRATEGY_DISPLAY_NAMES: Record<string, string> = {
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": "Aave",
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb": "Morpho",
  "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc": "Compound",
};

export function getStrategyDisplayName(id: string): string {
  const normalized = id.toLowerCase();
  return STRATEGY_DISPLAY_NAMES[normalized] ?? (id.slice(0, 10) + "…");
}
