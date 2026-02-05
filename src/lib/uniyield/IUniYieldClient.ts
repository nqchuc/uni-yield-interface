import type {
  VaultSnapshot,
  UserPosition,
  StrategyRow,
  PreviewRebalance,
} from "./types";

export interface IUniYieldClient {
  getVaultSnapshot(): Promise<VaultSnapshot>;
  getUserPosition(address: string): Promise<UserPosition>;
  getStrategies(): Promise<StrategyRow[]>;
  previewDeposit(assets: bigint): Promise<bigint>;
  deposit(assets: bigint, receiver: string): Promise<{ hash: `0x${string}` }>;
  withdraw(
    assets: bigint,
    receiver: string,
    owner: string
  ): Promise<{ hash: `0x${string}` }>;
  redeem(
    shares: bigint,
    receiver: string,
    owner: string
  ): Promise<{ hash: `0x${string}` }>;
  previewRebalance(): Promise<PreviewRebalance>;
  rebalance(): Promise<{ hash: `0x${string}` }>;
  getOwner(): Promise<string>;
}
