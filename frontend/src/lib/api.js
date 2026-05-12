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

export function createCertificate(actor, { id, lokasi, luas }) {
  return req(`/api/certificates?actor=${encodeURIComponent(actor)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, lokasi, luas: Number(luas) }),
  });
}

export function getCertificate(actor, id) {
  return req(`/api/certificates/${encodeURIComponent(id)}?actor=${encodeURIComponent(actor)}`);
}

export function initiateSale(actor, { id, calonPembeliID, notarisID }) {
  return req(`/api/sales/initiate?actor=${encodeURIComponent(actor)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, calonPembeliID, notarisID }),
  });
}

export function approveSale(actor, { id }) {
  return req(`/api/sales/approve?actor=${encodeURIComponent(actor)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

export function cancelSale(actor, { id }) {
  return req(`/api/sales/cancel?actor=${encodeURIComponent(actor)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

export function getMyAssets(actor) {
  return req(`/api/assets?actor=${encodeURIComponent(actor)}`);
}

export function getMyActions(actor) {
  return req(`/api/actions?actor=${encodeURIComponent(actor)}`);
}