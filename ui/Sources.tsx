import { useEffect, useState } from "react";
import { api, date } from "./api.js";
import { Button, Empty, Field } from "./components.js";
import type { Source } from "../src/model.js";

export function Sources({
  cid,
  sources,
  reload,
  act,
  showForm,
  setShowForm,
  read,
}: {
  cid: string;
  sources: Source[];
  reload: () => Promise<void>;
  act: (f: () => Promise<any>) => Promise<void>;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  read: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [documents, setDocuments] = useState<any[]>([]),
    [jobs, setJobs] = useState<any[]>([]),
    [job, setJob] = useState<any>(null);
  async function inspect(sid: string) {
    setSelected(sid);
    const [d, j] = await Promise.all([
      api(`/sources/${sid}/documents`),
      api(`/sources/${sid}/jobs`),
    ]);
    setDocuments(d.documents);
    setJobs(j.jobs);
    setJob(j.jobs.length ? await api(`/jobs/${j.jobs[0].id}`) : null);
  }
  useEffect(() => {
    setSelected(null);
    setJob(null);
  }, [cid]);
  useEffect(() => {
    if (!selected || job?.job.status !== "running") return;
    const timer = setInterval(() => {
      void inspect(selected).catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [selected, job?.job.status]);
  async function save(form: HTMLFormElement) {
    const d = new FormData(form);
    await api(`/collections/${cid}/sources`, "POST", {
      name: d.get("name"),
      url: d.get("url"),
      allowed_paths: String(d.get("paths"))
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      version: d.get("version") || null,
      limits: {
        pages: Number(d.get("pages")),
        depth: Number(d.get("depth")),
        concurrency: Number(d.get("concurrency")),
        retention: Number(d.get("retention")),
      },
    });
    form.reset();
    setShowForm(false);
    await reload();
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Documentation sources</h2>
          <p>Only the origins and paths you allow.</p>
        </div>
      </div>
      {sources.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Scope</th>
                <th>Last check</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    <small>{s.url}</small>
                    {s.version && (
                      <small>Version: {s.version} · user supplied</small>
                    )}
                  </td>
                  <td>
                    {s.allowed_paths.join(", ")}
                    <small>
                      Depth {s.limits.depth} · {s.limits.pages} pages
                    </small>
                  </td>
                  <td>{date(s.last_checked)}</td>
                  <td>
                    <span className={`status ${s.status}`}>
                      {s.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <Button onClick={() => void act(() => inspect(s.id))}>
                        Inspect
                      </Button>
                      <Button
                        disabled={s.status === "running"}
                        onClick={() =>
                          void act(async () => {
                            await api(`/sources/${s.id}/refresh`, "POST", {});
                            await reload();
                            await inspect(s.id);
                          })
                        }
                      >
                        Refresh
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="Give your assistant a clear set of sources.">
          Add a public documentation URL, review its allowed paths, then start a
          collection. Nothing is fetched until you choose Refresh.
        </Empty>
      )}
      {showForm && (
        <section className="panel">
          <div className="section-heading">
            <h2>Add documentation source</h2>
            <Button onClick={() => setShowForm(false)}>Close</Button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              void act(() => save(form));
            }}
          >
            <Field label="Name">
              <input
                name="name"
                required
                maxLength={120}
                placeholder="e.g. Project docs"
              />
            </Field>
            <Field label="Start URL">
              <input
                name="url"
                type="url"
                required
                placeholder="https://example.com/docs"
              />
            </Field>
            <Field
              label="Allowed paths"
              hint="Comma separated absolute paths. Subpaths are included; other origins are blocked."
            >
              <input name="paths" required placeholder="/docs, /guides" />
            </Field>
            <Field
              label="Version label (optional)"
              hint="A label you supply. Sift does not infer software versions."
            >
              <input name="version" maxLength={100} placeholder="e.g. v2.1" />
            </Field>
            <Field label="Crawl limits">
              <div className="limits">
                <label>
                  Max pages
                  <input
                    name="pages"
                    type="number"
                    defaultValue={50}
                    min={1}
                    max={500}
                    required
                  />
                </label>
                <label>
                  Max depth
                  <input
                    name="depth"
                    type="number"
                    defaultValue={3}
                    min={0}
                    max={6}
                    required
                  />
                </label>
                <label>
                  Concurrency
                  <input
                    name="concurrency"
                    type="number"
                    defaultValue={2}
                    min={1}
                    max={2}
                    required
                  />
                </label>
                <label>
                  Revisions to keep
                  <input
                    name="retention"
                    type="number"
                    defaultValue={2}
                    min={2}
                    max={20}
                    required
                  />
                </label>
              </div>
            </Field>
            <p className="footnote">
              At least 1 second between request starts per origin. 15-second
              request deadline, 2 MB decompressed response limit and 5-minute
              job limit. Public, server-rendered UTF-8 HTML only.
            </p>
            <Button primary type="submit">
              Save source
            </Button>
          </form>
        </section>
      )}
      {selected && (
        <section className="panel">
          <div className="section-heading">
            <h2>{sources.find((s) => s.id === selected)?.name} · inspection</h2>
            <Button onClick={() => setSelected(null)}>Close inspection</Button>
          </div>
          {job && (
            <div className="job">
              <strong>Latest refresh: {job.job.status}</strong>
              <p>
                {job.job.processed} outcomes · {job.job.discovered} discovered
                URLs
              </p>
              {job.job.error && <p className="warning">{job.job.error}</p>}
              {job.job.status === "running" && (
                <Button
                  onClick={() =>
                    void act(async () => {
                      await api(`/jobs/${job.job.id}/cancel`, "POST", {});
                      await inspect(selected);
                      await reload();
                    })
                  }
                >
                  Cancel collection
                </Button>
              )}
            </div>
          )}
          <h3>Collected pages</h3>
          {documents.length ? (
            <ul className="rows">
              {documents.map((d) => (
                <li key={d.id}>
                  <Button onClick={() => read(d.id)}>
                    {d.title || d.original_url}
                  </Button>
                  <small>{d.original_url}</small>
                  <small>
                    {d.last_outcome} · last successful check{" "}
                    {date(d.last_success)}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p>No pages collected yet.</p>
          )}
          {!!jobs.length && (
            <>
              <h3>Refresh history</h3>
              <select
                aria-label="Select refresh job"
                value={job?.job.id || ""}
                onChange={(e) =>
                  void act(async () =>
                    setJob(await api(`/jobs/${e.target.value}`)),
                  )
                }
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {date(j.started_at)} · {j.status}
                  </option>
                ))}
              </select>
            </>
          )}
          {job && (
            <details>
              <summary>
                Page outcomes and failures ({job.outcomes.length})
              </summary>
              <ul className="rows">
                {job.outcomes.map((o: any) => (
                  <li key={o.id}>
                    <strong>{o.outcome}</strong>
                    <small>{o.url}</small>
                    {o.message && <p>{o.message}</p>}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="danger-zone">
            <Button
              onClick={() => {
                if (
                  window.confirm(
                    "Delete this source, all its collected pages and retained history?",
                  )
                )
                  void act(async () => {
                    await api(`/sources/${selected}`, "DELETE", {
                      confirm: selected,
                    });
                    setSelected(null);
                    await reload();
                  });
              }}
            >
              Delete source
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
