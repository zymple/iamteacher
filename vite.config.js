import { join, dirname } from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import * as dotenv from 'dotenv';

const path = fileURLToPath(import.meta.url);
dotenv.config();

const allowedHosts = process.env.VITE_ALLOWED_HOSTS ?
  process.env.VITE_ALLOWED_HOSTS.split(',') : [];

export default {
  root: join(dirname(path), "client"),
  plugins: [react()],
  server: {
    allowedHosts: allowedHosts
  }
};
