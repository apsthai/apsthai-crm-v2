// Read-only MCP connector for the organisation's advisor (Bee7), owner-approved 17 Nov 2026.
// It connects as the Postgres role advisor_ro (ADVISOR_DATABASE_URL), which can only SELECT the views in the
// `analytics` schema: no contact details. The database grant is the real guard. Every query also runs alone in a
// READ ONLY transaction that is rolled back. Nothing about queries or results is logged here.
import { createHash, timingSafeEqual } from "node:crypto";
import { Pool, types } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 500;
let pool: Pool | null = null;
function db() {
  // Supabase's pooler needs TLS; its certificate chain is not in Node's store, so it is not verified.
  pool ??= new Pool({ connectionString: process.env.ADVISOR_DATABASE_URL, max: 3, ssl: { rejectUnauthorized: false } });
  return pool;
}

// Dates and times stay as the database text, so nothing shifts with the server's time zone.
const raw = (v: string) => v;
const parser = (oid: number, format?: "text" | "binary") =>
  [1082, 1114, 1184].includes(oid) ? raw : types.getTypeParser(oid, format as "text");

function tokenOk(given: string) {
  const want = process.env.ADVISOR_MCP_TOKEN;
  if (!want || want.length < 24) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(want).digest();
  return timingSafeEqual(a, b);
}

const INSTRUCTIONS = `APSthai CRM, read-only, for the advisor. Data is in Postgres views (schema analytics).
Call list_views first to see the views and columns, then run_query with one SELECT.
Business notes: the cycle runs September to August (2026-27 = 1 Sep 2026 to 31 Aug 2027). A case is one service for one
student; overall_status 'success' means enrolled / done, and closed_date is when. Money in is payments.received_thb (THB,
incl. VAT). receivables are amounts to collect (status expected = not billed yet). Staff points come from points_ledger,
KPI from kpi_targets. Contact details are not available by design.`;

const TOOLS = [
  {
    name: "list_views",
    description: "List every view you can query, with its columns and types.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "run_query",
    description: `Run one read-only SELECT (or WITH ... SELECT) on the analytics views. Returns up to ${MAX_ROWS} rows as JSON. Use date_trunc, sums and joins freely.`,
    inputSchema: {
      type: "object",
      properties: { sql: { type: "string", description: "A single SELECT statement, no semicolons." } },
      required: ["sql"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
];

async function readOnly(sql: string) {
  const client = await db().connect();
  try {
    await client.query("begin read only");
    await client.query("set local statement_timeout = '15s'");
    // values: [] makes pg use the extended protocol, which accepts exactly one statement.
    const res = await client.query({ text: sql, values: [], types: { getTypeParser: parser } });
    return res;
  } finally {
    await client.query("rollback").catch(() => {});
    client.release();
  }
}

async function callTool(name: string, args: Record<string, unknown>) {
  if (name === "list_views") {
    const res = await readOnly(`select table_name as view, string_agg(column_name || ' ' || data_type, ', ' order by ordinal_position) as columns
      from information_schema.columns where table_schema = 'analytics' group by table_name order by table_name`);
    return res.rows.map((r) => `${r.view}: ${r.columns}`).join("\n");
  }
  if (name === "run_query") {
    const sql = String(args.sql ?? "").trim().replace(/;+\s*$/, "");
    if (!/^(select|with)\b/i.test(sql)) throw new Error("Only a single SELECT (or WITH ... SELECT) is allowed");
    if (sql.includes(";")) throw new Error("One statement only, without semicolons");
    const res = await readOnly(`select * from (${sql}) as q limit ${MAX_ROWS + 1}`);
    const rows = res.rows.slice(0, MAX_ROWS);
    const more = res.rows.length > MAX_ROWS ? `\n(first ${MAX_ROWS} rows only: add filters or aggregate)` : "";
    return JSON.stringify(rows) + more;
  }
  throw new Error(`Unknown tool ${name}`);
}

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

async function handle(msg: Rpc) {
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id ?? null, result });
  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      const known = ["2025-06-18", "2025-03-26", "2024-11-05"];
      return ok({
        protocolVersion: known.includes(asked) ? asked : known[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "apsthai-crm-advisor", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        return ok({ content: [{ type: "text", text: await callTool(name, args) }] });
      } catch (e) {
        // Tool errors go back to the caller only.
        return ok({ content: [{ type: "text", text: e instanceof Error ? e.message : "Query failed" }], isError: true });
      }
    }
    default:
      return { jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32601, message: "Method not found" } };
  }
}

const notFound = () => new Response("Not found", { status: 404 });

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!tokenOk((await params).token) || !process.env.ADVISOR_DATABASE_URL) return notFound();
  let body: Rpc | Rpc[];
  try { body = await req.json(); } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const list = Array.isArray(body) ? body : [body];
  // Notifications (no id) get no answer.
  const answers = await Promise.all(list.filter((m) => m.id !== undefined && m.id !== null).map(handle));
  if (!answers.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? answers : answers[0]);
}

// No server-to-client stream: the connector only answers requests.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!tokenOk((await params).token)) return notFound();
  return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!tokenOk((await params).token)) return notFound();
  return new Response(null, { status: 204 });
}
