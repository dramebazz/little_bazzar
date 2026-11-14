import { readdir } from "node:fs/promises";
import type { Request, Response } from "express";

export default async function debugImport(_req: Request, res: Response) {
  try {
    const root = await readdir("/var/task");
    const server = await readdir("/var/task/server").catch(() => []);
    res.status(200).json({ root, server });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
}
