// Custom HTTPS server for serving the production build. Kiosk pages need camera/GPS,
// which browsers only grant on HTTPS (or localhost) -- `next start` has no HTTPS flag,
// so this wraps it with the same self-signed cert `next dev --experimental-https` uses.
process.env.NODE_ENV = process.env.NODE_ENV || "production";

import { createServer } from "https";
import { parse } from "url";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import next from "next";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOST || "0.0.0.0";

const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, "certificates", "localhost-key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "certificates", "localhost.pem")),
};

const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    handle(req, res, parse(req.url, true));
  }).listen(port, hostname, () => {
    console.log(`> Ready on https://localhost:${port}`);
  });
});
