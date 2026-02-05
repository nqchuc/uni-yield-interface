export interface StrategyConfig {
  enabled: boolean;
  targetBps: number;
  maxBps: number;
}

export interface StrategyRow {
  id: string;
  name: string;
  enabled: boolean;
  targetBps: number;
  maxBps: number;
  rateBps?: number;
  currentAssets?: string;
}

export interface VaultSnapshot {
  name: string;
  symbol: string;
  decimals: number;
  asset: string;
  totalAssets: string;
  totalSupply: string;
  activeStrategyId: string;
}

export interface UserPosition {
  shares: string;
  assetValue: string;
}

export interface PreviewRebalance {
  fromStrategy: string;
  toStrategy: string;
  assetsToMove: string;
}
