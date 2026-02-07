/**
 * UniYield protocol config from env.
 * TODO: Set VITE_UNIYIELD_VAULT_ADDRESS and VITE_CHAIN_ID when deploying.
 * Optional: VITE_USDC_ADDRESS (if unset, read from vault.asset() when connected).
 * Optional: VITE_LIFI_API_KEY for future LiFi integration.
 */

export const DEMO_MODE =
  import.meta.env.VITE_DEMO_MODE === "true";

/** UniYield Diamond (ERC-4626 vault) on Base mainnet. */
export const UNIYIELD_VAULT_BASE =
  import.meta.env.VITE_UNIYIELD_VAULT_ADDRESS ??
  "0x95A578Aa0aDDe49cb638745c86C27117AD00067c";

/** @deprecated Use UNIYIELD_VAULT_BASE */
export const UNIYIELD_VAULT_ADDRESS = UNIYIELD_VAULT_BASE;

/** Base mainnet chain ID. */
export const BASE_CHAIN_ID = 8453;

/** Chain the vault is deployed on. */
export const DEFAULT_CHAIN_ID: number = Number(
  import.meta.env.VITE_CHAIN_ID ?? "8453"
);

/** USDC decimals (all chains). */
export const USDC_DECIMALS = 6;

/** USDC token addresses per chain. */
export const USDC_BY_CHAIN: Record<number, string> = {
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  56: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
};

/** Optional. If absent, USDC is read from vault.asset() once connected. */
export const USDC_ADDRESS: string | undefined =
  import.meta.env.VITE_USDC_ADDRESS ?? undefined;

/** Optional. For LiFi API. */
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
