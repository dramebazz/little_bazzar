import { randomBytes, scryptSync } from "node:crypto";
import { stdin, stdout } from "node:process";

const N = 16_384;
const r = 8;
const p = 1;
const keyLength = 64;
const maxmem = 64 * 1024 * 1024;

if (!stdin.isTTY || !stdout.isTTY) {
  console.error("Run this helper in an interactive terminal so the password is not echoed or saved in shell history.");
  process.exit(1);
}

function readSecret(prompt) {
  return new Promise((resolve, reject) => {
    stdout.write(prompt);
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    const onData = chunk => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") {
          cleanup();
          stdout.write("\n");
          reject(new Error("Cancelled"));
          process.exit(130);
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }
        if (char >= " " && char !== "\u007f") {
          value += char;
          stdout.write("*");
        }
      }
    };
    function cleanup() {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    }
    stdin.on("data", onData);
  });
}

try {
  const password = await readSecret("New store-admin password (12–128 characters): ");
  const confirmation = await readSecret("Confirm password: ");
  if (password.length < 12 || password.length > 128) throw new Error("Password must be between 12 and 128 characters.");
  if (password !== confirmation) throw new Error("Passwords do not match.");

  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, keyLength, { N, r, p, maxmem });
  const hash = ["scrypt", N, r, p, salt.toString("base64url"), derived.toString("base64url")].join("$");
  console.log("\nCopy this hash into the Vercel STORE_ADMIN_PASSWORD_HASH environment variable:\n");
  console.log(hash);
  console.log("\nThe original password is not stored in this project or printed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unable to create the password hash.");
  process.exitCode = 1;
}
