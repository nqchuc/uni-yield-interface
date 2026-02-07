import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { usePublicClient } from "wagmi";
import {
  getStrategies,
  getAllocations,
  getVaultSummary,
  getUserBalance,
  convertToShares,
  formatVaultUnits,
  parseUsdcAmount,
  DEMO_USER_ADDRESS,
  type StrategyRow,
  type AllocationRow,
  type VaultSummary,
} from "@/lib/vault";
import { useDefiLlamaYields, defiLlamaQueryKeys } from "./useDefiLlamaYields";

export const vaultQueryKeys = {
  all: ["vault"] as const,
  strategies: (chainId?: number) =>
    [...vaultQueryKeys.all, "strategies", chainId] as const,
  allocations: (chainId?: number) =>
    [...vaultQueryKeys.all, "allocations", chainId] as const,
  summary: (chainId?: number) =>
    [...vaultQueryKeys.all, "summary", chainId] as const,
  userBalance: (user: string, chainId?: number) =>
    [...vaultQueryKeys.all, "balance", user, chainId] as const,
  convertToShares: (amountStr: string, chainId?: number) =>
    [...vaultQueryKeys.all, "convertToShares", amountStr, chainId] as const,
  convertToSharesFromWei: (assetsWei: string, chainId?: number) =>
    [...vaultQueryKeys.all, "convertToSharesFromWei", assetsWei, chainId] as const,
};

export function useVaultStrategies() {
  const publicClient = usePublicClient();
  const chainId = publicClient?.chain?.id;
  return useQuery({
    queryKey: vaultQueryKeys.strategies(chainId),
    queryFn: () => getStrategies(publicClient ?? undefined),
  });
}

export function useVaultAllocations() {
  const publicClient = usePublicClient();
  const chainId = publicClient?.chain?.id;
  return useQuery({
    queryKey: vaultQueryKeys.allocations(chainId),
    queryFn: () => getAllocations(publicClient ?? undefined),
  });
}

export function useVaultSummary() {
  const publicClient = usePublicClient();
  const chainId = publicClient?.chain?.id;
  return useQuery({
    queryKey: vaultQueryKeys.summary(chainId),
    queryFn: () => getVaultSummary(publicClient ?? undefined),
  });
}

export function useUserVaultBalance(userAddress: string | null) {
  const publicClient = usePublicClient();
  const chainId = publicClient?.chain?.id;
  return useQuery({
    queryKey: vaultQueryKeys.userBalance(userAddress ?? "", chainId),
    queryFn: () => getUserBalance(userAddress!, publicClient ?? undefined),
    enabled: !!userAddress,
  });
}

/** Single hook that returns strategies, allocations, and summary for pages that need several.
 * Merges DefiLlama real-time USDC yields (Aave V3, Morpho, Compound V3 on Ethereum) when available. */
export function useVaultData(): {
  strategies: StrategyRow[];
  allocations: AllocationRow[];
  summary: VaultSummary | null;
  isLoading: boolean;
  refetch: () => void;
} {
  const client = useQueryClient();
  const strategiesQ = useVaultStrategies();
  const allocationsQ = useVaultAllocations();
  const summaryQ = useVaultSummary();
  const { data: defiLlamaYields } = useDefiLlamaYields();

  const strategies = useMemo(() => {
    const base = strategiesQ.data ?? [];
    const yields = defiLlamaYields ?? {};
    if (Object.keys(yields).length === 0) return base;
    return base.map((s) => ({
      ...s,
      apy: yields[s.protocol] ?? s.apy,
    }));
  }, [strategiesQ.data, defiLlamaYields]);

  const allocations = allocationsQ.data ?? [];
  const summary = useMemo(() => {
    const base = summaryQ.data ?? null;
    if (!base || !defiLlamaYields) return base;
    const activeApy = defiLlamaYields[base.activeProtocolName];
    if (!activeApy) return base;
    return { ...base, currentAPY: activeApy };
  }, [summaryQ.data, defiLlamaYields]);
  const isLoading =
    strategiesQ.isLoading || allocationsQ.isLoading || summaryQ.isLoading;

  const refetch = () => {
    client.invalidateQueries({ queryKey: vaultQueryKeys.all });
    client.invalidateQueries({ queryKey: defiLlamaQueryKeys.all });
  };

  return { strategies, allocations, summary, isLoading, refetch };
}

/** Estimated shares for a given USDC amount (for deposit preview). */
export function useEstimatedShares(amountStr: string) {
  const publicClient = usePublicClient();
  const chainId = publicClient?.chain?.id;
  const assets = parseUsdcAmount(amountStr);
  return useQuery({
    queryKey: vaultQueryKeys.convertToShares(amountStr, chainId),
    queryFn: () => convertToShares(assets, publicClient ?? undefined),
    enabled: amountStr !== "" && assets > 0n,
  });
}

/** Convert USDC amount (wei string) to vault shares. Uses Base chain for vault read. */
export function useConvertToSharesFromWei(assetsWei: string | undefined) {
  const publicClient = usePublicClient({ chainId: 8453 });
  const assets = assetsWei ? BigInt(assetsWei) : 0n;
  return useQuery({
    queryKey: vaultQueryKeys.convertToSharesFromWei(assetsWei ?? "", 8453),
    queryFn: () => convertToShares(assets, publicClient ?? undefined),
    enabled: !!assetsWei && assets > 0n && !!publicClient,
  });
}

/** Portfolio metrics from vault mock. Uses demo user when no wallet. */
export function usePortfolioVaultMetrics(userAddress: string | null) {
  const address = userAddress ?? DEMO_USER_ADDRESS;
  const balanceQ = useUserVaultBalance(address);
  const summaryQ = useVaultSummary();

  const shares = balanceQ.data?.shares ?? 0n;
  const usdcValue = balanceQ.data?.usdcValue ?? 0n;
  const sharesFormatted = formatVaultUnits(shares);
  const usdcFormatted = formatVaultUnits(usdcValue);
  const currentAPY = summaryQ.data?.currentAPY ?? "—";
  const activeProtocol = summaryQ.data?.activeProtocolName ?? "—";

  return {
    sharesFormatted,
    usdcFormatted,
    currentAPY,
    activeProtocol,
    isLoading: balanceQ.isLoading || summaryQ.isLoading,
    refetch: async () => {
      await Promise.all([balanceQ.refetch(), summaryQ.refetch()]);
    },
  };
}
