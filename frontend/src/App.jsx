/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { 
  health, 
  getMyId, 
  createCertificate, 
  getCertificate, 
  initiateSale, 
  approveSale, 
  cancelSale, 
  getMyAssets, 
  getMyActions,
} from "./lib/api";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  Handshake,
  Home,
  Landmark,
  LayoutGrid,
  MapPin,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Tag,
  UserRound,
  XCircle,
} from "lucide-react";

const ACTORS = [
  { key: "dev", label: "Developer (Admin/BPN)", hint: "Org1 Admin", icon: Landmark },
  { key: "userA", label: "Customer A", hint: "Org1 User1", icon: UserRound },
  { key: "userB", label: "Customer B", hint: "Org1 User2", icon: UserRound },
  { key: "notary", label: "Notaris", hint: "Org2 User1", icon: ShieldCheck },
];

function actorNameFromId(id, actorIds = {}) {
  if (!id) return "-";

  if (id === actorIds.dev) return "Developer / Admin BPN";
  if (id === actorIds.userA) return "Customer A";
  if (id === actorIds.userB) return "Customer B";
  if (id === actorIds.notary) return "Notary";

  return shortId(id);
}

const primaryButtonClass =
  "border-0 bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,0.22)] hover:from-cyan-300 hover:to-violet-400";

const stackedPrimaryActionClass =
  "w-full justify-center rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:brightness-110 disabled:opacity-50";

const stackedDangerOutlineClass =
  "w-full justify-center rounded-lg border border-rose-400/35 bg-transparent px-4 py-3 text-sm font-semibold text-rose-200 hover:bg-rose-400/8 hover:border-rose-300/50";

function statusBadge(status) {
  if (status === "Tersedia") return { variant: "secondary", text: "Tersedia" };
  if (status === "Proses Jual") return { variant: "default", text: "Proses Jual" };
  return { variant: "outline", text: status || "-" };
}

function classifyEvent(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("gagal") || m.includes("error")) return "ERROR";
  if (m.includes("query")) return "QUERY";
  if (m.includes("terbitkan") || m.includes("ajukan") || m.includes("setujui") || m.includes("batalkan")) return "TX";
  return "INFO";
}

function nodeBadge(actor) {
  if (actor === "dev") return "DEVELOPER NODE";
  if (actor === "notary") return "NOTARY NODE";
  return "USER NODE";
}


function shortId(value) {
  if (!value) return "-";
  const text = String(value);
  if (text.length <= 14) return text;
  return `${text.slice(0, 6)}...${text.slice(-5)}`;
}

function certValue(certData, key, fallback = "-") {
  return certData?.[key] ?? fallback;
}

