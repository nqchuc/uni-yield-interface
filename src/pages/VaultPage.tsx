import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChainSelector } from "@/components/ChainSelector";
import { StrategyTable } from "@/components/StrategyTable";
import { TransactionProgress } from "@/components/TransactionProgress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useVaultData,
  useEstimatedShares,
  vaultQueryKeys,
} from "@/hooks/useVaultData";
import { deposit, formatVaultUnits, DEMO_USER_ADDRESS } from "@/lib/vault";

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

export default function VaultPage() {
  const queryClient = useQueryClient();
  const { strategies, summary, isLoading: vaultLoading } = useVaultData();
  const [chain, setChain] = useState("ethereum");
  const [amount, setAmount] = useState("");
  const [showProgress, setShowProgress] = useState(false);
  const [steps, setSteps] = useState(initialSteps);
  const [isComplete, setIsComplete] = useState(false);
  const [sharesReceived, setSharesReceived] = useState("0 uyUSDC");

  const estimatedSharesQ = useEstimatedShares(amount);
  const estimatedSharesFormatted =
    estimatedSharesQ.data != null
      ? formatVaultUnits(estimatedSharesQ.data)
      : "0.000000";
  const currentAPY = summary?.currentAPY ?? "—";
  const estimatedFees = amount
    ? `$${(parseFloat(amount) * 0.0013).toFixed(2)}`
    : "$0.00";
  const executionTime = chain === "ethereum" ? "~30 seconds" : "~2 minutes";

  const handleDeposit = () => {
    const assets = BigInt(Math.round(parseFloat(amount) * 1e6));
    if (!amount || assets <= 0n) return;
    setShowProgress(true);
    setSteps(initialSteps);
    setIsComplete(false);
    setSharesReceived("0 uyUSDC");

    // Simulate transaction progress; on last step run mock deposit and invalidate
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
        await deposit({ assets, receiver: DEMO_USER_ADDRESS });
        setSharesReceived(`${estimatedSharesFormatted} uyUSDC`);
        queryClient.invalidateQueries({ queryKey: vaultQueryKeys.all });
      } catch {
        setSharesReceived(`${estimatedSharesFormatted} uyUSDC`);
      }
      setIsComplete(true);
    }, 5500);
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

      {/* Deposit Panel */}
      <div className="infra-card p-6 space-y-6">
        {/* Source Section */}
        <div className="space-y-3">
          <label className="infra-label">Deposit from</label>
          <ChainSelector value={chain} onValueChange={setChain} />
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
        <div className="space-y-2 pt-4 border-t border-border">
          <label className="infra-label">Destination</label>
          <p className="infra-value">UniYield USDC Vault (Ethereum)</p>
          <p className="text-xs text-muted-foreground">
            Funds are routed cross-chain and deposited automatically.
          </p>
        </div>

        {/* Strategy Section */}
        <div className="space-y-3 pt-4 border-t border-border">
          <label className="infra-label">Strategy Allocation</label>
          <StrategyTable strategies={vaultLoading ? [] : strategies} />
          <p className="text-xs text-muted-foreground">
            The vault allocates to the highest net yield automatically.
          </p>
        </div>

        {/* Summary Section */}
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

        {/* Action Button */}
        <div className="pt-4">
          <Button
            onClick={handleDeposit}
            disabled={!amount || parseFloat(amount) <= 0}
            className="w-full"
            size="lg"
          >
            Deposit USDC
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            You will receive ERC-4626 vault shares on Ethereum.
          </p>
        </div>
      </div>

      {/* Transaction Progress Modal */}
      <TransactionProgress
        open={showProgress}
        onOpenChange={setShowProgress}
        steps={steps}
        isComplete={isComplete}
        sharesReceived={sharesReceived}
      />
    </div>
  );
}
