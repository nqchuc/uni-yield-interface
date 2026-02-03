import { useAccount } from "wagmi";
import { MetricCard } from "@/components/MetricCard";
import { AllocationBar } from "@/components/AllocationBar";
import { ActivityTable } from "@/components/ActivityTable";
import { useVaultData, usePortfolioVaultMetrics } from "@/hooks/useVaultData";

const activities = [
  {
    date: "Feb 1, 2026",
    amount: "5,000 USDC",
    shares: "4,993.35 uyUSDC",
    status: "completed" as const,
  },
  {
    date: "Jan 28, 2026",
    amount: "2,500 USDC",
    shares: "2,496.73 uyUSDC",
    status: "completed" as const,
  },
  {
    date: "Jan 15, 2026",
    amount: "10,000 USDC",
    shares: "9,987.00 uyUSDC",
    status: "completed" as const,
  },
];

export default function PortfolioPage() {
  const { address } = useAccount();
  const { allocations, isLoading: allocationsLoading } = useVaultData();
  const {
    sharesFormatted,
    usdcFormatted,
    currentAPY,
    activeProtocol,
    isLoading: metricsLoading,
  } = usePortfolioVaultMetrics(address ?? null);

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Portfolio
        </h1>
        <p className="mt-2 text-muted-foreground">
          Your vault position and activity.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="infra-label mb-4">Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Vault Shares"
            value={metricsLoading ? "…" : sharesFormatted}
            subValue="uyUSDC"
          />
          <MetricCard
            label="USDC Value"
            value={metricsLoading ? "…" : `$${usdcFormatted}`}
            subValue=""
          />
          <MetricCard
            label="Current APY"
            value={metricsLoading ? "…" : currentAPY}
            highlight
          />
          <MetricCard
            label="Active Protocol"
            value={metricsLoading ? "…" : activeProtocol}
          />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="infra-label mb-4">Allocation</h2>
        <div className="infra-card p-6">
          <AllocationBar allocations={allocationsLoading ? [] : allocations} />
          <p className="mt-4 text-xs text-muted-foreground">
            Allocation updates automatically based on yield conditions.
          </p>
        </div>
      </section>

      <section>
        <h2 className="infra-label mb-4">Activity</h2>
        <div className="infra-card p-6">
          <ActivityTable activities={activities} />
        </div>
      </section>
    </div>
  );
}
