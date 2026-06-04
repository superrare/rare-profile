import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { text } from "node:stream/consumers";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../../dist/bin.js", import.meta.url));

export interface CliResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  const home = await mkdtemp(join(tmpdir(), "rare-profile-test-home-"));
  try {
    return await fn(home);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

export async function runCli(
  args: string[],
  opts: {
    home?: string;
    env?: NodeJS.ProcessEnv;
    input?: string;
    timeoutMs?: number;
  } = {},
): Promise<CliResult> {
  const child = spawn(process.execPath, [cliPath, ...args], {
    env: {
      ...process.env,
      HOME: opts.home ?? process.env.HOME,
      USERPROFILE: opts.home ?? process.env.USERPROFILE,
      ...opts.env,
    },
    stdio: [opts.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  });
  if (opts.input !== undefined) child.stdin?.end(opts.input);
  const stdoutP = text(child.stdout!);
  const stderrP = text(child.stderr!);
  const code = await new Promise<number | null>((resolve, reject) => {
    const timer = setTimeout(
      () => {
        child.kill("SIGTERM");
        reject(new Error(`CLI timed out: rare-profile ${args.join(" ")}`));
      },
      opts.timeoutMs ?? 30_000,
    );
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (c) => {
      clearTimeout(timer);
      resolve(c);
    });
  });
  return { code, stdout: await stdoutP, stderr: await stderrP };
}

/** Parse the LAST non-empty stdout line as JSON (commands may emit progress lines before the final result). */
export function parseJsonStdout<T = Record<string, unknown>>(result: CliResult): T {
  const lines = result.stdout.split("\n").filter((l) => l.trim() !== "");
  const last = lines[lines.length - 1] ?? "";
  return JSON.parse(last) as T;
}
