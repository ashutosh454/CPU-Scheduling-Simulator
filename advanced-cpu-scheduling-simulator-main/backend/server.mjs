import { createServer } from "node:http";
import { PORT } from "./js/constants.mjs";
import { buildComparison, ensureEngineBuilt, runSchedulerEngine } from "./js/engine.mjs";
import { jsonResponse, readJsonBody } from "./js/http.mjs";

ensureEngineBuilt();

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    jsonResponse(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && req.url === "/api/health") {
    jsonResponse(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && req.url === "/api/simulate") {
    try {
      const payload = await readJsonBody(req);
      const result = runSchedulerEngine(payload);
      jsonResponse(res, 200, result);
    } catch (error) {
      jsonResponse(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === "POST" && req.url === "/api/compare") {
    try {
      const payload = await readJsonBody(req);
      const result = buildComparison(payload);
      jsonResponse(res, 200, result);
    } catch (error) {
      jsonResponse(res, 400, { error: error.message });
    }
    return;
  }

  jsonResponse(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`CPU scheduler backend running at http://localhost:${PORT}`);
});
