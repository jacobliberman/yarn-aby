import type { Pattern, YardageCheckResult } from "@yarn-aby/shared";
import { useCallback, useEffect, useState } from "react";

import { useAuthorizedFetch } from "../hooks/useAuthorizedFetch.ts";

export function Patterns() {
  const authFetch = useAuthorizedFetch();
  const [rows, setRows] = useState<Pattern[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [yardageById, setYardageById] = useState<
    Record<number, YardageCheckResult | "loading" | string>
  >({});

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await authFetch("/patterns");
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as Pattern[];
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load patterns");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      title: String(fd.get("title") ?? ""),
      craftType: String(fd.get("craftType") ?? "knit"),
      designer: emptyToNull(fd.get("designer")),
      yarnWeight: emptyToNull(fd.get("yarnWeight")),
      yardageNeeded: numOrNull(fd.get("yardageNeeded")),
      notes: emptyToNull(fd.get("notes")),
    };

    try {
      const res = await authFetch("/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? (await res.text()));
      }
      e.currentTarget.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function remove(id: number) {
    setError(null);
    try {
      const res = await authFetch(`/patterns/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      setYardageById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function yardageCheck(id: number) {
    setYardageById((p) => ({ ...p, [id]: "loading" }));
    try {
      const res = await authFetch(`/patterns/${id}/yardage-check`);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as YardageCheckResult;
      setYardageById((p) => ({ ...p, [id]: data }));
    } catch (e) {
      setYardageById((p) => ({
        ...p,
        [id]: e instanceof Error ? e.message : "Yardage check failed",
      }));
    }
  }

  return (
    <section aria-labelledby="patterns-heading" style={{ marginBottom: "2rem" }}>
      <h2 id="patterns-heading">Patterns</h2>
      {error ? (
        <p role="alert" style={{ color: "crimson" }}>
          {error}
        </p>
      ) : null}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <ul style={{ paddingLeft: "1.25rem" }}>
          {rows.map((p) => {
            const yd = yardageById[p.id];
            return (
              <li key={p.id} style={{ marginBottom: "0.75rem" }}>
                <strong>{p.title}</strong> ({p.craftType}
                {p.designer ? `, ${p.designer}` : ""})
                {p.yardageNeeded != null ? ` — ${p.yardageNeeded} yd needed` : ""}
                <div style={{ marginTop: "0.25rem" }}>
                  <button type="button" onClick={() => void yardageCheck(p.id)}>
                    Yardage check
                  </button>
                  <button
                    type="button"
                    style={{ marginLeft: "0.5rem" }}
                    onClick={() => void remove(p.id)}
                  >
                    Delete
                  </button>
                </div>
                {yd === "loading" ? <p style={{ fontSize: "0.9rem" }}>Checking…</p> : null}
                {yd && yd !== "loading" && typeof yd === "string" ? (
                  <p style={{ fontSize: "0.9rem", color: "crimson" }}>{yd}</p>
                ) : null}
                {yd && typeof yd === "object" ? (
                  <pre
                    style={{
                      fontSize: "0.8rem",
                      background: "#f5f5f5",
                      padding: "0.5rem",
                      marginTop: "0.25rem",
                      overflow: "auto",
                    }}
                  >
                    {JSON.stringify(yd, null, 2)}
                  </pre>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <h3 style={{ fontSize: "1rem" }}>Add pattern</h3>
      <form
        onSubmit={(ev) => void onCreate(ev)}
        style={{
          display: "grid",
          gap: "0.5rem",
          maxWidth: "24rem",
        }}
      >
        <label>
          Title{" "}
          <input name="title" required style={{ width: "100%" }} />
        </label>
        <label>
          Craft{" "}
          <select name="craftType" style={{ width: "100%" }}>
            <option value="knit">Knit</option>
            <option value="crochet">Crochet</option>
          </select>
        </label>
        <label>
          Designer (optional){" "}
          <input name="designer" style={{ width: "100%" }} />
        </label>
        <label>
          Yarn weight hint (optional){" "}
          <input name="yarnWeight" style={{ width: "100%" }} />
        </label>
        <label>
          Yardage needed (optional){" "}
          <input name="yardageNeeded" type="number" style={{ width: "100%" }} />
        </label>
        <label>
          Notes (optional){" "}
          <input name="notes" style={{ width: "100%" }} />
        </label>
        <button type="submit">Add</button>
      </form>
    </section>
  );
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
