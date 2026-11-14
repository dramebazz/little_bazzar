import type { Request, Response } from "express";

export default async function debugImport(_req: Request, res: Response) {
  try {
    await import("../server/routers.js");
    res.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
}
