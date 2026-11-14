import type { Request, Response } from "express";
import { createApiApp } from "../server/_core/app.js";

const app = createApiApp();

export default function handler(req: Request, res: Response) {
  app(req, res);
}
