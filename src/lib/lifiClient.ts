/**
 * LiFi client helpers: bridge-to-self and vault deposit with contract calls.
 */
import {
  getQuote,
  getContractCallsQuote,
  getRoutes,
  getStatus,
  convertQuoteToRoute,
} from "@lifi/sdk";
import type { ContractCall, RoutesRequest, RoutesResponse, StatusResponse } from "@lifi/types";
import type { Route } from "@lifi/types";
import { encodeFunctionData } from "viem";
import { USDC_BY_CHAIN_ID } from "@/lib/chains";
import {
  UNIYIELD_VAULT_BASE,
  USDC_BY_CHAIN,
  BASE_CHAIN_ID,
} from "@/config/uniyield";
import erc20Abi from "@/abis/erc20.json";
import uniyieldVaultAbi from "@/abis/uniyieldVaultUI.abi.json";

const ERC20_APPROVE_GAS = "80000";
const VAULT_DEPOSIT_GAS = "200000";

export interface GetQuoteDepositToUniYieldParams {
  fromChainId: number;
  fromAmount: string;
  userAddress: string;
  receiver?: string;
}

/**
 * Get LiFi quote for cross-chain deposit into UniYield vault.
 * Uses contractCalls: USDC.approve(vault, amountOut) + vault.deposit(amountOut, receiver).
 * One user signature - approve is bundled in LiFi execution.
 */
export async function getQuoteDepositToUniYield(
  params: GetQuoteDepositToUniYieldParams
): Promise<{ route: Route; depositAmountOut: string }> {
  const fromToken = USDC_BY_CHAIN[params.fromChainId] ?? USDC_BY_CHAIN_ID[params.fromChainId];
  const toToken = USDC_BY_CHAIN[BASE_CHAIN_ID];
  const receiver = params.receiver ?? params.userAddress;

  if (!fromToken || !toToken) {
    throw new Error("USDC not configured for source or Base chain");
  }

  // Step 1: Get bridge-only quote to estimate toAmount on Base
  const bridgeQuote = await getQuote({
    fromChain: params.fromChainId,
    toChain: BASE_CHAIN_ID,
    fromToken,
    toToken,
    fromAmount: params.fromAmount,
    fromAddress: params.userAddress,
    toAddress: params.userAddress,
  });

  const toAmount = bridgeQuote.estimate?.toAmount ?? bridgeQuote.action?.toAmount;
  if (!toAmount) {
    throw new Error("Could not estimate destination amount");
  }

  // Step 2: Build contract calls (exact approval, no infinite)
  const approveCalldata = encodeFunctionData({
    abi: erc20Abi as never,
    functionName: "approve",
    args: [UNIYIELD_VAULT_BASE as `0x${string}`, BigInt(toAmount)],
  });

  const depositCalldata = encodeFunctionData({
    abi: uniyieldVaultAbi as never,
    functionName: "deposit",
    args: [BigInt(toAmount), receiver as `0x${string}`],
  });

  const contractCalls: ContractCall[] = [
    {
      fromAmount: toAmount,
      fromTokenAddress: toToken,
      toContractAddress: toToken,
      toContractCallData: approveCalldata,
      toContractGasLimit: ERC20_APPROVE_GAS,
    },
    {
      fromAmount: toAmount,
      fromTokenAddress: toToken,
      toContractAddress: UNIYIELD_VAULT_BASE,
      toContractCallData: depositCalldata,
      toContractGasLimit: VAULT_DEPOSIT_GAS,
    },
  ];

  const contractCallQuote = await getContractCallsQuote({
    fromChain: params.fromChainId,
    toChain: BASE_CHAIN_ID,
    fromToken,
    toToken,
    fromAddress: params.userAddress,
    fromAmount: params.fromAmount,
    contractCalls,
    toFallbackAddress: params.userAddress,
    contractOutputsToken: UNIYIELD_VAULT_BASE,
    slippage: 0.003,
  });

  const route = convertQuoteToRoute(contractCallQuote);

  return {
    route,
    depositAmountOut: toAmount,
  };
}

export interface GetQuoteBridgeToSelfParams {
  fromChainId: number;
  toChainId: number;
  fromAmount: string;
  fromAddress: string;
  toAddress: string;
}

/**
 * Fetch LiFi routes for bridging USDC from source chain to destination chain (USDC).
 */
export async function getQuoteBridgeToSelf(
  params: GetQuoteBridgeToSelfParams
): Promise<RoutesResponse> {
  const fromToken = USDC_BY_CHAIN_ID[params.fromChainId];
  const toToken = USDC_BY_CHAIN_ID[params.toChainId];
  if (!fromToken || !toToken) {
    throw new Error("USDC not configured for source or destination chain");
  }
  const request: RoutesRequest = {
    fromChainId: params.fromChainId,
    fromAmount: params.fromAmount,
    fromTokenAddress: fromToken,
    fromAddress: params.fromAddress,
    toChainId: params.toChainId,
    toTokenAddress: toToken,
    toAddress: params.toAddress,
    options: {
      order: "CHEAPEST",
      slippage: 0.03,
      allowSwitchChain: false,
    },
  };
  return getRoutes(request);
}

export interface GetStatusParams {
  txHash: string;
  bridge?: string;
  fromChain?: number | string;
  toChain?: number | string;
}

/**
 * Poll LiFi status for a transfer (e.g. after sending the first step tx).
 * TODO: Use taskId from executeRoute if LiFi returns it for more accurate tracking.
 */
export async function getLifiStatus(params: GetStatusParams): Promise<StatusResponse> {
  return getStatus({
    txHash: params.txHash,
    bridge: params.bridge,
    fromChain: params.fromChain,
    toChain: params.toChain,
  });
}
