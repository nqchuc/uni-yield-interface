import { useQuery, useQueryClient } from "@tanstack/react-query";
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

export const vaultQueryKeys = {
  all: ["vault"] as const,
  strategies: () => [...vaultQueryKeys.all, "strategies"] as const,
  allocations: () => [...vaultQueryKeys.all, "allocations"] as const,
  summary: () => [...vaultQueryKeys.all, "summary"] as const,
  userBalance: (user: string) =>
    [...vaultQueryKeys.all, "balance", user] as const,
};

export function useVaultStrategies() {
  return useQuery({
    queryKey: vaultQueryKeys.strategies(),
    queryFn: getStrategies,
  });
}

export function useVaultAllocations() {
  return useQuery({
    queryKey: vaultQueryKeys.allocations(),
    queryFn: getAllocations,
  });
}

export function useVaultSummary() {
  return useQuery({
    queryKey: vaultQueryKeys.summary(),
    queryFn: getVaultSummary,
  });
}

export function useUserVaultBalance(userAddress: string | null) {
  return useQuery({
    queryKey: vaultQueryKeys.userBalance(userAddress ?? ""),
    queryFn: () => getUserBalance(userAddress!),
    enabled: !!userAddress,
  });
}

/** Single hook that returns strategies, allocations, and summary for pages that need several. */
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

  const strategies = strategiesQ.data ?? [];
  const allocations = allocationsQ.data ?? [];
  const summary = summaryQ.data ?? null;
  const isLoading =
    strategiesQ.isLoading || allocationsQ.isLoading || summaryQ.isLoading;

  const refetch = () => {
    client.invalidateQueries({ queryKey: vaultQueryKeys.all });
  };

  return { strategies, allocations, summary, isLoading, refetch };
}

/** Estimated shares for a given USDC amount (for deposit preview). */
export function useEstimatedShares(amountStr: string) {
  const assets = parseUsdcAmount(amountStr);
  return useQuery({
    queryKey: [...vaultQueryKeys.all, "convertToShares", amountStr],
    queryFn: () => convertToShares(assets),
    enabled: amountStr !== "" && assets > 0n,
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
