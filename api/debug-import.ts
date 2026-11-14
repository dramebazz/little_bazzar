import express from "express";
import type { Request, Response } from "express";

export default function debugImport(_req: Request, res: Response) {
  try {
    res.status(200).json({ ok: typeof express === "function" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
}
