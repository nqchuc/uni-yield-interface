import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CHAIN_ID_BY_KEY } from "@/lib/lifi";

function chainLogoPath(id: string): string {
  return `/assets/images/${id}-logo.svg`;
}

const chains = [
  { id: "ethereum", name: "Ethereum", chainId: CHAIN_ID_BY_KEY.ethereum, available: true },
  { id: "base", name: "Base", chainId: CHAIN_ID_BY_KEY.base, available: false },
  { id: "arbitrum", name: "Arbitrum", chainId: CHAIN_ID_BY_KEY.arbitrum, available: false },
  { id: "polygon", name: "Polygon", chainId: CHAIN_ID_BY_KEY.polygon, available: false },
  { id: "bnb", name: "BNB Chain", chainId: CHAIN_ID_BY_KEY.bnb, available: false },
  { id: "optimism", name: "Optimism", chainId: CHAIN_ID_BY_KEY.optimism, available: false },
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

interface DestinationChainSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function DestinationChainSelector({
  value,
  onValueChange,
}: DestinationChainSelectorProps) {
  const selectedChain = chains.find((c) => c.id === value) ?? chains[0];

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
    >
      <SelectTrigger className="w-full bg-background">
        <SelectValue>
          <span className="flex items-center gap-2">
            <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center">
              <ChainIcon id={selectedChain.id} className="h-6 w-6 rounded-full" />
              <ChainFallback name={selectedChain.name} />
            </span>
            <span>{selectedChain.name}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover">
        {chains.map((chain) => (
          <SelectItem
            key={chain.id}
            value={chain.id}
            disabled={!chain.available}
          >
            <span className="flex items-center gap-2">
              <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center">
                <ChainIcon id={chain.id} className="h-6 w-6 rounded-full" />
                <ChainFallback name={chain.name} />
              </span>
              <span>{chain.name}</span>
              {!chain.available && (
                <Badge variant="secondary" className="text-xs ml-1">
                  Coming soon
                </Badge>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
