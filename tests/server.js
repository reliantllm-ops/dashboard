const http = require("http");
const fs = require("fs");
const path = require("path");

const host = "127.0.0.1";
const port = 4173;
const rootDir = path.resolve(__dirname, "..");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function safePathFromUrl(urlPathname) {
  const cleaned = decodeURIComponent(urlPathname.split("?")[0]);
  const relativePath = cleaned === "/" ? "/index.html" : cleaned;
  const filePath = path.resolve(rootDir, `.${relativePath}`);
  return filePath.startsWith(rootDir) ? filePath : null;
}

const server = http.createServer((request, response) => {
  const filePath = safePathFromUrl(request.url || "/");
  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    response.end(contents);
  });
});

server.listen(port, host, () => {
  process.stdout.write(`Smoke test server running at http://${host}:${port}\n`);
});
