# UniYield Interface

Frontend for **UniYield** — an ERC-4626 USDC vault on Ethereum. Users deposit USDC from any chain (cross-chain via LI.FI); the vault allocates to Aave, Morpho, and Compound; users hold one ERC-4626 share token on Ethereum.

This repo is the Web3 dashboard UI: vault deposit flow, bridge mode (LI.FI debug), portfolio view, UniYield Diamond page (mock/onchain), and explanatory pages.

---

## Tech

- **Vite** + **React** + **TypeScript**
- **React Router** for routes
- **TanStack Query** for data
- **wagmi** + **viem** for chain/wallet
- **LI.FI SDK** for cross-chain quotes and execution
- **shadcn/ui** (Radix) + **Tailwind CSS** for UI

---

## Environment

Create a `.env` (or `.env.local`) with optional Vite vars:

| Variable | Description |
|----------|-------------|
| `VITE_DEMO_MODE` | `true` = use mock vault/data |
| `VITE_USE_MOCK_VAULT` | `false` = use onchain vault (default mock) |
| `VITE_UNIYIELD_VAULT_ADDRESS` | Deployed vault (Diamond) address |
| `VITE_CHAIN_ID` | Chain ID for vault (e.g. `1`) |
| `VITE_USDC_ADDRESS` | Optional; can be read from vault |
| `VITE_LIFI_API_KEY` | Optional; for LI.FI API |

---

## Codebase layout

```
src/
├── main.tsx                 # Entry, React root (Wagmi + QueryClient)
├── App.tsx                  # Router, providers, route definitions
├── index.css                # Global styles
│
├── config/
│   └── uniyield.ts          # UniYield env + strategy display names
│
├── pages/
│   ├── VaultPage.tsx        # Main deposit (/, vault) + Bridge mode
│   ├── UniYieldPage.tsx     # UniYield Diamond UI (/uniyield)
│   ├── PortfolioPage.tsx    # Portfolio + allocation + activity
│   ├── HowItWorksPage.tsx   # Explainer
│   └── NotFound.tsx
│
├── components/
│   ├── Layout.tsx           # App shell (nav + outlet)
│   ├── Navigation.tsx       # Top nav
│   ├── ChainSelector.tsx    # Source chain (with logos)
│   ├── StrategyTable.tsx    # Protocol / APY table
│   ├── RouteList.tsx        # LI.FI routes (tools, fees, steps, labels)
│   ├── TransactionProgress.tsx
│   ├── uniyield/            # UniYield Diamond components
│   │   ├── VaultStatsCard.tsx
│   │   ├── DepositCard.tsx
│   │   ├── PortfolioCard.tsx
│   │   ├── StrategiesTable.tsx
│   │   └── AdminPanel.tsx
│   └── ui/                  # shadcn primitives
│
├── hooks/
│   ├── useVaultData.ts      # Vault strategies / summary / balance
│   ├── useLifiTools.ts      # LI.FI tools cache for route UI
│   └── ...
│
├── lib/
│   ├── wagmi.ts             # Wagmi config (chains, transports)
│   ├── vault.ts             # Vault read/write + mock gate
│   ├── lifi.ts              # LI.FI SDK config + chain/USDC re-exports
│   ├── chains.ts            # Chain IDs + USDC by chain
│   ├── lifiClient.ts        # getQuoteBridgeToSelf, getLifiStatus
│   ├── lifiTools.ts         # LI.FI tools fetch + cache (getToolByKey)
│   ├── routeUtils.ts        # Route rankings, fee breakdown, approval info
│   └── uniyield/            # UniYield client (mock + onchain), provider, hooks
│
├── abis/                    # Contract ABIs (vault, Diamond, ERC20)
├── mocks/                   # Mock vault state (uniyieldMock)
└── test/
```

---

## Routes

| Path | Page |
|------|------|
| `/` | Vault — deposit from any chain; destination: UniYield or Bridge to wallet |
| `/uniyield` | UniYield Diamond — stats, deposit, portfolio, strategies, admin |
| `/portfolio` | Portfolio + allocation + activity |
| `/how-it-works` | Explainer |

---

## Deposit flow (Vault page)

- **Destination mode**
  - **Deposit into UniYield** — cross-chain or same-chain deposit into the vault (requires deployed vault address).
  - **Bridge mode** — “Bridge USDC to my Ethereum wallet”: LI.FI routes from selected chain to your wallet on Ethereum (for testing LI.FI before vault is live).
- **Bridge mode UI:** Get routes → pick route (with tool names, fees, labels like Fastest/Cheapest) → Bridge USDC. Stepper: Approve (if needed) → Execute → Complete.

---

## Commands

```sh
npm i
npm run dev      # Dev server
npm run build    # Production build
npm run preview  # Preview production build
npm run test     # Run tests
npm run lint     # Lint
```
