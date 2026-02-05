import { Badge } from "@/components/ui/badge";
import { VaultStatsCard } from "@/components/uniyield/VaultStatsCard";
import { DepositCard } from "@/components/uniyield/DepositCard";
import { PortfolioCard } from "@/components/uniyield/PortfolioCard";
import { StrategiesTable } from "@/components/uniyield/StrategiesTable";
import { AdminPanel } from "@/components/uniyield/AdminPanel";
import { DEMO_MODE } from "@/config/uniyield";

export default function UniYieldPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">UniYield Vault</h1>
        {DEMO_MODE && (
          <Badge variant="secondary">Demo Mode</Badge>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <DepositCard />
          <PortfolioCard />
        </div>
        <div className="space-y-6">
          <VaultStatsCard />
          <StrategiesTable />
        </div>
      </div>

      <AdminPanel />
    </div>
  );
}
