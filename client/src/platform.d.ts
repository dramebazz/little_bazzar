export {};
declare global {
  interface Window {
    __STORE_CONFIG__?: {
      publicApiUrl: string;
      publicApiKey: string;
    };
  }
}
