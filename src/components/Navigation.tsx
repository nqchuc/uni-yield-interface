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

const navItems = [
  { label: "Vault", path: "/" },
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
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 flex-shrink-0 items-center" aria-hidden>
            <img
              src="/assets/images/uniyield.svg"
              alt="UniYield"
              className="h-full w-auto max-h-8 object-contain object-left"
              height={32}
              fetchPriority="high"
            />
          </span>
          <span className="truncate text-lg font-semibold tracking-tight text-foreground">
            UniYield
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? "text-foreground bg-muted"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {isConnected && address ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Wallet className="h-4 w-4" />
                <span className="tabular-nums">{truncateAddress(address)}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="gap-2 text-muted-foreground"
                disabled
              >
                {address}
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => disconnect()}>
                <LogOut className="h-4 w-4" />
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!injected || isPending}
            onClick={handleConnect}
          >
            <Wallet className="h-4 w-4" />
            <span>{isPending ? "Connecting…" : "Connect Wallet"}</span>
          </Button>
        )}
      </div>
    </header>
  );
}
