// src/mocks/uniyieldMock.ts
export const UNIYIELD_VAULT_ADDRESS =
  "0x1111111111111111111111111111111111111111" as const;

export const USDC_ADDRESS =
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;

// bytes32 ids
export const STRATEGY_IDS = {
  AAVE: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  MORPHO: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  COMP: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
} as const;

export const STRATEGY_NAMES: Record<string, string> = {
  [STRATEGY_IDS.AAVE]: "Aave",
  [STRATEGY_IDS.MORPHO]: "Morpho",
  [STRATEGY_IDS.COMP]: "Compound",
};

type StrategyInfo = readonly [
  enabled: boolean,
  targetBps: bigint,
  maxBps: bigint,
  currentAssets: bigint,
  rateBps: bigint
];

const state = {
  asset: USDC_ADDRESS,
  totalAssets: 1250000_000000n,
  totalSupply: 1240000_000000n,
  activeStrategyId: STRATEGY_IDS.MORPHO as `0x${string}`,
  minSwitchBps: 30n,

  // user balances (shares)
  balances: new Map<string, bigint>([
    ["0x0000000000000000000000000000000000000000", 0n],
  ]),

  strategies: new Map<string, StrategyInfo>([
    [STRATEGY_IDS.AAVE, [true, 0n, 10000n, 250000_000000n, 335n]],
    [STRATEGY_IDS.MORPHO, [true, 0n, 10000n, 1000000_000000n, 388n]],
    [STRATEGY_IDS.COMP, [true, 0n, 10000n, 0n, 310n]],
  ]),
};

export function setMockUserBalance(user: string, shares: bigint) {
  state.balances.set(user.toLowerCase(), shares);
}

export async function mockRead(functionName: string, args: any[] = []) {
  switch (functionName) {
    case "asset":
      return state.asset;

    case "totalAssets":
      return state.totalAssets;

    case "totalSupply":
      return state.totalSupply;

    case "balanceOf": {
      const user = String(args[0] ?? "").toLowerCase();
      return state.balances.get(user) ?? 1000_000000n; // default
    }

    case "activeStrategyId":
      return state.activeStrategyId;

    case "minSwitchBps":
      return state.minSwitchBps;

    case "getStrategyIds":
      return [STRATEGY_IDS.AAVE, STRATEGY_IDS.MORPHO, STRATEGY_IDS.COMP];

    case "getStrategyInfo": {
      const id = String(args[0]);
      return state.strategies.get(id) ?? [false, 0n, 0n, 0n, 0n];
    }

    // For early UI, keep conversions ~1:1
    case "convertToShares": {
      const assets = BigInt(args[0] ?? 0);
      return assets; // 1 share = 1 USDC (mock)
    }
    case "convertToAssets": {
      const shares = BigInt(args[0] ?? 0);
      return shares; // 1 share = 1 USDC (mock)
    }

    case "previewRebalance": {
      // Pretend Aave becomes best later
      const fromId = state.activeStrategyId;
      const toId = STRATEGY_IDS.AAVE;
      const assetsToMove = state.strategies.get(fromId)?.[3] ?? 0n;
      return [fromId, toId, assetsToMove] as const;
    }

    default:
      throw new Error(`mockRead: unsupported function ${functionName}`);
  }
}

export async function mockWrite(functionName: string, args: any[] = []) {
  // Return fake tx hash-like string
  const fakeHash =
    "0x" +
    Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");

  if (functionName === "rebalance") {
    // Simulate switch to Aave
    state.activeStrategyId = STRATEGY_IDS.AAVE as any;
  }

  if (functionName === "deposit" || functionName === "depositReceived") {
    // Very simple “mint shares equal to assets received”
    const receiver = functionName === "deposit" ? args[1] : args[0];
    const assets =
      functionName === "deposit" ? BigInt(args[0] ?? 0) : 100_000000n; // mock cross-chain received amount = 100 USDC

    const shares = assets;
    const key = String(receiver).toLowerCase();
    const prev = state.balances.get(key) ?? 0n;
    state.balances.set(key, prev + shares);

    state.totalAssets += assets;
    state.totalSupply += shares;
  }

  return { hash: fakeHash as `0x${string}` };
}
