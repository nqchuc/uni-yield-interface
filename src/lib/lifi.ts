import { createConfig, EVM } from "@lifi/sdk";
import { getWalletClient, switchChain } from "@wagmi/core";
import { config as wagmiConfig } from "@/lib/wagmi";

createConfig({
  integrator: "UniYield",
  providers: [
    EVM({
      getWalletClient: () => getWalletClient(wagmiConfig),
      switchChain: async (chainId) => {
        const chain = await switchChain(wagmiConfig, { chainId });
        return getWalletClient(wagmiConfig, { chainId: chain?.id ?? chainId });
      },
    }),
  ],
});

/** Chain id by our UI chain key (ChainSelector). */
export const CHAIN_ID_BY_KEY: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  polygon: 137,
  bnb: 56,
};

/** USDC token address per chain (native USDC where available). */
export const USDC_BY_CHAIN_ID: Record<number, string> = {
  1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  56: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
};

export const LIFI_ETHEREUM_CHAIN_ID = 1;
