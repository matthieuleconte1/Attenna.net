import { readFile, readdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.PORT || "8014", 10);
const root = resolve(process.cwd());
const reloadClients = new Set();

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const liveReloadScript = `
<script>
  (() => {
    const updates = new EventSource("/__live_reload");
    updates.addEventListener("reload", () => window.location.reload());
  })();
</script>`;

function sendText(response, status, text) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(text);
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${host}:${port}`);

  if (requestUrl.pathname === "/__live_reload") {
    response.writeHead(200, {
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    });
    response.write(": connected\n\n");
    reloadClients.add(response);
    request.on("close", () => reloadClients.delete(response));
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    sendText(response, 400, "Adresse invalide");
    return;
  }

  if (pathname.endsWith("/")) pathname += "index.html";

  let filePath = resolve(root, `.${pathname}`);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    sendText(response, 403, "Accès refusé");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) filePath = resolve(filePath, "index.html");

    const extension = extname(filePath).toLowerCase();
    let contents = await readFile(filePath);

    if (extension === ".html") {
      const html = contents.toString("utf8");
      contents = Buffer.from(
        html.includes("</body>")
          ? html.replace("</body>", `${liveReloadScript}\n</body>`)
          : `${html}${liveReloadScript}`,
      );
    }

    response.writeHead(200, {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": contentTypes[extension] || "application/octet-stream",
    });
    response.end(contents);
  } catch (error) {
    if (error?.code === "ENOENT") {
      sendText(response, 404, "Fichier introuvable");
      return;
    }
    console.error(error);
    sendText(response, 500, "Erreur du serveur local");
  }
});

async function getFileState(directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const state = [];

  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === ".zed") continue;
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      state.push(...await getFileState(entryPath));
      continue;
    }

    const fileStat = await stat(entryPath);
    state.push(`${entryPath}:${fileStat.mtimeMs}:${fileStat.size}`);
  }

  return state.sort().join("|");
}

let previousFileState = await getFileState();
let checkingFiles = false;

setInterval(async () => {
  if (checkingFiles) return;
  checkingFiles = true;

  try {
    const nextFileState = await getFileState();
    if (nextFileState !== previousFileState) {
      previousFileState = nextFileState;
      for (const client of reloadClients) client.write("event: reload\ndata: changed\n\n");
    }
  } catch (error) {
    console.error("Impossible de vérifier les modifications :", error.message);
  } finally {
    checkingFiles = false;
  }
}, 250);

server.listen(port, host, () => {
  console.log(`Site disponible sur http://${host}:${port}/`);
  console.log("Les modifications enregistrées rechargent automatiquement la page.");
});
