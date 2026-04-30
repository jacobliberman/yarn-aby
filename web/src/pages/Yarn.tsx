import type { Yarn as YarnRow } from "@yarn-aby/shared";
import { useCallback, useEffect, useState } from "react";

import { useAuthorizedFetch } from "../hooks/useAuthorizedFetch.ts";

export function Yarn() {
  const authFetch = useAuthorizedFetch();
  const [rows, setRows] = useState<YarnRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await authFetch("/yarn");
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as YarnRow[];
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load yarn");
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
      brand: String(fd.get("brand") ?? ""),
      colorway: String(fd.get("colorway") ?? ""),
      weight: String(fd.get("weight") ?? ""),
      skeins: Number(fd.get("skeins")),
      fiber: emptyToNull(fd.get("fiber")),
      yardage: numOrNull(fd.get("yardage")),
      notes: emptyToNull(fd.get("notes")),
    };

    try {
      const res = await authFetch("/yarn", {
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
      const res = await authFetch(`/yarn/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <section aria-labelledby="yarn-heading" style={{ marginBottom: "2rem" }}>
      <h2 id="yarn-heading">Yarn</h2>
      {error ? (
        <p role="alert" style={{ color: "crimson" }}>
          {error}
        </p>
      ) : null}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <ul style={{ paddingLeft: "1.25rem" }}>
          {rows.map((y) => (
            <li key={y.id} style={{ marginBottom: "0.5rem" }}>
              <strong>
                {y.brand} — {y.colorway}
              </strong>{" "}
              ({y.weight}, {y.skeins} skeins
              {y.yardage != null ? `, ${y.yardage} yd/skein` : ""})
              <button
                type="button"
                style={{ marginLeft: "0.5rem" }}
                onClick={() => void remove(y.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      <h3 style={{ fontSize: "1rem" }}>Add yarn</h3>
      <form
        onSubmit={(ev) => void onCreate(ev)}
        style={{
          display: "grid",
          gap: "0.5rem",
          maxWidth: "24rem",
        }}
      >
        <label>
          Brand{" "}
          <input name="brand" required style={{ width: "100%" }} />
        </label>
        <label>
          Colorway{" "}
          <input name="colorway" required style={{ width: "100%" }} />
        </label>
        <label>
          Weight{" "}
          <input name="weight" required placeholder="DK, worsted…" style={{ width: "100%" }} />
        </label>
        <label>
          Skeins{" "}
          <input name="skeins" type="number" step="any" required style={{ width: "100%" }} />
        </label>
        <label>
          Yd/skein (optional){" "}
          <input name="yardage" type="number" style={{ width: "100%" }} />
        </label>
        <label>
          Fiber (optional){" "}
          <input name="fiber" style={{ width: "100%" }} />
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
