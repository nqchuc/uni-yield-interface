import { useState, useMemo } from "react";
import type { Route } from "@lifi/types";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { useLifiTools } from "@/hooks/useLifiTools";
import {
  computeRouteRankings,
  getRouteLabels,
  getFeeBreakdown,
  getTotalFeesUSD,
  getRouteExplanation,
  getApprovalInfo,
  getStepDetails,
} from "@/lib/routeUtils";
import { getChainDisplayName } from "@/lib/chains";

export interface RouteListProps {
  routes: Route[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  formatVaultUnits: (value: bigint) => string;
}

export function RouteList({
  routes,
  selectedIndex,
  onSelectIndex,
  formatVaultUnits,
}: RouteListProps) {
  const { getTool, toolsReady } = useLifiTools(routes.length > 0);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const rankings = useMemo(() => computeRouteRankings(routes), [routes]);

  if (routes.length === 0) return null;

  return (
    <TooltipProvider>
      <RadioGroup
        value={String(selectedIndex)}
        onValueChange={(v) => onSelectIndex(Number(v))}
        className="grid gap-2"
      >
        {routes.map((r, i) => {
          const stepNames = r.steps
            .map((s) => (s as { toolDetails?: { name?: string }; tool?: string }).toolDetails?.name ?? (s as { tool?: string }).tool)
            .filter(Boolean) as string[];
          const routeTitle = stepNames.length > 0 ? stepNames.join(" → ") : `Route ${i + 1}`;
          const firstStep = r.steps[0] as { estimate?: { executionDuration?: number } } | undefined;
          const estSec = firstStep?.estimate?.executionDuration;
          const estTime = estSec != null ? (estSec < 60 ? `~${estSec}s` : `~${Math.ceil(estSec / 60)} min`) : "~2 min";
          const labels = getRouteLabels(i, rankings);
          const feeLines = getFeeBreakdown(r);
          const totalFees = getTotalFeesUSD(r);
          const explanation = getRouteExplanation(i, rankings, r);
          const approval = getApprovalInfo(r);
          const stepDetails = getStepDetails(r);
          const firstToolKey = (r.steps[0] as { tool?: string })?.tool;
          const firstTool = firstToolKey ? getTool(firstToolKey) : undefined;
          const isRecommended = i === rankings.recommendedIndex;

          return (
            <div
              key={r.id}
              className={`rounded-lg border p-3 hover:bg-muted/50 ${isRecommended ? "ring-1 ring-primary/30" : ""}`}
            >
              <div className="flex items-start gap-3">
                <RadioGroupItem value={String(i)} id={`route-${i}`} className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {firstTool?.logoURI && toolsReady ? (
                      <img
                        src={firstTool.logoURI}
                        alt=""
                        className="h-5 w-5 rounded-full object-contain"
                      />
                    ) : null}
                    <Label htmlFor={`route-${i}`} className="font-medium cursor-pointer">
                      {routeTitle}
                    </Label>
                    {labels.map((l) => (
                      <Badge
                        key={l}
                        variant={l === "Recommended" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {l}
                      </Badge>
                    ))}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex text-muted-foreground cursor-help">
                          <Info className="h-3.5 w-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        {explanation}
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>
                      {(r as Route & { depositAmountOut?: string }).depositAmountOut
                        ? `Deposit: ${formatVaultUnits(BigInt((r as Route & { depositAmountOut: string }).depositAmountOut))} USDC`
                        : `Receive: ${formatVaultUnits(BigInt(r.toAmount))} USDC`}
                    </span>
                    <span>Est. time: {estTime}</span>
                    <span>Total fees: {totalFees}</span>
                    <span>Steps: {r.steps.length}</span>
                  </div>

                  {feeLines.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                      {feeLines.map((line, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{line.label}</span>
                          <span className="tabular-nums">{line.amountUSD}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {approval.required && (
                    <div className="mt-2 rounded bg-amber-500/10 border border-amber-500/30 px-2 py-1.5 text-xs">
                      <span className="font-medium">Approval required</span>
                      <div className="mt-0.5 text-muted-foreground">
                        {approval.tokenSymbol} → {approval.spenderAddress}
                        {approval.amount ? ` (exact amount)` : ""}
                      </div>
                    </div>
                  )}

                  <Collapsible
                    open={expandedIndex === i}
                    onOpenChange={(open) => setExpandedIndex(open ? i : null)}
                  >
                    <CollapsibleTrigger className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline">
                      {expandedIndex === i ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      View steps
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="mt-2 space-y-2 pl-4 border-l border-border">
                        {stepDetails.map((step, idx) => (
                          <li key={idx} className="text-xs pl-2">
                            <div className="font-medium text-foreground">{step.toolName}</div>
                            <div className="text-muted-foreground">
                              {step.tokenIn} → {step.tokenOut} · {getChainDisplayName(step.fromChainId)} → {getChainDisplayName(step.toChainId)}
                              {step.executionDurationSec != null && (
                                <span> · ~{step.executionDurationSec}s</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            </div>
          );
        })}
      </RadioGroup>
    </TooltipProvider>
  );
}
