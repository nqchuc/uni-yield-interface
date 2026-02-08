import { readContract } from "viem/actions";
import type { PublicClient } from "viem";
import uniyieldVaultAbi from "@/abis/uniyieldVaultUI.abi.json";
import { mockRead, mockWrite } from "@/mocks/uniyieldMock";
import {
  UNIYIELD_VAULT_ADDRESS,
  getStrategyDisplayName,
} from "@/config/uniyield";

export const VAULT_ABI = uniyieldVaultAbi as readonly unknown[];
export { UNIYIELD_VAULT_ADDRESS };

/** When true, use mock data and mockWrite; when false, use chain reads and real write (via useWriteContract in UI). Defaults to true so dev works without a deployed contract. Set VITE_USE_MOCK_VAULT=false for production. */
export function useMockVault(): boolean {
  return import.meta.env.VITE_USE_MOCK_VAULT !== "false";
}

/** Demo user when no wallet connected; used for mock balance and deposit receiver. */
export const DEMO_USER_ADDRESS =
  "0x0000000000000000000000000000000000000001" as const;

const USDC_DECIMALS = 6;

export interface StrategyRow {
  protocol: string;
  apy: string;
  status: "active" | "available";
}

export interface AllocationRow {
  protocol: string;
  percentage: number;
}

export interface VaultSummary {
  totalAssets: bigint;
  currentAPY: string;
  activeProtocolName: string;
}

export interface UserVaultBalance {
  shares: bigint;
  usdcValue: bigint;
}

/** rateBps (basis points) -> "3.88%" */
function formatRateBps(rateBps: bigint): string {
  const rate = Number(rateBps) / 100;
  return `${rate.toFixed(2)}%`;
}

