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
import { useUniYieldStrategies } from "@/lib/uniyield";

export function StrategiesTable() {
  const { data: strategies, isLoading } = useUniYieldStrategies();

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
              <TableHead>Enabled</TableHead>
              <TableHead>Target (bps)</TableHead>
              <TableHead>Max (bps)</TableHead>
              {strategies?.some((s) => s.rateBps != null) && (
                <TableHead>Rate (bps)</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(strategies ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>
                  {row.enabled ? (
                    <Badge variant="default">Yes</Badge>
                  ) : (
                    <Badge variant="secondary">No</Badge>
                  )}
                </TableCell>
                <TableCell>{row.targetBps}</TableCell>
                <TableCell>{row.maxBps}</TableCell>
                {strategies?.some((s) => s.rateBps != null) && (
                  <TableCell>{row.rateBps ?? "—"}</TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {(!strategies || strategies.length === 0) && (
          <p className="py-4 text-center text-sm text-muted-foreground">No strategies.</p>
        )}
      </CardContent>
    </Card>
  );
}
