import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";

const path = fileURLToPath(import.meta.url);
const allowedHosts = (process.env.allowedHosts || "localhost")
  .split(",")
  .map(h => h.trim());

export default {
  root: join(dirname(path), "client"),
  plugins: [react()],
  server: {
    allowedHosts: allowedHosts
  }
};
