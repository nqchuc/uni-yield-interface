import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StrategiesTable } from "@/components/uniyield/StrategiesTable";
import { AdminPanel } from "@/components/uniyield/AdminPanel";
import {
  useUniYieldVaultSnapshot,
  useUniYieldPosition,
} from "@/lib/uniyield";
import { getStrategyDisplayName } from "@/config/uniyield";
import { DEMO_MODE } from "@/config/uniyield";
import { useAccount } from "wagmi";

function formatUnits(value: string): string {
  const n = BigInt(value);
  const s = n.toString().padStart(7, "0");
  const intPart = s.slice(0, -6).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fracPart = s.slice(-6);
  return `${intPart}.${fracPart}`;
}

function formatWith2Decimals(value: string): string {
  const n = BigInt(value);
  const units = Number(n) / 1e6;
  return units.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function PortfolioSection() {
  const { address } = useAccount();
  const { data: position, isLoading } = useUniYieldPosition(address ?? undefined);

  if (!address) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Connect wallet to view your position.
          </p>
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
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const deposited = position.assetValue;
  const shares = position.shares;
  const valueUsdc = position.assetValue;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Deposited
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {formatUnits(deposited)} USDC
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Shares
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {formatUnits(shares)} uyUSDC
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Value
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {formatUnits(valueUsdc)} USDC
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VaultAllocationSection() {
  const { data: snapshot, isLoading } = useUniYieldVaultSnapshot();

  if (isLoading || !snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vault Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const activeName = getStrategyDisplayName(snapshot.activeStrategyId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vault Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total assets
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {formatWith2Decimals(snapshot.totalAssets)} {snapshot.symbol}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total supply
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {formatWith2Decimals(snapshot.totalSupply)} shares
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Active strategy
            </p>
            <p className="mt-0.5 text-lg font-semibold text-foreground">
              {activeName}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UniYieldPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Stats
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Portfolio, vault allocation, and strategies
          </p>
        </div>
        {DEMO_MODE && (
          <Badge variant="secondary" className="w-fit">
            Demo
          </Badge>
        )}
      </header>

      <PortfolioSection />

      <VaultAllocationSection />

      <StrategiesTable />

      <AdminPanel />
    </div>
  );
}
