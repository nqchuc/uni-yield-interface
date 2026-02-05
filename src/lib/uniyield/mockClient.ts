import type { IUniYieldClient } from "./IUniYieldClient";
import type {
  VaultSnapshot,
  UserPosition,
  StrategyRow,
  PreviewRebalance,
} from "./types";
import { getStrategyDisplayName } from "@/config/uniyield";

const STRATEGY_IDS = {
  AAVE: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  MORPHO: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  COMP: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
} as const;

const USDC_DECIMALS = 6;
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const MOCK_OWNER = "0x0000000000000000000000000000000000000002";

type StrategyInfo = readonly [
  enabled: boolean,
  targetBps: bigint,
  maxBps: bigint,
  currentAssets: bigint,
  rateBps: bigint
];

const state = {
  totalAssets: 1250000_000000n,
  totalSupply: 1240000_000000n,
  activeStrategyId: STRATEGY_IDS.MORPHO,
  balances: new Map<string, bigint>(),
  strategies: new Map<string, StrategyInfo>([
    [STRATEGY_IDS.AAVE, [true, 0n, 10000n, 250000_000000n, 335n]],
    [STRATEGY_IDS.MORPHO, [true, 0n, 10000n, 1000000_000000n, 388n]],
    [STRATEGY_IDS.COMP, [true, 0n, 10000n, 0n, 310n]],
  ]),
};

function formatUnits(value: bigint, decimals = USDC_DECIMALS): string {
  const s = value.toString().padStart(decimals + 1, "0");
  const intPart = s.slice(0, -decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fracPart = s.slice(-decimals);
  return `${intPart}.${fracPart}`;
}

export function createMockClient(): IUniYieldClient {
  return {
    async getVaultSnapshot(): Promise<VaultSnapshot> {
      return {
        name: "UniYield USDC",
        symbol: "uyUSDC",
        decimals: USDC_DECIMALS,
        asset: USDC_ADDRESS,
        totalAssets: state.totalAssets.toString(),
        totalSupply: state.totalSupply.toString(),
        activeStrategyId: state.activeStrategyId,
      };
    },

    async getUserPosition(address: string): Promise<UserPosition> {
      const key = address.toLowerCase();
      const shares = state.balances.get(key) ?? 1000_000000n;
      const assetValue = shares; // 1:1 mock
      return {
        shares: shares.toString(),
        assetValue: assetValue.toString(),
      };
    },

    async getStrategies(): Promise<StrategyRow[]> {
      const ids = [STRATEGY_IDS.AAVE, STRATEGY_IDS.MORPHO, STRATEGY_IDS.COMP];
      return ids.map((id) => {
        const info = state.strategies.get(id) ?? [false, 0n, 0n, 0n, 0n];
        const [enabled, targetBps, maxBps, currentAssets, rateBps] = info;
        return {
          id,
          name: getStrategyDisplayName(id),
          enabled,
          targetBps: Number(targetBps),
          maxBps: Number(maxBps),
          rateBps: Number(rateBps),
          currentAssets: formatUnits(currentAssets),
        };
      });
    },

    async previewDeposit(assets: bigint): Promise<bigint> {
      return assets; // 1:1 mock
    },

    async deposit(
      assets: bigint,
      receiver: string
    ): Promise<{ hash: `0x${string}` }> {
      const key = receiver.toLowerCase();
      const shares = assets;
      const prev = state.balances.get(key) ?? 0n;
      state.balances.set(key, prev + shares);
      state.totalAssets += assets;
      state.totalSupply += shares;
      const hash =
        "0x" +
        Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("");
      return { hash: hash as `0x${string}` };
    },

    async withdraw(
      _assets: bigint,
      _receiver: string,
      owner: string
    ): Promise<{ hash: `0x${string}` }> {
      const key = owner.toLowerCase();
      const shares = state.balances.get(key) ?? 0n;
      state.balances.set(key, 0n);
      state.totalAssets -= _assets;
      state.totalSupply -= shares;
      const hash =
        "0x" +
        Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("");
      return { hash: hash as `0x${string}` };
    },

    async redeem(
      shares: bigint,
      _receiver: string,
      owner: string
    ): Promise<{ hash: `0x${string}` }> {
      const key = owner.toLowerCase();
      const prev = state.balances.get(key) ?? 0n;
      state.balances.set(key, prev - shares);
      state.totalSupply -= shares;
      state.totalAssets -= shares;
      const hash =
        "0x" +
        Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("");
      return { hash: hash as `0x${string}` };
    },

    async previewRebalance(): Promise<PreviewRebalance> {
      return {
        fromStrategy: state.activeStrategyId,
        toStrategy: STRATEGY_IDS.AAVE,
        assetsToMove: (state.strategies.get(state.activeStrategyId)?.[3] ?? 0n).toString(),
      };
    },

    async rebalance(): Promise<{ hash: `0x${string}` }> {
      state.activeStrategyId = STRATEGY_IDS.AAVE;
      const hash =
        "0x" +
        Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("");
      return { hash: hash as `0x${string}` };
    },

    async getOwner(): Promise<string> {
      return MOCK_OWNER;
    },
  };
}
