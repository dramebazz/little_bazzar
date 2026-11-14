export type HttpRequest = {
  headers: Record<string, string | string[] | undefined>;
};

export type HttpResponse = {
  headersSent: boolean;
  cookie(name: string, value: string, options: Record<string, unknown>): void;
  clearCookie(name: string, options: Record<string, unknown>): void;
  json(body: unknown): unknown;
  send(body: string): unknown;
  setHeader(name: string, value: string): void;
  set(field: string, value: string): HttpResponse;
  status(code: number): HttpResponse;
  type(value: string): HttpResponse;
};
