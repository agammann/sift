const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const publish = require("../scripts/publish-release.cjs");

const sha = "c".repeat(40);
const digest = (data) => "sha256:" + crypto.createHash("sha256").update(data).digest("hex");

async function fixture({ existing = true, wrongTag = false, strayDraft = false, strayName = false, drift = false, providerResets = false, lagReads = 0, observed = [], unrelatedDraft = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sift-publisher-test-"));
  const prev = process.cwd();
  const archive = Buffer.from("synthetic archive");
  const checksum = Buffer.from(digest(archive).slice(7) + "  sift-local-1.0.1.tgz\n");
  const payloads = [
    { name: "sift-local-1.0.1.tgz", data: archive },
    { name: "sift-local-1.0.1.tgz.sha256", data: checksum },
    { name: "SHA256SUMS", data: checksum },
  ];
  fs.mkdirSync(path.join(dir, "release-artifacts"));
  for (const file of payloads) fs.writeFileSync(path.join(dir, "release-artifacts", file.name), file.data);
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({version:"1.0.1"}));
  fs.writeFileSync(path.join(dir, "CHANGELOG.md"), "## 1.0.1\n\nSynthetic notes.\n");
  process.chdir(dir);

  const calls = [];
  let currentTag = existing ? (wrongTag ? "d".repeat(40) : sha) : null;
  let release = existing ? {id:42,tag_name:"v1.0.1",target_commitish:sha,draft:true,prerelease:false} : null;
  let releases = release ? [release] : [];
  if (strayDraft) releases.push({id:43,tag_name:"untagged-test",target_commitish:(strayName || unrelatedDraft) ? "f".repeat(40) : sha,name:strayName ? "Sift 1.0.1" : "Other",draft:true});
  let tagCreated = false;
  let readsAfterCreate = 0;
  let assets = existing ? payloads.map((p,i)=>({id:i+1,name:p.name,digest:digest(p.data),size:p.data.length,state:"uploaded"})) : [];
  let branchCalls = 0;
  const data = (x) => ({data:x});
  const api = {
    repos: {
      listReleases: async () => data(releases),
      listReleaseAssets: async () => data(assets),
      getBranch: async () => data({commit:{sha:drift && ++branchCalls > 1 ? "e".repeat(40) : sha}}),
      getRelease: async () => data(release),
      createRelease: async (p) => {
        calls.push(["createRelease",p]);
        assert.equal(currentTag,sha,"tag must exist before creating draft");
        release={id:42,tag_name:p.tag_name,target_commitish:p.target_commitish,draft:true,prerelease:false};
        releases.push(release); return data(release);
      },
      updateRelease: async (p) => {
        calls.push(["updateRelease",p]);
        // Model the observed provider behavior: a draft update that omits
        // tag_name causes the draft to lose its intended tag association.
        release={...release,...p,tag_name:providerResets ? "untagged-provider" : p.tag_name || "untagged-provider"};
        return data(release);
      },
      uploadReleaseAsset: async (p) => {
        const a={id:assets.length+1,name:p.name,digest:digest(p.data),size:p.data.length,state:"uploaded"};
        assets.push(a); return data(a);
      },
      deleteReleaseAsset: async () => { throw new Error("Unexpected asset deletion"); },
    },
    git: {
      getRef: async () => { if (!currentTag || (tagCreated && readsAfterCreate++ < lagReads)) throw Object.assign(new Error("missing"),{status:404}); return data({object:{type:"commit",sha:currentTag}}); },
      createRef: async (p) => { calls.push(["createRef",p]); observed.push("createRef"); assert.equal(currentTag,null); currentTag=p.sha; tagCreated=true; return data({}); },
      getTag: async () => { throw new Error("Unexpected annotated tag"); },
    },
  };
  const github = {rest:api,paginate:async (fn,args)=>(await fn(args)).data};
  try {
    await publish({github,context:{eventName:"push",ref:"refs/heads/main",sha,repo:{owner:"test",repo:"sift"}},core:{info:()=>{}}});
    return {calls,release};
  } finally {
    process.chdir(prev);
    fs.rmSync(dir,{recursive:true,force:true});
  }
}

test("existing draft preserves its exact tag through both updates", async () => {
  const {calls,release}=await fixture();
  const updates=calls.filter(([name])=>name==="updateRelease").map(([,args])=>args);
  assert.equal(updates.length,2);
  assert.ok(updates.every((args)=>args.tag_name==="v1.0.1"));
  assert.equal(release.tag_name,"v1.0.1");
  assert.equal(release.draft,false);
});

test("new tag exists before the draft is created", async () => {
  const {calls}=await fixture({existing:false});
  assert.ok(calls.findIndex(([name])=>name==="createRef") < calls.findIndex(([name])=>name==="createRelease"));
});

test("refuses a tag pointing at another commit", async () => {
  await assert.rejects(fixture({wrongTag:true}),/different commit/);
});

test("refuses an untagged draft for the checked commit", async () => {
  await assert.rejects(fixture({existing:false,strayDraft:true}),/untagged draft/);
});

test("refuses publication if main drifts", async () => {
  await assert.rejects(fixture({drift:true}),/main moved/);
});


test("stops before asset upload when provider loses draft tag", async () => {
  await assert.rejects(fixture({providerResets:true}),/Draft identity changed before asset upload/);
});


test("refuses an untagged draft using the same release name", async () => {
  await assert.rejects(fixture({existing:false,strayDraft:true,strayName:true}),/untagged draft/);
});


test("refuses ambiguous untagged draft alongside matching draft", async () => {
  await assert.rejects(fixture({existing:true,strayDraft:true}),/untagged draft/);
});

test("waits for a newly created tag to become visible", async () => {
  const original = global.setTimeout;
  global.setTimeout = (fn) => original(fn, 0);
  try {
    const {calls}=await fixture({existing:false,lagReads:2});
    assert.equal(calls.filter(([name])=>name==="createRef").length,1);
  } finally { global.setTimeout=original; }
});

test("fails closed if a newly created tag remains invisible", async () => {
  const original = global.setTimeout;
  global.setTimeout = (fn) => original(fn, 0);
  try {
    const observed=[];
    await assert.rejects(fixture({existing:false,lagReads:100,observed}),/tag is missing/);
    assert.deepEqual(observed,["createRef"]);
  } finally { global.setTimeout=original; }
});


test("preserves an unrelated older untagged draft", async () => {
  const {calls}=await fixture({existing:false,strayDraft:true,unrelatedDraft:true});
  assert.equal(calls.filter(([name])=>name==="createRelease").length,1);
});
