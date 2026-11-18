/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GATEWAY_URL: string;
  readonly VITE_NOTIFICATIONS_URL: string;
  readonly VITE_BIBLIOTECA_URL?: string;
  readonly VITE_EVENTOS_URL?: string;
  readonly VITE_AUTH_PROXY?: string;
}
