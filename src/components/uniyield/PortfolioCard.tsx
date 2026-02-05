import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount } from "wagmi";
import { useUniYieldPosition } from "@/lib/uniyield";

function formatUnits(value: string): string {
  const n = BigInt(value);
  const decimals = 6;
  const s = n.toString().padStart(decimals + 1, "0");
  const intPart = s.slice(0, -decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fracPart = s.slice(-decimals);
  return `${intPart}.${fracPart}`;
}

export function PortfolioCard() {
  const { address } = useAccount();
  const { data: position, isLoading } = useUniYieldPosition(address ?? undefined);

  if (!address) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Connect wallet to view your position.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !position) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Shares: <span className="font-medium text-foreground">{formatUnits(position.shares)}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Value: <span className="font-medium text-foreground">{formatUnits(position.assetValue)}</span> USDC
        </p>
      </CardContent>
    </Card>
  );
}
