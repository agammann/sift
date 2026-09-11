let token = "";
export async function api(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<any> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Sift-Token": token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error?.message || `Request failed (${res.status})`);
  return data;
}
export async function session() {
  const result = await api("/session");
  token = result.token;
  return result;
}
export function date(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Never";
}
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
