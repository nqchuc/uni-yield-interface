import { createConfig, http } from "wagmi";
import { arbitrum, base, bsc, mainnet, optimism, polygon } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const vaultChains = [mainnet, base, arbitrum, polygon, bsc, optimism] as const;

export const config = createConfig({
  chains: [...vaultChains],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
    [optimism.id]: http(),
  },
});

/** Chain the vault contract is deployed on (Base mainnet). */
export const VAULT_CHAIN_ID = base.id;
