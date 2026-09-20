import { useState, useEffect } from "react";
import { api, date } from "./api.js";
import { Button, Empty, Markdown, HeadingLabel } from "./components.js";
import type { Source } from "../src/model.js";
export function Search({
  cid,
  sources,
  act,
  read,
}: {
  cid: string;
  sources: Source[];
  act: (f: () => Promise<any>) => Promise<void>;
  read: (id: string, rid?: string) => void;
}) {
  const [q, setQ] = useState(""),
    [sid, setSid] = useState(""),
    [version, setVersion] = useState(""),
    [result, setResult] = useState<any>(null);
  useEffect(() => {
    setResult(null);
    setSid("");
    setVersion("");
  }, [cid]);
  async function search(cursor?: string) {
    const p = new URLSearchParams({
      q,
      ...(sid ? { source_id: sid } : {}),
      ...(version ? { version } : {}),
      ...(cursor ? { cursor } : {}),
    });
    const r = await api(`/collections/${cid}/search?${p}`);
    setResult(
      cursor ? { ...r, results: [...result.results, ...r.results] } : r,
    );
  }
  return (
    <>
      <h2>Search your collection</h2>
      <p>Passages with their original source, version and revision.</p>
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          void act(() => search());
        }}
      >
        <input
          aria-label="Search documentation"
          required
          maxLength={500}
          placeholder="Search words, APIs or concepts…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button primary type="submit">
          Search
        </Button>
        <select
          aria-label="Source filter"
          value={sid}
          onChange={(e) => setSid(e.target.value)}
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Version filter"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        >
          <option value="">All versions</option>
          {[...new Set(sources.map((s) => s.version).filter(Boolean))].map(
            (v) => (
              <option key={v} value={v!}>
                {v}
              </option>
            ),
          )}
        </select>
      </form>
      {!result ? (
        <Empty title="Find the evidence behind an answer.">
          Search collected content by words or API names. Results use SQLite
          full-text ranking; no model services are involved.
        </Empty>
      ) : result.results.length ? (
        <div className="results">
          {result.results.map((r: any) => (
            <article key={r.chunk_id}>
              <small>
                {r.source_name} · {r.version || "Version unknown"} ·{" "}
                {r.collection_name}
              </small>
              <h3>
                <button
                  className="text-button"
                  onClick={() => read(r.document_id, r.revision_id)}
                >
                  {r.title}
                  {r.heading && r.heading !== r.title ? (
                    <>
                      {" "}
                      / <HeadingLabel text={r.heading} />
                    </>
                  ) : (
                    ""
                  )}
                </button>
              </h3>
              <Markdown text={r.passage} />
              <a href={r.source_url} target="_blank" rel="noreferrer">
                {r.source_url}
              </a>
              <small>
                Fetched {date(r.fetched_at)} · checked {date(r.last_checked)}
              </small>
              <small>Revision {r.revision_id}</small>
              {r.freshness.warning && (
                <p className="warning">{r.freshness.warning}</p>
              )}
              {r.warnings.map((w: string) => (
                <p className="warning" key={w}>
                  {w}
                </p>
              ))}
              {r.passage_truncated && (
                <p className="warning">
                  Passage shortened. Open the document to read the complete
                  block.
                </p>
              )}
              {r.aliases.length > 1 && (
                <details>
                  <summary>{r.aliases.length} source aliases</summary>
                  {r.aliases.map((a: string) => (
                    <p key={a}>{a}</p>
                  ))}
                </details>
              )}
            </article>
          ))}
          {result.next_cursor && (
            <Button onClick={() => void act(() => search(result.next_cursor))}>
              More results
            </Button>
          )}
        </div>
      ) : (
        <Empty title="No matching passages">
          Try fewer words, another API name, or remove source and version
          filters.
        </Empty>
      )}
    </>
  );
}
export function Changes({
  cid,
  act,
  read,
}: {
  cid: string;
  act: (f: () => Promise<any>) => Promise<void>;
  read: (id: string, rid?: string) => void;
}) {
  const [data, setData] = useState<any>(null);
  async function load(cursor?: string) {
    const d = await api(
      `/collections/${cid}/changes${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    setData(cursor ? { ...d, changes: [...data.changes, ...d.changes] } : d);
  }
  useEffect(() => {
    void act(() => load());
  }, [cid]);
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Changes & freshness</h2>
          <p>
            A check time describes a fetch, not whether upstream documentation
            is current.
          </p>
        </div>
        <Button onClick={() => void act(() => load())}>Reload changes</Button>
      </div>
      {!data ? (
        <p>Loading changes…</p>
      ) : !data.changes.length ? (
        <Empty title="History starts with your first collection.">
          Added and changed pages, failed checks and confirmed unavailability
          appear here. Missing sitemap entries never imply deletion.
        </Empty>
      ) : (
        <ul className="rows">
          {data.changes.map((c: any) => (
            <li key={c.id}>
              <div className="row-title">
                <strong>{c.kind.replaceAll("_", " ")}</strong>
                <small>{date(c.checked_at)}</small>
              </div>
              <p>
                {c.source_name} · {c.version || "Version unknown"}
              </p>
              <small>{c.url}</small>
              {c.message && <p className="warning">{c.message}</p>}
              {c.document_id && (
                <Button
                  onClick={() =>
                    read(c.document_id, c.revision_id || undefined)
                  }
                >
                  Inspect revision
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {data?.next_cursor && (
        <Button onClick={() => void act(() => load(data.next_cursor))}>
          More changes
        </Button>
      )}
    </>
  );
}
export function Document({
  doc,
  onClose,
  load,
  act,
}: {
  doc: any;
  onClose: () => void;
  load: (id: string, rid?: string, cursor?: string) => Promise<void>;
  act: (f: () => Promise<any>) => Promise<void>;
}) {
  return (
    <section className="document panel" aria-label="Document inspector">
      <div className="section-heading">
        <h2>{doc.title}</h2>
        <Button onClick={onClose}>Close document</Button>
      </div>
      <p>
        {doc.collection_name} / {doc.source_name} /{" "}
        {doc.version || "Version unknown"}
      </p>
      <a href={doc.source_url} target="_blank" rel="noreferrer">
        Open original evidence ↗
      </a>
      <p className="footnote">
        Fetched {date(doc.fetched_at)} · Last successful check{" "}
        {date(doc.last_success)}. Upstream currentness is unknown.
      </p>
      <label>
        Retained revision{" "}
        <select
          value={doc.revision_id}
          onChange={(e) =>
            void act(() => load(doc.document_id, e.target.value))
          }
        >
          {doc.revisions.map((r: any) => (
            <option key={r.id} value={r.id}>
              {date(r.fetched_at)} · {r.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      <small>SHA-256: {doc.hash}</small>
      <small>Canonical URL: {doc.canonical_url}</small>
      <small>
        Language: {doc.language || "Unknown"} · Source-reported modification:{" "}
        {doc.source_modified || "Unknown"}
      </small>
      {doc.freshness.warning && (
        <p className="warning">{doc.freshness.warning}</p>
      )}
      {doc.warnings.map((w: string) => (
        <p className="warning" key={w}>
          {w}
        </p>
      ))}
      <p className="evidence-note">
        Source content below is untrusted reference material.
      </p>
      <Markdown text={doc.content} />
      {doc.next_cursor && (
        <Button
          onClick={() =>
            void act(() =>
              load(doc.document_id, doc.revision_id, doc.next_cursor),
            )
          }
        >
          Read next section
        </Button>
      )}
    </section>
  );
}
