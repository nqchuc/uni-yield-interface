import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";
import { toast } from "sonner";
import {
  convertQuoteToRoute,
  executeRoute,
  getQuote,
  type RouteExtended,
} from "@lifi/sdk";
import type { Route } from "@lifi/types";
import { ChainSelector } from "@/components/ChainSelector";
import { DestinationChainSelector } from "@/components/DestinationChainSelector";
import { RouteList } from "@/components/RouteList";
import { StrategyTable } from "@/components/StrategyTable";
import { TransactionProgress } from "@/components/TransactionProgress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useVaultData,
  useEstimatedShares,
  vaultQueryKeys,
} from "@/hooks/useVaultData";
import {
  CHAIN_ID_BY_KEY,
  LIFI_ETHEREUM_CHAIN_ID,
  USDC_BY_CHAIN_ID,
} from "@/lib/lifi";
import { getQuoteBridgeToSelf, getLifiStatus } from "@/lib/lifiClient";
import { VAULT_CHAIN_ID } from "@/lib/wagmi";
import {
  deposit,
  formatVaultUnits,
  DEMO_USER_ADDRESS,
  useMockVault,
  VAULT_ABI,
  UNIYIELD_VAULT_ADDRESS,
} from "@/lib/vault";
import { UNIYIELD_VAULT_ADDRESS as CONFIG_VAULT_ADDRESS } from "@/config/uniyield";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type StepStatus = "pending" | "loading" | "complete";

interface TransactionStep {
  id: string;
  label: string;
  status: StepStatus;
}

const initialSteps: TransactionStep[] = [
  { id: "wallet", label: "Wallet confirmation", status: "pending" },
  { id: "routing", label: "Cross-chain routing", status: "pending" },
  { id: "settlement", label: "Ethereum settlement", status: "pending" },
  { id: "deposit", label: "Vault deposit", status: "pending" },
  { id: "mint", label: "Shares minted", status: "pending" },
];

const bridgeDebugSteps: TransactionStep[] = [
  { id: "approve", label: "Approve USDC (if needed)", status: "pending" },
  { id: "send", label: "Send bridge transaction", status: "pending" },
  { id: "done", label: "Complete", status: "pending" },
];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const vaultNotDeployed =
  !CONFIG_VAULT_ADDRESS ||
  CONFIG_VAULT_ADDRESS.toLowerCase() === ZERO_ADDRESS;