export default function App() {
  const [actor, setActor] = useState("dev");
  const [apiStatus, setApiStatus] = useState("checking");

  const [actorId, setActorId] = useState("");
  const [devId, setDevId] = useState("");
  const [userAId, setUserAId] = useState("");
  const [userBId, setUserBId] = useState("");
  const [notaryId, setNotaryId] = useState("");

  const [certId, setCertId] = useState("");
  const [lokasi, setLokasi] = useState("");
  const [luas, setLuas] = useState();

  const [selectedCertId, setSelectedCertId] = useState("");
  const [certData, setCertData] = useState(null);

  const [myAssets, setMyAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);

  const [myActions, setMyActions] = useState([]);
  const [actionsLoading, setActionsLoading] = useState(false);

  const [saleBuyerActor, setSaleBuyerActor] = useState("userA");
  const [saleNotaryActor] = useState("notary");
  const [saleMode, setSaleMode] = useState(false);

  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showIssueForm, setShowIssueForm] = useState(false);

  const [issueCheckStatus, setIssueCheckStatus] = useState("idle");
  const [issueCheckMessage, setIssueCheckMessage] = useState("Waiting for input");

  const isNetworkOfflineError = (msg) =>
    typeof msg === "string" && (msg.includes("Failed to fetch") || msg.includes("NetworkError"));

  function addLog(type, message, payload) {
    const shouldDowngrade = apiStatus !== "online" && type === "err" && isNetworkOfflineError(message);
    const fixedType = shouldDowngrade ? "ok" : type;
    const fixedKind = shouldDowngrade ? "INFO" : type === "err" ? "ERROR" : classifyEvent(message);
    const actorLabel = ACTORS.find((a) => a.key === actor)?.label || actor;

    setLogs((prev) => [
      {
        ts: new Date().toLocaleTimeString(),
        type: fixedType,
        kind: fixedKind,
        actor: actorLabel,
        message: shouldDowngrade ? "API Offline - UI mode (fetch skipped)" : message,
        payload,
      },
      ...prev,
    ]);
  }

  useEffect(() => {
    health()
      .then(() => setApiStatus("online"))
      .catch(() => setApiStatus("offline"));
  }, []);

  useEffect(() => {
  const trimmedId = String(certId || "").trim();
  const trimmedLokasi = String(lokasi || "").trim();
  const numericLuas = Number(luas);

  if (!trimmedId && !trimmedLokasi && !luas) {
    setIssueCheckStatus("idle");
    setIssueCheckMessage("Waiting for Input");
    return;
  }

  if (!trimmedId || !trimmedLokasi || !luas) {
    setIssueCheckStatus("incomplete");
    setIssueCheckMessage("Incomplete Input");
    return;
  }

  if (!Number.isFinite(numericLuas) || numericLuas <= 0) {
    setIssueCheckStatus("error");
    setIssueCheckMessage("Invalid Area");
    return;
  }

  let cancelled = false;

  async function checkCertificateId() {
    setIssueCheckStatus("checking");
    setIssueCheckMessage("Checking Ledger");

    try {
      await getCertificate(actor, trimmedId);

      if (!cancelled) {
        setIssueCheckStatus("duplicate");
        setIssueCheckMessage("ID Already Exists");
      }
    } catch (error) {
      const msg = String(error.message || "").toLowerCase();

      if (
        msg.includes("tidak ditemukan") ||
        msg.includes("not found") ||
        msg.includes("404")
      ) {
        if (!cancelled) {
          setIssueCheckStatus("valid");
          setIssueCheckMessage("Input Valid");
        }
      } else {
        if (!cancelled) {
          setIssueCheckStatus("error");
          setIssueCheckMessage("Ledger Check Failed");
        }
      }
    }
  }

  const timeout = setTimeout(checkCertificateId, 700);

  return () => {
    cancelled = true;
    clearTimeout(timeout);
  };
}, [certId, lokasi, luas, actor]);

  useEffect(() => {
    (async () => {
      try {
        const [d, u1, u2, n] = await Promise.all([
          getMyId("dev"),
          getMyId("userA"),
          getMyId("userB"),
          getMyId("notary"),
        ]);
        setDevId(d.id);
        setUserAId(u1.id);
        setUserBId(u2.id);
        setNotaryId(n.id);
        addLog("ok", "Prefetch identity sukses (dev/userA/userB/notary)");
      } catch (e) {
        addLog("err", `Prefetch identity gagal: ${e.message}`);
        toast.error("Prefetch identity gagal", { description: e.message });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      setActorId("");
      try {
        const data = await getMyId(actor);
        setActorId(data.id);
        await loadMyAssets(actor);
        await loadMyActions(actor);
        addLog("ok", "Login actor sukses");
        toast.success("Login berhasil", { description: ACTORS.find((a) => a.key === actor)?.label });
      } catch (e) {
        addLog("err", `Login actor gagal: ${e.message}`);
        toast.error("Login gagal", { description: e.message });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor]);

  const actorKeyToId = useMemo(
    () => ({ dev: devId, userA: userAId, userB: userBId, notary: notaryId }),
    [devId, userAId, userBId, notaryId]
  );

  const ownerActorKey = useMemo(() => {
    const ownerId = certData?.Pemilik;
    if (!ownerId) return null;
    if (ownerId === devId) return "dev";
    if (ownerId === userAId) return "userA";
    if (ownerId === userBId) return "userB";
    if (ownerId === notaryId) return "notary";
    return null;
  }, [certData, devId, userAId, userBId, notaryId]);

  const buyerOptions = useMemo(() => {
    const opts = [
      { value: "userA", label: "Customer A" },
      { value: "userB", label: "Customer B" },
    ];
    return opts.filter((o) => o.value !== ownerActorKey);
  }, [ownerActorKey]);

  useEffect(() => {
    if (!buyerOptions.find((o) => o.value === saleBuyerActor)) {
      setSaleBuyerActor(buyerOptions[0]?.value || "userA");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyerOptions]);

  const resolvedBuyerId = actorKeyToId[saleBuyerActor] || "";
  const resolvedNotaryId = actorKeyToId[saleNotaryActor] || "";

  const approvals = certData?.Persetujuan || null;
  const approvalExists = approvals && typeof approvals === "object";
  const myApprovalValue = approvalExists && actorId ? approvals[actorId] : undefined;

  const status = certData?.Status || "";
  const isOwner = !!certData?.Pemilik && !!actorId && certData.Pemilik === actorId;
  const isBuyer = !!certData?.CalonPembeli && !!actorId && certData.CalonPembeli === actorId;
  const isParticipant = approvalExists && actorId && Object.prototype.hasOwnProperty.call(approvals, actorId);

  const canApprove = status === "Proses Jual" && isParticipant && myApprovalValue === false;
  const canInitiateSale = status === "Tersedia" && isOwner;
  const canCancel = status === "Proses Jual" && isParticipant;
  const showIssuePanel = actor === "dev";

  const roleLabel = useMemo(() => {
    if (isOwner) return "Seller (Owner)";
    if (isBuyer) return "Buyer (Calon Pembeli)";
    if (actor === "notary") return "Notaris";
    return "Viewer";
  }, [isOwner, isBuyer, actor]);

  async function loadMyAssets(targetActor = actor) {
    setAssetsLoading(true);

    try {
      const data = await getMyAssets(targetActor);
      const assets = Array.isArray(data?.assets) ? data.assets : [];

      setMyAssets(assets);
      addLog("ok", `Load assets ${targetActor} sukses`, assets);
    } catch (e) {
      setMyAssets([]);
      addLog("err", `Load assets gagal: ${e.message}`);
    } finally {
      setAssetsLoading(false);
    }
  }

  async function loadMyActions(targetActor = actor) {
    setActionsLoading(true);

    try {
      const data = await getMyActions(targetActor);
      const actions = Array.isArray(data?.actions) ? data.actions : [];

      setMyActions(actions);
      addLog("ok", `Load actions ${targetActor} sukses`, actions);
    } catch (e) {
      setMyActions([]);
      addLog("err", `Load actions gagal: ${e.message}`);
    } finally {
      setActionsLoading(false);
    }
  }

  async function onQueryCert(id) {
    setBusy(true);
    try {
      const data = await getCertificate(actor, id);
      setCertData(data);
      addLog("ok", `QuerySertifikat ${id} sukses`, data);
      toast.success("Query berhasil", { description: `Sertifikat ${id} ditemukan` });
      return true;
    } catch (e) {
      addLog("err", `QuerySertifikat gagal: ${e.message}`);
      toast.error("Query gagal", { description: e.message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onCreateCert() {
    if (issueCheckStatus !== "valid") {
      toast.error("Input belum valid", {
        description: issueCheckMessage,
      });
      return;
    }

    setBusy(true);
    try {
      const res = await createCertificate(actor, { id: certId, lokasi, luas });
      addLog("ok", `TerbitkanSertifikat ${certId} sukses`, res);
      toast.success("Terbitkan berhasil", { description: `Sertifikat ${certId} dibuat` });
      setSelectedCertId(certId);
      await onQueryCert(certId);
      await loadMyAssets(actor);
      return true;
    } catch (e) {
      addLog("err", `TerbitkanSertifikat gagal: ${e.message}`);
      toast.error("Terbitkan gagal", { description: e.message });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onInitiateSale() {
    setBusy(true);
    try {
      if (!resolvedBuyerId || !resolvedNotaryId) throw new Error("BuyerID/NotaryID belum siap");
      const res = await initiateSale(actor, {
        id: selectedCertId,
        calonPembeliID: resolvedBuyerId,
        notarisID: resolvedNotaryId,
      });
      addLog("ok", `AjukanJualBeli ${selectedCertId} sukses`, res);
      toast.success("Jual-beli diajukan", { description: `Sertifikat ${selectedCertId} masuk proses jual` });
      await onQueryCert(selectedCertId);
      await loadMyAssets(actor);
      await loadMyActions(actor);
      setSaleMode(false);
    } catch (e) {
      addLog("err", `AjukanJualBeli gagal: ${e.message}`);
      toast.error("Ajukan jual-beli gagal", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function onApprove(targetId = selectedCertId) {
    if (targetId?.preventDefault) {
      targetId = selectedCertId;
    }
    
    if (!targetId) {
      toast.error("Approval gagal", {
        description: "Tidak ada sertifikat yang dipilih.",
      });
      return;
    }

    setBusy(true);

    try {
      const res = await approveSale(actor, { id: targetId });

      addLog("ok", `SetujuiJualBeli ${targetId} sukses`, res);
      toast.success("Approval berhasil", {
        description: `Sertifikat ${targetId} berhasil disetujui`,
      });

      setSelectedCertId(targetId);
      await onQueryCert(targetId);
      await loadMyAssets(actor);
      await loadMyActions(actor);
    } catch (e) {
      addLog("err", `SetujuiJualBeli gagal: ${e.message}`);
      toast.error("Approval gagal", {
        description: e.message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function onCancel(targetId = selectedCertId) {
    if (targetId?.preventDefault) {
      targetId = selectedCertId;
    }
    
    if (!targetId) {
      toast.error("Cancel gagal", {
        description: "Tidak ada sertifikat yang dipilih.",
      });
      return;
    }

    setBusy(true);

    try {
      const res = await cancelSale(actor, { id: targetId });

      addLog("ok", `BatalkanJualBeli ${targetId} sukses`, res);
      toast.success("Transaksi dibatalkan", {
        description: `Transaksi sertifikat ${targetId} berhasil dibatalkan`,
      });

      setSelectedCertId(targetId);
      await onQueryCert(targetId);
      await loadMyAssets(actor);
      await loadMyActions(actor);
    } catch (e) {
      addLog("err", `BatalkanJualBeli gagal: ${e.message}`);
      toast.error("Cancel gagal", {
        description: e.message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function onMintCertificate() {
    const success = await onCreateCert();
    if (success) setShowIssueForm(false);
  }

  const ActorIcon = ACTORS.find((a) => a.key === actor)?.icon || UserRound;
  const badge = statusBadge(status);

  const previewAssets = certData && actorId && certData.Pemilik === actorId? [certData]: [];

  const primaryAsset = getAssetsForActor(actor, actorId, certData, actorKeyToId)[0];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0B1220] text-slate-100">
      <BackdropScene />

      <StickyHeader
        actor={actor}
        setActor={setActor}
        apiStatus={apiStatus}
        ACTORS={ACTORS}
        ActorIcon={ActorIcon}
      />

      <main className="relative z-10 mx-auto max-w-[1440px] px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <HeroBanner actor={actor} apiStatus={apiStatus} actorId={actorId} />

        {actor === "notary" ? (
          <section className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[0.82fr_1.58fr]">
            <ChainOfTitlePanel
              selectedCertId={selectedCertId}
              setSelectedCertId={setSelectedCertId}
              onQueryCert={onQueryCert}
              busy={busy}
              certData={certData}
              logs={logs}
              badge={badge}
              roleLabel={roleLabel}
              isOwner={isOwner}
              isBuyer={isBuyer}
              actorKeyToId={actorKeyToId}
              compact
            />

            <ActionQueuePanel
              actor={actor}
              busy={busy}
              certData={certData}
              selectedCertId={selectedCertId}
              canInitiateSale={canInitiateSale}
              canApprove={canApprove}
              canCancel={canCancel}
              saleBuyerActor={saleBuyerActor}
              setSaleBuyerActor={setSaleBuyerActor}
              buyerOptions={buyerOptions}
              resolvedBuyerId={resolvedBuyerId}
              resolvedNotaryId={resolvedNotaryId}
              onInitiateSale={onInitiateSale}
              onApprove={onApprove}
              onCancel={onCancel}
              actorKeyToId={actorKeyToId}
              actions={myActions}
              actionsLoading={actionsLoading}
              onViewAction={(id) => {
                setSelectedCertId(id);
                setSaleMode(false);
                onQueryCert(id);
              }}
              detailed
            />
          </section>
        ) : (
          <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.62fr)_minmax(320px,0.7fr)]">
            <ChainOfTitlePanel
              selectedCertId={selectedCertId}
              setSelectedCertId={setSelectedCertId}
              onQueryCert={onQueryCert}
              busy={busy}
              certData={certData}
              logs={logs}
              badge={badge}
              roleLabel={roleLabel}
              isOwner={isOwner}
              isBuyer={isBuyer}
              actorKeyToId={actorKeyToId}
              compact
            />

            <PrimaryAssetPanel
              asset={primaryAsset}
              canSell={primaryAsset?.real && canInitiateSale}
              canApprove={canApprove}
              canCancel={canCancel}
              actor={actor}
              actorKeyToId={actorKeyToId}
              saleMode={saleMode}
              setSaleMode={setSaleMode}
              saleBuyerActor={saleBuyerActor}
              setSaleBuyerActor={setSaleBuyerActor}
              buyerOptions={buyerOptions}
              resolvedBuyerId={resolvedBuyerId}
              resolvedNotaryId={resolvedNotaryId}
              onInitiateSale={onInitiateSale}
              onApprove={onApprove}
              onCancel={onCancel}
              busy={busy}
            />

            <ActionQueuePanel
              actor={actor}
              busy={busy}
              certData={certData}
              selectedCertId={selectedCertId}
              canInitiateSale={canInitiateSale}
              canApprove={canApprove}
              canCancel={canCancel}
              saleBuyerActor={saleBuyerActor}
              setSaleBuyerActor={setSaleBuyerActor}
              buyerOptions={buyerOptions}
              resolvedBuyerId={resolvedBuyerId}
              resolvedNotaryId={resolvedNotaryId}
              onInitiateSale={onInitiateSale}
              onApprove={onApprove}
              onCancel={onCancel}
              actorKeyToId={actorKeyToId}
              actions={myActions}
              actionsLoading={actionsLoading}
              onViewAction={(id) => {
                setSelectedCertId(id);
                setSaleMode(false);
                onQueryCert(id);
              }}
            />
          </section>
        )}

        {actor !== "notary" && (
          <AssetsPanel
            actor={actor}
            assets={myAssets}
            assetsLoading={assetsLoading}
            onViewAsset={(id) => {
              setSelectedCertId(id);
              setSaleMode(false);
              onQueryCert(id);
            }}
            showIssueForm={showIssueForm}
            setShowIssueForm={setShowIssueForm}
            certId={certId}
            setCertId={setCertId}
            lokasi={lokasi}
            setLokasi={setLokasi}
            luas={luas}
            setLuas={setLuas}
            onMint={onMintCertificate}
            busy={busy}
            issueCheckStatus={issueCheckStatus}
            issueCheckMessage={issueCheckMessage}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}

function BackdropScene() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[url('/bg1.png')] bg-cover bg-center opacity-40" />
    </div>
  );
}

function StickyHeader({ actor, setActor, apiStatus, ACTORS, ActorIcon }) {
  const statusLabel = apiStatus === "online" ? "API Online" : apiStatus === "offline" ? "API Offline" : "Checking";

  return (
    <header className="sticky top-0 z-50 px-4 pt-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#080d1a]/78 px-4 py-3 shadow-[0_16px_38px_rgba(0,0,0,0.35)] backdrop-blur-xl md:flex-row md:items-center md:justify-between lg:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10">
              <ActorIcon className="h-5 w-5 text-cyan-200" />
            </div>
            <div>
              <div className="text-lg font-semibold text-cyan-300">Sistem Digital Administrasi Tanah</div>
              <div className="text-xs text-slate-500">Otomatisasi Sertifikasi & Jual-Beli Tanah</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                className="h-10 rounded-full bg-cyan-300 px-6 text-sm font-semibold text-slate-950 shadow-[0_10px_30px_rgba(103,232,249,0.24)] hover:bg-cyan-200"
              >
                {ACTORS.map((a) => (
                  <option key={a.key} value={a.key} className="bg-slate-950 text-slate-100">
                    {a.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

          </div>
        </div>
      </div>
    </header>
  );
}

function HeroBanner({ actor, apiStatus, actorId }) {
  const syncLabel = apiStatus === "online" ? "Synced with API" : apiStatus === "offline" ? "API Offline" : "Checking API";

  return (
    <section className="px-1 py-7 sm:py-9 lg:min-h-[260px] lg:py-10">
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="rounded-full border border-cyan-300/30 bg-cyan-300/15 px-4 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-100">
            {nodeBadge(actor)}
          </Badge>
          <div className={`flex items-center gap-2 text-sm ${
            apiStatus === "online"
              ? "text-cyan-200"
              : apiStatus === "offline"
                ? "text-rose-300"
                : "text-slate-300"
                }`}>
            <span className={`h-2 w-2 rounded-full ${
              apiStatus === "online"
              ? "bg-cyan-300 shadow-[0_0_12px_rgba(196,181,253,0.8)]"
              : apiStatus === "offline"
                ? "bg-rose-400 shadow-[0_0_12px_rgba(252,211,77,0.8)]"
                : "bg-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.7)]"
                }`} />
            {syncLabel}
          </div>
        </div>

        <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[0.98] text-slate-100 md:text-6xl lg:text-[72px]">
          Dashboard Administrasi Tanah Digital
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 md:text-lg">
          Kelola penerbitan sertifikat, proses jual-beli, dan persetujuan Customer serta Notaris dalam satu ruang kerja
          yang rapi, terlacak, dan mudah dipahami.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="h-10 rounded-lg border-cyan-300/50 bg-cyan-300/5 px-4 text-cyan-100 hover:bg-cyan-300/10 hover:text-cyan-50"
            title={actorId || "Actor ID loading"}
          >
            <Shield className="h-4 w-4" />
            Actor ID: {shortId(actorId) || "..."}
          </Button>
        </div>
      </div>
    </section>
  );
}

function ChainOfTitlePanel({
  selectedCertId,
  setSelectedCertId,
  onQueryCert,
  busy,
  certData,
  logs,
  badge,
  roleLabel,
  isOwner,
  isBuyer,
  actorKeyToId,
  compact = false,
}) {
  const timeline = buildTimeline(certData, logs);

  return (
    <GlassCard className={compact ? "flex h-[390px] flex-col overflow-hidden p-4" : ""}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <SectionTitle
          icon={<Activity className={compact ? "h-5 w-5 text-cyan-200" : "h-6 w-6 text-cyan-200"} />}
          title={compact ? "Chain of Title Explorer" : "Chain of Title"}
          subtitle={compact ? "Trace transaction history." : "Immutable provenance tracking"}
          compact={compact}
        />
      </div>

      <div className={compact ? "mt-5 flex flex-col gap-2 md:flex-row" : "mt-7 flex flex-col gap-3 md:flex-row"}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={selectedCertId}
            onChange={(e) => setSelectedCertId(e.target.value)}
            placeholder="Enter Parcel ID, Transaction Hash, or Owner Address..."
            className={`${compact ? "h-11" : "h-14"} rounded-lg border-white/10 bg-white/10 pl-11 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/40`}
          />
        </div>
        <Button
          disabled={busy}
          onClick={() => onQueryCert(selectedCertId)}
          className={`${compact ? "h-11 px-5" : "h-14 px-7"} rounded-lg ${primaryButtonClass}`}
        >
          {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Query
        </Button>
      </div>

      {certData && compact && (
        <div className="mt-3 rounded-xl border border-cyan-300/15 bg-slate-950/35 p-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
              <span className="shrink-0 text-slate-500">ID</span>
              <span className="truncate text-right font-semibold text-slate-100">
                {certValue(certData, "ID")}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
              <span className="shrink-0 text-slate-500">Status</span>
              <span className="truncate text-right font-semibold text-slate-100">
                {certValue(certData, "Status")}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
              <span className="shrink-0 text-slate-500">Owner</span>
              <span className="truncate text-right font-semibold text-slate-100">
                {actorNameFromId(certValue(certData, "Pemilik"), actorKeyToId)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
              <span className="shrink-0 text-slate-500">Area</span>
              <span className="truncate text-right font-semibold text-slate-100">
                {certValue(certData, "Luas")} sqm
              </span>
            </div>
          </div>
        </div>
      )}

      {certData && !compact && (
        <Tabs defaultValue="summary" className="mt-6">
          <TabsList className="rounded-xl border border-white/10 bg-slate-950/50 p-1">
            <TabsTrigger value="summary" className="rounded-lg data-[state=active]:bg-cyan-300/15 data-[state=active]:text-cyan-100">
              Certificate
            </TabsTrigger>
            <TabsTrigger value="json" className="rounded-lg data-[state=active]:bg-cyan-300/15 data-[state=active]:text-cyan-100">
              Ledger JSON
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-4">
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <LedgerMetric label="ID" value={certValue(certData, "ID")} />
                <LedgerMetric label="Lokasi" value={certValue(certData, "Lokasi")} />
                <LedgerMetric label="Luas" value={`${certValue(certData, "Luas")} sqm`} />
                <LedgerMetric label="Status" value={certValue(certData, "Status")} />
                <LedgerMetric label="Pemilik" value={actorNameFromId(certValue(certData, "Pemilik"), actorKeyToId)} />
                <LedgerMetric label="Calon Pembeli" value={actorNameFromId(certValue(certData, "CalonPembeli"), actorKeyToId)} />
              </div>
              <ApprovalStrip approvals={certData.Persetujuan} isOwner={isOwner} isBuyer={isBuyer} />
            </div>
          </TabsContent>

          <TabsContent value="json" className="mt-4">
            <pre className="max-h-72 overflow-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-xs leading-6 text-slate-300">
              {JSON.stringify(certData, null, 2)}
            </pre>
          </TabsContent>
        </Tabs>
      )}

      <div className={compact ? "mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-2" : "mt-7 space-y-4"}>
        {timeline.length > 0 ? (
          timeline.map((item, index) => (
            <TimelineItem key={`${item.title}-${index}`} item={item} active={index === 0} compact={compact} />
          ))
        ) : (
          <EmptyTimelineState />
        )}
      </div>
    </GlassCard>
  );
}

function ActionQueuePanel({
  actor,
  busy,
  certData,
  selectedCertId,
  canInitiateSale,
  canApprove,
  canCancel,
  saleBuyerActor,
  setSaleBuyerActor,
  buyerOptions,
  resolvedBuyerId,
  resolvedNotaryId,
  onInitiateSale,
  onApprove,
  onCancel,
  actorKeyToId,
  actions = [],
  actionsLoading = false,
  onViewAction,
  detailed = false,
}) {
  const isNotary = actor === "notary";
  const title = isNotary ? "Validation Queue" : "Action & Validation";
  const actionItems = Array.isArray(actions) ? actions : [];
  const pendingCount = actionItems.length;

  if (isNotary && detailed) {
    return (
      <DetailedNotaryQueue
        busy={busy}
        actions={actionItems}
        actionsLoading={actionsLoading}
        actorKeyToId={actorKeyToId}
        onApprove={onApprove}
        onCancel={onCancel}
      />
    );
  }

  return (
    <GlassCard id="action-queue" className="h-full min-h-[330px] p-5">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle
          icon={<ClipboardCheck className="h-5 w-5 text-violet-200" />}
          title={title}
          subtitle="Daftar transaksi aktif yang melibatkan role saat ini."
          compact
        />

        <Badge className="rounded-full bg-violet-500/80 px-3 py-1 text-white">
          {pendingCount} Pending
        </Badge>
      </div>

      <div className="mt-5 space-y-3">
        {actionsLoading ? (
          <QueueCard tone="empty" label="LOADING" title="Memuat transaksi">
            <p className="text-sm text-slate-400">
              Sistem sedang mengambil daftar transaksi aktif dari ledger.
            </p>
          </QueueCard>
        ) : actionItems.length > 0 ? (
          actionItems.map((item) => (
            <ActionListItem
              key={item.ID}
              item={item}
              actorKeyToId={actorKeyToId}
              onView={() => onViewAction?.(item.ID)}
            />
          ))
        ) : (
          <QueueCard tone="empty" label="READY" title="Belum ada transaksi aktif">
            <p className="text-sm text-slate-400">
              Transaksi jual-beli yang melibatkan role ini akan muncul di sini.
            </p>
          </QueueCard>
        )}
      </div>
    </GlassCard>
  );
}

function ActionListItem({ item, actorKeyToId, onView }) {
  const progress = getApprovalProgress(item?.Persetujuan);
  const seller = actorNameFromId(item?.Pemilik, actorKeyToId);
  const buyer = actorNameFromId(item?.CalonPembeli, actorKeyToId);

  return (
    <div className="rounded-xl border border-cyan-300/20 bg-slate-950/38 p-4 transition hover:border-cyan-300/35 hover:bg-slate-950/50">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-100">
              Transfer
            </Badge>
            <h3 className="text-lg font-semibold text-slate-100">
              {item?.ID || "Unknown Certificate"}
            </h3>
          </div>

          <p className="mt-2 text-sm text-slate-300">
            {item?.Lokasi || "Lokasi tidak tersedia"}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Seller: <span className="text-slate-300">{seller}</span>
            {" · "}
            Buyer: <span className="text-slate-300">{buyer}</span>
          </p>
        </div>

        <Button
          onClick={onView}
          variant="outline"
          className="w-full rounded-lg border-cyan-300/40 bg-cyan-300/5 text-cyan-100 hover:bg-cyan-300/10 sm:w-auto"
        >
          <Search className="h-4 w-4" />
          View
        </Button>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
          <span>Status: {item?.Status || "-"}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-violet-400"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function DetailedNotaryQueue({
  actions = [],
  actionsLoading = false,
  actorKeyToId,
  onApprove,
  onCancel,
  busy,
}) {
  const actionItems = Array.isArray(actions) ? actions : [];

  return (
    <GlassCard id="action-queue" className="min-h-[330px] p-5">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle
          icon={<ClipboardCheck className="h-5 w-5 text-violet-200" />}
          title="Validation Queue"
          subtitle="Daftar transaksi yang membutuhkan validasi notaris."
          compact
        />

        <Badge className="rounded-full bg-violet-500 px-3 py-1 text-white">
          {actionItems.length} Pending
        </Badge>
      </div>

      <div className="mt-5 space-y-3">
        {actionsLoading ? (
          <QueueCard tone="empty" label="LOADING" title="Memuat validation queue">
            <p className="text-sm text-slate-400">
              Sistem sedang mengambil daftar transaksi aktif dari ledger.
            </p>
          </QueueCard>
        ) : actionItems.length > 0 ? (
          actionItems.map((item) => (
            <NotaryValidationItem
              key={item.ID}
              item={item}
              actorKeyToId={actorKeyToId}
              busy={busy}
              onApprove={() => onApprove?.(item.ID)}
              onCancel={() => onCancel?.(item.ID)}
            />
          ))
        ) : (
          <QueueCard tone="empty" label="EMPTY QUEUE" title="Belum ada validasi">
            <p className="text-sm text-slate-400">
              Transaksi yang membutuhkan validasi notaris akan muncul pada daftar ini.
            </p>
          </QueueCard>
        )}
      </div>
    </GlassCard>
  );
}

function NotaryValidationItem({
  item,
  actorKeyToId,
  busy,
  onApprove,
  onCancel,
}) {
  const progress = getApprovalProgress(item?.Persetujuan);
  const seller = actorNameFromId(item?.Pemilik, actorKeyToId);
  const buyer = actorNameFromId(item?.CalonPembeli, actorKeyToId);

  return (
    <div className="rounded-xl border border-cyan-300/20 bg-slate-950/38 p-4 transition hover:border-cyan-300/35 hover:bg-slate-950/50">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-100">
              Transfer
            </Badge>

            <h3 className="text-lg font-semibold text-slate-100">
              {item?.ID || "Unknown Certificate"}
            </h3>

            <Badge className="rounded-md border border-violet-300/25 bg-violet-300/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-100">
              Awaiting Signature
            </Badge>
          </div>

          <p className="mt-2 text-sm text-slate-300">
            {item?.Lokasi || "Lokasi tidak tersedia"}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Seller: <span className="text-slate-300">{seller}</span>
            {" · "}
            Buyer: <span className="text-slate-300">{buyer}</span>
          </p>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>Status: {item?.Status || "-"}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-violet-400"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-[190px]">
          <Button
            disabled={busy}
            onClick={onApprove}
            className={`w-full justify-center rounded-lg px-4 py-3 text-sm font-semibold ${primaryButtonClass}`}
          >
            {busy ? (
              <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <FileCheck2 className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate">Verify & Sign</span>
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={busy}
                variant="outline"
                className="w-full justify-center rounded-lg border border-rose-400/35 bg-transparent px-4 py-3 text-sm font-semibold text-rose-200 hover:border-rose-300/50 hover:bg-rose-400/10"
              >
                <XCircle className="h-4 w-4 shrink-0" />
                <span className="truncate">Reject</span>
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent className="border-white/10 bg-slate-950 text-slate-100">
              <AlertDialogHeader>
                <AlertDialogTitle>Batalkan transaksi?</AlertDialogTitle>
                <AlertDialogDescription className="text-slate-400">
                  Tindakan ini akan membatalkan proses jual-beli untuk sertifikat{" "}
                  <b>{item?.ID}</b>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-lg border-white/10 bg-white/5 text-slate-100 hover:bg-white/10">
                  Tidak
                </AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-lg bg-rose-500 text-white hover:bg-rose-400"
                  onClick={onCancel}
                >
                  Ya, batalkan
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function CenterWorkbenchPanel({
  actor,
  actorId,
  certData,
  canInitiateSale,
  canApprove,
  canCancel,
  actorKeyToId,

  saleMode,
  setSaleMode,
  saleBuyerActor,
  setSaleBuyerActor,
  buyerOptions,
  resolvedBuyerId,
  resolvedNotaryId,
  onInitiateSale,
  onApprove,
  onCancel,
  busy,
}) {
  const primaryAsset = getAssetsForActor(actor, actorId, certData, actorKeyToId)[0];

  return (
    <PrimaryAssetPanel
      asset={primaryAsset}
      canSell={primaryAsset?.real && canInitiateSale}
      canApprove={canApprove}
      canCancel={canCancel}
      actor={actor}
      actorKeyToId={actorKeyToId}
      saleMode={saleMode}
      setSaleMode={setSaleMode}
      saleBuyerActor={saleBuyerActor}
      setSaleBuyerActor={setSaleBuyerActor}
      buyerOptions={buyerOptions}
      resolvedBuyerId={resolvedBuyerId}
      resolvedNotaryId={resolvedNotaryId}
      onInitiateSale={onInitiateSale}
      onApprove={onApprove}
      onCancel={onCancel}
      busy={busy}
    />
  );
}

function PrimaryAssetPanel({
  asset,
  canSell,
  canApprove,
  canCancel,
  actor,
  actorKeyToId,

  saleMode,
  setSaleMode,
  saleBuyerActor,
  setSaleBuyerActor,
  buyerOptions,
  resolvedBuyerId,
  resolvedNotaryId,
  onInitiateSale,
  onApprove,
  onCancel,
  busy,
}) {
  const Icon = asset?.icon || Home;
  const isSaleProcess = asset?.status === "Proses Jual";
  const isNotary = actor === "notary";
  const approveLabel = isNotary ? "Verify & Sign" : "Approve";
  const cancelLabel = isNotary ? "Reject" : "Cancel Transaction";

  if (!asset) {
    return (
      <GlassCard id="asset-management" className="flex min-h-[330px] flex-col justify-center p-5">
        <SectionTitle
          icon={<Tag className="h-5 w-5 text-cyan-200" />}
          title="Asset Management"
          subtitle="Aset utama atau proses terdepan."
          compact
        />
        <div className="mt-6 rounded-xl border border-dashed border-cyan-300/25 bg-slate-950/35 p-5 text-sm leading-6 text-slate-400">
          Pilih Aset untuk melihat detail aset.
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard id="asset-management" className="flex min-h-[330px] flex-col justify-between p-5">
      <SectionTitle
        icon={<Tag className="h-5 w-5 text-cyan-200" />}
        title="Asset Management"
        subtitle="Aset utama atau proses terdepan."
        compact
      />

      <div className="mt-5 flex items-start gap-4">
        <div className="min-w-0 flex-1 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">ID:</span>
            <span className="truncate text-right text-slate-100">
              {asset?.id || asset?.title || "No active asset"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Location:</span>
            <span className="truncate text-right text-slate-100">
              {asset?.lokasi || asset?.zone || "-"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Area:</span>
            <span className="text-right text-slate-100">
              {asset?.area || "-"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Owner:</span>
            <span className="text-right text-cyan-200">
              {actorNameFromId(asset?.owner, actorKeyToId)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Status:</span>
            <span className="text-right text-slate-100">
              {asset?.status || "-"}
            </span>
          </div>

          <Badge className="rounded-full bg-emerald-400/15 px-3 py-1 text-emerald-200">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            Live Ledger Asset
          </Badge>
        </div>

        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/10">
          <Icon className="h-11 w-11 text-cyan-200/80" />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {!isSaleProcess ? (
          !saleMode ? (
            <Button
              disabled={!canSell}
              onClick={() => setSaleMode(true)}
              className={`w-full rounded-lg ${primaryButtonClass}`}
            >
              <Tag className="h-4 w-4" />
              Sell Property
            </Button>
          ) : (
            <div className="rounded-xl border border-cyan-300/20 bg-slate-950/45 p-4">
              <Field label="Calon Pembeli">
                <div className="relative">
                  <select
                    value={saleBuyerActor}
                    onChange={(e) => setSaleBuyerActor(e.target.value)}
                    className="h-11 w-full appearance-none rounded-lg border border-white/10 bg-slate-950/70 px-3 pr-9 text-sm text-slate-100 outline-none focus:border-cyan-300/60"
                  >
                    {buyerOptions.map((o) => (
                      <option key={o.value} value={o.value} className="bg-slate-950 text-slate-100">
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </Field>

              <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/50 p-3 text-xs leading-5 text-slate-400">
                <div>
                  Buyer:{" "}
                  <span className="text-slate-200">
                    {actorNameFromId(resolvedBuyerId, actorKeyToId)}
                  </span>
                </div>
                <div>
                  Validator:{" "}
                  <span className="text-slate-200">
                    {actorNameFromId(resolvedNotaryId, actorKeyToId)}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setSaleMode(false)}
                  className="rounded-lg border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                >
                  Cancel
                </Button>

                <Button
                  disabled={busy}
                  onClick={onInitiateSale}
                  className={`min-w-0 rounded-lg px-3 text-xs sm:text-sm ${primaryButtonClass}`}
                >
                  {busy ? (
                    <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <Handshake className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate">Jual</span>
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="rounded-xl border border-white/10 bg-slate-950/45 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">
                  Transaksi sedang berjalan
                </p>
              </div>

              <Badge className="shrink-0 rounded-md border border-violet-300/25 bg-violet-300/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-100">
                Awaiting Signature
              </Badge>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <Button
                disabled={!canApprove || busy}
                onClick={() => onApprove?.(asset?.id)}
                className={`w-full justify-center rounded-lg px-4 py-3 text-sm font-semibold ${primaryButtonClass}`}
              >
                {busy ? (
                  <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <FileCheck2 className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate">{approveLabel}</span>
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={!canCancel || busy}
                    variant="outline"
                    className="w-full justify-center rounded-lg border border-rose-400/35 bg-transparent px-4 py-3 text-sm font-semibold text-rose-200 hover:border-rose-300/50 hover:bg-rose-400/10"
                  >
                    <XCircle className="h-4 w-4 shrink-0" />
                    <span className="truncate">{cancelLabel}</span>
                  </Button>
                </AlertDialogTrigger>

                <AlertDialogContent className="border-white/10 bg-slate-950 text-slate-100">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Batalkan transaksi?</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-400">
                      Tindakan ini akan membatalkan proses jual-beli untuk sertifikat{" "}
                      <b>{asset?.id}</b>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-lg border-white/10 bg-white/5 text-slate-100 hover:bg-white/10">
                      Tidak
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="rounded-lg bg-rose-500 text-white hover:bg-rose-400"
                      onClick={() => onCancel?.(asset?.id)}
                    >
                      Ya, batalkan
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function AssetsPanel({
  actor,
  assets = [],
  assetsLoading = false,
  onViewAsset,
  showIssueForm,
  setShowIssueForm,
  certId,
  setCertId,
  lokasi,
  setLokasi,
  luas,
  setLuas,
  onMint,
  busy,
  issueCheckStatus,
  issueCheckMessage,
}) {
  const isDeveloper = actor === "dev";
  const title = isDeveloper ? "Active Assets" : "My Assets";
  const assetCards = mapLedgerAssetsToCards(assets);

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionTitle
          icon={isDeveloper ? <LayoutGrid className="h-6 w-6 text-violet-200" /> : <MapPin className="h-6 w-6 text-cyan-200" />}
          title={title}
          subtitle={isDeveloper ? "Daftar sertifikat yang masih dimiliki Developer." : "Daftar sertifikat yang dimiliki role aktif."}
        />
      </div>

      {assetsLoading ? (
        <div className="rounded-xl border border-white/10 bg-slate-950/35 p-6 text-sm text-slate-400">
          Memuat aset dari ledger...
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
          {assetCards.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onView={() => onViewAsset?.(asset.id)}
            />
          ))}

          {isDeveloper && (
            <IssueCertificateCard
              showIssueForm={showIssueForm}
              setShowIssueForm={setShowIssueForm}
              certId={certId}
              setCertId={setCertId}
              lokasi={lokasi}
              setLokasi={setLokasi}
              luas={luas}
              setLuas={setLuas}
              onMint={onMint}
              busy={busy}
              issueCheckStatus={issueCheckStatus}
              issueCheckMessage={issueCheckMessage}
              featured={false}
            />
          )}

          {!isDeveloper && assetCards.length === 0 && (
            <EmptyAssetsState isDeveloper={isDeveloper} />
          )}
        </div>
      )}
    </section>
  );
}

function AssetCard({ asset, onView }) {
  const Icon = asset.icon || MapPin;
  const assetType = asset.type || "Certificate";

  return (
    <Card className="group self-start rounded-lg border border-white/10 bg-white/[0.07] p-5 text-slate-100 shadow-[0_18px_50px_rgba(0,0,0,0.24)] transition hover:border-cyan-300/30 hover:bg-white/[0.09]">
      <div className="flex items-start justify-between gap-4">
        <Badge className={`${asset.badgeClass} rounded-md px-3 py-1 text-[11px] font-bold uppercase tracking-wider`}>
          {assetType}
        </Badge>
        <Icon className="h-6 w-6 text-slate-500 transition group-hover:text-cyan-200" />
      </div>

      <div className="mt-6">
        <h3 className="text-2xl font-semibold leading-tight text-slate-100">
          {asset.id}
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          Status: <span className="text-cyan-200">{asset.status}</span>
        </p>
      </div>

      <Button
        onClick={onView}
        variant="outline"
        className="mt-6 w-full rounded-lg border-violet-300/60 bg-transparent text-violet-200 hover:bg-violet-300/10 hover:text-violet-100"
      >
        <Search className="h-4 w-4" />
        View Asset
      </Button>
    </Card>
  );
}

function IssueCertificateCard({
  showIssueForm,
  setShowIssueForm,
  certId,
  setCertId,
  lokasi,
  setLokasi,
  luas,
  setLuas,
  issueCheckStatus,
  issueCheckMessage,
  onMint,
  busy,
  featured = false,
}) {
  if (showIssueForm) {
    return (
      <IssueCertificateForm
        certId={certId}
        setCertId={setCertId}
        lokasi={lokasi}
        setLokasi={setLokasi}
        luas={luas}
        setLuas={setLuas}
        onMint={onMint}
        busy={busy}
        issueCheckStatus={issueCheckStatus}
        issueCheckMessage={issueCheckMessage}
        featured={featured}
      />
    );
  }

  return (
    <Card
      className={`flex ${
        featured ? "min-h-[330px]" : "min-h-[210px]"
      } flex-col items-center justify-center rounded-xl border border-cyan-200/20 bg-slate-950/75 bg-gradient-to-br from-cyan-400/10 via-slate-900/90 to-violet-500/20 p-5 text-center text-slate-100 shadow-[0_24px_70px_rgba(34,211,238,0.12)] backdrop-blur-xl`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-300/15 shadow-[0_0_32px_rgba(34,211,238,0.18)]">
        <ShieldCheck className="h-6 w-6 text-cyan-100" />
      </div>

      <h3 className="mt-4 text-xl font-semibold text-slate-100">
        Issue New Certificate
      </h3>

      <p className="mt-2 max-w-xs text-sm leading-5 text-slate-300">
        Draft a new land registry token onto the ledger.
      </p>

      <Button
        onClick={() => setShowIssueForm(true)}
        className={`mt-5 w-full rounded-lg ${primaryButtonClass}`}
      >
        <Tag className="h-4 w-4" />
        Create Certificate
      </Button>
    </Card>
  );
}

function IssueCertificateForm({
  certId,
  setCertId,
  lokasi,
  setLokasi,
  luas,
  setLuas,
  onMint,
  busy,
  issueCheckStatus = "idle",
  issueCheckMessage = "Waiting for Input",
  featured = false,
}) {
  const issueStatusClass =
  issueCheckStatus === "valid"
    ? "text-cyan-200"
    : issueCheckStatus === "duplicate" || issueCheckStatus === "error"
      ? "text-rose-300"
      : issueCheckStatus === "checking"
        ? "text-amber-200"
        : issueCheckStatus === "incomplete"
          ? "text-slate-300"
          : "text-slate-400";

const issueDotClass =
  issueCheckStatus === "valid"
    ? "bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.8)]"
    : issueCheckStatus === "duplicate" || issueCheckStatus === "error"
      ? "bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.8)]"
      : issueCheckStatus === "checking"
        ? "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.8)]"
        : issueCheckStatus === "incomplete"
          ? "bg-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.6)]"
          : "bg-slate-600";

  async function onCreateCert() {
    if (issueCheckStatus !== "valid") {
      toast.error("Input belum valid", {
        description: issueCheckMessage,
      });
      return;
    }
  }

  return (
    <Card className={`${featured ? "min-h-[330px]" : "min-h-[280px]"} rounded-xl border border-white/10 bg-white/[0.07] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]`}>
      <div className="mb-4 flex items-center gap-2">
        <FileCheck2 className="h-4 w-4 text-cyan-200" />
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">Issue Certificate</h3>
      </div>

      <div className="space-y-3">
        <Field label="Certificate ID">
          <Input
            value={certId}
            onChange={(e) => setCertId(e.target.value)}
            placeholder="CERT-001"
            className="h-10 rounded-md border-white/10 bg-slate-950/70 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </Field>

        <Field label="Address">
          <Input
            value={lokasi}
            onChange={(e) => setLokasi(e.target.value)}
            placeholder="Jl. Anggrek 12"
            className="h-10 rounded-md border-white/10 bg-slate-950/70 text-sm text-slate-100 placeholder:text-slate-500"
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_150px]">
          <Field label="Area (sqm)">
            <Input
              type="number"
              value={luas}
              onChange={(e) => setLuas(e.target.value)}
              placeholder="100"
              className="h-10 rounded-md border-white/10 bg-slate-950/70 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </Field>

          <Field label="System Check">
          <div
            className={`flex h-10 items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 px-2.5 text-[10px] font-bold uppercase tracking-[0.04em] ${issueStatusClass}`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${issueDotClass}`} />
            <span className="truncate">
              {issueCheckMessage}
            </span>
          </div>
        </Field>
        </div>

        <Button type="button"
          onClick={onCreateCert}
          disabled={busy || issueCheckStatus !== "valid"}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Mint to Ledger
        </Button>
      </div>
    </Card>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-[#050918] px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-bold text-cyan-300">Sistem Administrasi Tanah Berbasis Blockchain</div>
          <div className="mt-2">© 2026 Fadly Dwisima. Dibangun untuk penelitian skripsi.</div>
        </div>
        <div className="flex flex-wrap gap-5">
          <span>Network Status</span>
          <span>Documentation</span>
          <span>Privacy Policy</span>
          <span>Smart Contracts</span>
        </div>
      </div>
    </footer>
  );
}

function GlassCard({ children, className = "", ...props }) {
  return (
    <Card
      {...props}
      className={`rounded-xl border border-white/10 bg-white/[0.065] p-6 text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl ${className}`}
    >
      {children}
    </Card>
  );
}

function SectionTitle({ icon, title, subtitle, compact = false }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 text-cyan-200">{icon}</div>
      <div>
        <h2 className={`${compact ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"} font-semibold leading-tight text-slate-100`}>
          {title}
        </h2>
        {subtitle && <p className={`${compact ? "mt-1 text-xs" : "mt-2 text-sm"} leading-6 text-slate-400`}>{subtitle}</p>}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-slate-400">{label}</Label>
      {children}
    </div>
  );
}

function LedgerMetric({ label, value, compact = false }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-slate-950/45 ${compact ? "p-2.5" : "p-3"}`}>
      <div className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className={`${compact ? "mt-1 text-xs" : "mt-2 text-sm"} break-words font-semibold text-slate-100`}>{value || "-"}</div>
    </div>
  );
}

function ApprovalStrip({ approvals, isOwner, isBuyer }) {
  if (!approvals || typeof approvals !== "object") {
    return (
      <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-400">
        Persetujuan: belum ada transaksi approval aktif.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>Persetujuan</span>
        {isOwner && <Badge className="rounded-full bg-cyan-300/15 text-cyan-100">Owner view</Badge>}
        {isBuyer && <Badge className="rounded-full bg-violet-300/15 text-violet-100">Buyer view</Badge>}
      </div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(approvals).map(([id, approved]) => (
          <Badge
            key={id}
            variant="outline"
            className={`rounded-full border-white/10 px-3 py-1 ${
              approved ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-400/10 text-amber-200"
            }`}
          >
            {shortId(id)}: {approved ? "Approved" : "Pending"}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function QueueCard({ tone, label, title, children }) {
  const toneClass = {
    alert: "border-rose-300/25 bg-rose-500/5",
    info: "border-cyan-300/25 bg-cyan-300/5",
    danger: "border-rose-400/25 bg-rose-500/5",
    processing: "border-white/10 bg-slate-950/35",
    empty: "border-white/10 bg-slate-950/35",
  }[tone];

  const labelClass = {
    alert: "text-rose-200",
    info: "text-cyan-200",
    danger: "text-rose-200",
    processing: "text-cyan-200",
    empty: "text-slate-400",
  }[tone];

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className={`text-xs font-bold uppercase tracking-[0.12em] ${labelClass}`}>{label}</div>
      <h3 className="mt-2 text-xl font-semibold text-slate-100">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function EmptyActionState({ actor, certData }) {
  if (actor === "notary") {
    return (
      <QueueCard tone="empty" label="PENDING REVIEW" title="Commercial Deed Issuance">
        <p className="text-sm text-slate-400">
          Awaiting notary signature for parcel 44-B. Query a live certificate to activate approval.
        </p>
        <Button disabled variant="outline" className="mt-4 w-full rounded-lg border-cyan-300/60 bg-transparent text-cyan-200">
          <FileText className="h-4 w-4" />
          Review Document
        </Button>
      </QueueCard>
    );
  }

  return (
    <QueueCard tone="empty" label={certData ? "NO ACTION" : "READY"} title={certData ? "No Eligible Action" : "Select Certificate"}>
      <p className="text-sm text-slate-400">
        {certData
          ? "Actor ini tidak memiliki aksi yang tersedia untuk status sertifikat saat ini."
          : "Query sertifikat terlebih dahulu untuk membuka aksi jual-beli atau approval."}
      </p>
    </QueueCard>
  );
}

function EmptyTimelineState() {
  return (
    <div className="rounded-xl border border-dashed border-cyan-300/25 bg-slate-950/35 p-4 text-sm leading-6 text-slate-400">
      Belum ada aktivitas sertifikat. Query sertifikat atau lakukan pendaftaran sertifikat terlebih dahulu untuk melihat
      riwayat ledger.
    </div>
  );
}

function EmptyAssetsState({ isDeveloper }) {
  return (
    <div className="rounded-xl border border-dashed border-cyan-300/25 bg-slate-950/35 p-6 text-sm leading-6 text-slate-400">
      {isDeveloper
        ? "Belum ada sertifikat, lakukan pendaftaran sertifikat terlebih dahulu."
        : "Belum ada aset, hubungi developer untuk melakukan transaksi aset."}
    </div>
  );
}

function TimelineItem({ item, active, compact = false }) {
  return (
    <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-3">
      <div className="relative flex justify-center">
        <span
          className={`mt-3 ${compact ? "h-3.5 w-3.5" : "h-4 w-4"} rounded-full border-2 ${
            active ? "border-cyan-200 bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.8)]" : "border-violet-300 bg-slate-900"
          }`}
        />
        <span className="absolute bottom-[-18px] top-9 w-px border-l border-dashed border-violet-300/50" />
      </div>
      <div className={`rounded-xl border border-white/10 bg-slate-950/38 ${compact ? "p-3" : "p-4"}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge className={`${item.badgeClass} rounded-md px-3 py-1 text-[11px] font-bold uppercase tracking-wider`}>
              {item.kind}
            </Badge>
            <h3 className={`${compact ? "mt-2 text-base" : "mt-3 text-xl"} font-semibold text-slate-100`}>{item.title}</h3>
          </div>
          <div className="text-xs text-slate-500">{item.meta}</div>
        </div>
        <p className={`${compact ? "mt-2 line-clamp-2 text-xs leading-5" : "mt-3 text-sm leading-6"} text-slate-400`}>
          {item.description}
        </p>
        <div className={`${compact ? "mt-2" : "mt-3"} flex flex-wrap items-center gap-3 text-xs text-slate-500`}>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" />
            {item.time}
          </span>
          <span className="inline-flex items-center gap-1 text-cyan-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {item.state}
          </span>
        </div>
      </div>
    </div>
  );
}

function getApprovalProgress(approvals) {
  if (!approvals || typeof approvals !== "object") return 0;
  const values = Object.values(approvals);
  if (values.length === 0) return 0;
  const approved = values.filter(Boolean).length;
  return Math.round((approved / values.length) * 100);
}

function buildTimeline(certData, logs) {
  const items = [];

  if (certData) {
    items.push({
      kind: certData.Status === "Proses Jual" ? "Transfer Pending" : "Certificate Loaded",
      title: `Parcel ${certData.ID || "Selected"}`,
      description: `${certData.Lokasi || "Lokasi belum tersedia"} - luas ${certData.Luas || "-"} sqm.`,
      meta: certData.Status || "Ledger",
      time: "Live query",
      state: certData.Status || "Confirmed",
      badgeClass: "bg-cyan-300/15 text-cyan-100",
    });
  }

  logs.slice(0, 4).forEach((log) => {
    items.push({
      kind: log.kind,
      title: log.message,
      description: `Actor: ${log.actor}`,
      meta: log.type === "ok" ? "Ledger event" : "System notice",
      time: log.ts,
      state: log.type === "ok" ? "Confirmed" : "Needs review",
      badgeClass:
        log.kind === "ERROR"
          ? "bg-rose-400/15 text-rose-100"
          : log.kind === "TX"
            ? "bg-violet-300/15 text-violet-100"
            : "bg-cyan-300/15 text-cyan-100",
    });
  });

  return items;
}

function mapLedgerAssetsToCards(assets = []) {
  if (!Array.isArray(assets)) return [];

  return assets.map((asset) => ({
    id: asset.ID || "UNKNOWN-CERT",
    type: asset.Status || "CERTIFICATE",
    title: asset.ID || "UNKNOWN-CERT",
    status: asset.Status || "-",
    lokasi: asset.Lokasi || "-",
    area: `${asset.Luas || "-"} sqm`,
    owner: asset.Pemilik,
    buyer: asset.CalonPembeli,
    icon: MapPin,
    badgeClass:
      asset.Status === "Proses Jual"
        ? "bg-amber-300/75 text-slate-950"
        : "bg-cyan-300/75 text-slate-950",
    real: true,
  }));
}

function getAssetsForActor(actor, actorId, certData, actorKeyToId) {
  if (!certData) return [];

  const ownerId = certData.Pemilik || "";
  const buyerId = certData.CalonPembeli || "";
  const approvals = certData.Persetujuan || {};

  const isOwner = ownerId === actorId;
  const isBuyer = buyerId === actorId;
  const isApprover = actorId && Object.prototype.hasOwnProperty.call(approvals, actorId);

  const certRelevant = isOwner || isBuyer || isApprover;

  if (!certRelevant) return [];

  return [
    {
      id: certData.ID || "LIVE-CERT",
      title: certData.ID || "LIVE-CERT",
      lokasi: certData.Lokasi || "-",
      zone: certData.Lokasi || "-",
      area: `${certData.Luas || "-"} sqm`,
      status: certData.Status || "-",
      owner: ownerId,
      buyer: buyerId,
      approvals,
      type: certData.Status || "CERTIFICATE",
      icon: MapPin,
      badgeClass:
        certData.Status === "Proses Jual"
          ? "bg-amber-300/75 text-slate-950"
          : "bg-cyan-300/75 text-slate-950",
      real: true,
    },
  ];
}
