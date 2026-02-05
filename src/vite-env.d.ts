/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_UNIYIELD_VAULT_ADDRESS?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_USDC_ADDRESS?: string;
  readonly VITE_LIFI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
