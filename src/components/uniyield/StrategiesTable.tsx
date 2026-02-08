import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUniYieldStrategies, useUniYieldVaultSnapshot } from "@/lib/uniyield";
import { useMemo } from "react";

/** Allocation % per strategy (Aave, Morpho, Compound). */
const STRATEGY_ALLOCATION: Record<string, number> = {
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": 40,
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb": 30,
  "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc": 30,
};

export function StrategiesTable() {
  const { data: strategies, isLoading } = useUniYieldStrategies();
  const { data: snapshot } = useUniYieldVaultSnapshot();

  const sortedStrategies = useMemo(() => {
    if (!strategies || !snapshot) return strategies ?? [];
    const activeId = snapshot.activeStrategyId;
    return [...strategies].sort((a, b) =>
      a.id === activeId ? -1 : b.id === activeId ? 1 : 0
    );
  }, [strategies, snapshot]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Strategies</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategies</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Strategy</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>APY</TableHead>
              <TableHead>Current Holding (USD)</TableHead>
              <TableHead>Allocation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(sortedStrategies ?? []).map((row) => {
              const isActive = snapshot && row.id === snapshot.activeStrategyId;
              const apy =
                row.rateBps != null
                  ? `${(Number(row.rateBps) / 100).toFixed(2)}%`
                  : "—";
              const allocation = STRATEGY_ALLOCATION[row.id.toLowerCase()];
              const allocationDisplay =
                allocation != null ? `${allocation}%` : "—";
              const totalAssets = snapshot ? BigInt(snapshot.totalAssets) : 0n;
              const holdingUsd =
                allocation != null && snapshot
                  ? (
                      (Number(totalAssets) * (allocation / 100)) /
                      1e6
                    ).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : "—";
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    {isActive ? (
                      <Badge variant="default">Active</Badge>
                    ) : row.enabled ? (
                      <Badge variant="secondary">Available</Badge>
                    ) : (
                      <Badge variant="outline">Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell className={isActive ? "font-medium text-success" : ""}>
                    {apy}
                  </TableCell>
                  <TableCell>{holdingUsd}</TableCell>
                  <TableCell>{allocationDisplay}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {(!strategies || strategies.length === 0) && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No strategies.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
