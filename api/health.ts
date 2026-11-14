import type { HttpResponse } from "../server/_core/httpTypes.js";

export default function health(_req: unknown, rawResponse: unknown) {
  const res = rawResponse as HttpResponse;
  res.status(200).json({ status: "ok" });
}
