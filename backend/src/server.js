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
    <p>Use ?actor=dev|Pembeli|notary</p>
    <ul>
      <li><a href="/health">/health</a></li>
      <li><a href="/api/me/id?actor=dev">/api/me/id?actor=dev</a></li>
      <li><a href="/api/me/id?actor=Pembeli">/api/me/id?actor=Pembeli</a></li>
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
  const { namaCluster, lokasi, luasTotal, jumlahUnit, hargaPerUnit } = req.body;
  try {
    const result = await submitWithFallback(actor, (c) =>
      c.submitTransaction("TerbitkanCluster", namaCluster, lokasi, String(luasTotal), String(jumlahUnit), String(hargaPerUnit))
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

// GET ASSETS
app.get("/api/assets", async (req, res) => {
  const actor = req.query.actor || "dev";
  try {
    const result = await evaluateWithFallback(actor, (c) =>
      c.evaluateTransaction("QueryAllSertifikat")
    );
    const decoded = decodeResult(result);
    const allAssets = decoded ? JSON.parse(decoded) : [];

    //Hanya ambil yang statusnya "Siap Dijual"
    const availableAssets = allAssets.filter(asset => asset.Status === "Siap Dijual");

    res.json({ ok: true, assets: availableAssets });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET ACTIONS
app.get("/api/actions", async (req, res) => {
  const actor = req.query.actor || "dev";
  try {
    const myIdResult = await evaluateWithFallback(actor, (c) =>
      c.evaluateTransaction("GetMyID")
    );
    const myID = decodeResult(myIdResult);

    const result = await evaluateWithFallback(actor, (c) =>
      c.evaluateTransaction("QueryAllSertifikat")
    );
    const decoded = decodeResult(result);
    const allAssets = decoded ? JSON.parse(decoded) : [];

    const pendingActions = allAssets.filter(asset => {
      return (
        asset.Status === "Perlu ACC" &&
        asset.Persetujuan &&
        asset.Persetujuan[myID] === false
      );
    });

    res.json({ ok: true, actions: pendingActions });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/sales/initiate", async (req, res) => {
  const actor = req.query.actor || "dev";
  const { id, metodeBayar, devID, notarisID, bankID } = req.body;
  try {
    const result = await submitWithFallback(actor, (c) =>
      c.submitTransaction("AjukanTransaksi", id, metodeBayar, devID, notarisID, bankID || "")
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
      c.submitTransaction("SetujuiTransaksi", String(id))
    );
    res.json({ ok: true, txResult: decodeResult(result) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post("/api/sales/cancel", async (req, res) => {
  const actor = req.query.actor || "dev";
  const { id, alasan } = req.body;
  try {
    const result = await submitWithFallback(actor, (c) =>
      c.submitTransaction("BatalkanTransaksi", id, alasan)
    );
    res.json({ ok: true, txResult: decodeResult(result) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.get("/api/sertifikat/:id/history", async (req, res) => {
  const actor = req.query.actor || "dev";
  const { id } = req.params;
  try {
    const result = await evaluateWithFallback(actor, (c) =>
      c.evaluateTransaction("GetHistorySertifikat", id)
    );
    
    const decoded = decodeResult(result);
    const history = decoded ? JSON.parse(decoded) : [];
    
    res.json({ ok: true, history: history });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post("/api/cluster/buka", async (req, res) => {
  const actor = req.query.actor || "dev";
  const { namaCluster } = req.body;
  try {
    const result = await submitWithFallback(actor, (c) =>
      c.submitTransaction("BukaPenjualan", namaCluster)
    );
    res.json({ ok: true, txResult: decodeResult(result) });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.get("/api/sertifikat/all", async (req, res) => {
  const actor = req.query.actor || "dev";
  try {
    const result = await evaluateWithFallback(actor, (c) =>
      c.evaluateTransaction("QueryAllSertifikat")
    );
    const decoded = decodeResult(result);
    res.json({
      ok: true,
      assets: decoded ? JSON.parse(decoded) : [],
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
