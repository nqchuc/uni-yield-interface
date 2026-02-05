import { useState } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUniYield, useUniYieldPreviewDeposit, useUniYieldInvalidate } from "@/lib/uniyield";
import { DEFAULT_CHAIN_ID } from "@/config/uniyield";

function formatUnitsDisplay(value: string): string {
  const n = BigInt(value);
  const decimals = 6;
  const s = n.toString().padStart(decimals + 1, "0");
  const intPart = s.slice(0, -decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fracPart = s.slice(-decimals);
  return `${intPart}.${fracPart}`;
}

function parseAmount(amountStr: string): bigint {
  const num = parseFloat(amountStr);
  if (!Number.isFinite(num) || num < 0) return 0n;
  return BigInt(Math.round(num * 1e6));
}

export function DepositCard() {
  const { address, chainId } = useAccount();
  const client = useUniYield();
  const invalidate = useUniYieldInvalidate();
  const [amount, setAmount] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const assets = parseAmount(amount);
  const { data: previewShares, isLoading: previewLoading } =
    useUniYieldPreviewDeposit(amount);

  const wrongNetwork = !!address && chainId != null && chainId !== DEFAULT_CHAIN_ID;

  const handleDeposit = async () => {
    if (!amount || assets <= 0n) return;
    if (!address) {
      toast.error("Connect wallet first.");
      return;
    }
    if (wrongNetwork) {
      toast.error("Switch to the correct network.");
      return;
    }
    setIsPending(true);
    setTxHash(null);
    try {
      const { hash } = await client.deposit(assets, address);
      setTxHash(hash);
      toast.success("Deposit submitted.");
      await invalidate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deposit failed.";
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  };

  if (!address) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deposit</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Connect wallet to deposit.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (wrongNetwork) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deposit</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Wrong network. Switch to the correct chain to deposit.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deposit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="deposit-amount">Amount (USDC)</Label>
          <Input
            id="deposit-amount"
            type="number"
            min="0"
            step="any"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        {amount && assets > 0n && (
          <p className="text-sm text-muted-foreground">
            You will receive approximately:{" "}
            {previewLoading
              ? "…"
              : previewShares != null
                ? formatUnitsDisplay(previewShares.toString())
                : "—"}{" "}
            shares
          </p>
        )}
        <Button
          onClick={handleDeposit}
          disabled={!amount || assets <= 0n || isPending}
        >
          {isPending ? "Confirming…" : "Deposit"}
        </Button>
        {txHash && (
          <p className="text-xs text-muted-foreground">
            Tx: {txHash.slice(0, 10)}…{txHash.slice(-8)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
