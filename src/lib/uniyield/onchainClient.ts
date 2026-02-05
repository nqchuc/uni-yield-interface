import type { Address, PublicClient, WalletClient } from "viem";
import { readContract, writeContract } from "viem/actions";
import { formatUnits as viemFormatUnits } from "viem/utils";
import type { IUniYieldClient } from "./IUniYieldClient";
import type {
  VaultSnapshot,
  UserPosition,
  StrategyRow,
  PreviewRebalance,
} from "./types";
import { getStrategyDisplayName } from "@/config/uniyield";
import uniyieldDiamondAbi from "@/abis/uniyieldDiamond.abi.json";
import erc20Abi from "@/abis/erc20.abi.json";

const VAULT_ABI = uniyieldDiamondAbi as readonly unknown[];
const ERC20_ABI = erc20Abi as readonly unknown[];
const USDC_DECIMALS = 6;

/** Format 6-decimal units for display (USDC). */
export function formatUnits(value: bigint, decimals = USDC_DECIMALS): string {
  return viemFormatUnits(value, decimals);
}

export interface OnchainClientParams {
  publicClient: PublicClient;
  walletClient: WalletClient | null;
  vaultAddress: Address;
  chainId: number;
  /** If not set, read from vault.asset() when needed. */
  usdcAddress?: Address;
}

/**
 * TODO: Set vaultAddress and chainId from env (VITE_UNIYIELD_VAULT_ADDRESS, VITE_CHAIN_ID).
 * TODO: Optionally set custom RPC in wagmi transports for production.
 */
export function createOnchainClient(
  params: OnchainClientParams
): IUniYieldClient {
  const {
    publicClient,
    walletClient,
    vaultAddress,
    chainId,
    usdcAddress: usdcAddressParam,
  } = params;

  async function getAssetAddress(): Promise<Address> {
    if (usdcAddressParam) return usdcAddressParam;
    return readContract(publicClient, {
      address: vaultAddress,
      abi: VAULT_ABI as never,
      functionName: "asset",
    }) as Promise<Address>;
  }

  async function readVault<T>(
    functionName: string,
    args: readonly unknown[] = []
  ): Promise<T> {
    return readContract(publicClient, {
      address: vaultAddress,
      abi: VAULT_ABI as never,
      functionName,
      args: args as never[],
    }) as Promise<T>;
  }

  async function writeVault(
    functionName: string,
    args: readonly unknown[]
  ): Promise<{ hash: `0x${string}` }> {
    if (!walletClient?.account) {
      throw new Error("Wallet not connected");
    }
    const hash = await writeContract(walletClient, {
      address: vaultAddress,
      abi: VAULT_ABI as never,
      functionName,
      args: args as never[],
      chainId,
      account: walletClient.account,
    });
    return { hash };
  }

  return {
    async getVaultSnapshot(): Promise<VaultSnapshot> {
      const [asset, decimals, name, symbol, totalAssets, totalSupply, activeStrategyId] =
        await Promise.all([
          readVault<Address>("asset"),
          readVault<number>("decimals").catch(() => USDC_DECIMALS),
          readVault<string>("name").catch(() => "UniYield USDC"),
          readVault<string>("symbol").catch(() => "uyUSDC"),
          readVault<bigint>("totalAssets"),
          readVault<bigint>("totalSupply"),
          readVault<`0x${string}`>("activeStrategyId"),
        ]);
      return {
        name,
        symbol,
        decimals: Number(decimals),
        asset,
        totalAssets: totalAssets.toString(),
        totalSupply: totalSupply.toString(),
        activeStrategyId: activeStrategyId,
      };
    },

    async getUserPosition(address: string): Promise<UserPosition> {
      const shares = await readVault<bigint>("balanceOf", [address as Address]);
      const assetValue = await readVault<bigint>("convertToAssets", [shares]);
      return {
        shares: shares.toString(),
        assetValue: assetValue.toString(),
      };
    },

    async getStrategies(): Promise<StrategyRow[]> {
      const ids = await readVault<readonly `0x${string}`[]>("getStrategyIds");
      const rows: StrategyRow[] = [];
      for (const id of ids) {
        const info = await readVault<
          readonly [boolean, bigint, bigint, bigint, bigint]
        >("getStrategyInfo", [id]);
        const [enabled, targetBps, maxBps, currentAssets, rateBps] = info;
        rows.push({
          id,
          name: getStrategyDisplayName(id),
          enabled,
          targetBps: Number(targetBps),
          maxBps: Number(maxBps),
          rateBps: Number(rateBps),
          currentAssets: formatUnits(currentAssets),
        });
      }
      return rows;
    },

    async previewDeposit(assets: bigint): Promise<bigint> {
      return readVault<bigint>("convertToShares", [assets]);
    },

    async deposit(
      assets: bigint,
      receiver: string
    ): Promise<{ hash: `0x${string}` }> {
      const account = walletClient?.account;
      if (!account) throw new Error("Wallet not connected");
      const assetAddress = await getAssetAddress();
      const allowance = await readContract(publicClient, {
        address: assetAddress,
        abi: ERC20_ABI as never,
        functionName: "allowance",
        args: [account.address, vaultAddress],
      }) as bigint;
      if (allowance < assets) {
        await writeContract(walletClient!, {
          address: assetAddress,
          abi: ERC20_ABI as never,
          functionName: "approve",
          args: [vaultAddress, assets],
          chainId,
          account: account,
        });
      }
      return writeVault("deposit", [assets, receiver as Address]);
    },

    async withdraw(
      assets: bigint,
      receiver: string,
      owner: string
    ): Promise<{ hash: `0x${string}` }> {
      return writeVault("withdraw", [assets, receiver as Address, owner as Address]);
    },

    async redeem(
      shares: bigint,
      receiver: string,
      owner: string
    ): Promise<{ hash: `0x${string}` }> {
      return writeVault("redeem", [shares, receiver as Address, owner as Address]);
    },

    async previewRebalance(): Promise<PreviewRebalance> {
      const [fromStrategy, toStrategy, assetsToMove] = await readVault<
        readonly [`0x${string}`, `0x${string}`, bigint]
      >("previewRebalance");
      return {
        fromStrategy,
        toStrategy,
        assetsToMove: assetsToMove.toString(),
      };
    },

    async rebalance(): Promise<{ hash: `0x${string}` }> {
      return writeVault("rebalance", []);
    },

    async getOwner(): Promise<string> {
      return readVault<Address>("owner");
    },
  };
}
