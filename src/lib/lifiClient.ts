/**
 * LiFi client helpers for bridge-to-self (debug) flow.
 * TODO: Confirm LiFi API endpoint names if docs change.
 */
import { getRoutes, getStatus } from "@lifi/sdk";
import type { RoutesRequest, RoutesResponse, StatusResponse } from "@lifi/types";
import { LIFI_ETHEREUM_CHAIN_ID, USDC_BY_CHAIN_ID } from "@/lib/chains";

export interface GetQuoteBridgeToSelfParams {
  fromChainId: number;
  fromAmount: string;
  fromAddress: string;
  toAddress: string;
}

/**
 * Fetch LiFi routes for bridging USDC from source chain to user's Ethereum wallet (USDC).
 * Destination is fixed: Ethereum, USDC, toAddress.
 */
export async function getQuoteBridgeToSelf(
  params: GetQuoteBridgeToSelfParams
): Promise<RoutesResponse> {
  const fromToken = USDC_BY_CHAIN_ID[params.fromChainId];
  const toToken = USDC_BY_CHAIN_ID[LIFI_ETHEREUM_CHAIN_ID];
  if (!fromToken || !toToken) {
    throw new Error("USDC not configured for source or destination chain");
  }
  const request: RoutesRequest = {
    fromChainId: params.fromChainId,
    fromAmount: params.fromAmount,
    fromTokenAddress: fromToken,
    fromAddress: params.fromAddress,
    toChainId: LIFI_ETHEREUM_CHAIN_ID,
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
