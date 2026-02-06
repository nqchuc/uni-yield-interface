import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CHAIN_ID_BY_KEY } from "@/lib/lifi";

/** Path to chain logo SVG in public assets (id matches filename prefix, e.g. ethereum -> ethereum-logo.svg). */
function chainLogoPath(id: string): string {
  return `/assets/images/${id}-logo.svg`;
}

const chains = [
  { id: "base", name: "Base", chainId: CHAIN_ID_BY_KEY.base },
  { id: "arbitrum", name: "Arbitrum", chainId: CHAIN_ID_BY_KEY.arbitrum },
  { id: "polygon", name: "Polygon", chainId: CHAIN_ID_BY_KEY.polygon },
  { id: "ethereum", name: "Ethereum", chainId: CHAIN_ID_BY_KEY.ethereum },
  { id: "bnb", name: "BNB Chain", chainId: CHAIN_ID_BY_KEY.bnb },
  { id: "optimism", name: "Optimism", chainId: CHAIN_ID_BY_KEY.optimism },
];

function ChainIcon({ id, className }: { id: string; className?: string }) {
  return (
    <img
      src={chainLogoPath(id)}
      alt=""
      width={24}
      height={24}
      className={className}
      onError={(e) => {
        e.currentTarget.style.display = "none";
        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
        if (fallback) fallback.style.display = "inline-flex";
      }}
    />
  );
}

function ChainFallback({ name }: { name: string }) {
  return (
    <span
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium"
      style={{ display: "none" }}
      aria-hidden
    >
      {name.slice(0, 1)}
    </span>
  );
}

interface ChainSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Chain IDs that are disabled and show "Coming soon" */
  comingSoonChains?: string[];
}

export function ChainSelector({ value, onValueChange, comingSoonChains = [] }: ChainSelectorProps) {
  const selectedChain = chains.find((c) => c.id === value);
  const isComingSoon = (chainId: string) => comingSoonChains.includes(chainId);

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full bg-background">
        <SelectValue>
          {selectedChain && (
            <span className="flex items-center gap-2">
              <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center">
                <ChainIcon id={selectedChain.id} className="h-6 w-6 rounded-full" />
                <ChainFallback name={selectedChain.name} />
              </span>
              <span>{selectedChain.name}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover">
        {chains.map((chain) => {
          const comingSoon = isComingSoon(chain.id);
          return (
            <SelectItem key={chain.id} value={chain.id} disabled={comingSoon}>
              <span className="flex items-center gap-2">
                <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center">
                  <ChainIcon id={chain.id} className="h-6 w-6 rounded-full" />
                  <ChainFallback name={chain.name} />
                </span>
                <span>{chain.name}</span>
                {comingSoon && (
                  <Badge variant="secondary" className="text-xs ml-1">
                    Coming soon
                  </Badge>
                )}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
