import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { api, session } from "./api.js";
import { Button, Empty } from "./components.js";
import { Sources } from "./Sources.js";
import { Search, Changes, Document } from "./Retrieval.js";
import { Connect, Workspace } from "./Settings.js";
import "./style.css";

function App() {
  const [collections, setCollections] = useState<any[]>([]),
    [cid, setCid] = useState(""),
    [sources, setSources] = useState<any[]>([]),
    [tab, setTab] = useState("Sources"),
    [health, setHealth] = useState<any>(null),
    [appVersion, setAppVersion] = useState(""),
    [mcpLaunch, setMcpLaunch] = useState<{
      command: string;
      args: string[];
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [newCollection, setNewCollection] = useState(false),
    [showForm, setShowForm] = useState(false),
    [doc, setDoc] = useState<any>(null);
  async function act(f: () => Promise<any>) {
    setBusy(true);
    setError("");
    try {
      await f();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    const data = await api("/collections");
    setCollections(data.collections);
    setCid((old) =>
      data.collections.some((c: any) => c.id === old)
        ? old
        : data.collections[0]?.id || "",
    );
    if (cid && data.collections.some((c: any) => c.id === cid))
      setSources((await api(`/collections/${cid}/sources`)).sources);
  }
  useEffect(() => {
    void act(async () => {
      const s = await session();
      setHealth(s.health);
      setAppVersion(s.version);
      setMcpLaunch(s.mcpLaunch);
      await reload();
      setReady(true);
    });
  }, []);
  useEffect(() => {
    setDoc(null);
    setShowForm(false);
    if (cid)
      void act(async () =>
        setSources((await api(`/collections/${cid}/sources`)).sources),
      );
    else setSources([]);
  }, [cid]);
  useEffect(() => {
    if (!sources.some((s) => s.status === "running")) return;
    const t = setInterval(() => void reload().catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [sources, cid]);
  async function read(id: string, rid?: string, cursor?: string) {
    const p = new URLSearchParams({
      collection_id: cid,
      document_id: id,
      ...(rid ? { revision_id: rid } : {}),
      ...(cursor ? { cursor } : {}),
    });
    const d = await api(`/document?${p}`);
    setDoc(cursor ? { ...d, content: doc.content + "\n\n" + d.content } : d);
  }
  const current = collections.find((c) => c.id === cid);
  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside>
        <div className="brand">Sift</div>
        <p className="tagline">Clean documentation. Clear sources.</p>
        <div className="side-label">Collections</div>
        <nav aria-label="Collections">
          {collections.map((c) => (
            <button
              key={c.id}
              className={c.id === cid && tab !== "Workspace" ? "selected" : ""}
              onClick={() => {
                setCid(c.id);
                setTab("Sources");
              }}
            >
              {c.name}
            </button>
          ))}
          <button onClick={() => setNewCollection((v) => !v)}>
            ＋ New collection
          </button>
        </nav>
        {newCollection && (
          <form
            className="new-collection"
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(new FormData(e.currentTarget).get("name"));
              void act(async () => {
                const c = await api("/collections", "POST", { name });
                await reload();
                setCid(c.id);
                setTab("Sources");
                setNewCollection(false);
              });
            }}
          >
            <input
              aria-label="Collection name"
              name="name"
              autoFocus
              required
              maxLength={120}
              placeholder="Project name"
            />
            <Button primary>Create collection</Button>
          </form>
        )}
        <div className="side-bottom">
          <small>Local workspace{appVersion ? ` · v${appVersion}` : ""}</small>
          <button
            className={tab === "Workspace" ? "selected" : ""}
            onClick={() => {
              setTab("Workspace");
              setDoc(null);
            }}
          >
            Backup & restore
          </button>
        </div>
      </aside>
      <main id="main" aria-busy={busy}>
        {error && (
          <div role="alert" className="error">
            {error}
            <button onClick={() => setError("")} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}
        {busy && (
          <div role="status" className="busy">
            Working…
          </div>
        )}
        {!ready ? (
          <Empty title="Opening your workspace">
            Checking the database and loading collections…
          </Empty>
        ) : tab === "Workspace" ? (
          <Workspace health={health} act={act} reload={reload} />
        ) : !current ? (
          <>
            <h1>Documentation, with a clear source.</h1>
            <p>
              Build a collection for your project. Give your coding assistant
              documentation you can inspect and maintain.
            </p>
            <Empty title="Your workspace is ready.">
              Create your first project collection to choose which documentation
              your assistant can access.
            </Empty>
            <Button primary onClick={() => setNewCollection(true)}>
              Create your first collection
            </Button>
          </>
        ) : (
          <>
            <header>
              <div>
                <h1>{current.name}</h1>
                <p>Documentation your assistant can trace.</p>
              </div>
              <Button
                primary
                onClick={() => {
                  setTab("Sources");
                  setShowForm(true);
                  setDoc(null);
                }}
              >
                ＋ Add source
              </Button>
            </header>
            <nav className="tabs" aria-label="Collection views">
              {["Sources", "Search", "Changes", "Connect"].map((t) => (
                <button
                  aria-current={tab === t ? "page" : undefined}
                  className={tab === t ? "active" : ""}
                  key={t}
                  onClick={() => {
                    setTab(t);
                    setDoc(null);
                  }}
                >
                  {t}
                </button>
              ))}
            </nav>
            {doc ? (
              <Document
                doc={doc}
                onClose={() => setDoc(null)}
                load={read}
                act={act}
              />
            ) : tab === "Sources" ? (
              <Sources
                cid={cid}
                sources={sources}
                reload={reload}
                act={act}
                showForm={showForm}
                setShowForm={setShowForm}
                read={(id) => void act(() => read(id))}
              />
            ) : tab === "Search" ? (
              <Search
                cid={cid}
                sources={sources}
                act={act}
                read={(id, rid) => void act(() => read(id, rid))}
              />
            ) : tab === "Changes" ? (
              <Changes
                cid={cid}
                act={act}
                read={(id, rid) => void act(() => read(id, rid))}
              />
            ) : (
              <Connect cid={cid} act={act} launch={mcpLaunch!} />
            )}
            <footer>
              <span>
                Selected sources. Traceable passages. Upstream currentness
                remains unknown.
              </span>
              <button
                className="text-button danger"
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete collection “${current.name}” and all of its sources, documents and history?`,
                    )
                  )
                    void act(async () => {
                      await api(`/collections/${cid}`, "DELETE", {
                        confirm: cid,
                      });
                      await reload();
                    });
                }}
              >
                Delete collection
              </button>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
