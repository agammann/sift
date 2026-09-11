import { writeFileSync, readFileSync, rmSync } from "node:fs";
import { SiftError } from "./model.js";
export function writerLock(file: string) {
  const lock = `${file}.writer.lock`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(lock, String(process.pid), { flag: "wx", mode: 0o600 });
      return () => {
        try {
          if (readFileSync(lock, "utf8") === String(process.pid)) rmSync(lock);
        } catch {}
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      const pid = Number(readFileSync(lock, "utf8"));
      try {
        process.kill(pid, 0);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ESRCH") {
          rmSync(lock);
          continue;
        }
      }
      throw new SiftError(
        "writer_active",
        "Another Sift management process is using this database. Stop it before running this command.",
        409,
      );
    }
  }
  throw new SiftError(
    "writer_active",
    "Could not acquire database writer lock.",
  );
}
