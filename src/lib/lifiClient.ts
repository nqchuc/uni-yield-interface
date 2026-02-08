/**
 * LiFi client helpers: bridge-to-self and vault deposit with contract calls.
 *
 * Flow: Bridge USDC to LiFi Executor on Base, then call vault.deposit(assets, receiver).
 * The Executor holds bridged USDC, approves vault, and deposits.
 *
 * Guaranteed amount: deposit assets = LiFi's returned contract call fromAmount (or bridge
 * toAmountMin). Calldata is built from the amount LiFi indicates will be available.
 */
import {
  getContractCallsQuote,
  getRoutes,
  getStatus,
  convertQuoteToRoute,
  PatcherMagicNumber,
} from "@lifi/sdk";
import type {
  ContractCall,
  RoutesRequest,
  RoutesResponse,
  StatusResponse,
} from "@lifi/types";
import type { LiFiStep, Route, Step } from "@lifi/types";
import { encodeFunctionData, type Address } from "viem";
import { USDC_BY_CHAIN_ID } from "@/lib/chains";
import {
  UNIYIELD_VAULT_BASE,
  USDC_BY_CHAIN,
  BASE_CHAIN_ID,
} from "@/config/uniyield";
import uniyieldVaultAbi from "@/abis/uniyieldVaultUI.abi.json";

const VAULT_DEPOSIT_GAS = "200000";

const vaultAbi = uniyieldVaultAbi as readonly unknown[];

/** Encode calldata for vault.deposit(assets, receiver) */
function encodeVaultDepositCalldata(
  assets: bigint,
  receiver: Address
): `0x${string}` {
  return encodeFunctionData({
    abi: vaultAbi,
    functionName: "deposit",
    args: [assets, receiver],
  });
}

/**
 * Extract the guaranteed destination amount from the quote.
 * Prefers bridge step's toAmountMin (slippage-adjusted); falls back to toAmount or top-level estimate.
 */
function extractGuaranteedDepositAmount(quote: LiFiStep): string {
  const steps = quote.includedSteps ?? [];
  const crossStep = steps.find((s: Step) => s.type === "cross") as
    | (Step & { estimate?: { toAmountMin?: string; toAmount?: string } })
    | undefined;
  const customStep = steps.find((s: Step) => s.type === "custom") as
    | (Step & { action?: { fromAmount?: string } })
    | undefined;

  if (crossStep?.estimate?.toAmountMin && BigInt(crossStep.estimate.toAmountMin) > 0n) {
    return crossStep.estimate.toAmountMin;
  }
  if (crossStep?.estimate?.toAmount && BigInt(crossStep.estimate.toAmount) > 0n) {
    return crossStep.estimate.toAmount;
  }
  if (customStep?.action?.fromAmount && BigInt(customStep.action.fromAmount) > 0n) {
    return customStep.action.fromAmount;
  }
  if (quote.estimate?.toAmountMin && BigInt(quote.estimate.toAmountMin) > 0n) {
    return quote.estimate.toAmountMin;
  }
  if (quote.estimate?.toAmount && BigInt(quote.estimate.toAmount) > 0n) {
    return quote.estimate.toAmount;
  }
  throw new Error("Could not extract guaranteed destination amount from LiFi quote");
}

export interface GetQuoteDepositToUniYieldParams {
  fromChainId: number;
  fromAmount: string;
  userAddress: string;
  /** Beneficiary of vault shares (default: userAddress) */
  receiver?: string;
}

/**
 * Get LiFi quote for cross-chain deposit into UniYield vault.
 * Uses getContractCallsQuote. Deposit amount = LiFi's guaranteed destination amount.
 *
 * Flow: Bridge to LiFi Executor, call vault.deposit(assets, receiver).
 * depositAssets is taken from the quote response (bridge toAmountMin), not from user input.
 */
