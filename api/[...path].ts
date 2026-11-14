import { createApiApp } from "../server/_core/app.js";

const app = createApiApp();

export default function handler(req: unknown, res: unknown) {
  app(req as never, res as never);
}
