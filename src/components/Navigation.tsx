import { Link, useLocation } from "react-router-dom";
import { ChevronDown, LogOut, Wallet } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Vault", path: "/" },
  { label: "UniYield", path: "/uniyield" },
  { label: "Portfolio", path: "/portfolio" },
  { label: "How it works", path: "/how-it-works" },
];

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function Navigation() {
  const location = useLocation();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const injected = connectors.find((c) => c.type === "injected");

  const handleConnect = () => {
    if (injected) connect({ connector: injected });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 shadow-sm">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-90"
        >
          <span className="flex h-9 flex-shrink-0 items-center" aria-hidden>
            <img
              src="/assets/images/uniyield.svg"
              alt="UniYield"
              className="h-full w-auto max-h-9 object-contain object-left"
              height={36}
              fetchPriority="high"
            />
          </span>
          <span className="hidden truncate text-lg font-semibold tracking-tight text-foreground sm:inline">
            UniYield
          </span>
        </Link>

        <nav className="flex items-center rounded-full border border-border/60 bg-muted/30 p-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {isConnected && address ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 rounded-full border-border/60 bg-muted/30 px-4 font-medium shadow-none transition-all hover:border-border hover:bg-muted/50"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                    <Wallet className="h-3 w-3 text-primary" />
                  </span>
                  <span className="tabular-nums">{truncateAddress(address)}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl border-border/80 shadow-lg">
                <DropdownMenuItem
                  className="gap-2 text-muted-foreground cursor-default"
                  disabled
                >
                  {address}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 focus:bg-destructive/10 focus:text-destructive"
                  onClick={() => disconnect()}
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              size="sm"
              className="h-9 rounded-full px-4 font-medium shadow-sm transition-all hover:shadow-md"
              disabled={!injected || isPending}
              onClick={handleConnect}
            >
              <Wallet className="h-4 w-4" />
              <span>{isPending ? "Connecting…" : "Connect Wallet"}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
