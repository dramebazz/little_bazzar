const fieldLabels: Record<string, string> = {
  address: "Address",
  city: "City",
  customerName: "Name",
  email: "Email",
  name: "Name",
  password: "Password",
  phone: "Phone number",
  pincode: "PIN code",
  securityAnswer: "Security answer",
};

function labelFor(path: unknown[]) {
  const field = path.findLast(value => typeof value === "string");
  return fieldLabels[String(field)] ?? (typeof field === "string" ? field : "This field");
}

function parseValidationMessage(message: string) {
  try {
    const parsed: unknown = JSON.parse(message);
    const issue = Array.isArray(parsed)
      ? parsed[0]
      : parsed && typeof parsed === "object" && "issues" in parsed && Array.isArray(parsed.issues)
        ? parsed.issues[0]
        : undefined;
    if (!issue || typeof issue !== "object") return null;
    const item = issue as { code?: string; path?: unknown[]; message?: string; minimum?: number; maximum?: number };
    const label = labelFor(item.path ?? []);
    if (item.code === "too_small" && typeof item.minimum === "number") return `${label} must be at least ${item.minimum} characters.`;
    if (item.code === "too_big" && typeof item.maximum === "number") return `${label} must be ${item.maximum} characters or fewer.`;
    if (item.code === "invalid_type") return `${label} is required.`;
    if (typeof item.message === "string" && item.message !== message) return item.message;
  } catch {
    return null;
  }
  return null;
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return parseValidationMessage(message) ?? (message && !message.trim().startsWith("{") && !message.trim().startsWith("[") ? message : fallback);
}
