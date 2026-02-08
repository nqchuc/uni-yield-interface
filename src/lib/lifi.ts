import { createConfig, EVM } from "@lifi/sdk";
import { getWalletClient, switchChain } from "@wagmi/core";
import { config as wagmiConfig } from "@/lib/wagmi";
import {
  CHAIN_ID_BY_KEY,
  LIFI_ETHEREUM_CHAIN_ID,
  USDC_BY_CHAIN_ID,
} from "@/lib/chains";

const lifiApiKey = import.meta.env.VITE_LIFI_API_KEY;

createConfig({
  integrator: "UniYield",
  ...(lifiApiKey ? { apiKey: lifiApiKey } : {}),
  // Option B: Remove destination swap. Our vault flow bridges USDC->USDC and runs
  // approve+deposit. No swap needed. Without this, LiFi adds a swap step; Executor
  // has 0 balance (Stargate sends to EOA) and swap reverts.
  routeOptions: {
    exchanges: { deny: ["all"] },
  },
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

export { CHAIN_ID_BY_KEY, LIFI_ETHEREUM_CHAIN_ID, USDC_BY_CHAIN_ID };
