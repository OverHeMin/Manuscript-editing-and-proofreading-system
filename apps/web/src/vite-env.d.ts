/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly DEV: boolean;
  readonly MODE: string;
  readonly PROD: boolean;
  readonly SSR: boolean;
  readonly VITE_APP_ENV?: string;
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

declare module "*.css" {
  const href: string;
  export default href;
}
