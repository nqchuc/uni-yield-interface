import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";
import { toast } from "sonner";
import { executeRoute, type RouteExtended } from "@lifi/sdk";
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
  useConvertToSharesFromWei,
  vaultQueryKeys,
} from "@/hooks/useVaultData";
import { CHAIN_ID_BY_KEY } from "@/lib/lifi";
import { getChainDisplayName, getExplorerTxLink } from "@/lib/chains";
import { getTotalFeesUSD } from "@/lib/routeUtils";
import {
  getQuoteBridgeToSelf,
  getQuoteDepositToUniYield,
  createGetContractCallsForUniYield,
} from "@/lib/lifiClient";
import { VAULT_CHAIN_ID, vaultChains } from "@/lib/wagmi";
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
  { id: "routing", label: "Executing route (bridge + deposit)", status: "pending" },
  { id: "settlement", label: "Base settlement", status: "pending" },
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
  const [chain, setChain] = useState("arbitrum");
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

  const [destinationChain, setDestinationChain] = useState("base");
  const [destinationMode, setDestinationMode] = useState<"uniyield" | "bridgeToSelf">(
    vaultNotDeployed ? "bridgeToSelf" : "uniyield"
  );
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [depositRoutes, setDepositRoutes] = useState<Route[]>([]);
  const [depositRoutesLoading, setDepositRoutesLoading] = useState(false);
  const [selectedDepositRouteIndex, setSelectedDepositRouteIndex] = useState(0);
  const [bridgeSteps, setBridgeSteps] = useState(bridgeDebugSteps);
  const [showBridgeProgress, setShowBridgeProgress] = useState(false);
  const [bridgeComplete, setBridgeComplete] = useState(false);
  const [bridgeTxHash, setBridgeTxHash] = useState<string | null>(null);
  const [depositTxLink, setDepositTxLink] = useState<string | null>(null);
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

  // Clear deposit routes when amount or source chain changes
  useEffect(() => {
    setDepositRoutes([]);
  }, [amount, chain]);

  const isSameChainDeposit = chain === "base";
  const isWrongChain =
    !isMock &&
    isSameChainDeposit &&
    address != null &&
    chainId != null &&
    chainId !== VAULT_CHAIN_ID;

  const estimatedSharesQ = useEstimatedShares(amount);
  const selectedDepositRouteForShares = depositRoutes[selectedDepositRouteIndex];
  const depositAmountOut = (selectedDepositRouteForShares as Route & { depositAmountOut?: string })?.depositAmountOut;
  const crossChainSharesQ = useConvertToSharesFromWei(depositAmountOut);
  const estimatedSharesFormatted =
    depositAmountOut && crossChainSharesQ.data != null
      ? formatVaultUnits(crossChainSharesQ.data)
      : selectedDepositRouteForShares?.toAmount != null && BigInt(selectedDepositRouteForShares.toAmount) > 0n
        ? formatVaultUnits(BigInt(selectedDepositRouteForShares.toAmount))
        : estimatedSharesQ.data != null
          ? formatVaultUnits(estimatedSharesQ.data)
          : "0.000000";
  const selectedStrategy = strategies.find((s) => s.protocol === selectedStrategyProtocol);
  const currentAPY =
    selectedStrategy?.apy ?? summary?.currentAPY ?? "—";
  const selectedDepositRoute = depositRoutes[selectedDepositRouteIndex];
  const depositRouteFees = selectedDepositRoute
    ? getTotalFeesUSD(selectedDepositRoute)
    : null;
  const estimatedFees =
    depositRouteFees ??
    (amount ? `$${(parseFloat(amount) * 0.0013).toFixed(2)}` : "$0.00");
  const depositRouteEstTime =
    selectedDepositRoute?.steps?.[0] != null
      ? (() => {
          const est = (selectedDepositRoute.steps[0] as { estimate?: { executionDuration?: number } }).estimate;
          const sec = est?.executionDuration;
          return sec != null
            ? sec < 60
              ? `~${sec}s`
              : `~${Math.ceil(sec / 60)} min`
            : "~2 min";
        })()
      : null;
  const executionTime =
    depositRouteEstTime ?? (chain === "base" ? "~30 seconds" : "~2 minutes");

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
    const toChainId = CHAIN_ID_BY_KEY[destinationChain];
    const fromAmount = BigInt(Math.round(parseFloat(amount) * 1e6)).toString();
    setRoutesLoading(true);
    setRoutes([]);
    try {
      const res = await getQuoteBridgeToSelf({
        fromChainId,
        toChainId,
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
  }, [address, amount, chain, destinationChain]);

  const fetchRoutesForDeposit = useCallback(async () => {
    if (!address || !amount || parseFloat(amount) <= 0 || isSameChainDeposit) return;
    const fromChainId = CHAIN_ID_BY_KEY[chain];
    const fromAmount = BigInt(Math.round(parseFloat(amount) * 1e6)).toString();
    setDepositRoutesLoading(true);
    setDepositRoutes([]);
    try {
      const { route } = await getQuoteDepositToUniYield({
        fromChainId,
        fromAmount,
        userAddress: address,
        receiver,
      });
      setDepositRoutes([route]);
      setSelectedDepositRouteIndex(0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch routes";
      toast.error(msg);
    } finally {
      setDepositRoutesLoading(false);
    }
  }, [address, amount, chain, receiver, isSameChainDeposit]);

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
    setDepositTxLink(null);

    // Cross-chain: always use real LiFi executeRoute (never mock)
    if (!isSameChainDeposit) {
      const route = depositRoutes[selectedDepositRouteIndex];
      if (!route) {
        toast.error("Get routes first");
        setShowProgress(false);
        return;
      }
      if (!address || receiver === DEMO_USER_ADDRESS) {
        toast.error("Connect wallet to deposit");
        setShowProgress(false);
        return;
      }
      setIsLifiPending(true);
      setSteps((prev) =>
        prev.map((s, i) => (i === 0 ? { ...s, status: "loading" as const } : s))
      );
      executeRoute(route, {
        getContractCalls: createGetContractCallsForUniYield(),
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
      })
        .then((executedRoute) => {
          const lastStep = executedRoute.steps[executedRoute.steps.length - 1];
          const toAmount = lastStep?.estimate?.toAmount;
          const hasValidToAmount =
            toAmount != null && toAmount !== "" && BigInt(toAmount) > 0n;
          const sharesStr = hasValidToAmount
            ? formatVaultUnits(BigInt(toAmount))
            : `~${estimatedSharesFormatted}`;

          let txLink: string | null = null;
          for (const step of executedRoute.steps) {
            const processes =
              (step as {
                execution?: {
                  process?: Array<{
                    type?: string;
                    txHash?: string;
                    txLink?: string;
                    chainId?: number;
                  }>;
                };
              }).execution?.process ?? [];
            const receiving = processes.find(
              (p) => p.type === "RECEIVING_CHAIN" && (p.txHash || p.txLink)
            );
            if (receiving?.txLink) {
              txLink = receiving.txLink;
              break;
            }
            if (receiving?.txHash) {
              txLink = getExplorerTxLink(8453, receiving.txHash);
              break;
            }
            const baseProc = processes.find(
              (p) =>
                (p.txHash || p.txLink) &&
                (p.chainId === 8453 || p.type === "RECEIVING_CHAIN")
            );
            if (baseProc?.txLink) {
              txLink = baseProc.txLink;
              break;
            }
            if (baseProc?.txHash) {
              txLink = getExplorerTxLink(baseProc.chainId ?? 8453, baseProc.txHash);
              break;
            }
            const anyProc = processes.find((p) => p.txHash || p.txLink);
            if (anyProc?.txLink) {
              txLink = anyProc.txLink;
              break;
            }
            if (anyProc?.txHash) {
              txLink = getExplorerTxLink(anyProc.chainId ?? 8453, anyProc.txHash);
              break;
            }
          }
          setDepositTxLink(txLink);
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
          toast.error(message, {
            action: {
              label: "Retry as Bridge-to-self",
              onClick: () => setDestinationMode("bridgeToSelf"),
            },
          });
          setShowProgress(false);
        })
        .finally(() => {
          setIsLifiPending(false);
        });
      return;
    }

    // Same-chain: mock (demo) or real vault deposit on Base
    if (!address || receiver === DEMO_USER_ADDRESS) {
      toast.error("Connect wallet to deposit");
      setShowProgress(false);
      return;
    }
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
    setSteps((prev) =>
      prev.map((s, i) => (i === 0 ? { ...s, status: "loading" as const } : s))
    );
    const baseChain = vaultChains.find((c) => c.id === VAULT_CHAIN_ID);
    writeContractAsync({
      address: UNIYIELD_VAULT_ADDRESS as `0x${string}`,
      abi: VAULT_ABI as never,
      functionName: "deposit",
      args: [assets, receiver as `0x${string}`],
      chain: baseChain ?? vaultChains[1],
      account: address,
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
              The vault is on Base. Switch network to deposit.
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={isSwitchPending}
              onClick={() => switchChain({ chainId: VAULT_CHAIN_ID })}
            >
              {isSwitchPending ? "Switching…" : "Switch to Base"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Deposit Panel */}
      <div className="infra-card p-6 space-y-6">
        {/* Source Section */}
        <div className="space-y-3">
          <label className="infra-label">Deposit from</label>
          <ChainSelector
            value={chain}
            onValueChange={handleChainChange}
            comingSoonChains={["base"]}
          />
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
            onValueChange={(v) => {
              setDestinationMode(v as "uniyield" | "bridgeToSelf");
              setRoutes([]);
              setDepositRoutes([]);
            }}
            className="grid gap-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="uniyield" id="dest-uniyield" />
              <Label
                htmlFor="dest-uniyield"
                className="flex flex-col gap-0.5 font-normal cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  1-click bridge/deposit into UniYield
                  <Badge variant="secondary" className="text-xs">Deposit mode</Badge>
                </span>
                {vaultNotDeployed && (
                  <span className="text-xs text-muted-foreground">
                    Vault not deployed — click to preview
                  </span>
                )}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="bridgeToSelf" id="dest-bridge" />
              <Label htmlFor="dest-bridge" className="flex items-center gap-2 font-normal cursor-pointer">
                <span>Bridge USDC directly to my wallet</span>
                <Badge variant="secondary" className="text-xs">Bridge mode</Badge>
              </Label>
            </div>
          </RadioGroup>
          {destinationMode === "uniyield" && (
            <p className="text-xs text-muted-foreground">
              Destination: Base. You will receive UniYield vault shares (uyUSDC). Funds are routed cross-chain and deposited in one transaction.
            </p>
          )}
          {destinationMode === "bridgeToSelf" && (
            <p className="text-xs text-muted-foreground">
              Bridge USDC from selected chain to your wallet on {getChainDisplayName(CHAIN_ID_BY_KEY[destinationChain])}.
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

        {/* Deposit mode: routes (cross-chain only) */}
        {destinationMode === "uniyield" && !isSameChainDeposit && (
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <Label>Routes</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!address || !amount || parseFloat(amount) <= 0 || depositRoutesLoading}
                onClick={fetchRoutesForDeposit}
              >
                {depositRoutesLoading ? "Loading…" : "Get routes"}
              </Button>
            </div>
            {depositRoutes.length > 0 && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Route (bridge + vault deposit)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <RouteList
                    routes={depositRoutes}
                    selectedIndex={selectedDepositRouteIndex}
                    onSelectIndex={setSelectedDepositRouteIndex}
                    formatVaultUnits={formatVaultUnits}
                  />
                </CardContent>
              </Card>
            )}
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
                  {(depositAmountOut ? crossChainSharesQ.isLoading : estimatedSharesQ.isLoading) ? "…" : estimatedSharesFormatted}
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
                isWrongChain ||
                (!isSameChainDeposit && depositRoutes.length === 0)
              }
              className="w-full"
              size="lg"
            >
              {isWritePending || isLifiPending
                ? "Confirm in wallet…"
                : address
                ? isSameChainDeposit
                  ? "Deposit USDC"
                  : depositRoutes.length === 0
                    ? "Get routes first"
                    : "Bridge & deposit"
                : "Connect wallet to deposit"}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {address
                ? "You will receive ERC-4626 vault shares on Base."
                : "Connect your wallet to deposit."}
            </p>
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
      </div>

      {/* Transaction Progress Modal (UniYield deposit) */}
      <TransactionProgress
        open={showProgress}
        onOpenChange={setShowProgress}
        steps={steps}
        isComplete={isComplete}
        sharesReceived={sharesReceived}
        txLink={depositTxLink ?? undefined}
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
