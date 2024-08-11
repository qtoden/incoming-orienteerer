import http from "http";
import fs from "fs/promises";
import path from "path";
import * as esbuild from "esbuild";
import { createMeosFetcher } from "./meos.ts";
import { settingsSchema } from "../schema.ts";

import { settings } from "./settings.ts";

console.log("Settings", settings);

const PORT = 3001;

async function buildApp() {
  console.log("Building client app");
  await esbuild.build({
    entryPoints: ["app/app.ts"],
    bundle: true,
    outfile: "bundle/app.js",
    sourcemap: true,
  });
}

const sseConnections = new Set<http.ServerResponse>();

const { getAllPunches, startPoll } =
  await createMeosFetcher(settings.meosHost);

startPoll((punch) => {
  console.log("Broadcast", punch);
  for (const connection of sseConnections) {
    connection.write(
      `data: ${JSON.stringify({ type: "punch", data: punch })}\n\n`,
    );
  }
});

const server = http.createServer(async (req, res) => {
  console.log(`Request URL: ${req.url}`);
  if (req.url === "/") {
    const indexHtml = await fs.readFile(
      path.resolve(import.meta.dirname, "../app/index.html"),
    );
    res.writeHead(200, {
      "Content-Type": "text/html",
      "Permissions-Policy": "autoplay=(self)",
    });
    res.write(indexHtml);
    res.end();
  } else if (req.url === "/app.js") {
    const js = await fs.readFile(
      path.resolve(import.meta.dirname, "../bundle/app.js"),
    );
    res.writeHead(200, { "Content-Type": "text/javascript" });
    res.write(js);
    res.end();
  } else if (req.url === "/app.css") {
    const css = await fs.readFile(
      path.resolve(import.meta.dirname, "../app/app.css"),
    );
    res.writeHead(200, { "Content-Type": "text/css" });
    res.write(css);
    res.end();
  } else if (req.url === "/app.js.map") {
    const sourceMap = await fs.readFile(
      path.resolve(import.meta.dirname, "../bundle/app.js.map"),
    );
    res.writeHead(200, { "Content-Type": "application/json" });
    res.write(sourceMap);
    res.end();
  } else if (req.url?.endsWith(".mp3")) {
    let mp3: Buffer;

    try {
      mp3 = await fs.readFile(
        path.resolve(
          import.meta.dirname,
          `../../forvarning-js/client/src/sounds/${req.url}`,
        ),
      );
    } catch (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.write("<h1>404 Not Found</h1>");
        res.end();
        return;
      }
      throw err;
    }

    res.writeHead(200, { "Content-Type": "audio/mp3" });
    res.write(mp3);
    res.end();
  } else if (req.url === "/sse") {
    sseConnections.add(res);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    res.write(
      `data: ${JSON.stringify({ type: "settings", data: settings })}\n\n`,
    );

    res.write(
      `data: ${JSON.stringify({ type: "punches", data: getAllPunches() })}\n\n`,
    );

    res.on("close", () => {
      console.log("Connection closed");
      sseConnections.delete(res);
    });
  } else {
    res.writeHead(404, { "Content-Type": "text/html" });
    res.write("<h1>404 Not Found</h1>");
    res.end();
  }
});

await buildApp();

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
