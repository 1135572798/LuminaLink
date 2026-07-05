declare global {
  interface Window {
    lumina?: {
      status: () => Promise<any>;
      dashboard: () => Promise<any>;
      assets: (query?: string, filter?: string) => Promise<any>;
      asset: (id: string) => Promise<any>;
      scan: () => Promise<any>;
      pendingTranslations: () => Promise<any>;
      agentGuide: () => Promise<any>;
      translateAsset: (id: string) => Promise<any>;
      translateAssetLive: (id: string) => Promise<any>;
      translatePending: (limit?: number) => Promise<any>;
      onTranslationProgress: (listener: (event: any) => void) => () => void;
      doctor: () => Promise<any>;
      addRoot: (pathExpression: string, kind: string) => Promise<any>;
      setTranslator: (translator: any) => Promise<any>;
      addFile: (filePath: string, category: string) => Promise<any>;
      pickFile: () => Promise<string | undefined>;
      pickDirectory: () => Promise<string | undefined>;
      openPath: (target: string) => Promise<any>;
      showItem: (target: string) => Promise<any>;
      openReader: (payload: any) => Promise<any>;
    };
  }
}

export {};