export async function getQuoteDepositToUniYield(
  params: GetQuoteDepositToUniYieldParams
): Promise<{ route: Route; depositAmountOut: string }> {
  if (!UNIYIELD_VAULT_BASE) {
    throw new Error(
      "VITE_UNIYIELD_VAULT_ADDRESS not set. Configure the UniYield vault address on Base."
    );
  }

  const fromToken =
    USDC_BY_CHAIN[params.fromChainId] ?? USDC_BY_CHAIN_ID[params.fromChainId];
  const toToken = USDC_BY_CHAIN[BASE_CHAIN_ID];
  const beneficiary = (params.receiver ?? params.userAddress) as Address;

  if (!fromToken || !toToken) {
    throw new Error("USDC not configured for source or Base chain");
  }

  const initialToAmount = params.fromAmount;
  const initialCalldata = encodeVaultDepositCalldata(
    BigInt(initialToAmount),
    beneficiary
  );
  const initialContractCalls: ContractCall[] = [
    {
      fromAmount: initialToAmount,
      fromTokenAddress: toToken,
      toContractAddress: UNIYIELD_VAULT_BASE,
      toContractCallData: initialCalldata,
      toContractGasLimit: VAULT_DEPOSIT_GAS,
      toApprovalAddress: UNIYIELD_VAULT_BASE,
    },
  ];

  const firstQuote = await getContractCallsQuote({
    fromChain: params.fromChainId,
    toChain: BASE_CHAIN_ID,
    fromToken,
    toToken,
    fromAddress: params.userAddress,
    fromAmount: params.fromAmount,
    contractCalls: initialContractCalls,
    toFallbackAddress: beneficiary,
    denyExchanges: ["all"],
    slippage: 0.003,
  } as Parameters<typeof getContractCallsQuote>[0]);

  const depositAmountOut = extractGuaranteedDepositAmount(firstQuote);

  const depositCalldata = encodeVaultDepositCalldata(
    BigInt(depositAmountOut),
    beneficiary
  );
  const contractCalls: ContractCall[] = [
    {
      fromAmount: depositAmountOut,
      fromTokenAddress: toToken,
      toContractAddress: UNIYIELD_VAULT_BASE,
      toContractCallData: depositCalldata,
      toContractGasLimit: VAULT_DEPOSIT_GAS,
      toApprovalAddress: UNIYIELD_VAULT_BASE,
    },
  ];

  const finalQuote = await getContractCallsQuote({
    fromChain: params.fromChainId,
    toChain: BASE_CHAIN_ID,
    fromToken,
    toToken,
    fromAddress: params.userAddress,
    fromAmount: params.fromAmount,
    contractCalls,
    toFallbackAddress: beneficiary,
    denyExchanges: ["all"],
    slippage: 0.003,
  } as Parameters<typeof getContractCallsQuote>[0]);

  const route = convertQuoteToRoute(finalQuote);
  (route as Route & { depositAmountOut?: string }).depositAmountOut =
    depositAmountOut;

  return {
    route,
    depositAmountOut,
  };
}

/**
 * Creates getContractCalls hook for executeRoute.
 * Uses LiFi patcher: encode vault.deposit(PatcherMagicNumber, receiver), return patcher: true.
 * LiFi replaces PatcherMagicNumber in calldata with the actual amount at execution time.
 * This fixes the Diamond swap revert (fromAmount underflow) when not using the patcher flow.
 */
export function createGetContractCallsForUniYield(): (
  params: import("@lifi/sdk").ContractCallParams
) => Promise<{ contractCalls: ContractCall[]; patcher: boolean }> {
  return async (params) => {
    if (!UNIYIELD_VAULT_BASE) {
      throw new Error(
        "VITE_UNIYIELD_VAULT_ADDRESS not set. Configure the UniYield vault address on Base."
      );
    }

    const toToken = USDC_BY_CHAIN[BASE_CHAIN_ID];
    if (!toToken) {
      throw new Error("USDC not configured for Base");
    }

    const beneficiary = params.fromAddress as Address;
    const depositAssets =
      params.fromAmount > 0n ? params.fromAmount : params.toAmount;
    if (depositAssets <= 0n) {
      throw new Error("No amount available for vault deposit from LiFi quote");
    }

    const depositCalldata = encodeVaultDepositCalldata(
      PatcherMagicNumber,
      beneficiary
    );

    return {
      contractCalls: [
        {
          fromAmount: depositAssets.toString(),
          fromTokenAddress: toToken,
          toContractAddress: UNIYIELD_VAULT_BASE,
          toContractCallData: depositCalldata,
          toContractGasLimit: VAULT_DEPOSIT_GAS,
          toApprovalAddress: UNIYIELD_VAULT_BASE,
        },
      ],
      patcher: true,
    };
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
 */
export async function getLifiStatus(
  params: GetStatusParams
): Promise<StatusResponse> {
  return getStatus({
    txHash: params.txHash,
    bridge: params.bridge,
    fromChain: params.fromChain,
    toChain: params.toChain,
  });
}
