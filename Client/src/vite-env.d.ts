/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: 'development' | 'stage' | 'production';
  readonly VITE_AUTH_API_URL: string;
  /** Base URL of the ClinSync scan server (Server/), e.g. http://localhost:8000 */
  readonly VITE_SCAN_API_URL?: string;
  readonly VITE_MAX_UPLOAD_FILE_SIZE_MB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '@/playground' {
  import type { ComponentType } from 'react';

  export const Playground: ComponentType;
}
