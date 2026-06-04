export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

const BOOLEAN_FLAGS = new Set(["json", "help", "version", "unread-only", "mine"]);

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const body = a.slice(2);
      // `--key=value` form (value may itself contain `=`, e.g. a URL query).
      const eq = body.indexOf("=");
      if (eq !== -1) { flags[body.slice(0, eq)] = body.slice(eq + 1); continue; }
      const key = body;
      if (BOOLEAN_FLAGS.has(key)) { flags[key] = true; continue; }
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) { flags[key] = true; }
      else { flags[key] = next; i++; }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}
