/**
 * Supported chain IDs and token addresses for the dApp.
 * Used by LiFi integration and chain selector.
 */

export const LIFI_ETHEREUM_CHAIN_ID = 1;

/** Chain id by our UI chain key (ChainSelector). */
export const CHAIN_ID_BY_KEY: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  polygon: 137,
  bnb: 56,
  optimism: 10,
};

/** Chain name by chain ID for display (LiFi routes, etc.). */
export const CHAIN_NAME_BY_ID: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
  137: "Polygon",
  56: "BNB Chain",
  10: "Optimism",
};

export function getChainDisplayName(chainId: number): string {
  return CHAIN_NAME_BY_ID[chainId] ?? `Chain ${chainId}`;
}

/** USDC token address per chain (native USDC where available). */
export const USDC_BY_CHAIN_ID: Record<number, string> = {
  1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  56: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
};

/** Block explorer base URL for tx links by chain ID. */
export const EXPLORER_TX_BY_CHAIN: Record<number, string> = {
  1: "https://etherscan.io/tx/",
  8453: "https://basescan.org/tx/",
  42161: "https://arbiscan.io/tx/",
  137: "https://polygonscan.com/tx/",
  56: "https://bscscan.com/tx/",
  10: "https://optimistic.etherscan.io/tx/",
};

export function getExplorerTxLink(chainId: number, txHash: string): string {
  return (EXPLORER_TX_BY_CHAIN[chainId] ?? "https://etherscan.io/tx/") + txHash;
}

/** List of chain IDs we support (Base, Arbitrum, Polygon, BNB, Ethereum, Optimism). */
export const SUPPORTED_CHAIN_IDS = Object.values(CHAIN_ID_BY_KEY);
