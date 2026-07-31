'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Minus, Package, TrendingUp, TrendingDown, MapPin, Clock, X, ChevronDown, Trash2, Loader2, Wallet, LogOut, Lock, Receipt, CircleSlash, Banknote, QrCode, FileDown, Calendar, User, Pencil, Truck, Users, RotateCcw, CheckCircle2, AlertTriangle } from 'lucide-react';

const LOKASI_OPTIONS = ['Alun-alun Kidul Pagi', 'Alun-alun Kidul Sore', 'Rumah'];

const DEFAULT_JENIS = [
  { id: 'mambo', nama: 'Es Mambo', varian: [
    { nama: 'Coklat', harga: 2000 },
    { nama: 'Kacang Hijau', harga: 2500 },
    { nama: 'Vanilla', harga: 2000 },
  ]},
  { id: 'gabus', nama: 'Es Gabus', varian: [
    { nama: 'Sirup Merah', harga: 2000 },
    { nama: 'Cincau', harga: 2000 },
  ]},
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatRupiah(n) {
  return 'Rp' + n.toLocaleString('id-ID');
}

// Hitung pendapatan dari distribusi titik jual sendiri (bukan reseller) yang sudah selesai.
// Reseller sengaja TIDAK dihitung ke sini karena skema harga ke reseller beda & belum pasti.
function hitungPendapatanDistribusi(distribusiList, countingList) {
  const perDistribusi = [];
  for (const d of distribusiList) {
    if (d.tujuanTipe !== 'lokasi' || d.status !== 'selesai') continue;

    // Kelompokkan item per jenis untuk hitung rata-rata harga & terjual per jenis
    const jenisMap = {}; // jenisId -> { totalTerjual, totalRevenue }
    for (const it of d.items) {
      const terjual = it.jumlahDibawa - it.jumlahRetur;
      if (!jenisMap[it.jenisId]) jenisMap[it.jenisId] = { totalTerjual: 0, totalRevenue: 0 };
      jenisMap[it.jenisId].totalTerjual += terjual;
      jenisMap[it.jenisId].totalRevenue += terjual * (it.hargaSatuan || 0);
    }

    let cash = 0, qris = 0, tidakTercatat = 0, totalPendapatan = 0;
    const countingIni = countingList.filter((c) => c.distribusiId === d.id);

    for (const [jenisId, info] of Object.entries(jenisMap)) {
      totalPendapatan += info.totalRevenue;
      const avgHarga = info.totalTerjual > 0 ? info.totalRevenue / info.totalTerjual : 0;
      const countingJenis = countingIni.filter((c) => c.jenisId === jenisId);
      let pcsTercatat = 0;
      for (const c of countingJenis) {
        const rp = c.jumlah * avgHarga;
        if (c.metodeBayar === 'QRIS') qris += rp; else cash += rp;
        pcsTercatat += c.jumlah;
      }
      const sisaPcs = Math.max(0, info.totalTerjual - pcsTercatat);
      tidakTercatat += sisaPcs * avgHarga;
    }

    perDistribusi.push({
      id: d.id, tujuanNama: d.tujuanNama, waktu: d.waktuSelesai,
      totalPendapatan, cash, qris, tidakTercatat,
    });
  }
  const grand = perDistribusi.reduce((acc, x) => ({
    totalPendapatan: acc.totalPendapatan + x.totalPendapatan,
    cash: acc.cash + x.cash,
    qris: acc.qris + x.qris,
    tidakTercatat: acc.tidakTercatat + x.tidakTercatat,
  }), { totalPendapatan: 0, cash: 0, qris: 0, tidakTercatat: 0 });
  return { perDistribusi, ...grand };
}

// ============ APP ROOT: login gate ============
export default function StokEsApp() {
  const [teamCode, setTeamCode] = useState('');
  const [nama, setNama] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const savedCode = typeof window !== 'undefined' ? localStorage.getItem('stokes-team-code') : null;
    const savedNama = typeof window !== 'undefined' ? localStorage.getItem('stokes-nama') : null;
    setTeamCode(savedCode || '');
    setNama(savedNama || '');
    setChecking(false);
  }, []);

  const handleLogin = (code) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    localStorage.setItem('stokes-team-code', trimmed);
    setTeamCode(trimmed);
  };

  const handleLogout = () => {
    localStorage.removeItem('stokes-team-code');
    setTeamCode('');
  };

  const handleSetNama = (n) => {
    const trimmed = n.trim();
    if (!trimmed) return;
    localStorage.setItem('stokes-nama', trimmed);
    setNama(trimmed);
  };

  if (checking) {
    return (
      <div style={styles.loadingScreen}>
        <Loader2 className="spin" size={28} color="#F0A04B" />
        <style>{spinCss}</style>
      </div>
    );
  }

  if (!teamCode) return <LoginScreen onLogin={handleLogin} />;
  if (!nama) return <NamaScreen onSubmit={handleSetNama} />;

  return <MainApp teamCode={teamCode} nama={nama} onLogout={handleLogout} onGantiNama={handleSetNama} />;
}

function NamaScreen({ onSubmit }) {
  const [val, setVal] = useState('');
  return (
    <div style={styles.loginScreen}>
      <style>{globalCss}</style>
      <div style={styles.loginIce}>👋</div>
      <div style={styles.loginTitle}>Siapa kamu?</div>
      <div style={styles.loginSub}>Nama ini akan otomatis tercatat di tiap transaksi yang kamu input dari HP ini</div>
      <input
        autoFocus
        style={styles.loginInput}
        placeholder="Nama kamu"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit(val)}
      />
      <button style={styles.loginBtn} onClick={() => onSubmit(val)} disabled={!val.trim()}>
        <User size={15} /> Lanjut
      </button>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [code, setCode] = useState('');
  return (
    <div style={styles.loginScreen}>
      <style>{globalCss}</style>
      <div style={styles.loginIce}>🍧</div>
      <div style={styles.loginTitle}>Stok Es</div>
      <div style={styles.loginSub}>Masukkan kode akses tim untuk melihat data bersama</div>
      <input
        autoFocus
        style={styles.loginInput}
        placeholder="Kode akses tim"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onLogin(code)}
      />
      <button style={styles.loginBtn} onClick={() => onLogin(code)} disabled={!code.trim()}>
        <Lock size={15} /> Masuk
      </button>
      <div style={styles.loginHint}>
        Pertama kali? Buat kode bebas (mis. "keluarga-es-2026") lalu bagikan kode yang sama ke partner kamu supaya datanya nyambung.
      </div>
    </div>
  );
}

