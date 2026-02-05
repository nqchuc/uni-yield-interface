import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import type { IUniYieldClient } from "./IUniYieldClient";
import { createMockClient } from "./mockClient";
import { createOnchainClient } from "./onchainClient";
import {
  DEMO_MODE,
  UNIYIELD_VAULT_ADDRESS,
  DEFAULT_CHAIN_ID,
  USDC_ADDRESS,
} from "@/config/uniyield";

const uniyieldQueryKeys = {
  all: ["uniyield"] as const,
  snapshot: (chainId?: number) =>
    [...uniyieldQueryKeys.all, "snapshot", chainId] as const,
  strategies: (chainId?: number) =>
    [...uniyieldQueryKeys.all, "strategies", chainId] as const,
  position: (address: string, chainId?: number) =>
    [...uniyieldQueryKeys.all, "position", address, chainId] as const,
  previewDeposit: (amount: string, chainId?: number) =>
    [...uniyieldQueryKeys.all, "previewDeposit", amount, chainId] as const,
  previewRebalance: (chainId?: number) =>
    [...uniyieldQueryKeys.all, "previewRebalance", chainId] as const,
  owner: (chainId?: number) =>
    [...uniyieldQueryKeys.all, "owner", chainId] as const,
};

const UniYieldContext = createContext<IUniYieldClient | null>(null);

function useClient(): IUniYieldClient {
  const ctx = useContext(UniYieldContext);
  if (!ctx) {
    throw new Error("UniYieldProvider missing. Wrap the app or page with UniYieldProvider.");
  }
  return ctx;
}

export function useUniYield(): IUniYieldClient {
  return useClient();
}

export function useUniYieldVaultSnapshot() {
  const client = useClient();
  const publicClient = usePublicClient();
  const chainId = publicClient?.chain?.id;
  return useQuery({
    queryKey: uniyieldQueryKeys.snapshot(chainId),
    queryFn: () => client.getVaultSnapshot(),
  });
}

export function useUniYieldStrategies() {
  const client = useClient();
  const publicClient = usePublicClient();
  const chainId = publicClient?.chain?.id;
  return useQuery({
    queryKey: uniyieldQueryKeys.strategies(chainId),
    queryFn: () => client.getStrategies(),
  });
}

export function useUniYieldPosition(address: string | undefined) {
  const client = useClient();
  const publicClient = usePublicClient();
  const chainId = publicClient?.chain?.id;
  return useQuery({
    queryKey: uniyieldQueryKeys.position(address ?? "", chainId),
    queryFn: () => client.getUserPosition(address!),
    enabled: !!address,
  });
}

export function useUniYieldPreviewDeposit(amountStr: string) {
  const client = useClient();
  const publicClient = usePublicClient();
  const chainId = publicClient?.chain?.id;
  const assets = parseAmount(amountStr);
  return useQuery({
    queryKey: uniyieldQueryKeys.previewDeposit(amountStr, chainId),
    queryFn: () => client.previewDeposit(assets),
    enabled: amountStr !== "" && assets > 0n,
  });
}

export function useUniYieldPreviewRebalance() {
  const client = useClient();
  const publicClient = usePublicClient();
  const chainId = publicClient?.chain?.id;
  return useQuery({
    queryKey: uniyieldQueryKeys.previewRebalance(chainId),
    queryFn: () => client.previewRebalance(),
  });
}

export function useUniYieldOwner() {
  const client = useClient();
  const publicClient = usePublicClient();
  const chainId = publicClient?.chain?.id;
  return useQuery({
    queryKey: uniyieldQueryKeys.owner(chainId),
    queryFn: () => client.getOwner(),
  });
}

export function useIsUniYieldAdmin(): boolean {
  const { address } = useAccount();
  const { data: owner } = useUniYieldOwner();
  return !!address && !!owner && address.toLowerCase() === owner.toLowerCase();
}

export function useUniYieldInvalidate() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: uniyieldQueryKeys.all });
  }, [queryClient]);
}

function parseAmount(amountStr: string): bigint {
  const num = parseFloat(amountStr);
  if (!Number.isFinite(num) || num < 0) return 0n;
  return BigInt(Math.round(num * 1e6));
}

interface UniYieldProviderProps {
  children: ReactNode;
}

export function UniYieldProvider({ children }: UniYieldProviderProps) {
  const { address, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const client = useMemo(() => {
    const useMock =
      DEMO_MODE || !address || !publicClient || chainId !== DEFAULT_CHAIN_ID;
    if (useMock) {
      return createMockClient();
    }
    return createOnchainClient({
      publicClient,
      walletClient: walletClient ?? null,
      vaultAddress: UNIYIELD_VAULT_ADDRESS as `0x${string}`,
      chainId: DEFAULT_CHAIN_ID,
      usdcAddress: USDC_ADDRESS as `0x${string}` | undefined,
    });
  }, [DEMO_MODE, address, chainId, publicClient, walletClient]);

  return (
    <UniYieldContext.Provider value={client}>
      {children}
    </UniYieldContext.Provider>
  );
}
