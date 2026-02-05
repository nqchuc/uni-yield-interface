import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUniYieldVaultSnapshot } from "@/lib/uniyield";
import { getStrategyDisplayName } from "@/config/uniyield";

function formatUnits(value: string): string {
  const n = BigInt(value);
  const decimals = 6;
  const s = n.toString().padStart(decimals + 1, "0");
  const intPart = s.slice(0, -decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fracPart = s.slice(-decimals);
  return `${intPart}.${fracPart}`;
}

export function VaultStatsCard() {
  const { data: snapshot, isLoading } = useUniYieldVaultSnapshot();

  const activeName = snapshot
    ? getStrategyDisplayName(snapshot.activeStrategyId)
    : "—";

  if (isLoading || !snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vault stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-24" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vault stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Total assets:{" "}
          <span className="font-medium text-foreground">
            {formatUnits(snapshot.totalAssets)}
          </span>{" "}
          {snapshot.symbol}
        </p>
        <p className="text-sm text-muted-foreground">
          Total supply:{" "}
          <span className="font-medium text-foreground">
            {formatUnits(snapshot.totalSupply)}
          </span>{" "}
          shares
        </p>
        <p className="text-sm text-muted-foreground">
          Active strategy:{" "}
          <span className="font-medium text-foreground">{activeName}</span>
        </p>
      </CardContent>
    </Card>
  );
}
