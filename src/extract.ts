import { load } from "cheerio";
import Turndown from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { createHash } from "node:crypto";
import { normalizeUrl, inScope } from "./network.js";
import type { Source } from "./model.js";
import { SiftError } from "./model.js";

export function extract(html: string, url: string, source: Source) {
  const $ = load(html);
  const warnings: string[] = [];
  const title =
    $("h1").first().text().trim() || $("title").first().text().trim() || url;
  const language = $("html").attr("lang") || null;
  const canonicalCandidate = $('link[rel="canonical"]').attr("href");
  let canonical = url;
  if (canonicalCandidate) {
    try {
      const u = normalizeUrl(new URL(canonicalCandidate, url).href);
      if (inScope(u, source)) canonical = u;
      else
        warnings.push(
          "Canonical URL was outside the allowed scope and was ignored.",
        );
    } catch {
      warnings.push("Invalid canonical URL was ignored.");
    }
  }
  const links: string[] = [];
  $("a[href]").each((_, a) => {
    try {
      links.push(normalizeUrl(new URL($(a).attr("href")!, url).href));
    } catch {
      /* unsafe or malformed links are excluded */
    }
  });
  $(
    'script,style,noscript,nav,footer,header,form,iframe,object,embed,svg,[role="navigation"],[role="banner"],[role="contentinfo"],.cookie-banner,.cookie-consent,#cookie-banner,.advertisement,.ads,.sidebar,.toc',
  ).remove();
  const main = $("main").first().length
    ? $("main").first()
    : $("article").first().length
      ? $("article").first()
      : $('[role="main"]').first().length
        ? $('[role="main"]').first()
        : $("body");
  if (main.is("body"))
    warnings.push(
      "No main or article landmark; body extraction may include layout text.",
    );
  main.find("a").each((_, a) => {
    try {
      const link = new URL($(a).attr("href") || "", url);
      if (
        !["http:", "https:"].includes(link.protocol) ||
        link.username ||
        link.password
      )
        $(a).removeAttr("href");
      else $(a).attr("href", link.href);
    } catch {
      $(a).removeAttr("href");
    }
  });
  main.find("img").remove(); // No remote image loads in the local inspector.
  const headings = main
    .find("h1,h2,h3,h4,h5,h6")
    .map((_, h) => $(h).text().trim())
    .get();
  const td = new Turndown({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  td.use(gfm);
  td.addRule("completeCode", {
    filter: "pre",
    replacement: (_content, node) => {
      const code = node.textContent || "";
      const fence = "`".repeat(
        Math.max(3, ...(code.match(/`+/g) || []).map((x) => x.length + 1)),
      );
      const lang =
        node.firstChild && "getAttribute" in node.firstChild
          ? (
              (node.firstChild as HTMLElement).getAttribute("class") || ""
            ).match(/language-([\w+-]+)/)?.[1] || ""
          : "";
      return `\n\n${fence}${lang}\n${code.replace(/\n$/, "")}\n${fence}\n\n`;
    },
  });
  const content = td.turndown(main.html() || "").trim();
  if (content.length < 40)
    throw new SiftError(
      "unsupported_content",
      "No useful server-rendered documentation was found. JavaScript-only pages, login screens and empty content are unsupported.",
    );
  if (
    /enable javascript|access denied|captcha|sign in to continue/i.test(
      content,
    ) &&
    content.length < 1500
  )
    throw new SiftError(
      "access_control",
      "This page appears to require JavaScript, authentication or an access-control challenge. Sift will not bypass it.",
    );
  const chunks = chunkMarkdown(content, warnings, title.slice(0, 1000));
  const hash = createHash("sha256")
    .update(JSON.stringify({ title, headings, language, content }))
    .digest("hex");
  return {
    title: title.slice(0, 1000),
    language,
    headings,
    content,
    canonical,
    links,
    hash,
    warnings,
    chunks,
  };
}
export function chunkMarkdown(content: string, warnings: string[], title = "") {
  const result: { heading: string; passage: string }[] = [];
  const warn = (message: string) => {
    if (!warnings.includes(message)) warnings.push(message);
  };
  const titleBytes = Buffer.byteLength(title);
  let indexedBytes = 0,
    exhausted = false;
  let heading = "",
    buffer = "",
    fence = "";
  const flush = () => {
    const passage = buffer.trim();
    buffer = "";
    if (!passage || exhausted) return;
    const bytes =
      titleBytes + Buffer.byteLength(heading) + Buffer.byteLength(passage);
    if (result.length >= 2048 || indexedBytes + bytes > 4 * 1024 * 1024) {
      exhausted = true;
      warn(
        "The search index reached its per-document limit of 2,048 chunks or 4 MB of text and metadata. Read the full document for content beyond this limit.",
      );
      return;
    }
    indexedBytes += bytes;
    result.push({ heading, passage });
  };
  for (const line of content.split("\n")) {
    const match = line.match(/^(`{3,}|~{3,})/);
    if (match) {
      if (!fence) fence = match[1];
      else if (match[1][0] === fence[0] && match[1].length >= fence.length)
        fence = "";
    }
    if (!fence && /^#{1,6} /.test(line)) {
      flush();
      heading = line.replace(/^#+ /, "");
      if (heading.length > 512) {
        heading = heading.slice(0, 512);
        warn(
          "A heading exceeded 512 characters and was shortened in search metadata. The full heading remains in the document.",
        );
      }
    }
    if (!fence && !line.trim() && buffer.length >= 1800) flush();
    buffer += `${line}\n`;
    while (buffer.length > 16000 && !exhausted) {
      warn(
        "A long block exceeded 16,000 characters and was split for retrieval; read the full document for the complete example.",
      );
      // Avoid splitting a UTF-16 surrogate pair between passages.
      const cut = /[\uD800-\uDBFF]/.test(buffer[15999]) ? 15999 : 16000;
      const rest = buffer.slice(cut);
      buffer = buffer.slice(0, cut);
      flush();
      buffer = rest;
    }
    if (exhausted) break;
  }
  flush();
  return result;
}