// ============ MAIN APP ============
function MainApp({ teamCode, nama, onLogout, onGantiNama }) {
  const [jenisList, setJenisList] = useState(null);
  const [transaksi, setTransaksi] = useState(null);
  const [pengeluaran, setPengeluaran] = useState(null);
  const [resellerList, setResellerList] = useState(null);
  const [distribusiList, setDistribusiList] = useState(null);
  const [countingList, setCountingList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [loadFailMsg, setLoadFailMsg] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [tab, setTab] = useState('stok');

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ---- Load data + seed default jenis/varian if empty ----
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadFailMsg('');
    let jenisRows, varianRows, transRows, pengeluaranRows, resellerRows, distRows, distItemRows, countingRows;
    try {
      const r1 = await supabase.from('jenis_es').select('*').eq('team_code', teamCode);
      const r2 = await supabase.from('varian_es').select('*').eq('team_code', teamCode);
      const r3 = await supabase.from('transaksi').select('*').eq('team_code', teamCode).order('waktu', { ascending: false });
      const r4 = await supabase.from('pengeluaran').select('*').eq('team_code', teamCode).order('waktu', { ascending: false });
      const r5 = await supabase.from('reseller').select('*').eq('team_code', teamCode);
      const r6 = await supabase.from('distribusi').select('*').eq('team_code', teamCode).order('waktu_mulai', { ascending: false });
      const r7 = await supabase.from('distribusi_item').select('*').eq('team_code', teamCode);
      const r8 = await supabase.from('counting').select('*').eq('team_code', teamCode).order('waktu', { ascending: false });

      const firstErr = r1.error || r2.error || r3.error || r4.error || r5.error || r6.error || r7.error || r8.error;
      if (firstErr) {
        setLoadFailMsg(firstErr.message || 'Gagal mengambil data dari database.');
        setSaveError(true);
        setLoading(false);
        return;
      }
      jenisRows = r1.data; varianRows = r2.data; transRows = r3.data; pengeluaranRows = r4.data;
      resellerRows = r5.data; distRows = r6.data; distItemRows = r7.data; countingRows = r8.data;
    } catch (err) {
      // Network-level failure (wrong URL, no internet, CORS, etc.) — never let this spin forever
      setLoadFailMsg(
        err && err.message
          ? `Tidak bisa terhubung ke database: ${err.message}`
          : 'Tidak bisa terhubung ke database. Cek URL/key Supabase di lib/supabase.js.'
      );
      setSaveError(true);
      setLoading(false);
      return;
    }

    if (!jenisRows || jenisRows.length === 0) {
      // Seed default data for a brand-new team code
      const seedRows = [];
      const seedVarian = [];
      for (const j of DEFAULT_JENIS) {
        seedRows.push({ id: j.id + '-' + teamCode, nama: j.nama, team_code: teamCode });
        for (const v of j.varian) {
          seedVarian.push({
            id: uid(),
            jenis_id: j.id + '-' + teamCode,
            nama: v.nama,
            harga: v.harga,
            habis: false,
            team_code: teamCode,
          });
        }
      }
      await supabase.from('jenis_es').insert(seedRows);
      await supabase.from('varian_es').insert(seedVarian);
      const combined = seedRows.map((j) => ({
        id: j.id,
        nama: j.nama,
        varian: seedVarian.filter((v) => v.jenis_id === j.id).map((v) => ({ nama: v.nama, harga: v.harga, habis: false })),
      }));
      setJenisList(combined);
      setTransaksi([]);
      setPengeluaran([]);
      setResellerList([]);
      setDistribusiList([]);
      setCountingList([]);
    } else {
      const combined = jenisRows.map((j) => ({
        id: j.id,
        nama: j.nama,
        varian: (varianRows || [])
          .filter((v) => v.jenis_id === j.id)
          .map((v) => ({ nama: v.nama, harga: v.harga, habis: !!v.habis })),
      }));
      setJenisList(combined);
      setTransaksi(
        (transRows || []).map((t) => ({
          id: t.id,
          jenisId: t.jenis_id,
          varian: t.varian_nama,
          tipe: t.tipe,
          jumlah: t.jumlah,
          hargaSatuan: t.harga_satuan,
          lokasi: t.lokasi,
          metodeBayar: t.metode_bayar,
          waktu: t.waktu,
          dicatatOleh: t.dicatat_oleh,
        }))
      );
      setPengeluaran(
        (pengeluaranRows || []).map((p) => ({
          id: p.id,
          deskripsi: p.deskripsi,
          jumlah: p.jumlah,
          waktu: p.waktu,
          dicatatOleh: p.dicatat_oleh,
        }))
      );
      setResellerList(
        (resellerRows || []).map((r) => ({
          id: r.id,
          nama: r.nama,
          hargaKeReseller: r.harga_ke_reseller,
          hargaJualReseller: r.harga_jual_reseller,
          aktif: r.aktif !== false,
        }))
      );
      setDistribusiList(
        (distRows || []).map((d) => ({
          id: d.id,
          tujuanTipe: d.tujuan_tipe,
          tujuanNama: d.tujuan_nama,
          resellerId: d.reseller_id,
          status: d.status,
          waktuMulai: d.waktu_mulai,
          waktuSelesai: d.waktu_selesai,
          dicatatOleh: d.dicatat_oleh,
          items: (distItemRows || [])
            .filter((it) => it.distribusi_id === d.id)
            .map((it) => ({
              id: it.id,
              jenisId: it.jenis_id,
              varian: it.varian_nama,
              jumlahDibawa: it.jumlah_dibawa,
              jumlahRetur: it.jumlah_retur || 0,
              hargaSatuan: it.harga_satuan || 0,
            })),
        }))
      );
      setCountingList(
        (countingRows || []).map((c) => ({
          id: c.id,
          distribusiId: c.distribusi_id,
          jenisId: c.jenis_id,
          jumlah: c.jumlah,
          metodeBayar: c.metode_bayar,
          dicatatOleh: c.dicatat_oleh,
          waktu: c.waktu,
        }))
      );
    }
    setSaveError(false);
    setLoading(false);
  }, [teamCode]);

  useEffect(() => { loadData(); }, [loadData]);

  // ---- Mutations ----
  const tambahTransaksi = async (t) => {
    const row = {
      id: uid(),
      jenis_id: t.jenisId,
      varian_nama: t.varian,
      tipe: t.tipe,
      jumlah: t.jumlah,
      harga_satuan: t.hargaSatuan,
      lokasi: t.lokasi,
      metode_bayar: t.metodeBayar || null,
      waktu: Date.now(),
      team_code: teamCode,
      dicatat_oleh: nama,
    };
    // optimistic update
    setTransaksi((prev) => [{ ...t, id: row.id, waktu: row.waktu, dicatatOleh: nama }, ...prev]);
    const { error } = await supabase.from('transaksi').insert(row);
    setSaveError(!!error);
  };

  const toggleHabis = async (jenisId, varianNama, habis) => {
    setJenisList((prev) => prev.map((j) => (
      j.id === jenisId ? { ...j, varian: j.varian.map((v) => (v.nama === varianNama ? { ...v, habis } : v)) } : j
    )));
    const { error } = await supabase.from('varian_es').update({ habis }).eq('jenis_id', jenisId).eq('nama', varianNama).eq('team_code', teamCode);
    setSaveError(!!error);
  };

  const tambahPengeluaran = async (deskripsi, jumlah) => {
    const row = { id: uid(), deskripsi, jumlah, waktu: Date.now(), team_code: teamCode, dicatat_oleh: nama };
    setPengeluaran((prev) => [{ ...row, dicatatOleh: nama }, ...prev]);
    const { error } = await supabase.from('pengeluaran').insert(row);
    setSaveError(!!error);
  };

  const hapusPengeluaran = async (id) => {
    setPengeluaran((prev) => prev.filter((p) => p.id !== id));
    const { error } = await supabase.from('pengeluaran').delete().eq('id', id).eq('team_code', teamCode);
    setSaveError(!!error);
  };

  // ---- Reseller ----
  const tambahReseller = async (nama) => {
    const row = { id: uid(), nama, harga_ke_reseller: null, harga_jual_reseller: null, aktif: true, team_code: teamCode };
    setResellerList((prev) => [...prev, { id: row.id, nama, hargaKeReseller: null, hargaJualReseller: null, aktif: true }]);
    const { error } = await supabase.from('reseller').insert(row);
    setSaveError(!!error);
  };

  const updateReseller = async (id, patch) => {
    setResellerList((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const dbPatch = {};
    if ('nama' in patch) dbPatch.nama = patch.nama;
    if ('hargaKeReseller' in patch) dbPatch.harga_ke_reseller = patch.hargaKeReseller;
    if ('hargaJualReseller' in patch) dbPatch.harga_jual_reseller = patch.hargaJualReseller;
    if ('aktif' in patch) dbPatch.aktif = patch.aktif;
    const { error } = await supabase.from('reseller').update(dbPatch).eq('id', id).eq('team_code', teamCode);
    setSaveError(!!error);
  };

  // ---- Distribusi ----
  const mulaiDistribusi = async (tujuanTipe, tujuanNama, resellerId, items) => {
    const distId = uid();
    const distRow = {
      id: distId, tujuan_tipe: tujuanTipe, tujuan_nama: tujuanNama, reseller_id: resellerId || null,
      status: 'berjalan', waktu_mulai: Date.now(), waktu_selesai: null, dicatat_oleh: nama, team_code: teamCode,
    };
    const itemRows = items.map((it) => ({
      id: uid(), distribusi_id: distId, jenis_id: it.jenisId, varian_nama: it.varian,
      jumlah_dibawa: it.jumlah, jumlah_retur: 0, harga_satuan: it.harga || 0, team_code: teamCode,
    }));
    setDistribusiList((prev) => [{
      id: distId, tujuanTipe, tujuanNama, resellerId, status: 'berjalan', waktuMulai: distRow.waktu_mulai,
      waktuSelesai: null, dicatatOleh: nama,
      items: itemRows.map((r) => ({ id: r.id, jenisId: r.jenis_id, varian: r.varian_nama, jumlahDibawa: r.jumlah_dibawa, jumlahRetur: 0, hargaSatuan: r.harga_satuan })),
    }, ...prev]);
    const { error: e1 } = await supabase.from('distribusi').insert(distRow);
    const { error: e2 } = await supabase.from('distribusi_item').insert(itemRows);
    setSaveError(!!(e1 || e2));
  };

  const tambahCounting = async (distribusiId, jenisId, jumlah, metodeBayar) => {
    const row = { id: uid(), distribusi_id: distribusiId, jenis_id: jenisId, jumlah, metode_bayar: metodeBayar, dicatat_oleh: nama, waktu: Date.now(), team_code: teamCode };
    setCountingList((prev) => [{ id: row.id, distribusiId, jenisId, jumlah, metodeBayar, dicatatOleh: nama, waktu: row.waktu }, ...prev]);
    const { error } = await supabase.from('counting').insert(row);
    setSaveError(!!error);
  };

  const hapusCounting = async (id) => {
    setCountingList((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase.from('counting').delete().eq('id', id).eq('team_code', teamCode);
    setSaveError(!!error);
  };

  const tutupDistribusi = async (distribusiId, returMap) => {
    // returMap: { itemId: jumlahRetur }
    setDistribusiList((prev) => prev.map((d) => (
      d.id === distribusiId
        ? { ...d, status: 'selesai', waktuSelesai: Date.now(), items: d.items.map((it) => ({ ...it, jumlahRetur: returMap[it.id] ?? it.jumlahRetur })) }
        : d
    )));
    const updates = Object.entries(returMap).map(([itemId, jumlahRetur]) =>
      supabase.from('distribusi_item').update({ jumlah_retur: jumlahRetur }).eq('id', itemId).eq('team_code', teamCode)
    );
    const { error: eStatus } = await supabase.from('distribusi').update({ status: 'selesai', waktu_selesai: Date.now() }).eq('id', distribusiId).eq('team_code', teamCode);
    const results = await Promise.all(updates);
    setSaveError(!!eStatus || results.some((r) => r.error));
  };

  const hapusTransaksi = async (id) => {
    setTransaksi((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from('transaksi').delete().eq('id', id).eq('team_code', teamCode);
    setSaveError(!!error);
  };

  const tambahJenis = async (nama) => {
    const id = uid();
    setJenisList((prev) => [...prev, { id, nama, varian: [] }]);
    const { error } = await supabase.from('jenis_es').insert({ id, nama, team_code: teamCode });
    setSaveError(!!error);
  };

  const hapusJenis = async (id) => {
    setJenisList((prev) => prev.filter((j) => j.id !== id));
    const { error } = await supabase.from('jenis_es').delete().eq('id', id).eq('team_code', teamCode);
    setSaveError(!!error);
  };

  const tambahVarian = async (jenisId, nama, harga) => {
    const id = uid();
    setJenisList((prev) => prev.map((j) => (j.id === jenisId ? { ...j, varian: [...j.varian, { nama, harga }] } : j)));
    const { error } = await supabase.from('varian_es').insert({ id, jenis_id: jenisId, nama, harga, team_code: teamCode });
    setSaveError(!!error);
  };

  const hapusVarian = async (jenisId, varianNama) => {
    setJenisList((prev) => prev.map((j) => (j.id === jenisId ? { ...j, varian: j.varian.filter((v) => v.nama !== varianNama) } : j)));
    const { error } = await supabase.from('varian_es').delete().eq('jenis_id', jenisId).eq('nama', varianNama).eq('team_code', teamCode);
    setSaveError(!!error);
  };

  const updateHargaVarian = async (jenisId, varianNama, harga) => {
    setJenisList((prev) => prev.map((j) => (
      j.id === jenisId ? { ...j, varian: j.varian.map((v) => (v.nama === varianNama ? { ...v, harga } : v)) } : j
    )));
    const { error } = await supabase.from('varian_es').update({ harga }).eq('jenis_id', jenisId).eq('nama', varianNama).eq('team_code', teamCode);
    setSaveError(!!error);
  };

  const stokMap = {};
  if (transaksi) {
    for (const t of transaksi) {
      const key = t.jenisId + '||' + t.varian;
      stokMap[key] = (stokMap[key] || 0) + (t.tipe === 'masuk' ? t.jumlah : -t.jumlah);
    }
  }
  if (distribusiList) {
    for (const d of distribusiList) {
      for (const it of d.items) {
        const key = it.jenisId + '||' + it.varian;
        const belumKembali = it.jumlahDibawa - it.jumlahRetur;
        stokMap[key] = (stokMap[key] || 0) - belumKembali;
      }
    }
  }

  if (loadFailMsg) {
    return (
      <div style={styles.loginScreen}>
        <style>{globalCss}</style>
        <div style={styles.loginIce}>⚠️</div>
        <div style={styles.loginTitle}>Gagal terhubung</div>
        <div style={{ ...styles.loginSub, color: '#C0392B' }}>{loadFailMsg}</div>
        <button style={styles.loginBtn} onClick={loadData}>Coba lagi</button>
        <button style={{ ...styles.loginBtn, background: '#F0E4D4', color: '#8A6D4E', marginTop: 10 }} onClick={onLogout}>
          Ganti kode tim
        </button>
      </div>
    );
  }

  if (loading || !jenisList || !transaksi || !pengeluaran || !resellerList || !distribusiList || !countingList) {
    return (
      <div style={styles.loadingScreen}>
        <Loader2 className="spin" size={28} color="#F0A04B" />
        <style>{spinCss}</style>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <style>{globalCss}</style>
      <Header saveError={saveError} isOffline={isOffline} onLogout={onLogout} onRetry={loadData} nama={nama} onGantiNama={onGantiNama} />
      <div style={styles.tabBar}>
        <TabBtn active={tab === 'stok'} onClick={() => setTab('stok')} label="Stok" icon={<Package size={16} />} />
        <TabBtn active={tab === 'distribusi'} onClick={() => setTab('distribusi')} label="Distribusi" icon={<Truck size={16} />} />
        <TabBtn active={tab === 'pendapatan'} onClick={() => setTab('pendapatan')} label="Pendapatan" icon={<Wallet size={16} />} />
        <TabBtn active={tab === 'pengeluaran'} onClick={() => setTab('pengeluaran')} label="Pengeluaran" icon={<Receipt size={16} />} />
        <TabBtn active={tab === 'riwayat'} onClick={() => setTab('riwayat')} label="Riwayat" icon={<Clock size={16} />} />
        <TabBtn active={tab === 'laporan'} onClick={() => setTab('laporan')} label="Laporan" icon={<FileDown size={16} />} />
        <TabBtn active={tab === 'kelola'} onClick={() => setTab('kelola')} label="Kelola" icon={<ChevronDown size={16} />} />
      </div>

      <div style={styles.content}>
        {tab === 'stok' && <StokView jenisList={jenisList} stokMap={stokMap} onTambahTransaksi={tambahTransaksi} onToggleHabis={toggleHabis} />}
        {tab === 'distribusi' && (
          <DistribusiView
            jenisList={jenisList}
            stokMap={stokMap}
            resellerList={resellerList}
            distribusiList={distribusiList}
            countingList={countingList}
            onMulai={mulaiDistribusi}
            onTambahCounting={tambahCounting}
            onHapusCounting={hapusCounting}
            onTutup={tutupDistribusi}
          />
        )}
        {tab === 'pendapatan' && <PendapatanView transaksi={transaksi} pengeluaran={pengeluaran} distribusiList={distribusiList} countingList={countingList} />}
        {tab === 'pengeluaran' && (
          <PengeluaranView pengeluaran={pengeluaran} onTambah={tambahPengeluaran} onHapus={hapusPengeluaran} />
        )}
        {tab === 'riwayat' && <RiwayatView transaksi={transaksi} jenisList={jenisList} onHapus={hapusTransaksi} />}
        {tab === 'laporan' && (
          <LaporanView
            transaksi={transaksi}
            pengeluaran={pengeluaran}
            jenisList={jenisList}
            distribusiList={distribusiList}
            countingList={countingList}
          />
        )}
        {tab === 'kelola' && (
          <KelolaView
            jenisList={jenisList}
            onTambahJenis={tambahJenis}
            onHapusJenis={hapusJenis}
            onTambahVarian={tambahVarian}
            onHapusVarian={hapusVarian}
            onUpdateHarga={updateHargaVarian}
            resellerList={resellerList}
            onTambahReseller={tambahReseller}
            onUpdateReseller={updateReseller}
            transaksi={transaksi}
            pengeluaran={pengeluaran}
            distribusiList={distribusiList}
            countingList={countingList}
          />
        )}
      </div>
    </div>
  );
}

function Header({ saveError, isOffline, onLogout, onRetry, nama, onGantiNama }) {
  const [editingNama, setEditingNama] = useState(false);
  const [namaVal, setNamaVal] = useState(nama);

  let statusText = 'Tersinkron otomatis';
  let statusColor = '#B08968';
  if (isOffline) { statusText = 'Offline — akan sync saat online'; statusColor = '#C0862E'; }
  else if (saveError) { statusText = 'Gagal menyimpan — ketuk untuk coba lagi'; statusColor = '#C0392B'; }

  return (
    <div>
      <div style={styles.header}>
        <div style={styles.headerIce}>🍧</div>
        <div style={{ flex: 1 }} onClick={saveError ? onRetry : undefined}>
          <div style={styles.headerTitle}>Stok Es</div>
          <div style={{ fontSize: 12, color: statusColor, marginTop: 2 }}>{statusText}</div>
        </div>
        <button style={styles.namaBtn} onClick={() => { setNamaVal(nama); setEditingNama(true); }} aria-label="Ganti nama pencatat">
          <User size={13} /> {nama} <Pencil size={11} />
        </button>
        <button style={styles.logoutBtn} onClick={onLogout} aria-label="Ganti tim">
          <LogOut size={16} />
        </button>
      </div>

      {editingNama && (
        <div style={styles.overlay} onClick={() => setEditingNama(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>Ganti nama pencatat</div>
              <button style={styles.closeBtn} onClick={() => setEditingNama(false)}><X size={18} /></button>
            </div>
            <input
              autoFocus
              style={styles.input}
              value={namaVal}
              onChange={(e) => setNamaVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && namaVal.trim() && (onGantiNama(namaVal), setEditingNama(false))}
            />
            <button
              style={{ ...styles.submitBtn, background: '#3A2618' }}
              onClick={() => { if (namaVal.trim()) { onGantiNama(namaVal); setEditingNama(false); } }}
            >
              Simpan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label, icon }) {
  return (
    <button onClick={onClick} style={{ ...styles.tabBtn, ...(active ? styles.tabBtnActive : {}) }}>
      {icon}
      {label}
    </button>
  );
}

// ============ STOK VIEW ============
function StokView({ jenisList, stokMap, onTambahTransaksi, onToggleHabis }) {
  const [modal, setModal] = useState(null);
  const totalStok = Object.values(stokMap).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div style={styles.summaryCard}>
        <div style={styles.summaryLabel}>Total stok saat ini</div>
        <div style={styles.summaryValue}>{totalStok} pcs</div>
      </div>

      {jenisList.length === 0 && <EmptyState text="Belum ada jenis es. Tambahkan lewat tab Kelola." />}

      {jenisList.map((jenis) => (
        <div key={jenis.id} style={styles.jenisBlock}>
          <div style={styles.jenisTitle}>{jenis.nama}</div>
          {jenis.varian.length === 0 ? (
            <div style={styles.varianEmptyRow}>Belum ada varian rasa</div>
          ) : (
            jenis.varian.map((v) => {
              const key = jenis.id + '||' + v.nama;
              const jumlah = stokMap[key] || 0;
              return (
                <div key={v.nama} style={{ ...styles.varianRow, opacity: v.habis ? 0.6 : 1 }}>
                  <div style={styles.varianInfo}>
                    <div style={styles.varianName}>{v.nama}{v.habis ? ' · Bahan habis' : ''}</div>
                    <div style={styles.varianMetaRow}>
                      <span style={{ color: jumlah <= 0 ? '#C0392B' : '#2E7D5B', fontWeight: 600 }}>{jumlah} pcs</span>
                      <span style={styles.hargaTag}>{formatRupiah(v.harga)}</span>
                    </div>
                  </div>
                  <div style={styles.varianActions}>
                    <button
                      style={{ ...styles.roundBtn, background: v.habis ? '#F0E4D4' : '#FFF0DC', color: v.habis ? '#8A6D4E' : '#C0862E' }}
                      onClick={() => onToggleHabis(jenis.id, v.nama, !v.habis)}
                      aria-label={v.habis ? `Tandai bahan ${v.nama} masih ada` : `Tandai bahan ${v.nama} habis`}
                    >
                      <CircleSlash size={15} />
                    </button>
                    <button
                      style={{ ...styles.roundBtn, background: '#FCEEE3', color: '#C0392B' }}
                      onClick={() => setModal({ jenisId: jenis.id, jenisNama: jenis.nama, varian: v.nama, harga: v.harga, tipe: 'keluar' })}
                      aria-label={`Kurangi stok ${v.nama}`}
                    >
                      <Minus size={16} />
                    </button>
                    <button
                      style={{ ...styles.roundBtn, background: '#E4F3EA', color: '#2E7D5B' }}
                      onClick={() => setModal({ jenisId: jenis.id, jenisNama: jenis.nama, varian: v.nama, harga: v.harga, tipe: 'masuk' })}
                      aria-label={`Tambah stok ${v.nama}`}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ))}

      {modal && (
        <TransaksiModal
          info={modal}
          onClose={() => setModal(null)}
          onSubmit={(payload) => { onTambahTransaksi(payload); setModal(null); }}
        />
      )}
    </div>
  );
}

function TransaksiModal({ info, onClose, onSubmit }) {
  const [jumlah, setJumlah] = useState('');
  const [lokasi, setLokasi] = useState(info.tipe === 'masuk' ? '' : LOKASI_OPTIONS[0]);
  const [metodeBayar, setMetodeBayar] = useState('Cash');
  const isMasuk = info.tipe === 'masuk';
  const n = parseInt(jumlah, 10) || 0;
  const totalHarga = n * info.harga;

  const submit = () => {
    if (!n || n <= 0) return;
    onSubmit({
      jenisId: info.jenisId,
      varian: info.varian,
      tipe: info.tipe,
      jumlah: n,
      hargaSatuan: info.harga,
      lokasi: lokasi || null,
      metodeBayar: isMasuk ? null : metodeBayar,
    });
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalTitle}>{isMasuk ? 'Stok masuk' : 'Stok keluar'}</div>
            <div style={styles.modalSub}>{info.jenisNama} — {info.varian} · {formatRupiah(info.harga)}/pcs</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <label style={styles.fieldLabel}>Jumlah (pcs)</label>
        <input
          type="number"
          inputMode="numeric"
          autoFocus
          value={jumlah}
          onChange={(e) => setJumlah(e.target.value)}
          placeholder="0"
          style={styles.input}
        />

        {!isMasuk && n > 0 && (
          <div style={styles.totalPreview}>Total: <strong>{formatRupiah(totalHarga)}</strong></div>
        )}

        <label style={styles.fieldLabel}>{isMasuk ? 'Titik jual (opsional)' : 'Titik jual'}</label>
        <div style={styles.lokasiGrid}>
          {LOKASI_OPTIONS.map((l) => (
            <button
              key={l}
              onClick={() => setLokasi(lokasi === l && isMasuk ? '' : l)}
              style={{ ...styles.lokasiChip, ...(lokasi === l ? styles.lokasiChipActive : {}) }}
            >
              {l}
            </button>
          ))}
        </div>

        {!isMasuk && (
          <>
            <label style={styles.fieldLabel}>Metode bayar</label>
            <div style={styles.lokasiGrid}>
              <button
                onClick={() => setMetodeBayar('Cash')}
                style={{ ...styles.lokasiChip, ...(metodeBayar === 'Cash' ? styles.lokasiChipActive : {}) }}
              >
                <Banknote size={13} style={{ marginRight: 5, verticalAlign: -2 }} />Cash
              </button>
              <button
                onClick={() => setMetodeBayar('QRIS')}
                style={{ ...styles.lokasiChip, ...(metodeBayar === 'QRIS' ? styles.lokasiChipActive : {}) }}
              >
                <QrCode size={13} style={{ marginRight: 5, verticalAlign: -2 }} />QRIS
              </button>
            </div>
          </>
        )}

        <button
          style={{ ...styles.submitBtn, background: isMasuk ? '#2E7D5B' : '#C0392B', opacity: n > 0 ? 1 : 0.5 }}
          onClick={submit}
          disabled={!(n > 0)}
        >
          {isMasuk ? 'Catat stok masuk' : 'Catat stok keluar'}
        </button>
      </div>
    </div>
  );
}

// ============ PENDAPATAN VIEW ============
function PendapatanView({ transaksi, pengeluaran, distribusiList, countingList }) {
  const keluar = useMemo(() => transaksi.filter((t) => t.tipe === 'keluar'), [transaksi]);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayOfWeek = now.getDay();
  const startOfWeek = startOfDay - dayOfWeek * 86400000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

  const distSelesai = useMemo(
    () => distribusiList.filter((d) => d.tujuanTipe === 'lokasi' && d.status === 'selesai'),
    [distribusiList]
  );

  const sumLangsungSince = (ts) => keluar.filter((t) => t.waktu >= ts).reduce((a, t) => a + t.jumlah * (t.hargaSatuan || 0), 0);
  const sumDistribusiSince = (ts) => {
    const filtered = { ...Object.fromEntries(distSelesai.filter((d) => d.waktuSelesai >= ts).map((d) => [d.id, d])) };
    const list = Object.values(filtered);
    return hitungPendapatanDistribusi(list, countingList).totalPendapatan;
  };
  const sumSince = (ts) => sumLangsungSince(ts) + sumDistribusiSince(ts);
  const sumPengeluaranSince = (ts) => pengeluaran.filter((p) => p.waktu >= ts).reduce((a, p) => a + p.jumlah, 0);

  const harian = sumSince(startOfDay);
  const mingguan = sumSince(startOfWeek);
  const bulanan = sumSince(startOfMonth);
  const tahunan = sumSince(startOfYear);

  const pengeluaranBulanan = sumPengeluaranSince(startOfMonth);

  const perLokasi = useMemo(() => {
    const map = {};
    for (const t of keluar) {
      const loc = t.lokasi || 'Tanpa lokasi';
      map[loc] = (map[loc] || 0) + t.jumlah * (t.hargaSatuan || 0);
    }
    const distInfo = hitungPendapatanDistribusi(distSelesai, countingList);
    for (const pd of distInfo.perDistribusi) {
      map[pd.tujuanNama] = (map[pd.tujuanNama] || 0) + pd.totalPendapatan;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [keluar, distSelesai, countingList]);

  const distInfoAll = useMemo(() => hitungPendapatanDistribusi(distSelesai, countingList), [distSelesai, countingList]);

  const totalCash = useMemo(() => keluar.filter((t) => t.metodeBayar === 'Cash').reduce((a, t) => a + t.jumlah * (t.hargaSatuan || 0), 0), [keluar]) + distInfoAll.cash;
  const totalQris = useMemo(() => keluar.filter((t) => t.metodeBayar === 'QRIS').reduce((a, t) => a + t.jumlah * (t.hargaSatuan || 0), 0), [keluar]) + distInfoAll.qris;
  const totalTidakTercatat = distInfoAll.tidakTercatat;

  if (keluar.length === 0 && distSelesai.length === 0) {
    return <EmptyState text="Belum ada penjualan tercatat. Pendapatan akan muncul setelah ada stok keluar atau distribusi selesai." />;
  }

  return (
    <div>
      <div style={styles.pendapatanGrid}>
        <PendapatanCard label="Hari ini" value={harian} />
        <PendapatanCard label="Minggu ini" value={mingguan} />
        <PendapatanCard label="Bulan ini" value={bulanan} />
        <PendapatanCard label="Tahun ini" value={tahunan} />
      </div>

      <div style={styles.untungCard}>
        <div style={styles.untungRow}>
          <span>Pendapatan bulan ini</span>
          <strong style={{ color: '#2E7D5B' }}>{formatRupiah(bulanan)}</strong>
        </div>
        <div style={styles.untungRow}>
          <span>Pengeluaran bulan ini</span>
          <strong style={{ color: '#C0392B' }}>-{formatRupiah(pengeluaranBulanan)}</strong>
        </div>
        <div style={{ ...styles.untungRow, borderTop: '1px solid #EFDFC8', paddingTop: 8, marginTop: 4 }}>
          <span style={{ fontWeight: 700 }}>Untung bersih bulan ini</span>
          <strong style={{ color: '#3A2618', fontSize: 15 }}>{formatRupiah(bulanan - pengeluaranBulanan)}</strong>
        </div>
      </div>

      {(totalCash > 0 || totalQris > 0 || totalTidakTercatat > 0) && (
        <>
          <div style={styles.sectionLabel}>Total berdasarkan metode bayar</div>
          <div style={styles.lokasiRevRow}>
            <div style={styles.lokasiRevName}><Banknote size={13} style={{ marginRight: 4, verticalAlign: -2 }} />Cash</div>
            <div style={styles.lokasiRevValue}>{formatRupiah(totalCash)}</div>
          </div>
          <div style={styles.lokasiRevRow}>
            <div style={styles.lokasiRevName}><QrCode size={13} style={{ marginRight: 4, verticalAlign: -2 }} />QRIS</div>
            <div style={styles.lokasiRevValue}>{formatRupiah(totalQris)}</div>
          </div>
          {totalTidakTercatat > 0 && (
            <div style={styles.lokasiRevRow}>
              <div style={styles.lokasiRevName}><AlertTriangle size={13} style={{ marginRight: 4, verticalAlign: -2, color: '#C0862E' }} />Metode tidak tercatat (dari distribusi)</div>
              <div style={{ ...styles.lokasiRevValue, color: '#C0862E' }}>{formatRupiah(totalTidakTercatat)}</div>
            </div>
          )}
        </>
      )}

      <div style={styles.sectionLabel}>Pendapatan per titik jual (total)</div>
      {perLokasi.map(([loc, total]) => (
        <div key={loc} style={styles.lokasiRevRow}>
          <div style={styles.lokasiRevName}><MapPin size={13} style={{ marginRight: 4, verticalAlign: -2 }} />{loc}</div>
          <div style={styles.lokasiRevValue}>{formatRupiah(total)}</div>
        </div>
      ))}

    </div>
  );
}

// ============ PENGELUARAN VIEW ============
function PengeluaranView({ pengeluaran, onTambah, onHapus }) {
  const [deskripsi, setDeskripsi] = useState('');
  const [jumlah, setJumlah] = useState('');

  const totalSemua = pengeluaran.reduce((a, p) => a + p.jumlah, 0);

  const submit = () => {
    const desk = deskripsi.trim();
    const n = parseInt(jumlah, 10) || 0;
    if (!desk || n <= 0) return;
    onTambah(desk, n);
    setDeskripsi('');
    setJumlah('');
  };

  return (
    <div>
      <div style={{ ...styles.summaryCard, background: 'linear-gradient(135deg, #C0392B, #A73024)' }}>
        <div style={styles.summaryLabel}>Total pengeluaran tercatat</div>
        <div style={styles.summaryValue}>{formatRupiah(totalSemua)}</div>
      </div>

      <div style={styles.kelolaAddCard}>
        <label style={styles.fieldLabel}>Catat pengeluaran baru</label>
        <input
          style={styles.input}
          placeholder="Keterangan (mis. telur + gula)"
          value={deskripsi}
          onChange={(e) => setDeskripsi(e.target.value)}
        />
        <div style={styles.addRow}>
          <input
            type="number"
            inputMode="numeric"
            style={{ ...styles.input, marginBottom: 0, flex: 1 }}
            placeholder="Jumlah (Rp)"
            value={jumlah}
            onChange={(e) => setJumlah(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button style={styles.addBtn} onClick={submit}><Plus size={18} /></button>
        </div>
      </div>

      {pengeluaran.length === 0 ? (
        <EmptyState text="Belum ada pengeluaran tercatat." />
      ) : (
        pengeluaran.map((p) => (
          <div key={p.id} style={styles.riwayatRow}>
            <div style={{ ...styles.riwayatIcon, background: '#FCEEE3', color: '#C0392B' }}>
              <Receipt size={16} />
            </div>
            <div style={styles.riwayatInfo}>
              <div style={styles.riwayatTitle}>{p.deskripsi}</div>
              <div style={styles.riwayatMeta}>
                {new Date(p.waktu).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {p.dicatatOleh ? <> · {p.dicatatOleh}</> : null}
              </div>
            </div>
            <div style={{ ...styles.riwayatQty, color: '#C0392B' }}>-{formatRupiah(p.jumlah)}</div>
            <button style={styles.deleteBtn} onClick={() => onHapus(p.id)} aria-label="Hapus pengeluaran">
              <Trash2 size={14} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function PendapatanCard({ label, value }) {
  return (
    <div style={styles.pendapatanCard}>
      <div style={styles.pendapatanLabel}>{label}</div>
      <div style={styles.pendapatanValue}>{formatRupiah(value)}</div>
    </div>
  );
}

// ============ RIWAYAT VIEW ============
function RiwayatView({ transaksi, jenisList, onHapus }) {
  const jenisNama = (id) => jenisList.find((j) => j.id === id)?.nama || id;

  if (transaksi.length === 0) {
    return <EmptyState text="Belum ada transaksi. Catatan stok masuk/keluar akan muncul di sini." />;
  }

  return (
    <div>
      {transaksi.map((t) => (
        <div key={t.id} style={styles.riwayatRow}>
          <div style={{
            ...styles.riwayatIcon,
            background: t.tipe === 'masuk' ? '#E4F3EA' : '#FCEEE3',
            color: t.tipe === 'masuk' ? '#2E7D5B' : '#C0392B',
          }}>
            {t.tipe === 'masuk' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          </div>
          <div style={styles.riwayatInfo}>
            <div style={styles.riwayatTitle}>{jenisNama(t.jenisId)} — {t.varian}</div>
            <div style={styles.riwayatMeta}>
              {new Date(t.waktu).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {t.lokasi && <> · <MapPin size={11} style={{ display: 'inline', verticalAlign: -1 }} /> {t.lokasi}</>}
              {t.tipe === 'keluar' && t.hargaSatuan ? <> · {formatRupiah(t.jumlah * t.hargaSatuan)}</> : null}
              {t.dicatatOleh ? <> · {t.dicatatOleh}</> : null}
            </div>
          </div>
          <div style={{ ...styles.riwayatQty, color: t.tipe === 'masuk' ? '#2E7D5B' : '#C0392B' }}>
            {t.tipe === 'masuk' ? '+' : '-'}{t.jumlah}
          </div>
          <button style={styles.deleteBtn} onClick={() => onHapus(t.id)} aria-label="Hapus transaksi">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ============ KELOLA VIEW ============
function KelolaView({ jenisList, onTambahJenis, onHapusJenis, onTambahVarian, onHapusVarian, onUpdateHarga, resellerList, onTambahReseller, onUpdateReseller, transaksi, pengeluaran, distribusiList, countingList }) {
  const [namaJenisBaru, setNamaJenisBaru] = useState('');
  const [varianInput, setVarianInput] = useState({});
  const [hargaInput, setHargaInput] = useState({});
  const [namaResellerBaru, setNamaResellerBaru] = useState('');

  const anggotaTim = useMemo(() => {
    const set = new Set();
    transaksi.forEach((t) => t.dicatatOleh && set.add(t.dicatatOleh));
    pengeluaran.forEach((p) => p.dicatatOleh && set.add(p.dicatatOleh));
    distribusiList.forEach((d) => d.dicatatOleh && set.add(d.dicatatOleh));
    countingList.forEach((c) => c.dicatatOleh && set.add(c.dicatatOleh));
    return Array.from(set).sort();
  }, [transaksi, pengeluaran, distribusiList, countingList]);

  const submitJenis = () => {
    const nama = namaJenisBaru.trim();
    if (!nama) return;
    onTambahJenis(nama);
    setNamaJenisBaru('');
  };

  const submitVarian = (jenisId) => {
    const nama = (varianInput[jenisId] || '').trim();
    const harga = parseInt(hargaInput[jenisId], 10) || 2000;
    if (!nama) return;
    onTambahVarian(jenisId, nama, harga);
    setVarianInput((s) => ({ ...s, [jenisId]: '' }));
    setHargaInput((s) => ({ ...s, [jenisId]: '' }));
  };

  const submitReseller = () => {
    const nama = namaResellerBaru.trim();
    if (!nama) return;
    onTambahReseller(nama);
    setNamaResellerBaru('');
  };

  return (
    <div>
      <div style={styles.kelolaAddCard}>
        <label style={styles.fieldLabel}>Tambah jenis es baru</label>
        <div style={styles.addRow}>
          <input
            style={{ ...styles.input, marginBottom: 0, flex: 1 }}
            placeholder="mis. Es Krim Goreng"
            value={namaJenisBaru}
            onChange={(e) => setNamaJenisBaru(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitJenis()}
          />
          <button style={styles.addBtn} onClick={submitJenis}><Plus size={18} /></button>
        </div>
      </div>

      {jenisList.map((jenis) => (
        <div key={jenis.id} style={styles.kelolaJenisCard}>
          <div style={styles.kelolaJenisHeader}>
            <div style={styles.jenisTitle}>{jenis.nama}</div>
            <button style={styles.deleteBtn} onClick={() => onHapusJenis(jenis.id)} aria-label={`Hapus ${jenis.nama}`}>
              <Trash2 size={15} />
            </button>
          </div>

          {jenis.varian.length === 0 ? (
            <div style={styles.varianEmptyRow}>Belum ada rasa</div>
          ) : (
            jenis.varian.map((v) => (
              <div key={v.nama} style={styles.kelolaVarianRow}>
                <div style={styles.kelolaVarianNama}>{v.nama}</div>
                <div style={styles.hargaEditWrap}>
                  <span style={styles.hargaPrefix}>Rp</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    style={styles.hargaEditInput}
                    defaultValue={v.harga}
                    onBlur={(e) => onUpdateHarga(jenis.id, v.nama, parseInt(e.target.value, 10) || 0)}
                  />
                </div>
                <button style={styles.deleteBtnSmall} onClick={() => onHapusVarian(jenis.id, v.nama)} aria-label={`Hapus ${v.nama}`}>
                  <X size={13} />
                </button>
              </div>
            ))
          )}

          <div style={{ ...styles.addRow, marginTop: 10 }}>
            <input
              style={{ ...styles.input, marginBottom: 0, flex: 1.4, fontSize: 14 }}
              placeholder="Rasa baru"
              value={varianInput[jenis.id] || ''}
              onChange={(e) => setVarianInput((s) => ({ ...s, [jenis.id]: e.target.value }))}
            />
            <input
              type="number"
              inputMode="numeric"
              style={{ ...styles.input, marginBottom: 0, flex: 1, fontSize: 14 }}
              placeholder="2000"
              value={hargaInput[jenis.id] || ''}
              onChange={(e) => setHargaInput((s) => ({ ...s, [jenis.id]: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && submitVarian(jenis.id)}
            />
            <button style={styles.addBtnSmall} onClick={() => submitVarian(jenis.id)}><Plus size={15} /></button>
          </div>
        </div>
      ))}

      <div style={{ ...styles.sectionLabel, marginTop: 20 }}><Users size={13} style={{ marginRight: 5, verticalAlign: -2 }} />Reseller</div>
      <div style={styles.kelolaAddCard}>
        <label style={styles.fieldLabel}>Tambah reseller baru</label>
        <div style={styles.addRow}>
          <input
            style={{ ...styles.input, marginBottom: 0, flex: 1 }}
            placeholder="Nama reseller"
            value={namaResellerBaru}
            onChange={(e) => setNamaResellerBaru(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitReseller()}
          />
          <button style={styles.addBtn} onClick={submitReseller}><Plus size={18} /></button>
        </div>
      </div>

      {resellerList.length === 0 ? (
        <div style={styles.varianEmptyRow}>Belum ada reseller.</div>
      ) : (
        resellerList.map((r) => (
          <div key={r.id} style={styles.kelolaJenisCard}>
            <div style={styles.kelolaJenisHeader}>
              <input
                style={{ ...styles.namaResellerInput, opacity: r.aktif ? 1 : 0.5 }}
                defaultValue={r.nama}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== r.nama) onUpdateReseller(r.id, { nama: v }); }}
              />
              {!r.aktif && <span style={{ fontSize: 11, color: '#B08968', marginRight: 6 }}>(nonaktif)</span>}
              <button
                style={{ ...styles.deleteBtnSmall, color: r.aktif ? '#C0392B' : '#2E7D5B' }}
                onClick={() => onUpdateReseller(r.id, { aktif: !r.aktif })}
                aria-label={r.aktif ? `Nonaktifkan ${r.nama}` : `Aktifkan ${r.nama}`}
              >
                {r.aktif ? <CircleSlash size={15} /> : <CheckCircle2 size={15} />}
              </button>
            </div>
            <div style={styles.addRow}>
              <div style={styles.hargaEditWrap}>
                <span style={styles.hargaPrefix}>Harga ke reseller Rp</span>
                <input
                  type="number" inputMode="numeric" style={styles.hargaEditInput}
                  defaultValue={r.hargaKeReseller || ''}
                  placeholder="—"
                  onBlur={(e) => onUpdateReseller(r.id, { hargaKeReseller: parseInt(e.target.value, 10) || null })}
                />
              </div>
            </div>
            <div style={{ ...styles.addRow, marginTop: 6 }}>
              <div style={styles.hargaEditWrap}>
                <span style={styles.hargaPrefix}>Harga jual reseller Rp</span>
                <input
                  type="number" inputMode="numeric" style={styles.hargaEditInput}
                  defaultValue={r.hargaJualReseller || ''}
                  placeholder="—"
                  onBlur={(e) => onUpdateReseller(r.id, { hargaJualReseller: parseInt(e.target.value, 10) || null })}
                />
              </div>
            </div>
          </div>
        ))
      )}

      <div style={{ ...styles.sectionLabel, marginTop: 20 }}><User size={13} style={{ marginRight: 5, verticalAlign: -2 }} />Anggota Tim</div>
      {anggotaTim.length === 0 ? (
        <div style={styles.varianEmptyRow}>Belum ada yang tercatat.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {anggotaTim.map((n) => (
            <div key={n} style={styles.varianChip}><User size={11} style={{ marginRight: 2 }} />{n}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ LAPORAN VIEW ============
function LaporanView({ transaksi, pengeluaran, jenisList, distribusiList, countingList }) {
  const [mode, setMode] = useState('harian'); // 'harian' | 'periode' | 'semua'
  const todayStr = new Date().toISOString().slice(0, 10);
  const [tanggal, setTanggal] = useState(todayStr);
  const [dari, setDari] = useState(todayStr);
  const [sampai, setSampai] = useState(todayStr);

  const jenisNama = (id) => jenisList.find((j) => j.id === id)?.nama || id;

  const range = useMemo(() => {
    if (mode === 'semua') return { start: 0, end: Infinity, label: 'Semua riwayat' };
    if (mode === 'harian') {
      const d = new Date(tanggal + 'T00:00:00');
      const start = d.getTime();
      const end = start + 86400000;
      return { start, end, label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) };
    }
    const dStart = new Date(dari + 'T00:00:00').getTime();
    const dEnd = new Date(sampai + 'T00:00:00').getTime() + 86400000;
    return {
      start: dStart,
      end: dEnd,
      label: `${new Date(dari).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} — ${new Date(sampai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    };
  }, [mode, tanggal, dari, sampai]);

  const filteredTransaksi = useMemo(
    () => transaksi.filter((t) => t.waktu >= range.start && t.waktu < range.end).sort((a, b) => a.waktu - b.waktu),
    [transaksi, range]
  );
  const filteredPengeluaran = useMemo(
    () => pengeluaran.filter((p) => p.waktu >= range.start && p.waktu < range.end).sort((a, b) => a.waktu - b.waktu),
    [pengeluaran, range]
  );

  const totalMasuk = filteredTransaksi.filter((t) => t.tipe === 'masuk').reduce((a, t) => a + t.jumlah, 0);
  const totalKeluarPcs = filteredTransaksi.filter((t) => t.tipe === 'keluar').reduce((a, t) => a + t.jumlah, 0);
  const totalPendapatanLangsung = filteredTransaksi.filter((t) => t.tipe === 'keluar').reduce((a, t) => a + t.jumlah * (t.hargaSatuan || 0), 0);
  const totalPengeluaran = filteredPengeluaran.reduce((a, p) => a + p.jumlah, 0);

  const distSelesaiLokasiRange = useMemo(
    () => (distribusiList || []).filter((d) => d.tujuanTipe === 'lokasi' && d.status === 'selesai' && d.waktuSelesai >= range.start && d.waktuSelesai < range.end),
    [distribusiList, range]
  );
  const distInfoRange = useMemo(() => hitungPendapatanDistribusi(distSelesaiLokasiRange, countingList), [distSelesaiLokasiRange, countingList]);
  const totalPendapatan = totalPendapatanLangsung + distInfoRange.totalPendapatan;
  const untungBersih = totalPendapatan - totalPengeluaran;

  const filteredDistribusi = useMemo(
    () => (distribusiList || []).filter((d) => d.waktuMulai >= range.start && d.waktuMulai < range.end).sort((a, b) => a.waktuMulai - b.waktuMulai),
    [distribusiList, range]
  );

  const downloadCSV = () => {
    const rows = [];
    rows.push(['Laporan Stok Es']);
    rows.push(['Periode', range.label]);
    rows.push([]);
    rows.push(['=== PENJUALAN LANGSUNG (input manual di tab Stok) ===']);
    rows.push(['Tanggal', 'Jenis', 'Varian', 'Tipe', 'Jumlah', 'Harga Satuan', 'Total', 'Titik Jual', 'Metode Bayar', 'Dicatat Oleh']);
    filteredTransaksi.forEach((t) => {
      rows.push([
        new Date(t.waktu).toLocaleString('id-ID'),
        jenisNama(t.jenisId),
        t.varian,
        t.tipe,
        t.jumlah,
        t.hargaSatuan || '',
        t.tipe === 'keluar' ? t.jumlah * (t.hargaSatuan || 0) : '',
        t.lokasi || '',
        t.metodeBayar || '',
        t.dicatatOleh || '',
      ]);
    });
    rows.push([]);
    rows.push(['=== PENGELUARAN ===']);
    rows.push(['Tanggal', 'Keterangan', 'Jumlah', 'Dicatat Oleh']);
    filteredPengeluaran.forEach((p) => {
      rows.push([new Date(p.waktu).toLocaleString('id-ID'), p.deskripsi, p.jumlah, p.dicatatOleh || '']);
    });
    rows.push([]);
    rows.push(['=== DISTRIBUSI TITIK JUAL SENDIRI (ikut masuk ke Total Pendapatan) ===']);
    rows.push(['Tanggal Selesai', 'Tujuan', 'Status', 'Varian', 'Dibawa', 'Retur', 'Terjual', 'Est. Pendapatan', 'Dicatat Oleh']);
    filteredDistribusi.filter((d) => d.tujuanTipe === 'lokasi').forEach((d) => {
      d.items.forEach((it) => {
        const terjual = it.jumlahDibawa - it.jumlahRetur;
        rows.push([
          d.waktuSelesai ? new Date(d.waktuSelesai).toLocaleString('id-ID') : '(belum selesai)',
          d.tujuanNama,
          d.status,
          `${jenisNama(it.jenisId)} - ${it.varian}`,
          it.jumlahDibawa,
          it.jumlahRetur,
          terjual,
          terjual * (it.hargaSatuan || 0),
          d.dicatatOleh || '',
        ]);
      });
    });
    rows.push([]);
    rows.push(['=== DISTRIBUSI RESELLER (TIDAK dihitung ke Total Pendapatan - harga ke reseller beda) ===']);
    rows.push(['Tanggal Selesai', 'Nama Reseller', 'Status', 'Varian', 'Dibawa', 'Retur', 'Terjual', 'Dicatat Oleh']);
    filteredDistribusi.filter((d) => d.tujuanTipe === 'reseller').forEach((d) => {
      d.items.forEach((it) => {
        rows.push([
          d.waktuSelesai ? new Date(d.waktuSelesai).toLocaleString('id-ID') : '(belum selesai)',
          d.tujuanNama,
          d.status,
          `${jenisNama(it.jenisId)} - ${it.varian}`,
          it.jumlahDibawa,
          it.jumlahRetur,
          it.jumlahDibawa - it.jumlahRetur,
          d.dicatatOleh || '',
        ]);
      });
    });
    rows.push([]);
    rows.push(['=== RINGKASAN ===']);
    rows.push(['Total pendapatan (langsung + distribusi titik jual)', totalPendapatan]);
    rows.push(['Total pengeluaran', totalPengeluaran]);
    rows.push(['Untung bersih', untungBersih]);

    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-stok-es-${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('Laporan Stok Es', 14, 16);
    doc.setFontSize(10);
    doc.text(`Periode: ${range.label}`, 14, 23);

    autoTable(doc, {
      startY: 28,
      head: [['Ringkasan', 'Nilai']],
      body: [
        ['Total pendapatan (langsung + distribusi titik jual)', formatRupiah(totalPendapatan)],
        ['Total pengeluaran', formatRupiah(totalPengeluaran)],
        ['Untung bersih', formatRupiah(untungBersih)],
        ['Total pcs masuk', String(totalMasuk)],
        ['Total pcs terjual (langsung)', String(totalKeluarPcs)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [240, 160, 75] },
    });

    let y = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(9);
    doc.setTextColor(58, 38, 24);
    doc.text('Penjualan Langsung (input manual di tab Stok)', 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [['Tanggal', 'Produk', 'Tipe', 'Jml', 'Total', 'Lokasi/Bayar', 'Oleh']],
      body: filteredTransaksi.map((t) => [
        new Date(t.waktu).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        `${jenisNama(t.jenisId)} - ${t.varian}`,
        t.tipe,
        t.jumlah,
        t.tipe === 'keluar' ? formatRupiah(t.jumlah * (t.hargaSatuan || 0)) : '-',
        [t.lokasi, t.metodeBayar].filter(Boolean).join(' / ') || '-',
        t.dicatatOleh || '-',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [58, 38, 24] },
      styles: { fontSize: 8 },
    });

    if (filteredPengeluaran.length > 0) {
      y = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(9);
      doc.setTextColor(192, 57, 43);
      doc.text('Pengeluaran', 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [['Tanggal', 'Keterangan', 'Jumlah', 'Oleh']],
        body: filteredPengeluaran.map((p) => [
          new Date(p.waktu).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
          p.deskripsi,
          formatRupiah(p.jumlah),
          p.dicatatOleh || '-',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [192, 57, 43] },
        styles: { fontSize: 8 },
      });
    }

    const distLokasi = filteredDistribusi.filter((d) => d.tujuanTipe === 'lokasi');
    if (distLokasi.length > 0) {
      const distRows = [];
      distLokasi.forEach((d) => {
        d.items.forEach((it) => {
          const terjual = it.jumlahDibawa - it.jumlahRetur;
          distRows.push([
            d.waktuSelesai ? new Date(d.waktuSelesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Berjalan',
            d.tujuanNama,
            `${jenisNama(it.jenisId)} - ${it.varian}`,
            it.jumlahDibawa,
            it.jumlahRetur,
            terjual,
            formatRupiah(terjual * (it.hargaSatuan || 0)),
          ]);
        });
      });
      y = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(9);
      doc.setTextColor(46, 125, 91);
      doc.text('Distribusi Titik Jual Sendiri (nilai ini IKUT masuk ke Total Pendapatan)', 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [['Tanggal', 'Tujuan', 'Varian', 'Dibawa', 'Retur', 'Terjual', 'Est. Pendapatan']],
        body: distRows,
        theme: 'striped',
        headStyles: { fillColor: [46, 125, 91] },
        styles: { fontSize: 8 },
      });
    }

    const distReseller = filteredDistribusi.filter((d) => d.tujuanTipe === 'reseller');
    if (distReseller.length > 0) {
      const resRows = [];
      distReseller.forEach((d) => {
        d.items.forEach((it) => {
          resRows.push([
            d.waktuSelesai ? new Date(d.waktuSelesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : 'Berjalan',
            d.tujuanNama,
            `${jenisNama(it.jenisId)} - ${it.varian}`,
            it.jumlahDibawa,
            it.jumlahRetur,
            it.jumlahDibawa - it.jumlahRetur,
          ]);
        });
      });
      y = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(9);
      doc.setTextColor(138, 90, 43);
      doc.text('Distribusi Reseller (TIDAK dihitung ke Total Pendapatan)', 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [['Tanggal', 'Reseller', 'Varian', 'Dibawa', 'Retur', 'Terjual']],
        body: resRows,
        theme: 'striped',
        headStyles: { fillColor: [138, 90, 43] },
        styles: { fontSize: 8 },
      });
    }

    doc.save(`laporan-stok-es-${todayStr}.pdf`);
  };

  return (
    <div>
      <div style={styles.kelolaAddCard}>
        <label style={styles.fieldLabel}>Pilih periode laporan</label>
        <div style={styles.lokasiGrid}>
          <button onClick={() => setMode('harian')} style={{ ...styles.lokasiChip, ...(mode === 'harian' ? styles.lokasiChipActive : {}) }}>Harian</button>
          <button onClick={() => setMode('periode')} style={{ ...styles.lokasiChip, ...(mode === 'periode' ? styles.lokasiChipActive : {}) }}>Rentang tanggal</button>
          <button onClick={() => setMode('semua')} style={{ ...styles.lokasiChip, ...(mode === 'semua' ? styles.lokasiChipActive : {}) }}>Semua riwayat</button>
        </div>

        {mode === 'harian' && (
          <>
            <label style={styles.fieldLabel}>Tanggal</label>
            <input type="date" style={styles.input} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </>
        )}
        {mode === 'periode' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={styles.fieldLabel}>Dari</label>
              <input type="date" style={styles.input} value={dari} onChange={(e) => setDari(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.fieldLabel}>Sampai</label>
              <input type="date" style={styles.input} value={sampai} onChange={(e) => setSampai(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div style={styles.untungCard}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#8A6D4E', marginBottom: 8 }}>
          <Calendar size={13} style={{ marginRight: 5, verticalAlign: -2 }} />{range.label}
        </div>
        <div style={styles.untungRow}><span>Total pendapatan</span><strong style={{ color: '#2E7D5B' }}>{formatRupiah(totalPendapatan)}</strong></div>
        <div style={styles.untungRow}><span>Total pengeluaran</span><strong style={{ color: '#C0392B' }}>-{formatRupiah(totalPengeluaran)}</strong></div>
        <div style={{ ...styles.untungRow, borderTop: '1px solid #EFDFC8', paddingTop: 8, marginTop: 4 }}>
          <span style={{ fontWeight: 700 }}>Untung bersih</span>
          <strong style={{ color: '#3A2618', fontSize: 15 }}>{formatRupiah(untungBersih)}</strong>
        </div>
      </div>

      {filteredTransaksi.length === 0 && filteredPengeluaran.length === 0 && filteredDistribusi.length === 0 ? (
        <EmptyState text="Tidak ada data di periode ini." />
      ) : (
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          <button style={{ ...styles.submitBtn, background: '#2E7D5B', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={downloadPDF}>
            <FileDown size={16} /> PDF
          </button>
          <button style={{ ...styles.submitBtn, background: '#3A2618', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={downloadCSV}>
            <FileDown size={16} /> Excel/CSV
          </button>
        </div>
      )}
    </div>
  );
}

// ============ DISTRIBUSI VIEW ============
function DistribusiView({ jenisList, stokMap, resellerList, distribusiList, countingList, onMulai, onTambahCounting, onHapusCounting, onTutup }) {
  const [showMulai, setShowMulai] = useState(false);
  const [openDist, setOpenDist] = useState(null); // distribusi object being managed

  const berjalan = distribusiList.filter((d) => d.status === 'berjalan');
  const selesai = distribusiList.filter((d) => d.status === 'selesai').sort((a, b) => b.waktuSelesai - a.waktuSelesai);

  const resellerAktif = resellerList.filter((r) => r.aktif);

  return (
    <div>
      <button style={{ ...styles.submitBtn, background: '#3A2618', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setShowMulai(true)}>
        <Truck size={16} /> Mulai Distribusi Baru
      </button>

      {berjalan.length === 0 && selesai.length === 0 && (
        <EmptyState text="Belum ada distribusi. Mulai distribusi untuk kirim stok ke titik jual atau reseller." />
      )}

      {berjalan.length > 0 && (
        <>
          <div style={styles.sectionLabel}>Sedang berjalan</div>
          {berjalan.map((d) => (
            <DistribusiCard key={d.id} d={d} jenisList={jenisList} countingList={countingList} onClick={() => setOpenDist(d)} />
          ))}
        </>
      )}

      {selesai.length > 0 && (
        <>
          <div style={{ ...styles.sectionLabel, marginTop: 16 }}>Sudah selesai</div>
          {selesai.slice(0, 10).map((d) => (
            <DistribusiCard key={d.id} d={d} jenisList={jenisList} countingList={countingList} onClick={() => setOpenDist(d)} selesai />
          ))}
        </>
      )}

      {showMulai && (
        <MulaiDistribusiModal
          jenisList={jenisList}
          stokMap={stokMap}
          resellerAktif={resellerAktif}
          onClose={() => setShowMulai(false)}
          onSubmit={(tujuanTipe, tujuanNama, resellerId, items) => { onMulai(tujuanTipe, tujuanNama, resellerId, items); setShowMulai(false); }}
        />
      )}

      {openDist && (
        <DetailDistribusiModal
          d={openDist}
          jenisList={jenisList}
          countingList={countingList.filter((c) => c.distribusiId === openDist.id)}
          onClose={() => setOpenDist(null)}
          onTambahCounting={onTambahCounting}
          onHapusCounting={onHapusCounting}
          onTutup={(returMap) => { onTutup(openDist.id, returMap); setOpenDist(null); }}
        />
      )}
    </div>
  );
}

function DistribusiCard({ d, jenisList, countingList, onClick, selesai }) {
  const jenisNama = (id) => jenisList.find((j) => j.id === id)?.nama || id;
  const totalDibawa = d.items.reduce((a, it) => a + it.jumlahDibawa, 0);
  const totalRetur = d.items.reduce((a, it) => a + it.jumlahRetur, 0);
  const totalCounting = countingList.filter((c) => c.distribusiId === d.id).reduce((a, c) => a + c.jumlah, 0);

  return (
    <button style={styles.distCard} onClick={onClick}>
      <div style={styles.distCardHeader}>
        <div style={styles.distCardTujuan}>
          {d.tujuanTipe === 'reseller' ? <Users size={14} /> : <MapPin size={14} />} {d.tujuanNama}
        </div>
        <div style={{ ...styles.distBadge, background: selesai ? '#E4F3EA' : '#FFF0DC', color: selesai ? '#2E7D5B' : '#C0862E' }}>
          {selesai ? 'Selesai' : 'Berjalan'}
        </div>
      </div>
      <div style={styles.distCardMeta}>
        {new Date(d.waktuMulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
        {' · '}Dibawa {totalDibawa} pcs
        {selesai && <> · Retur {totalRetur} pcs · Terjual {totalDibawa - totalRetur} pcs</>}
        {!selesai && d.tujuanTipe === 'lokasi' && totalCounting > 0 && <> · Counting {totalCounting} pcs</>}
      </div>
      <div style={styles.distCardItems}>
        {d.items.map((it) => `${jenisNama(it.jenisId)} - ${it.varian} (${it.jumlahDibawa})`).join(' · ')}
      </div>
    </button>
  );
}

function MulaiDistribusiModal({ jenisList, stokMap, resellerAktif, onClose, onSubmit }) {
  const [tujuanTipe, setTujuanTipe] = useState('lokasi');
  const [tujuanNama, setTujuanNama] = useState(LOKASI_OPTIONS[0]);
  const [resellerId, setResellerId] = useState(resellerAktif[0]?.id || '');
  const [items, setItems] = useState([]); // {jenisId, varian, jumlah}
  const [pickJenis, setPickJenis] = useState(jenisList[0]?.id || '');
  const [pickVarian, setPickVarian] = useState(jenisList[0]?.varian[0]?.nama || '');
  const [pickJumlah, setPickJumlah] = useState('');

  const jenisAktif = jenisList.find((j) => j.id === pickJenis);

  const tambahItem = () => {
    const n = parseInt(pickJumlah, 10);
    if (!n || n <= 0 || !pickVarian) return;
    const hargaVarian = jenisAktif?.varian.find((v) => v.nama === pickVarian)?.harga || 0;
    setItems((prev) => [...prev, { jenisId: pickJenis, varian: pickVarian, jumlah: n, harga: hargaVarian }]);
    setPickJumlah('');
  };

  const hapusItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const submit = () => {
    if (items.length === 0) return;
    const namaTujuan = tujuanTipe === 'reseller' ? (resellerAktif.find((r) => r.id === resellerId)?.nama || '') : tujuanNama;
    if (!namaTujuan) return;
    onSubmit(tujuanTipe, namaTujuan, tujuanTipe === 'reseller' ? resellerId : null, items);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div style={styles.modalTitle}>Mulai Distribusi</div>
          <button style={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <label style={styles.fieldLabel}>Tujuan</label>
        <div style={styles.lokasiGrid}>
          <button onClick={() => setTujuanTipe('lokasi')} style={{ ...styles.lokasiChip, ...(tujuanTipe === 'lokasi' ? styles.lokasiChipActive : {}) }}>Titik jual sendiri</button>
          <button onClick={() => setTujuanTipe('reseller')} style={{ ...styles.lokasiChip, ...(tujuanTipe === 'reseller' ? styles.lokasiChipActive : {}) }}>Reseller</button>
        </div>

        {tujuanTipe === 'lokasi' ? (
          <div style={styles.lokasiGrid}>
            {LOKASI_OPTIONS.map((l) => (
              <button key={l} onClick={() => setTujuanNama(l)} style={{ ...styles.lokasiChip, ...(tujuanNama === l ? styles.lokasiChipActive : {}) }}>{l}</button>
            ))}
          </div>
        ) : resellerAktif.length === 0 ? (
          <div style={styles.varianEmptyRow}>Belum ada reseller aktif. Tambahkan dulu di tab Kelola.</div>
        ) : (
          <div style={styles.lokasiGrid}>
            {resellerAktif.map((r) => (
              <button key={r.id} onClick={() => setResellerId(r.id)} style={{ ...styles.lokasiChip, ...(resellerId === r.id ? styles.lokasiChipActive : {}) }}>{r.nama}</button>
            ))}
          </div>
        )}

        <label style={{ ...styles.fieldLabel, marginTop: 8 }}>Tambah varian yang dibawa</label>
        <div style={styles.addRow}>
          <select
            style={{ ...styles.input, marginBottom: 0, flex: 1.2 }}
            value={pickJenis}
            onChange={(e) => { setPickJenis(e.target.value); const j = jenisList.find((jj) => jj.id === e.target.value); setPickVarian(j?.varian[0]?.nama || ''); }}
          >
            {jenisList.map((j) => <option key={j.id} value={j.id}>{j.nama}</option>)}
          </select>
        </div>
        <div style={styles.addRow}>
          <select style={{ ...styles.input, marginBottom: 0, flex: 1.2 }} value={pickVarian} onChange={(e) => setPickVarian(e.target.value)}>
            {(jenisAktif?.varian || []).map((v) => {
              const key = pickJenis + '||' + v.nama;
              const sisa = stokMap[key] || 0;
              return <option key={v.nama} value={v.nama}>{v.nama} (sisa {sisa})</option>;
            })}
          </select>
          <input
            type="number" inputMode="numeric" placeholder="Jml"
            style={{ ...styles.input, marginBottom: 0, flex: 0.6 }}
            value={pickJumlah}
            onChange={(e) => setPickJumlah(e.target.value)}
          />
          <button style={styles.addBtnSmall} onClick={tambahItem}><Plus size={15} /></button>
        </div>

        {items.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {items.map((it, idx) => (
              <div key={idx} style={styles.kelolaVarianRow}>
                <div style={styles.kelolaVarianNama}>{jenisList.find((j) => j.id === it.jenisId)?.nama} - {it.varian}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#3A2618' }}>{it.jumlah} pcs</div>
                <button style={styles.deleteBtnSmall} onClick={() => hapusItem(idx)}><X size={13} /></button>
              </div>
            ))}
          </div>
        )}

        <button style={{ ...styles.submitBtn, background: '#3A2618', opacity: items.length > 0 ? 1 : 0.5 }} onClick={submit} disabled={items.length === 0}>
          Mulai Distribusi ({items.reduce((a, i) => a + i.jumlah, 0)} pcs)
        </button>
      </div>
    </div>
  );
}

function DetailDistribusiModal({ d, jenisList, countingList, onClose, onTambahCounting, onHapusCounting, onTutup }) {
  const jenisNama = (id) => jenisList.find((j) => j.id === id)?.nama || id;
  const isBerjalan = d.status === 'berjalan';
  const [showTutup, setShowTutup] = useState(false);
  const [returVal, setReturVal] = useState(() => Object.fromEntries(d.items.map((it) => [it.id, it.jumlahRetur])));
  const [countJenis, setCountJenis] = useState(d.items[0]?.jenisId || '');
  const [countJumlah, setCountJumlah] = useState('');
  const [countMetode, setCountMetode] = useState('Cash');

  const totalCountingByJenis = {};
  for (const c of countingList) totalCountingByJenis[c.jenisId] = (totalCountingByJenis[c.jenisId] || 0) + c.jumlah;
  const totalDibawaByJenis = {};
  for (const it of d.items) totalDibawaByJenis[it.jenisId] = (totalDibawaByJenis[it.jenisId] || 0) + it.jumlahDibawa;

  const submitCounting = () => {
    const n = parseInt(countJumlah, 10);
    if (!n || n <= 0) return;
    onTambahCounting(d.id, countJenis, n, countMetode);
    setCountJumlah('');
  };

  const totalDibawa = d.items.reduce((a, it) => a + it.jumlahDibawa, 0);
  const totalReturInput = Object.values(returVal).reduce((a, v) => a + (parseInt(v, 10) || 0), 0);
  const totalTerjualEstimasi = totalDibawa - totalReturInput;
  const totalCountingSemua = countingList.reduce((a, c) => a + c.jumlah, 0);
  const selisih = totalTerjualEstimasi - totalCountingSemua;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalTitle}>{d.tujuanNama}</div>
            <div style={styles.modalSub}>{isBerjalan ? 'Distribusi berjalan' : 'Sudah ditutup'}</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        <div style={styles.sectionLabel}>Dibawa</div>
        {d.items.map((it) => (
          <div key={it.id} style={styles.kelolaVarianRow}>
            <div style={styles.kelolaVarianNama}>{jenisNama(it.jenisId)} - {it.varian}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#3A2618' }}>{it.jumlahDibawa} pcs</div>
          </div>
        ))}

        {d.tujuanTipe === 'lokasi' && isBerjalan && (
          <>
            <div style={{ ...styles.sectionLabel, marginTop: 14 }}>Catat penjualan (opsional)</div>
            <div style={styles.addRow}>
              <select style={{ ...styles.input, marginBottom: 0, flex: 1 }} value={countJenis} onChange={(e) => setCountJenis(e.target.value)}>
                {[...new Set(d.items.map((it) => it.jenisId))].map((jid) => <option key={jid} value={jid}>{jenisNama(jid)}</option>)}
              </select>
              <input type="number" inputMode="numeric" placeholder="Jml" style={{ ...styles.input, marginBottom: 0, flex: 0.5 }} value={countJumlah} onChange={(e) => setCountJumlah(e.target.value)} />
            </div>
            <div style={{ ...styles.lokasiGrid, marginBottom: 10 }}>
              <button onClick={() => setCountMetode('Cash')} style={{ ...styles.lokasiChip, ...(countMetode === 'Cash' ? styles.lokasiChipActive : {}) }}><Banknote size={13} style={{ marginRight: 4, verticalAlign: -2 }} />Cash</button>
              <button onClick={() => setCountMetode('QRIS')} style={{ ...styles.lokasiChip, ...(countMetode === 'QRIS' ? styles.lokasiChipActive : {}) }}><QrCode size={13} style={{ marginRight: 4, verticalAlign: -2 }} />QRIS</button>
              <button style={{ ...styles.addBtnSmall, width: 44 }} onClick={submitCounting}><Plus size={15} /></button>
            </div>

            {countingList.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                {countingList.map((c) => (
                  <div key={c.id} style={styles.kelolaVarianRow}>
                    <div style={styles.kelolaVarianNama}>{jenisNama(c.jenisId)} · {c.metodeBayar} {c.dicatatOleh ? `· ${c.dicatatOleh}` : ''}</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{c.jumlah} pcs</div>
                    <button style={styles.deleteBtnSmall} onClick={() => onHapusCounting(c.id)}><X size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {isBerjalan && !showTutup && (
          <button style={{ ...styles.submitBtn, background: '#C0392B', marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setShowTutup(true)}>
            <RotateCcw size={16} /> Tutup & Catat Retur
          </button>
        )}

        {isBerjalan && showTutup && (
          <>
            <div style={{ ...styles.sectionLabel, marginTop: 14 }}>Jumlah sisa (retur) per varian</div>
            {d.items.map((it) => (
              <div key={it.id} style={styles.kelolaVarianRow}>
                <div style={styles.kelolaVarianNama}>{jenisNama(it.jenisId)} - {it.varian} <span style={{ color: '#B08968' }}>(dibawa {it.jumlahDibawa})</span></div>
                <input
                  type="number" inputMode="numeric"
                  style={{ width: 56, padding: '6px 8px', borderRadius: 8, border: '1px solid #EFDFC8', fontSize: 13 }}
                  value={returVal[it.id]}
                  onChange={(e) => setReturVal((s) => ({ ...s, [it.id]: e.target.value }))}
                />
              </div>
            ))}

            <div style={styles.untungCard}>
              <div style={styles.untungRow}><span>Total terjual (estimasi)</span><strong>{totalTerjualEstimasi} pcs</strong></div>
              {totalCountingSemua > 0 && (
                <>
                  <div style={styles.untungRow}><span>Total counting tercatat</span><strong>{totalCountingSemua} pcs</strong></div>
                  {selisih !== 0 && (
                    <div style={{ ...styles.untungRow, color: '#C0392B' }}>
                      <span><AlertTriangle size={13} style={{ marginRight: 4, verticalAlign: -2 }} />Ada selisih</span>
                      <strong>{selisih > 0 ? '+' : ''}{selisih} pcs</strong>
                    </div>
                  )}
                </>
              )}
            </div>

            <button
              style={{ ...styles.submitBtn, background: '#2E7D5B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onClick={() => onTutup(Object.fromEntries(Object.entries(returVal).map(([k, v]) => [k, parseInt(v, 10) || 0])))}
            >
              <CheckCircle2 size={16} /> Konfirmasi & Kembalikan ke Stok
            </button>
          </>
        )}

        {!isBerjalan && (
          <>
            <div style={{ ...styles.sectionLabel, marginTop: 14 }}>Retur & Terjual</div>
            {d.items.map((it) => (
              <div key={it.id} style={styles.kelolaVarianRow}>
                <div style={styles.kelolaVarianNama}>{jenisNama(it.jenisId)} - {it.varian}</div>
                <div style={{ fontSize: 12, color: '#B08968' }}>Retur {it.jumlahRetur} · Terjual {it.jumlahDibawa - it.jumlahRetur}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={styles.empty}>
      <Package size={32} color="#D9A46A" />
      <div style={styles.emptyText}>{text}</div>
    </div>
  );
}

const spinCss = `.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`;
const globalCss = `
  * { box-sizing: border-box; }
  button { font-family: inherit; cursor: pointer; border: none; }
  input { font-family: inherit; }
  input:focus { outline: 2px solid #F0A04B; outline-offset: 1px; }
  button:focus-visible { outline: 2px solid #F0A04B; outline-offset: 2px; }
  body { font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
`;

const styles = {
  loadingScreen: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF8F0' },
  loginScreen: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: '#FFF8F0', padding: 32, textAlign: 'center',
  },
  loginIce: { fontSize: 44, marginBottom: 8 },
  loginTitle: { fontSize: 22, fontWeight: 800, color: '#3A2618' },
  loginSub: { fontSize: 13, color: '#B08968', marginTop: 6, marginBottom: 24, maxWidth: 260 },
  loginInput: {
    width: '100%', maxWidth: 280, padding: '13px 16px', borderRadius: 12, border: '1.5px solid #EFDFC8',
    fontSize: 16, marginBottom: 12, background: '#fff', color: '#3A2618', textAlign: 'center',
  },
  loginBtn: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '13px 28px', borderRadius: 14,
    background: '#3A2618', color: '#FFF8F0', fontSize: 15, fontWeight: 700,
  },
  loginHint: { fontSize: 11.5, color: '#C9AC85', marginTop: 20, maxWidth: 260, lineHeight: 1.5 },
  app: { minHeight: '100vh', background: '#FFF8F0', paddingBottom: 32, maxWidth: 480, margin: '0 auto' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 16px' },
  headerIce: { fontSize: 32, lineHeight: 1 },
  headerTitle: { fontSize: 20, fontWeight: 700, color: '#3A2618', letterSpacing: -0.3 },
  logoutBtn: {
    width: 34, height: 34, borderRadius: '50%', background: '#F0E4D4', color: '#8A6D4E',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  namaBtn: {
    display: 'flex', alignItems: 'center', gap: 5, background: '#F0E4D4', color: '#8A6D4E',
    borderRadius: 16, padding: '6px 10px', fontSize: 11.5, fontWeight: 600, marginRight: 6, whiteSpace: 'nowrap',
  },
  tabBar: { display: 'flex', gap: 5, padding: '0 14px', marginBottom: 8 },
  tabBtn: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
    padding: '9px 4px', borderRadius: 12, background: 'transparent', color: '#B08968', fontSize: 11, fontWeight: 600,
  },
  tabBtnActive: { background: '#3A2618', color: '#FFF8F0' },
  content: { padding: '8px 16px 16px' },
  summaryCard: {
    background: 'linear-gradient(135deg, #F0A04B, #E8873A)', borderRadius: 18, padding: '18px 20px',
    marginBottom: 18, color: '#fff',
  },
  summaryLabel: { fontSize: 12, opacity: 0.9, fontWeight: 500 },
  summaryValue: { fontSize: 30, fontWeight: 800, marginTop: 2, letterSpacing: -0.5 },
  jenisBlock: { marginBottom: 20 },
  jenisTitle: { fontSize: 15, fontWeight: 700, color: '#3A2618', marginBottom: 8 },
  varianRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff',
    borderRadius: 14, padding: '12px 14px', marginBottom: 8, boxShadow: '0 1px 3px rgba(58,38,24,0.06)',
  },
  varianInfo: { display: 'flex', flexDirection: 'column', gap: 4 },
  varianName: { fontSize: 14, fontWeight: 600, color: '#3A2618' },
  varianMetaRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 },
  hargaTag: { background: '#FFF0DC', color: '#8A5A2B', padding: '2px 7px', borderRadius: 8, fontWeight: 600, fontSize: 11 },
  varianActions: { display: 'flex', gap: 8 },
  roundBtn: { width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  varianEmptyRow: { fontSize: 13, color: '#B08968', padding: '4px 2px' },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(58,38,24,0.45)', display: 'flex',
    alignItems: 'flex-end', justifyContent: 'center', zIndex: 50,
  },
  modal: { background: '#FFF8F0', borderRadius: '20px 20px 0 0', padding: '20px 20px 28px', width: '100%', maxWidth: 480 },
  modalHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: 700, color: '#3A2618' },
  modalSub: { fontSize: 13, color: '#B08968', marginTop: 2 },
  closeBtn: {
    background: '#F0E4D4', borderRadius: '50%', width: 30, height: 30,
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3A2618',
  },
  fieldLabel: { fontSize: 12, fontWeight: 600, color: '#8A6D4E', marginBottom: 6, display: 'block' },
  input: {
    width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #EFDFC8',
    fontSize: 16, marginBottom: 16, background: '#fff', color: '#3A2618',
  },
  totalPreview: {
    background: '#FFF0DC', color: '#8A5A2B', padding: '10px 14px', borderRadius: 12,
    fontSize: 14, marginBottom: 16, marginTop: -8,
  },
  lokasiGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  lokasiChip: {
    padding: '9px 14px', borderRadius: 20, background: '#fff', border: '1.5px solid #EFDFC8',
    fontSize: 13, fontWeight: 600, color: '#8A6D4E',
  },
  lokasiChipActive: { background: '#3A2618', borderColor: '#3A2618', color: '#FFF8F0' },
  submitBtn: { width: '100%', padding: '14px', borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 700 },
  pendapatanGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 },
  pendapatanCard: { background: '#fff', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 3px rgba(58,38,24,0.06)' },
  pendapatanLabel: { fontSize: 11.5, color: '#B08968', fontWeight: 600 },
  pendapatanValue: { fontSize: 17, fontWeight: 800, color: '#3A2618', marginTop: 4 },
  untungCard: { background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 18, boxShadow: '0 1px 3px rgba(58,38,24,0.06)' },
  untungRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: '#3A2618', padding: '4px 0' },
  sectionLabel: { fontSize: 12.5, fontWeight: 700, color: '#8A6D4E', marginBottom: 10, marginTop: 4 },
  lokasiRevRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff',
    borderRadius: 12, padding: '11px 14px', marginBottom: 8, boxShadow: '0 1px 3px rgba(58,38,24,0.06)',
  },
  lokasiRevName: { fontSize: 13, color: '#3A2618', fontWeight: 600 },
  lokasiRevValue: { fontSize: 14, color: '#2E7D5B', fontWeight: 700 },
  riwayatRow: {
    display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 14,
    padding: '10px 12px', marginBottom: 8, boxShadow: '0 1px 3px rgba(58,38,24,0.06)',
  },
  riwayatIcon: { width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  riwayatInfo: { flex: 1, minWidth: 0 },
  riwayatTitle: { fontSize: 13.5, fontWeight: 600, color: '#3A2618' },
  riwayatMeta: { fontSize: 11, color: '#B08968', marginTop: 2 },
  riwayatQty: { fontSize: 14, fontWeight: 700, flexShrink: 0 },
  deleteBtn: { background: 'transparent', color: '#D9A46A', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  deleteBtnSmall: { background: 'transparent', color: '#D9A46A', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', textAlign: 'center', gap: 10 },
  emptyText: { fontSize: 13.5, color: '#B08968', maxWidth: 240 },
  kelolaAddCard: { background: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: '0 1px 3px rgba(58,38,24,0.06)' },
  addRow: { display: 'flex', gap: 8 },
  addBtn: { width: 44, background: '#3A2618', color: '#FFF8F0', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  addBtnSmall: { width: 38, background: '#F0A04B', color: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  kelolaJenisCard: { background: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, boxShadow: '0 1px 3px rgba(58,38,24,0.06)' },
  kelolaJenisHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  kelolaVarianRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #FBF1E4' },
  kelolaVarianNama: { flex: 1, fontSize: 13.5, fontWeight: 600, color: '#3A2618' },
  hargaEditWrap: { display: 'flex', alignItems: 'center', background: '#FFF8F0', borderRadius: 8, border: '1px solid #EFDFC8', padding: '4px 8px' },
  hargaPrefix: { fontSize: 12, color: '#B08968', marginRight: 2 },
  hargaEditInput: { width: 56, border: 'none', background: 'transparent', fontSize: 13, color: '#3A2618', fontWeight: 600, padding: 2 },
  distCard: {
    display: 'block', width: '100%', textAlign: 'left', background: '#fff', borderRadius: 14, padding: '12px 14px',
    marginBottom: 8, boxShadow: '0 1px 3px rgba(58,38,24,0.06)',
  },
  distCardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  distCardTujuan: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: '#3A2618' },
  distBadge: { fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 10 },
  distCardMeta: { fontSize: 11.5, color: '#B08968', marginBottom: 4 },
  distCardItems: { fontSize: 11.5, color: '#8A6D4E', lineHeight: 1.5 },
  namaResellerInput: {
    flex: 1, fontSize: 15, fontWeight: 700, color: '#3A2618', border: 'none', background: 'transparent', padding: '4px 0',
  },
  footer: { textAlign: 'center', fontSize: 10.5, color: '#D9C4A8', padding: '10px 16px 4px' },
};
