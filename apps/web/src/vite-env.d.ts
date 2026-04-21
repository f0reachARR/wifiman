/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ENABLE_DEV_OPERATOR_AUTH?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
