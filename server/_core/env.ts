export const ENV = {
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get cookieSecret() { return process.env.APP_SESSION_SECRET ?? ""; },
  get storeAdminEmail() { return process.env.STORE_ADMIN_EMAIL?.trim().toLowerCase() ?? ""; },
  get storeAdminPasswordHash() { return process.env.STORE_ADMIN_PASSWORD_HASH ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  get serviceApiUrl() { return process.env.SERVICE_API_URL ?? ""; },
  get serviceApiKey() { return process.env.SERVICE_API_KEY ?? ""; },
};
