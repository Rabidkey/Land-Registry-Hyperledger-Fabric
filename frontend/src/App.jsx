import React, { useState, useEffect } from "react";
import {
  Map, Building, CheckCircle2, XCircle, Clock, Search, ChevronDown,
  ChevronRight, AlertTriangle, CreditCard, Banknote
} from "lucide-react";
import * as api from "./lib/api";
import MapCluster from "./MapCluster";

export default function App() {
  // --- STATES ---
  const [actor, setActor] = useState("dev");
  const [units, setUnits] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedUnitNumber, setSelectedUnitNumber] = useState("");
  const [form, setForm] = useState({ namaCluster: "", luas: "", jumlahUnit: "", harga: "" });
  
  // State untuk Form Transaksi
  const [metodeBayar, setMetodeBayar] = useState("CASH");
  const [bankID, setBankID] = useState("");
  const [alasanBatal, setAlasanBatal] = useState("");
  
  // State untuk History
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load data setiap kali aktor berganti
  useEffect(() => {
    fetchUnits();
    // Reset selection kalau ganti role
    setSelectedUnit(null);
    setShowHistory(false);
  }, [actor]);

  // Update selectedUnit jika units berubah (biar data di sidebar up-to-date)
  useEffect(() => {
    if (selectedUnit) {
      const updatedUnit = units.find((u) => u.ID === selectedUnit.ID);
      if (updatedUnit) setSelectedUnit(updatedUnit);
    }
  }, [units]);

  // --- API CALLS ---
  const fetchUnits = async () => {
    try {
      const res = await api.getAllCertificates(actor);
      if (Array.isArray(res)) setUnits(res); 
      else if (res && res.assets) setUnits(res.assets);
      else if (res && res.data) setUnits(res.data);
      else setUnits([]); 
    } catch (err) {
      console.error("Gagal ambil data:", err.message);
    }
  };

  const handleBeli = async () => {
    if (!activeUnitData) return alert("Pilih unit terlebih dahulu!");
    setLoading(true);
    
    try {
      // 1. Ambil ID Kriptografi (Client ID Fabric) Asli
      const resDev = await api.getMyId("dev");
      const resNotaris = await api.getMyId("notaris");

      const realDevId = resDev.id || resDev.ID || resDev.clientId || resDev;
      const realNotarisId = resNotaris.id || resNotaris.ID || resNotaris.clientId || resNotaris;

      // TARIK ID BANK KHUSUS KALAU METODE BAYAR KREDIT
      let realBankId = "";
      if (metodeBayar === "KREDIT") {
        const resBank = await api.getMyId("bank");
        realBankId = resBank.id || resBank.ID || resBank.clientId || resBank;
      }

      // 2. Kirim data pengajuan
      await api.initiateSale(actor, {
        id: activeUnitData.ID || activeUnitData.id,
        metodeBayar: metodeBayar,
        devID: realDevId, 
        notarisID: realNotarisId,
        // Ini bakal otomatis kosong kalau CASH, atau keisi ID Kripto Bank kalau KREDIT
        bankID: realBankId 
      });

      alert("Pengajuan beli berhasil dikirim ke Ledger!");
      fetchUnits(); // Refresh UI
    } catch (e) { 
      alert("Gagal Beli: " + e.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleApprove = async () => {
    if (!activeUnitData) return;
    setLoading(true);
    try {
      await api.approveSale(actor, { id: activeUnitData.ID || activeUnitData.id });
      alert("Transaksi disetujui!");
      fetchUnits();
    } catch (e) { alert("Gagal Approve: " + e.message); } finally { setLoading(false); }
  };

  const handleCancel = async () => {
    if (!activeUnitData || !alasanBatal) return alert("Pilih unit dan isi alasan!");
    setLoading(true);
    try {
      await api.cancelSale(actor, { id: activeUnitData.ID || activeUnitData.id, alasan: alasanBatal });
      alert("Transaksi berhasil dibatalkan!");
      setAlasanBatal(""); 
      fetchUnits();
    } catch (e) { alert("Gagal Batal: " + e.message); } finally { setLoading(false); }
  };

  const handleCekHistory = async () => {
    if (!activeUnitData) return alert("Pilih unit terlebih dahulu!");
    try {
      const res = await api.getCertificateHistory(actor, activeUnitData.ID || activeUnitData.id);
      if (res && res.history) {
        setHistory(res.history);
        setShowHistory(true);
      } else if (Array.isArray(res)) {
        setHistory(res);
        setShowHistory(true);
      }
    } catch (e) {
      alert("Gagal ambil riwayat: " + e.message);
    }
  };

  // --- HELPER UNTUK RENDER PETA ---
  const getFillColor = (status) => {
    switch (status) {
      case "Siap Dijual": return "fill-emerald-500/80 hover:fill-emerald-400 cursor-pointer";
      case "Perlu ACC": return "fill-amber-500/80 hover:fill-amber-400 cursor-pointer";
      case "Telah Terjual": return "fill-rose-500/80 hover:fill-rose-400 cursor-pointer";
      default: return "fill-slate-800/50 pointer-events-none"; // Belum Siap / Undefined
    }
  };

  const getClusterInZone = (zoneId) => {
    return units.find((u) => {
      const lok = u.Lokasi || u.lokasi;
      return lok && lok.toLowerCase() === zoneId.toLowerCase();
    });
  };

  const getZoneStatus = (zoneId) => {
    return getClusterInZone(zoneId) ? "Sudah Diterbitkan" : "Belum Diterbitkan";
  };

  // --- LOGIKA BACKGROUND MAP DINAMIS ---
  // Filter daftar dropdown unit berdasarkan daerah yang diklik
  const filteredUnitsInZone = units.filter((u) => {
    if (!selectedZone) return false;
    const lok = u.Lokasi || u.lokasi;
    return lok && lok.toLowerCase() === selectedZone.toLowerCase();
  });

  const getBgImage = () => {
    if (!selectedZone) return '/FullMap.png'; // Peta utama
    switch(selectedZone) {
      case 'Block-A': return '/Orchid.png';
      case 'Block-B': return '/Hibiscus.png';
      case 'Block-C': return '/Lily.png'; 
      case 'Block-D': return '/Lily.png'; // Dummy sementara
      case 'Block-E': return '/Lotus.png';
      default: return '/FullMap.png'; 
    }
  };
  const bgImageUrl = getBgImage();

  const activeUnitData = units.find((u) => {
    if (!selectedZone || !selectedUnitNumber) return false;
    const unitId = String(u.ID || u.id || ""); 
    const numberOnly = unitId.includes("-") ? unitId.split("-")[1] : unitId;
    const lok = u.Lokasi || u.lokasi;
    return lok?.toLowerCase() === selectedZone.toLowerCase() && numberOnly === selectedUnitNumber;
  });

    return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex font-sans relative">
      
      {/* --- HEADER FUTURISTIK (Proporsi Diperbaiki) --- */}
      <header className="absolute top-0 left-0 w-full h-24 flex items-start justify-between px-10 pt-8 z-50 pointer-events-none">
        
        {/* Logo Kiri */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="w-6 h-6 border-[1px] border-cyan-500/80 rotate-45 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm shadow-[0_0_10px_rgba(6,182,212,0.3)]">
            <div className="w-1.5 h-1.5 bg-cyan-400"></div>
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-bold tracking-[0.1em] text-white uppercase leading-none">BloxState</h1>
            <p className="text-[8px] text-cyan-400/80 tracking-[0.2em] uppercase mt-1 font-medium">Blockchain Registry</p>
          </div>
        </div>

        {/* Dropdown Kanan */}
        <div className="flex items-center gap-4 pointer-events-auto bg-slate-950/40 px-4 py-2 rounded-full backdrop-blur-sm border border-slate-800/50">
          <span className="text-[11px] text-slate-400 uppercase tracking-[0.2em] font-bold">Akses:</span>
          <div className="relative">
            <select
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              className="bg-transparent border-b border-cyan-500/50 text-slate-100 text-sm font-mono focus:border-cyan-400 block pb-0.5 outline-none cursor-pointer hover:text-white transition-colors appearance-none pr-7"
            >
              <option className="bg-slate-900" value="dev">Developer_Node</option>
              <option className="bg-slate-900" value="pembeli">Public_Access</option>
              <option className="bg-slate-900" value="notaris">Notary_Node</option>
              <option className="bg-slate-900" value="bank">Bank_Auth</option>
            </select>
            <div className="absolute right-0 top-1 pointer-events-none text-cyan-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT (AREA PETA & CROSSFADE) --- */}
      <main className="relative flex-1 w-full h-full overflow-hidden bg-slate-950">
        
        {/* CROSS-FADE BACKGROUND TRICK (Smooth Transition) */}
        {/* 1. Gambar Peta Makro (Utama) */}
        <div 
          className={`absolute inset-0 bg-[url('/FullMap.png')] bg-cover bg-center transition-opacity duration-1000 ease-in-out z-0 ${selectedZone ? "opacity-0" : "opacity-100"}`}
        ></div>
        
        {/* 2. Gambar Peta Mikro (Zoom-in) */}
        <div 
          className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out z-0 ${selectedZone ? "opacity-100" : "opacity-0"}`}
          style={{ backgroundImage: `url('${bgImageUrl}')` }}
        ></div>

        {/* --- EFEK VIGNETTE (PINGGIRAN GELAP) --- */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-transparent to-slate-950/90 pointer-events-none z-0"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-transparent to-slate-950/90 pointer-events-none z-0"></div>

        {/* JUDUL LAYAR PENUH (Kiri Bawah) */}
        <div className={`absolute bottom-16 left-12 flex flex-col items-start pointer-events-none transition-all duration-1000 ${selectedZone ? "opacity-0 translate-y-10" : "opacity-100 translate-y-0"} z-10`}>
          <h2 className="text-5xl md:text-6xl font-light text-white tracking-[0.2em] uppercase drop-shadow-[0_0_25px_rgba(0,0,0,0.8)]">
            BloxState <span className="font-medium text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-none">Map</span>
          </h2>
          <div className="mt-6 flex items-center gap-4">
            <div className="h-[2px] w-16 bg-cyan-500 shadow-[0_0_10px_#06b6d4]"></div>
            <p className="text-slate-200 text-xs tracking-[0.4em] uppercase font-light drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              Pilih Daerah Untuk Membuka Daftar Unit
            </p>
          </div>
        </div>

        {/* RENDERING SVG */}
        {!selectedZone && (
          <div className="absolute inset-0 z-20">
            <MapCluster 
              selectedZone={selectedZone} 
              onSelectZone={(zoneId) => {
                setSelectedZone(zoneId);
                setSelectedUnitNumber(""); 
              }}
              getZoneStatus={getZoneStatus}
              actor={actor}
            />
          </div>
        )}
        {/* --- SIDEBAR PANEL DETAIL --- */}
        <div 
          className="absolute right-6 top-28 bottom-6 w-[400px] bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-950/95 backdrop-blur-2xl border border-slate-700/50 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_30px_rgba(6,182,212,0.1)_inset] overflow-hidden flex flex-col z-30 transition-all duration-700"
          style={{ 
            transform: selectedZone ? "translateX(0)" : "translateX(120%)",
            opacity: selectedZone ? 1 : 0
          }}
        >
          {selectedZone && (() => {
            const clusterData = getClusterInZone(selectedZone);
            const isPublished = !!clusterData;
            const sidebarImage = isPublished ? "/bg1.png" : "/emptyland.jpg";

            return (
              <>
                {/* --- HEADER SIDEBAR --- */}
                <div className="p-6 border-b border-slate-700/50 flex justify-between items-center relative overflow-hidden">
                  {/* Efek Garis Neon di atas header */}
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
                  <div>
                    <h3 className="text-xl font-bold text-white uppercase tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                      {isPublished ? clusterData.NamaCluster : `ZONA ${selectedZone.toUpperCase()}`}
                    </h3>
                    <p className="text-cyan-400/80 text-[10px] mt-1.5 font-mono tracking-widest">
                      {!isPublished 
                      ? "STATUS: Belum Diinisiasi" 
                      : activeUnitData 
                        ? `ID ASSET: ${activeUnitData.ID || activeUnitData.id}` 
                        : `ID KLASTER: ${clusterData.NamaCluster.toUpperCase()}`}
                    </p>
                  </div>
                  <button onClick={() => setSelectedZone(null)} className="p-2 bg-slate-800/50 hover:bg-cyan-500/20 border border-slate-700 hover:border-cyan-500/50 rounded-full transition-all duration-300 group">
                    <XCircle className="w-5 h-5 text-slate-400 group-hover:text-cyan-400" />
                  </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                  {/* --- GAMBAR AREA --- */}
                  <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-slate-700 mb-8 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                    <img src={sidebarImage} alt="Area View" className="w-full h-full object-cover transition-transform duration-1000 hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent pointer-events-none"></div>
                  </div>

                  {!isPublished ? (
                    /* --- FORM PENERBITAN (Kondisi Belum Terbit) --- */
                    <div className="space-y-4 relative">
                      {actor === "dev" ? (
                        <div className="p-5 bg-slate-950/60 border border-slate-800 rounded-2xl relative overflow-hidden backdrop-blur-md">
                          <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-500"></div>
                          
                          <p className="text-cyan-400 font-bold mb-4 text-xs tracking-[0.15em] uppercase flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                            Terbitkan Klaster Baru
                          </p>
                          
                          <input 
                            placeholder="Nama Klaster (Misal: Orchid)" 
                            className="w-full bg-slate-900/50 p-3 rounded-xl border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 text-white mb-2.5 text-sm outline-none transition-all placeholder:text-slate-500" 
                            onChange={(e) => setForm({...form, namaCluster: e.target.value})} 
                          />
                          <input 
                            type="number" 
                            placeholder="Luas Total (m²)" 
                            className="w-full bg-slate-900/50 p-3 rounded-xl border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 text-white mb-2.5 text-sm outline-none transition-all placeholder:text-slate-500" 
                            onChange={(e) => setForm({...form, luas: e.target.value})} 
                          />
                          <input 
                            type="number" 
                            placeholder="Jumlah Unit Rumah" 
                            className="w-full bg-slate-900/50 p-3 rounded-xl border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 text-white mb-2.5 text-sm outline-none transition-all placeholder:text-slate-500" 
                            onChange={(e) => setForm({...form, jumlahUnit: e.target.value})} 
                          />
                          <input 
                            type="number" 
                            placeholder="Harga per Unit (Rp)" 
                            className="w-full bg-slate-900/50 p-3 rounded-xl border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 text-white mb-5 text-sm outline-none transition-all placeholder:text-slate-500" 
                            onChange={(e) => setForm({...form, harga: e.target.value})} 
                          />
                          
                          <button 
                            onClick={async () => {
                              // Validasi 4 Field Wajib Isi
                              if(!form.namaCluster || !form.luas || !form.jumlahUnit || !form.harga) {
                                return alert("Semua form (Nama, Luas, Unit, Harga) wajib diisi!");
                              }
                              
                              setLoading(true);
                              try {
                                // Eksekusi API
                                await api.createCertificate(actor, { 
                                  namaCluster: form.namaCluster,
                                  lokasi: selectedZone, 
                                  luasTotal: form.luas,
                                  jumlahUnit: form.jumlahUnit,
                                  hargaPerUnit: form.harga 
                                });
                                
                                alert("Sertifikat Klaster & Unit berhasil diterbitkan ke Ledger!");
                                fetchUnits(); // Refresh peta & sidebar otomatis
                              } catch (e) { 
                                alert(e.message); 
                              } finally { 
                                setLoading(false); 
                              }
                            }}
                            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-3.5 rounded-xl font-bold tracking-wider text-xs shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all uppercase"
                          >
                            {loading ? "Menyinkronkan Node..." : "Terbitkan Sertifikat"}
                          </button>
                        </div>
                      ) : (
                        <div className="text-center p-8 border border-dashed border-slate-700 rounded-2xl bg-slate-950/40">
                          <Building className="text-slate-600 w-10 h-10 mx-auto mb-4 opacity-50" />
                          <p className="text-xs text-slate-400 tracking-wider leading-relaxed">AREA INI BELUM DIBUKA UNTUK AKSES PUBLIK</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* --- DETAIL & AKSI (Kondisi Sudah Terbit) --- */
                    <div className="space-y-6">
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                          <p className="text-slate-500 text-[10px] tracking-[0.2em] uppercase font-bold mb-1">Luas Area</p>
                          <p className="text-lg text-white font-mono">{clusterData.Luas} <span className="text-sm text-slate-500">m²</span></p>
                        </div>
                        <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 relative overflow-hidden">
                          <div className="absolute right-0 top-0 w-8 h-8 bg-emerald-500/10 rounded-bl-full"></div>
                          <p className="text-slate-500 text-[10px] tracking-[0.2em] uppercase font-bold mb-1">Status</p>
                          <p className="text-sm text-emerald-400 font-bold tracking-wide mt-1.5">{clusterData.Status}</p>
                        </div>
                      </div>

                      {actor === "dev" && clusterData.Status !== "Siap Dijual" && (
                        <button onClick={async() => {await api.openSale(actor, { namaCluster: clusterData.NamaCluster }); fetchUnits();}} className="w-full py-3.5 bg-emerald-500/10 border border-emerald-500/50 hover:bg-emerald-500 hover:text-white text-emerald-400 rounded-xl font-bold text-xs tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                          Tandai Siap Jual
                        </button>
                      )}

                      {/* GRID PILIH UNIT */}
                      <div className="space-y-3">
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold flex justify-between">
                          <span>Pilih Unit Kavling</span>
                          <span className="text-cyan-400">{filteredUnitsInZone.length} Unit</span>
                        </p>
                        
                        {/* Grid Kotak-Kotak Unit */}
                        <div className="grid grid-cols-5 gap-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                          {filteredUnitsInZone.map((u) => {
                            const unitId = String(u.ID || u.id || "");
                            const numberOnly = unitId.includes("-") ? unitId.split("-")[1] : unitId;
                            const stat = u.Status || u.status || "";
                            
                            // JARING SUPER LEBAR buat nangkep alasan dari backend
                            const reason = u.AlasanPembatalan || u.alasanPembatalan || u.Alasan || u.alasan || u.CancelReason || "";
                            
                            // LOGIKA WARNA NOTIFIKASI
                            let bgClass = "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"; 
                            
                            if (stat === "Siap Dijual") {
                              if (reason) {
                                // TERSEDIA KEMBALI (EX-BATAL): Background hijau redup, Garis Merah Menyala
                                bgClass = "bg-emerald-500/10 text-emerald-400 border-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] hover:bg-emerald-500/30";
                              } else {
                                // TERSEDIA NORMAL
                                bgClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30";
                              }
                            } else if (stat === "Perlu ACC") {
                              const isKredit = u.MetodeBayar === "KREDIT" || u.metodeBayar === "KREDIT";
                              
                              // CEK STATUS PERSETUJUAN DI LEDGER
                              const persetujuan = u.Persetujuan || u.persetujuan || {};
                              let hasApproved = false;
                              if (actor === "dev") hasApproved = persetujuan.dev || persetujuan.Dev === true;
                              if (actor === "notaris") hasApproved = persetujuan.notaris || persetujuan.Notaris === true;
                              if (actor === "bank") hasApproved = persetujuan.bank || persetujuan.Bank === true;

                              // KEDIP HANYA JIKA PUNYA HAK & BELUM APPROVE
                              const isMyTurnToApprove = (actor === "dev" || actor === "notaris" || (actor === "bank" && isKredit)) && !hasApproved;

                              if (isMyTurnToApprove) {
                                bgClass = "bg-amber-500/20 text-amber-400 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.4)] animate-pulse hover:bg-amber-500/30";
                              } else {
                                bgClass = "bg-amber-500/5 text-amber-500/40 border-amber-500/20 cursor-default";
                              }
                            } else if (stat === "Telah Terjual") {
                              // TERJUAL: Background Biru Gelap/Hitam (mati), Outline Hijau Terang (Sukses)
                              bgClass = "bg-slate-950 text-slate-600 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] cursor-not-allowed";
                            }

                            // Efek Kalau Kotak Sedang Diklik
                            const isSelected = selectedUnitNumber === numberOnly;
                            if (isSelected) {
                              bgClass = "bg-cyan-600 text-white border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.6)] font-black scale-105";
                            }

                            return (
                              <button
                                key={unitId}
                                onClick={() => setSelectedUnitNumber(numberOnly)}
                                className={`py-2 px-1 rounded-lg border text-xs font-mono transition-all duration-300 ${bgClass}`}
                                title={reason ? `Status: ${stat} | Riwayat Batal: ${reason}` : `Status: ${stat}`}
                              >
                                {numberOnly}
                              </button>
                            );
                          })}
                        </div>
                        
                        {/* Legenda Warna (Desain Diperbarui) */}
                        <div className="flex justify-center gap-4 mt-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800 flex-wrap backdrop-blur-sm">
                          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/50"></div><span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Tersedia</span></div>
                          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-emerald-500/10 border border-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.5)]"></div><span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Ex-Batal</span></div>
                          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-amber-500 animate-pulse shadow-[0_0_5px_#f59e0b]"></div><span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Pending</span></div>
                          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-slate-950 border border-emerald-500 shadow-[0_0_5px_#10b981]"></div><span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Terjual</span></div>
                        </div>
                      </div>

                      {/* --- DATA LEDGER UNIT & FORM TRANSAKSI --- */}
                      {activeUnitData && (
                        <div className="pt-5 border-t border-slate-700/50 space-y-5">
                          
                          <div className="space-y-3 bg-slate-950/60 p-5 rounded-2xl border border-slate-800 font-mono text-xs shadow-inner">
                            <div className="flex justify-between border-b border-slate-800/60 pb-3">
                              <span className="text-slate-500">ID ASSET</span>
                              <span className="text-cyan-400 font-bold">{activeUnitData.ID || activeUnitData.id}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800/60 pb-3">
                              <span className="text-slate-500">HARGA</span>
                              <span className="text-white font-semibold">
                                Rp {parseInt(activeUnitData.Harga || activeUnitData.harga || activeUnitData.HargaPerUnit || activeUnitData.hargaPerUnit || 0).toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800/60 pb-3">
                              <span className="text-slate-500">PEMILIK</span>
                              <span className="text-white truncate max-w-[140px]">{activeUnitData.Pemilik || activeUnitData.pemilik}</span>
                            </div>
                            {(activeUnitData.PembeliId || activeUnitData.pembeliId) && (
                              <div className="flex justify-between border-b border-slate-800/60 pb-3">
                                <span className="text-slate-500">CALON PEMBELI</span>
                                <span className="text-amber-400 font-semibold">{activeUnitData.PembeliId || activeUnitData.pembeliId}</span>
                              </div>
                            )}
                          </div>

                          {/* ACTION BUTTONS (Pembeli/Dev/Bank/Notaris) */}
                          <div className="space-y-4 pt-2">
                            
                            {/* FIX: Cek status pakai huruf besar (Status) atau kecil (status) */}
                            {actor === "pembeli" && (activeUnitData.Status === "Siap Dijual" || activeUnitData.status === "Siap Dijual") && (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <button onClick={() => setMetodeBayar("CASH")} className={`p-3 rounded-xl border flex flex-col items-center justify-center text-xs font-bold transition ${metodeBayar === "CASH" ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]" : "bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-600"}`}>
                                    <Banknote className="w-5 h-5 mb-1.5" /> CASH
                                  </button>
                                  <button onClick={() => setMetodeBayar("KREDIT")} className={`p-3 rounded-xl border flex flex-col items-center justify-center text-xs font-bold transition ${metodeBayar === "KREDIT" ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]" : "bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-600"}`}>
                                    <CreditCard className="w-5 h-5 mb-1.5" /> KREDIT
                                  </button>
                                </div>
                                {metodeBayar === "KREDIT" && (
                                  <input type="text" placeholder="ID Bank Penjamin (Misal: BCA)" value={bankID} onChange={(e) => setBankID(e.target.value)} className="w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3.5 text-xs text-white outline-none focus:border-cyan-500 transition-all" />
                                )}
                                <button onClick={handleBeli} disabled={loading} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs tracking-wider uppercase shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50 transition-all">
                                  {loading ? "Menulis ke Ledger..." : "Kirim Pengajuan Beli"}
                                </button>
                              </div>
                            )}

                            {/* --- LOGIKA AKSI SAAT PERLU ACC --- */}
                            {(activeUnitData.Status === "Perlu ACC" || activeUnitData.status === "Perlu ACC") && (() => {
                              
                              const isKredit = activeUnitData.MetodeBayar === "KREDIT" || activeUnitData.metodeBayar === "KREDIT";
                              const persetujuan = activeUnitData.Persetujuan || activeUnitData.persetujuan || {};

                              // 1. Cek apakah role yang lagi login SUDAH approve
                              let hasApproved = false;
                              if (actor === "dev") hasApproved = persetujuan.dev || persetujuan.Dev === true;
                              if (actor === "notaris") hasApproved = persetujuan.notaris || persetujuan.Notaris === true;
                              if (actor === "bank") hasApproved = persetujuan.bank || persetujuan.Bank === true;
                              
                              // 2. Tentukan siapa yang berhak Approve SEKARANG (Harus belum approve)
                              const canApprove = (actor === "dev" || actor === "notaris" || (actor === "bank" && isKredit)) && !hasApproved;
                              
                              // 3. Tentukan siapa yang berhak Batalin
                              const canCancel = actor === "pembeli" || (actor === "bank" && isKredit);

                              return (
                                <div className="space-y-3">
                                  
                                  {/* TOMBOL APPROVE (Mati/Hilang kalau sudah di-klik sebelumnya) */}
                                  {canApprove && (
                                    <button onClick={handleApprove} disabled={loading} className="w-full py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/50 hover:bg-emerald-500 text-emerald-400 hover:text-white font-bold text-xs tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex justify-center items-center gap-2">
                                      <CheckCircle2 className="w-4 h-4" /> Validasi & Setujui Transaksi
                                    </button>
                                  )}

                                  {/* TOMBOL CANCEL */}
                                  {canCancel && (
                                    <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                                      <input type="text" placeholder="Masukkan alasan pembatalan..." value={alasanBatal} onChange={(e) => setAlasanBatal(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white outline-none focus:border-rose-500 transition-all" />
                                      <button onClick={handleCancel} disabled={loading} className="w-full py-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/40 text-xs font-bold tracking-wider uppercase transition-all shadow-[0_0_10px_rgba(244,63,94,0.1)] flex justify-center items-center gap-2">
                                        <XCircle className="w-4 h-4" /> Batalkan Transaksi
                                      </button>
                                    </div>
                                  )}

                                  {/* NOTIFIKASI MENUNGGU (Muncul kalau tidak punya hak, ATAU kalau sudah selesai approve tapi nunggu yang lain) */}
                                  {!canApprove && !canCancel && (
                                    <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-center flex items-center justify-center gap-2">
                                      {hasApproved ? (
                                        <>
                                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                          <p className="text-emerald-500/80 text-[10px] uppercase tracking-widest font-bold">Telah Disetujui, Menunggu Pihak Lain</p>
                                        </>
                                      ) : (
                                        <>
                                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                                          <p className="text-amber-500/80 text-[10px] uppercase tracking-widest font-bold">Menunggu Validasi Pihak Lain</p>
                                        </>
                                      )}
                                    </div>
                                  )}

                                </div>
                              );
                            })()}

                            <div className="pt-4 border-t border-slate-800">
                              <button onClick={handleCekHistory} className="w-full py-3.5 bg-slate-950/50 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white transition-all text-xs tracking-wider uppercase font-bold flex items-center justify-center gap-2">
                                <Clock className="w-4 h-4" /> Ambil Audit Trail
                              </button>
                              {/* TIMELINE RENDER (HUMAN READABLE & FUTURISTIC) */}
                              {showHistory && (
                                <div className="mt-5 space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                  {history.map((hist, i) => {
                                    // --- 1. TANGGAL DARI GO ---
                                    const dateStr = hist.Timestamp || "-";

                                    // --- 2. TERJEMAHAN STATUS KE BAHASA MANUSIA ---
                                    // FIX UTAMA: Tarik data dari hist.Data (sesuai struct Go lu!)
                                    const val = hist.Data || {};

                                    const status = val.Status || val.status || "";
                                    const reason = val.AlasanPembatalan || val.alasanPembatalan || val.Alasan || val.alasan || val.CancelReason || "";

                                    let actionName = "Update Data Ledger";
                                    let actorName = "Sistem Node";

                                    // LOGIKA DETEKTIF AKSI
                                    if (reason) {
                                      actionName = "Pembatalan Transaksi";
                                      actorName = val.PembeliId || val.pembeliId || "Pihak Terkait";
                                    } else if (status === "Belum Dijual" || status === "") {
                                      actionName = "Penerbitan Sertifikat";
                                      actorName = "Developer";
                                    } else if (status === "Siap Dijual") {
                                      actionName = "Buka Akses Penjualan";
                                      actorName = "Developer";
                                    } else if (status === "Perlu ACC") {
                                      actionName = "Pengajuan Pembelian";
                                      actorName = val.PembeliId || val.pembeliId || "Public Access";
                                    } else if (status === "Telah Terjual") {
                                      actionName = "Persetujuan Final";
                                      actorName = "Multi-Sig (Notaris/Bank/Dev)";
                                    }

                                    const isCancel = actionName === "Pembatalan Transaksi";
                                    const lineColor = isCancel ? "bg-rose-500/50 group-hover:bg-rose-400 shadow-[0_0_10px_#f43f5e]" : "bg-cyan-500/30 group-hover:bg-cyan-400 shadow-[0_0_10px_#06b6d4]";
                                    const titleColor = isCancel ? "text-rose-400" : "text-cyan-400";
                                    const borderBox = isCancel ? "border-rose-900/50 hover:border-rose-500/50 bg-rose-950/20" : "border-slate-800 hover:border-cyan-500/50 bg-slate-950/80";

                                    return (
                                      <div key={i} className={`p-4 rounded-xl border relative overflow-hidden group transition-all backdrop-blur-sm ${borderBox}`}>
                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${lineColor} transition-colors`}></div>
                                        
                                        <div className="flex justify-between items-start mb-2.5 ml-2">
                                          <span className={`${titleColor} font-bold text-[11px] tracking-widest uppercase drop-shadow-md`}>
                                            {actionName}
                                          </span>
                                          <span className="text-slate-500 font-mono text-[9px] text-right mt-0.5">
                                            {dateStr}
                                          </span>
                                        </div>
                                        
                                        <div className="ml-2 space-y-1.5">
                                          <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                            <p className="text-slate-400 text-[10px] uppercase tracking-widest font-semibold flex-1 truncate">
                                              Aktor: <span className="text-white ml-1">{actorName}</span>
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                                            <p className="text-slate-500 text-[10px] font-mono truncate flex-1">
                                              TxHash: <span className="text-slate-400 ml-1">{hist.TxId ? hist.TxId.substring(0, 16) : ""}...</span>
                                            </p>
                                          </div>
                                          
                                          {/* KOTAK MERAH ALASAN */}
                                          {isCancel && reason && (
                                            <div className="mt-3 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-md text-[10px] text-rose-300">
                                              <span className="font-bold uppercase tracking-wider text-rose-400 mr-1">Alasan:</span> 
                                              {reason}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      </main>
    </div>
  );
}