/** Format 6-decimal asset/shares for display (e.g. 1000000000n -> "1,000.000000") */
export function formatVaultUnits(
  value: bigint,
  decimals = USDC_DECIMALS
): string {
  const s = value.toString().padStart(decimals + 1, "0");
  const intPart = s.slice(0, -decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fracPart = s.slice(-decimals);
  return `${intPart}.${fracPart}`;
}

async function readFromChain<T>(
  publicClient: PublicClient,
  functionName: string,
  args: readonly unknown[] = []
): Promise<T> {
  return readContract(publicClient, {
    address: UNIYIELD_VAULT_ADDRESS as `0x${string}`,
    abi: VAULT_ABI as never,
    functionName,
    args: args as never[],
  }) as Promise<T>;
}

export async function getStrategies(
  publicClient?: PublicClient
): Promise<StrategyRow[]> {
  if (useMockVault() || !publicClient) {
    const ids = (await mockRead("getStrategyIds", [])) as string[];
    const activeId = (await mockRead("activeStrategyId", [])) as string;
    const rows: StrategyRow[] = [];
    for (const id of ids) {
      const info = (await mockRead("getStrategyInfo", [id])) as readonly [
        boolean,
        bigint,
        bigint,
        bigint,
        bigint
      ];
      const [enabled, , , , rateBps] = info;
      const protocol = getStrategyDisplayName(id);
      const status = id === activeId ? "active" : "available";
      if (enabled) {
        rows.push({ protocol, apy: formatRateBps(rateBps), status });
      }
    }
    return rows;
  }
  const ids = await readFromChain<`0x${string}`[]>(
    publicClient,
    "getStrategyIds",
    []
  );
  const activeId = await readFromChain<`0x${string}`>(
    publicClient,
    "activeStrategyId",
    []
  );
  const rows: StrategyRow[] = [];
  for (const id of ids) {
    const info = await readFromChain<
      readonly [boolean, bigint, bigint, bigint, bigint]
    >(publicClient, "getStrategyInfo", [id]);
    const [enabled, , , , rateBps] = info;
    const protocol = getStrategyDisplayName(id);
    const status = id === activeId ? "active" : "available";
    if (enabled) {
      rows.push({ protocol, apy: formatRateBps(rateBps), status });
    }
  }
  return rows;
}

export async function getAllocations(
  publicClient?: PublicClient
): Promise<AllocationRow[]> {
  if (useMockVault() || !publicClient) {
    const totalAssets = (await mockRead("totalAssets", [])) as bigint;
    const ids = (await mockRead("getStrategyIds", [])) as string[];
    const rows: AllocationRow[] = [];
    for (const id of ids) {
      const info = (await mockRead("getStrategyInfo", [id])) as readonly [
        boolean,
        bigint,
        bigint,
        bigint,
        bigint
      ];
      const currentAssets = info[3];
      const pct =
        totalAssets > 0n
          ? Number((currentAssets * 10000n) / totalAssets) / 100
          : 0;
      rows.push({
        protocol: getStrategyDisplayName(id),
        percentage: Math.round(pct),
      });
    }
    return rows;
  }
  const totalAssets = await readFromChain<bigint>(
    publicClient,
    "totalAssets",
    []
  );
  const ids = await readFromChain<`0x${string}`[]>(
    publicClient,
    "getStrategyIds",
    []
  );
  const rows: AllocationRow[] = [];
  for (const id of ids) {
    const info = await readFromChain<
      readonly [boolean, bigint, bigint, bigint, bigint]
    >(publicClient, "getStrategyInfo", [id]);
    const currentAssets = info[3];
    const pct =
      totalAssets > 0n
        ? Number((currentAssets * 10000n) / totalAssets) / 100
        : 0;
    rows.push({
      protocol: getStrategyDisplayName(id),
      percentage: Math.round(pct),
    });
  }
  return rows;
}

export async function getVaultSummary(
  publicClient?: PublicClient
): Promise<VaultSummary> {
  if (useMockVault() || !publicClient) {
    const [totalAssets, activeId] = await Promise.all([
      mockRead("totalAssets", []) as Promise<bigint>,
      mockRead("activeStrategyId", []) as Promise<string>,
    ]);
    const info = (await mockRead("getStrategyInfo", [activeId])) as readonly [
      boolean,
      bigint,
      bigint,
      bigint,
      bigint
    ];
    const rateBps = info[4];
    return {
      totalAssets,
      currentAPY: formatRateBps(rateBps),
      activeProtocolName: getStrategyDisplayName(activeId),
    };
  }
  const [totalAssets, activeId] = await Promise.all([
    readFromChain<bigint>(publicClient, "totalAssets", []),
    readFromChain<`0x${string}`>(publicClient, "activeStrategyId", []),
  ]);
  const info = await readFromChain<
    readonly [boolean, bigint, bigint, bigint, bigint]
  >(publicClient, "getStrategyInfo", [activeId]);
  const rateBps = info[4];
  return {
    totalAssets,
    currentAPY: formatRateBps(rateBps),
    activeProtocolName: getStrategyDisplayName(activeId),
  };
}

export async function convertToShares(
  assets: bigint,
  publicClient?: PublicClient
): Promise<bigint> {
  if (useMockVault() || !publicClient) {
    return mockRead("convertToShares", [assets]) as Promise<bigint>;
  }
  return readFromChain<bigint>(publicClient, "convertToShares", [assets]);
}

export async function convertToAssets(
  shares: bigint,
  publicClient?: PublicClient
): Promise<bigint> {
  if (useMockVault() || !publicClient) {
    return mockRead("convertToAssets", [shares]) as Promise<bigint>;
  }
  return readFromChain<bigint>(publicClient, "convertToAssets", [shares]);
}

export async function getUserBalance(
  user: string,
  publicClient?: PublicClient
): Promise<UserVaultBalance> {
  if (useMockVault() || !publicClient) {
    const shares = (await mockRead("balanceOf", [user])) as bigint;
    const usdcValue = (await mockRead("convertToAssets", [shares])) as bigint;
    return { shares, usdcValue };
  }
  const shares = await readFromChain<bigint>(publicClient, "balanceOf", [
    user as `0x${string}`,
  ]);
  const usdcValue = await readFromChain<bigint>(
    publicClient,
    "convertToAssets",
    [shares]
  );
  return { shares, usdcValue };
}

export type DepositParams = {
  assets: bigint;
  receiver: string;
};

/** Mock-only: updates in-memory state. For real chain use useWriteContract in the UI. */
export async function deposit(
  params: DepositParams
): Promise<{ hash: `0x${string}` }> {
  if (!useMockVault()) {
    throw new Error(
      "Real contract deposit must be done via useWriteContract in the UI."
    );
  }
  return mockWrite("deposit", [params.assets, params.receiver]) as Promise<{
    hash: `0x${string}`;
  }>;
}

/** Parse USDC amount string (e.g. "1000.50") to 6-decimal bigint. */
export function parseUsdcAmount(amountStr: string): bigint {
  const num = parseFloat(amountStr);
  if (!Number.isFinite(num) || num < 0) return 0n;
  return BigInt(Math.round(num * 10 ** USDC_DECIMALS));
}
