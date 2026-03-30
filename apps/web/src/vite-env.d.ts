/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEMO_PASSWORD?: string;
  readonly VITE_DEV_ROLE?: string;
  readonly VITE_DEV_USER_ID?: string;
  readonly VITE_DEV_USERNAME?: string;
  readonly VITE_DEV_DISPLAY_NAME?: string;
  readonly VITE_DEV_SESSION_EXPIRES_AT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
