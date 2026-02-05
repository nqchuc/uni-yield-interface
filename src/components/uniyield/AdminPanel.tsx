import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useUniYield,
  useUniYieldPreviewRebalance,
  useUniYieldInvalidate,
  useIsUniYieldAdmin,
} from "@/lib/uniyield";
import { getStrategyDisplayName } from "@/config/uniyield";

function formatUnits(value: string): string {
  const n = BigInt(value);
  const decimals = 6;
  const s = n.toString().padStart(decimals + 1, "0");
  const intPart = s.slice(0, -decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fracPart = s.slice(-decimals);
  return `${intPart}.${fracPart}`;
}

export function AdminPanel() {
  const isAdmin = useIsUniYieldAdmin();
  const client = useUniYield();
  const invalidate = useUniYieldInvalidate();
  const { data: preview, isLoading } = useUniYieldPreviewRebalance();
  const [isPending, setIsPending] = useState(false);

  const handleRebalance = async () => {
    setIsPending(true);
    try {
      await client.rebalance();
      toast.success("Rebalance submitted.");
      await invalidate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rebalance failed.";
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin — Rebalance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !preview ? (
          <p className="text-sm text-muted-foreground">Loading preview…</p>
        ) : (
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              From: {getStrategyDisplayName(preview.fromStrategy)} → To:{" "}
              {getStrategyDisplayName(preview.toStrategy)}
            </p>
            <p>Assets to move: {formatUnits(preview.assetsToMove)}</p>
          </div>
        )}
        <Button onClick={handleRebalance} disabled={isPending}>
          {isPending ? "Confirming…" : "Rebalance"}
        </Button>
      </CardContent>
    </Card>
  );
}
