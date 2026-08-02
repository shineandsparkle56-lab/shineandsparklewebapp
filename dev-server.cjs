/**
 * Local dev API server — run with: npm run dev:api
 * Uses tsx to load the TypeScript API file directly.
 */

// Register tsx so we can require .ts files
require("tsx/cjs");

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

// Load .env.local manually
const envFile = path.join(__dirname, ".env.local");
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, "utf-8")
    .split("\n")
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const idx = trimmed.indexOf("=");
      if (idx === -1) return;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, "");
      if (!process.env[key]) process.env[key] = val;
    });
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

// Load the TypeScript handlers via tsx
const shippingHandler = (require("./api/shipping-rate.ts").default || require("./api/shipping-rate.ts"));
const createOrderHandler = (require("./api/create-shiprocket-order.ts").default || require("./api/create-shiprocket-order.ts"));
const uploadImageHandler  = (require("./api/upload-image.ts").default  || require("./api/upload-image.ts"));
const deleteImagesHandler = (require("./api/delete-images.ts").default  || require("./api/delete-images.ts"));
const proxyImageHandler   = (require("./api/proxy-image.ts").default    || require("./api/proxy-image.ts"));

app.post("/api/shipping-rate",           (req, res) => shippingHandler(req, res));
app.post("/api/create-shiprocket-order", (req, res) => createOrderHandler(req, res));
app.post("/api/upload-image",            (req, res) => uploadImageHandler(req, res));
app.post("/api/delete-images",           (req, res) => deleteImagesHandler(req, res));
app.get("/api/proxy-image",              (req, res) => proxyImageHandler(req, res));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[dev-server] API running at http://localhost:${PORT}`);
});
