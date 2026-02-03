import uniyieldVaultAbi from "@/abis/uniyieldVaultUI.abi.json";
import {
  mockRead,
  mockWrite,
  STRATEGY_IDS,
  STRATEGY_NAMES,
  UNIYIELD_VAULT_ADDRESS,
} from "@/mocks/uniyieldMock";

export const VAULT_ABI = uniyieldVaultAbi as readonly unknown[];
export { UNIYIELD_VAULT_ADDRESS };

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

export async function getStrategies(): Promise<StrategyRow[]> {
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
    const protocol = STRATEGY_NAMES[id] ?? id.slice(0, 8);
    const status = id === activeId ? "active" : "available";
    if (enabled) {
      rows.push({ protocol, apy: formatRateBps(rateBps), status });
    }
  }
  return rows;
}

export async function getAllocations(): Promise<AllocationRow[]> {
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
      protocol: STRATEGY_NAMES[id] ?? id.slice(0, 8),
      percentage: Math.round(pct),
    });
  }
  return rows;
}

export async function getVaultSummary(): Promise<VaultSummary> {
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
    activeProtocolName: STRATEGY_NAMES[activeId] ?? "—",
  };
}

export async function convertToShares(assets: bigint): Promise<bigint> {
  return mockRead("convertToShares", [assets]) as Promise<bigint>;
}

export async function convertToAssets(shares: bigint): Promise<bigint> {
  return mockRead("convertToAssets", [shares]) as Promise<bigint>;
}

export async function getUserBalance(user: string): Promise<UserVaultBalance> {
  const shares = (await mockRead("balanceOf", [user])) as bigint;
  const usdcValue = (await mockRead("convertToAssets", [shares])) as bigint;
  return { shares, usdcValue };
}

export type DepositParams = {
  assets: bigint;
  receiver: string;
};

export async function deposit(
  params: DepositParams
): Promise<{ hash: `0x${string}` }> {
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
