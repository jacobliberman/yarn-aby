import type { Project, ProjectDetailResponse } from "@yarn-aby/shared";
import { useCallback, useEffect, useState } from "react";

import { useAuthorizedFetch } from "../hooks/useAuthorizedFetch.ts";

export function Projects() {
  const authFetch = useAuthorizedFetch();
  const [rows, setRows] = useState<Project[]>([]);
  const [detail, setDetail] = useState<ProjectDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await authFetch("/projects");
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as Project[];
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadDetail(id: number) {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/projects/${id}`);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as ProjectDetailResponse;
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load project");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const patternRaw = fd.get("patternId");
    const yarnRaw = fd.get("yarnId");
    const skeinsRaw = fd.get("skeinsUsed");
    const patternId =
      patternRaw == null || String(patternRaw) === ""
        ? null
        : Number.parseInt(String(patternRaw), 10);
    const yarnId =
      yarnRaw == null || String(yarnRaw) === ""
        ? null
        : Number.parseInt(String(yarnRaw), 10);

    const body: Record<string, unknown> = {
      title: String(fd.get("title") ?? ""),
      status: String(fd.get("status") ?? "wip"),
      notes: emptyToNull(fd.get("notes")),
    };
    if (patternId != null && Number.isFinite(patternId)) {
      body.patternId = patternId;
    } else {
      body.patternId = null;
    }
    if (yarnId != null && Number.isFinite(yarnId)) {
      body.yarnLinks = [
        {
          yarnId,
          skeinsUsed:
            skeinsRaw == null || String(skeinsRaw) === ""
              ? null
              : Number(String(skeinsRaw)),
        },
      ];
    }

    try {
      const res = await authFetch("/projects", {
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
      const res = await authFetch(`/projects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      if (detail?.project.id === id) {
        setDetail(null);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <section aria-labelledby="projects-heading" style={{ marginBottom: "2rem" }}>
      <h2 id="projects-heading">Projects</h2>
      {error ? (
        <p role="alert" style={{ color: "crimson" }}>
          {error}
        </p>
      ) : null}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <ul style={{ paddingLeft: "1.25rem" }}>
          {rows.map((p) => (
            <li key={p.id} style={{ marginBottom: "0.5rem" }}>
              <strong>{p.title}</strong> ({p.status}
              {p.patternId != null ? `, pattern #${p.patternId}` : ""})
              <button
                type="button"
                style={{ marginLeft: "0.5rem" }}
                onClick={() => void loadDetail(p.id)}
              >
                Detail
              </button>
              <button
                type="button"
                style={{ marginLeft: "0.5rem" }}
                onClick={() => void remove(p.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      {detailLoading ? <p>Loading detail…</p> : null}
      {detail ? (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            background: "#f8f8f8",
            borderRadius: "4px",
          }}
        >
          <h3 style={{ fontSize: "1rem", marginTop: 0 }}>Selected project</h3>
          <p style={{ fontSize: "0.9rem" }}>
            {detail.project.title} — {detail.project.status}
          </p>
          {detail.pattern ? (
            <p style={{ fontSize: "0.9rem" }}>
              Pattern: {detail.pattern.title} ({detail.pattern.craftType})
            </p>
          ) : null}
          <p style={{ fontSize: "0.9rem" }}>Yarn links:</p>
          <ul style={{ fontSize: "0.85rem" }}>
            {detail.yarnLinks.length === 0 ? (
              <li>None</li>
            ) : (
              detail.yarnLinks.map((l) => (
                <li key={l.id}>
                  #{l.yarnId}
                  {l.yarn
                    ? `: ${l.yarn.brand} ${l.yarn.colorway} (${l.skeinsUsed ?? "—"} skeins used)`
                    : null}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
      <h3 style={{ fontSize: "1rem", marginTop: "1.25rem" }}>Add project</h3>
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
          Status{" "}
          <select name="status" style={{ width: "100%" }}>
            <option value="wip">WIP</option>
            <option value="finished">Finished</option>
            <option value="frogged">Frogged</option>
          </select>
        </label>
        <label>
          Pattern ID (optional){" "}
          <input name="patternId" type="number" style={{ width: "100%" }} />
        </label>
        <label>
          Yarn ID (optional, links inventory){" "}
          <input name="yarnId" type="number" style={{ width: "100%" }} />
        </label>
        <label>
          Skeins used on that yarn (optional){" "}
          <input name="skeinsUsed" type="number" step="any" style={{ width: "100%" }} />
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
