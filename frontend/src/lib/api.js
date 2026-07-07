const API_BASE = "http://localhost:3001";

async function req(path, options) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export function health() {
  return req("/health");
}

export function getMyId(actor) {
  return req(`/api/me/id?actor=${encodeURIComponent(actor)}`);
}

// 1. UPDATE: Disesuaikan dengan TerbitkanCluster (bukan satuan lagi)
export function createCertificate(actor, { namaCluster, lokasi, luasTotal, jumlahUnit, hargaPerUnit }) {
  return req(`/api/certificates?actor=${encodeURIComponent(actor)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      namaCluster, 
      lokasi, 
      luasTotal: Number(luasTotal), 
      jumlahUnit: Number(jumlahUnit), 
      hargaPerUnit: Number(hargaPerUnit) 
    }),
  });
}

// 2. BARU: Fungsi untuk mengubah status klaster jadi "Siap Dijual"
export function openSale(actor, { namaCluster }) {
  return req(`/api/cluster/buka?actor=${encodeURIComponent(actor)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ namaCluster }),
  });
}

export function getCertificate(actor, id) {
  return req(`/api/certificates/${encodeURIComponent(id)}?actor=${encodeURIComponent(actor)}`);
}

// 3. BARU: Fungsi ambil data semua unit
export function getAllCertificates(actor) {
  return req(`/api/sertifikat/all?actor=${encodeURIComponent(actor)}`);
}

// 4. UPDATE: Tambahan metodeBayar dan bankID
export function initiateSale(actor, { id, metodeBayar, devID, notarisID, bankID }) {
  return req(`/api/sales/initiate?actor=${encodeURIComponent(actor)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, metodeBayar, devID, notarisID, bankID }),
  });
}

export function approveSale(actor, { id }) {
  return req(`/api/sales/approve?actor=${encodeURIComponent(actor)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

// 5. UPDATE: Wajib bawa string "alasan"
export function cancelSale(actor, { id, alasan }) {
  return req(`/api/sales/cancel?actor=${encodeURIComponent(actor)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, alasan }),
  });
}

export function getMyAssets(actor) {
  return req(`/api/assets?actor=${encodeURIComponent(actor)}`);
}

export function getMyActions(actor) {
  return req(`/api/actions?actor=${encodeURIComponent(actor)}`);
}

// 6. BARU: Fungsi buat narik data Audit Trail
export function getCertificateHistory(actor, id) {
  return req(`/api/sertifikat/${encodeURIComponent(id)}/history?actor=${encodeURIComponent(actor)}`);
}