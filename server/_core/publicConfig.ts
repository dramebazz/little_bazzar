// Only explicitly public configuration values may reach browser code.
export function storeRuntimeConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    publicApiUrl: env.PUBLIC_API_URL ?? "",
    publicApiKey: env.PUBLIC_API_KEY ?? "",
  };
}

export function storeRuntimeScript(env: NodeJS.ProcessEnv = process.env): string {
  const json = JSON.stringify(storeRuntimeConfig(env)).replaceAll("<", "\\u003c");
  return `window.__STORE_CONFIG__=${json};`;
}
