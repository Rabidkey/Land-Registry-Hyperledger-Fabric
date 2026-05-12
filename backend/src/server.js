require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { getContractForActor } = require("./fabric");

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

function decodeResult(result) {
  const buf = Buffer.isBuffer(result) ? result : Buffer.from(result);
  return buf.toString("utf8");
}

async function withContract(actor, peerWhich, fn) {
  const { contract, gateway, client } = await getContractForActor(actor, process.env, peerWhich);
  try {
    return await fn(contract);
  } finally {
    gateway.close();
    client.close();
  }
}

async function submitWithFallback(actor, submitFn) {
  try {
    return await withContract(actor, "org1", submitFn);
  } catch (e1) {
    try {
      return await withContract(actor, "org2", submitFn);
    } catch (e2) {
      throw new Error(`Submit gagal (Org1): ${e1.message} | (Org2): ${e2.message}`);
    }
  }
}

async function evaluateWithFallback(actor, evaluateFn) {
  try {
    return await withContract(actor, "org1", evaluateFn);
  } catch (e1) {
    try {
      return await withContract(actor, "org2", evaluateFn);
    } catch (e2) {
      throw new Error(`Evaluate gagal (Org1): ${e1.message} | (Org2): ${e2.message}`);
    }
  }
}

app.get("/", (req, res) => {
  res.type("html").send(`
    <h2>Land Registry API</h2>
    <p>Use ?actor=dev|userA|notary</p>
    <ul>
      <li><a href="/health">/health</a></li>
      <li><a href="/api/me/id?actor=dev">/api/me/id?actor=dev</a></li>
      <li><a href="/api/me/id?actor=userA">/api/me/id?actor=userA</a></li>
      <li><a href="/api/me/id?actor=notary">/api/me/id?actor=notary</a></li>
    </ul>
  `);
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/me/id", async (req, res) => {
  const actor = req.query.actor || "dev";

  try {
    const result = await evaluateWithFallback(actor, (c) =>
      c.evaluateTransaction("GetMyID")
    );

    res.json({
      ok: true,
      actor,
      id: decodeResult(result),
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      actor,
      error: e.message,
    });
  }
});

app.post("/api/certificates", async (req, res) => {
  const actor = req.query.actor || "dev";
  const { id, lokasi, luas } = req.body;
  try {
    const result = await submitWithFallback(actor, (c) =>
      c.submitTransaction("TerbitkanSertifikat", String(id), String(lokasi), String(luas))
    );
    res.json({ ok: true, txResult: decodeResult(result) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.get("/api/certificates/:id", async (req, res) => {
  const actor = req.query.actor || "dev";
  const { id } = req.params;
  try {
    const result = await withContract(actor, "org1", (c) => c.evaluateTransaction("QuerySertifikat", String(id)));
    res.json(JSON.parse(decodeResult(result)));
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

app.get("/api/assets", async (req, res) => {
  const actor = req.query.actor || "dev";

  try {
    const result = await evaluateWithFallback(actor, (c) =>
      c.evaluateTransaction("GetSertifikatByOwner")
    );

    const decoded = decodeResult(result);
    const assets = decoded ? JSON.parse(decoded) : [];

    res.json({
      ok: true,
      actor,
      assets: Array.isArray(assets) ? assets : [],
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      actor,
      error: e.message,
    });
  }
});

app.get("/api/actions", async (req, res) => {
  const actor = req.query.actor || "dev";

  try {
    const result = await evaluateWithFallback(actor, (c) =>
      c.evaluateTransaction("GetTransaksiByActor")
    );

    const decoded = decodeResult(result);
    const actions = decoded ? JSON.parse(decoded) : [];

    res.json({
      ok: true,
      actor,
      actions: Array.isArray(actions) ? actions : [],
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      actor,
      error: e.message,
    });
  }
});

app.post("/api/sales/initiate", async (req, res) => {
  const actor = req.query.actor || "dev";
  const { id, calonPembeliID, notarisID } = req.body;
  try {
    const result = await submitWithFallback(actor, (c) =>
      c.submitTransaction("AjukanJualBeli", String(id), String(calonPembeliID), String(notarisID))
    );
    res.json({ ok: true, txResult: decodeResult(result) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post("/api/sales/approve", async (req, res) => {
  const actor = req.query.actor || "dev";
  const { id } = req.body;
  try {
    const result = await submitWithFallback(actor, (c) =>
      c.submitTransaction("SetujuiJualBeli", String(id))
    );
    res.json({ ok: true, txResult: decodeResult(result) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post("/api/sales/cancel", async (req, res) => {
  const actor = req.query.actor || "dev";
  const { id } = req.body;
  try {
    const result = await submitWithFallback(actor, (c) =>
      c.submitTransaction("BatalkanJualBeli", String(id))
    );
    res.json({ ok: true, txResult: decodeResult(result) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