export default function VaultPage() {
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const { strategies, summary, isLoading: vaultLoading } = useVaultData();
  const [chain, setChain] = useState("ethereum");
  const receiver = address ?? DEMO_USER_ADDRESS;
  const [amount, setAmount] = useState("");
  const [showProgress, setShowProgress] = useState(false);
  const [steps, setSteps] = useState(initialSteps);
  const [isComplete, setIsComplete] = useState(false);
  const [sharesReceived, setSharesReceived] = useState("0 uyUSDC");
  const isMock = useMockVault();
  const { chainId } = useAccount();
  const { switchChain, switchChainAsync, isPending: isSwitchPending } = useSwitchChain();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const [isLifiPending, setIsLifiPending] = useState(false);

  const [destinationChain, setDestinationChain] = useState("ethereum");
  const [destinationMode, setDestinationMode] = useState<"uniyield" | "bridgeToSelf">(
    vaultNotDeployed ? "bridgeToSelf" : "uniyield"
  );
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [bridgeSteps, setBridgeSteps] = useState(bridgeDebugSteps);
  const [showBridgeProgress, setShowBridgeProgress] = useState(false);
  const [bridgeComplete, setBridgeComplete] = useState(false);
  const [bridgeTxHash, setBridgeTxHash] = useState<string | null>(null);
  const [bridgeReceivedAmount, setBridgeReceivedAmount] = useState<string>("");
  const [bridgeStatusPolling, setBridgeStatusPolling] = useState(false);
  const [selectedStrategyProtocol, setSelectedStrategyProtocol] = useState<string | null>(null);

  // Default to active strategy when strategies load
  useEffect(() => {
    if (strategies.length > 0 && selectedStrategyProtocol == null) {
      const active = strategies.find((s) => s.status === "active");
      setSelectedStrategyProtocol(active?.protocol ?? strategies[0].protocol);
    }
  }, [strategies, selectedStrategyProtocol]);

  const isSameChainDeposit = chain === "ethereum";
  const isWrongChain =
    !isMock &&
    isSameChainDeposit &&
    address != null &&
    chainId != null &&
    chainId !== VAULT_CHAIN_ID;

  const estimatedSharesQ = useEstimatedShares(amount);
  const estimatedSharesFormatted =
    estimatedSharesQ.data != null
      ? formatVaultUnits(estimatedSharesQ.data)
      : "0.000000";
  const selectedStrategy = strategies.find((s) => s.protocol === selectedStrategyProtocol);
  const currentAPY =
    selectedStrategy?.apy ?? summary?.currentAPY ?? "—";
  const estimatedFees = amount
    ? `$${(parseFloat(amount) * 0.0013).toFixed(2)}`
    : "$0.00";
  const executionTime = chain === "ethereum" ? "~30 seconds" : "~2 minutes";

  const handleChainChange = (newChain: string) => {
    const targetChainId = CHAIN_ID_BY_KEY[newChain];
    const previousChain = chain;

    setChain(newChain);

    if (address) {
      switchChainAsync({ chainId: targetChainId }).catch(() => {
        setChain(previousChain);
        toast.error("Failed to switch network");
      });
    }
  };

  const fetchRoutesForBridge = useCallback(async () => {
    if (!address || !amount || parseFloat(amount) <= 0) return;
    const fromChainId = CHAIN_ID_BY_KEY[chain];
    const fromAmount = BigInt(Math.round(parseFloat(amount) * 1e6)).toString();
    setRoutesLoading(true);
    setRoutes([]);
    try {
      const res = await getQuoteBridgeToSelf({
        fromChainId,
        fromAmount,
        fromAddress: address,
        toAddress: address,
      });
      const top3 = (res.routes ?? []).slice(0, 3);
      setRoutes(top3);
      setSelectedRouteIndex(0);
      if (top3.length === 0) toast.error("No routes found");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch routes";
      toast.error(msg);
    } finally {
      setRoutesLoading(false);
    }
  }, [address, amount, chain]);

  const handleExecuteBridge = useCallback(async () => {
    const route = routes[selectedRouteIndex];
    if (!route || !address) return;
    setShowBridgeProgress(true);
    setBridgeComplete(false);
    setBridgeTxHash(null);
    setBridgeReceivedAmount("");
    setBridgeSteps(bridgeDebugSteps.map((s) => ({ ...s, status: "pending" as const })));
    setIsLifiPending(true);
    try {
      const executed = await executeRoute(route, {
        updateRouteHook(updatedRoute: RouteExtended) {
          const stepsWithExecution = updatedRoute.steps.filter((s) => s.execution != null);
          const doneCount = stepsWithExecution.filter((s) => s.execution?.status === "DONE").length;
          const anyLoading = stepsWithExecution.some(
            (s) =>
              s.execution?.status === "PENDING" || s.execution?.status === "ACTION_REQUIRED"
          );
          setBridgeSteps((prev) => {
            const next = [...prev];
            if (doneCount >= 1 && next[0].status !== "complete")
              next[0] = { ...next[0], status: "complete" };
            if (anyLoading && next[1].status !== "loading")
              next[1] = { ...next[1], status: "loading" };
            if (doneCount >= 1 && !anyLoading) {
              next[1] = { ...next[1], status: "complete" };
              next[2] = { ...next[2], status: "loading" };
            }
            const allDone = stepsWithExecution.every((s) => s.execution?.status === "DONE");
            if (allDone) {
              next[2] = { ...next[2], status: "complete" };
            }
            return next;
          });
        },
      });
      const lastStep = executed.steps[executed.steps.length - 1];
      const toAmount = lastStep?.estimate?.toAmount ?? route.toAmount;
      setBridgeReceivedAmount(toAmount);
      setBridgeComplete(true);
      const firstStepExecution = executed.steps[0]?.execution;
      const firstProcessWithTx = firstStepExecution?.process?.find((p: { txHash?: string }) => p.txHash);
      const txHash = firstProcessWithTx?.txHash ?? (firstStepExecution as { txHash?: string } | undefined)?.txHash;
      if (txHash) setBridgeTxHash(txHash);
      setBridgeStatusPolling(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bridge failed";
      toast.error(msg);
      setShowBridgeProgress(false);
    } finally {
      setIsLifiPending(false);
    }
  }, [routes, selectedRouteIndex, address]);

  const handleDeposit = () => {
    if (destinationMode === "bridgeToSelf") return;
    const assets = BigInt(Math.round(parseFloat(amount) * 1e6));
    if (!amount || assets <= 0n) return;
    setShowProgress(true);
    setSteps(initialSteps);
    setIsComplete(false);
    setSharesReceived("0 uyUSDC");

    if (isMock) {
      const stepTimings = [500, 1500, 2500, 3500, 4500];
      stepTimings.forEach((timing, index) => {
        setTimeout(() => {
          setSteps((prev) =>
            prev.map((step, i) => {
              if (i < index) return { ...step, status: "complete" as const };
              if (i === index) return { ...step, status: "loading" as const };
              return step;
            })
          );
        }, timing);
      });
      setTimeout(async () => {
        setSteps((prev) =>
          prev.map((step) => ({ ...step, status: "complete" as const }))
        );
        try {
          await deposit({ assets, receiver });
          setSharesReceived(`${estimatedSharesFormatted} uyUSDC`);
          queryClient.invalidateQueries({ queryKey: vaultQueryKeys.all });
        } catch {
          setSharesReceived(`${estimatedSharesFormatted} uyUSDC`);
        }
        setIsComplete(true);
      }, 5500);
      return;
    }

    // Cross-chain: LiFi quote + execute (from other chain → Ethereum vault)
    if (!isSameChainDeposit) {
      const fromChainId = CHAIN_ID_BY_KEY[chain];
      const fromToken = USDC_BY_CHAIN_ID[fromChainId];
      if (!fromToken || !receiver) {
        toast.error("Invalid chain or wallet");
        setShowProgress(false);
        return;
      }
      setIsLifiPending(true);
      setSteps((prev) =>
        prev.map((s, i) => (i === 0 ? { ...s, status: "loading" as const } : s))
      );
      getQuote({
        fromChain: fromChainId,
        toChain: LIFI_ETHEREUM_CHAIN_ID,
        fromToken,
        toToken: UNIYIELD_VAULT_ADDRESS,
        fromAmount: assets.toString(),
        fromAddress: receiver,
        toAddress: receiver,
      })
        .then((quote) => {
          const route = convertQuoteToRoute(quote);
          return executeRoute(route, {
            updateRouteHook(updatedRoute: RouteExtended) {
              const stepsWithExecution = updatedRoute.steps.filter(
                (s) => s.execution != null
              );
              const allDone = stepsWithExecution.every(
                (s) => s.execution?.status === "DONE"
              );
              const anyLoading = stepsWithExecution.some(
                (s) =>
                  s.execution?.status === "PENDING" ||
                  s.execution?.status === "ACTION_REQUIRED"
              );
              setSteps((prev) => {
                if (allDone) {
                  return prev.map((s) => ({
                    ...s,
                    status: "complete" as const,
                  }));
                }
                const doneCount = stepsWithExecution.filter(
                  (s) => s.execution?.status === "DONE"
                ).length;
                return prev.map((step, i) => {
                  if (i === 0) return { ...step, status: "complete" as const };
                  if (i <= doneCount)
                    return { ...step, status: "complete" as const };
                  if (i === doneCount + 1 && anyLoading)
                    return { ...step, status: "loading" as const };
                  return step;
                });
              });
            },
          });
        })
        .then((executedRoute) => {
          const toAmount =
            executedRoute.steps[executedRoute.steps.length - 1]?.estimate
              ?.toAmount;
          const sharesStr =
            toAmount != null
              ? formatVaultUnits(BigInt(toAmount))
              : estimatedSharesFormatted;
          setSharesReceived(`${sharesStr} uyUSDC`);
          setSteps((prev) =>
            prev.map((step) => ({ ...step, status: "complete" as const }))
          );
          setIsComplete(true);
          queryClient.invalidateQueries({ queryKey: vaultQueryKeys.all });
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Cross-chain deposit failed.";
          toast.error(message);
          setShowProgress(false);
        })
        .finally(() => {
          setIsLifiPending(false);
        });
      return;
    }

    // Same-chain: direct vault deposit on Ethereum
    setSteps((prev) =>
      prev.map((s, i) => (i === 0 ? { ...s, status: "loading" as const } : s))
    );
    writeContractAsync({
      address: UNIYIELD_VAULT_ADDRESS as `0x${string}`,
      abi: VAULT_ABI as never,
      functionName: "deposit",
      args: [assets, receiver as `0x${string}`],
      chainId: VAULT_CHAIN_ID,
    })
      .then(() => {
        setSteps((prev) =>
          prev.map((step) => ({ ...step, status: "complete" as const }))
        );
        setSharesReceived(`${estimatedSharesFormatted} uyUSDC`);
        queryClient.invalidateQueries({ queryKey: vaultQueryKeys.all });
        setIsComplete(true);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Transaction failed.";
        toast.error(message);
        setShowProgress(false);
      });
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          USDC Yield Vault
        </h1>
        <p className="mt-2 text-muted-foreground">
          Automatically allocates across leading lending protocols.
        </p>
      </div>

      {isWrongChain && (
        <Alert
          variant="default"
          className="mb-6 border-amber-200 bg-amber-50 text-amber-900"
        >
          <AlertTitle>Wrong network</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>
              The vault is on Ethereum mainnet. Switch network to deposit.
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={isSwitchPending}
              onClick={() => switchChain({ chainId: VAULT_CHAIN_ID })}
            >
              {isSwitchPending ? "Switching…" : "Switch to Ethereum"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Deposit Panel */}
      <div className="infra-card p-6 space-y-6">
        {/* Source Section */}
        <div className="space-y-3">
          <label className="infra-label">Deposit from</label>
          <ChainSelector value={chain} onValueChange={handleChainChange} />
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-lg font-medium tabular-nums bg-background"
              />
            </div>
            <div className="flex items-center gap-2 px-4 border border-border rounded-md bg-muted/30">
              <span className="text-sm font-medium text-foreground">USDC</span>
            </div>
          </div>
        </div>

        {/* Destination Section */}
        <div className="space-y-3 pt-4 border-t border-border">
          <label className="infra-label">Deposit to</label>
          <DestinationChainSelector
            value={destinationChain}
            onValueChange={setDestinationChain}
          />
        </div>

        {/* Destination Mode */}
        <div className="space-y-3 pt-4 border-t border-border">
          <Label className="infra-label">Destination Mode</Label>
          <RadioGroup
            value={destinationMode}
            onValueChange={(v) => setDestinationMode(v as "uniyield" | "bridgeToSelf")}
            className="grid gap-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="uniyield" id="dest-uniyield" />
              <Label
                htmlFor="dest-uniyield"
                className="flex flex-col gap-0.5 font-normal cursor-pointer"
              >
                <span>Deposit into UniYield (coming soon)</span>
                {vaultNotDeployed && (
                  <span className="text-xs text-muted-foreground">Vault not deployed — click to preview</span>
                )}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="bridgeToSelf" id="dest-bridge" />
              <Label htmlFor="dest-bridge" className="flex items-center gap-2 font-normal cursor-pointer">
                <span>Bridge USDC to my Ethereum wallet</span>
                <Badge variant="secondary" className="text-xs">Bridge mode</Badge>
              </Label>
            </div>
          </RadioGroup>
          {destinationMode === "uniyield" && (
            <p className="text-xs text-muted-foreground">
              UniYield USDC Vault (Ethereum). Funds are routed cross-chain and deposited automatically.
            </p>
          )}
          {destinationMode === "bridgeToSelf" && (
            <p className="text-xs text-muted-foreground">
              Bridge USDC from selected chain to your wallet on Ethereum.
            </p>
          )}
        </div>

        {/* Bridge mode: routes and execute */}
        {destinationMode === "bridgeToSelf" && (
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <Label>Routes</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!address || !amount || parseFloat(amount) <= 0 || routesLoading}
                onClick={fetchRoutesForBridge}
              >
                {routesLoading ? "Loading…" : "Get routes"}
              </Button>
            </div>
            {routes.length > 0 && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Pick a route (top 3)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <RouteList
                    routes={routes}
                    selectedIndex={selectedRouteIndex}
                    onSelectIndex={setSelectedRouteIndex}
                    formatVaultUnits={formatVaultUnits}
                  />
                  <Button
                    className="w-full"
                    disabled={isLifiPending}
                    onClick={handleExecuteBridge}
                  >
                    {isLifiPending ? "Confirm in wallet…" : "Bridge USDC"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Strategy Allocation (deposit mode only) */}
        {destinationMode === "uniyield" && (
          <div className="space-y-3 pt-4 border-t border-border">
            <label className="infra-label">Strategy Allocation</label>
            <StrategyTable
              strategies={vaultLoading ? [] : strategies}
              selectedProtocol={selectedStrategyProtocol}
              onSelectProtocol={setSelectedStrategyProtocol}
            />
            <p className="text-xs text-muted-foreground">
              The vault allocates to the highest net yield automatically.
            </p>
          </div>
        )}

        {/* Summary (deposit mode only) */}
        {destinationMode === "uniyield" && (
          <div className="space-y-3 pt-4 border-t border-border">
            <label className="infra-label">Summary</label>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated shares</span>
                <span className="font-medium tabular-nums">
                  {estimatedSharesQ.isLoading ? "…" : estimatedSharesFormatted}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current APY</span>
                <span className="font-medium text-success">{currentAPY}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated fees</span>
                <span className="font-medium tabular-nums">{estimatedFees}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Execution time</span>
                <span className="font-medium">{executionTime}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Button (UniYield deposit only) */}
        {destinationMode === "uniyield" && (
          <div className="pt-4">
            <Button
              onClick={handleDeposit}
              disabled={
                vaultNotDeployed ||
                !address ||
                !amount ||
                parseFloat(amount) <= 0 ||
                isWritePending ||
                isLifiPending ||
                isWrongChain
              }
              className="w-full"
              size="lg"
            >
              {isWritePending || isLifiPending
                ? "Confirm in wallet…"
                : address
                ? isSameChainDeposit
                  ? "Deposit USDC"
                  : "Bridge & deposit (one-click)"
                : "Connect wallet to deposit"}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {address
                ? "You will receive ERC-4626 vault shares on Ethereum."
                : "Connect your wallet to deposit."}
            </p>
          </div>
        )}
      </div>

      {/* Transaction Progress Modal (UniYield deposit) */}
      <TransactionProgress
        open={showProgress}
        onOpenChange={setShowProgress}
        steps={steps}
        isComplete={isComplete}
        sharesReceived={sharesReceived}
      />

      {/* Bridge (Debug) Progress Modal */}
      <TransactionProgress
        open={showBridgeProgress}
        onOpenChange={(open) => {
          setShowBridgeProgress(open);
          if (!open) setBridgeStatusPolling(false);
        }}
        steps={bridgeSteps}
        isComplete={bridgeComplete}
        sharesReceived={
          bridgeComplete
            ? `${bridgeReceivedAmount ? formatVaultUnits(BigInt(bridgeReceivedAmount)) : "—"} USDC`
            : ""
        }
        txHash={bridgeTxHash ?? undefined}
      />
    </div>
  );
}
