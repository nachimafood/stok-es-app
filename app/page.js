'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Minus, Package, TrendingUp, TrendingDown, MapPin, Clock, X, ChevronDown, Trash2, Loader2, Wallet, LogOut, Lock, Receipt, CircleSlash, Banknote, QrCode } from 'lucide-react';

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

// ============ APP ROOT: login gate ============
export default function StokEsApp() {
  const [teamCode, setTeamCode] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('stokes-team-code') : null;
    setTeamCode(saved || '');
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

  if (checking) {
    return (
      <div style={styles.loadingScreen}>
        <Loader2 className="spin" size={28} color="#F0A04B" />
        <style>{spinCss}</style>
      </div>
    );
  }

  if (!teamCode) return <LoginScreen onLogin={handleLogin} />;

  return <MainApp teamCode={teamCode} onLogout={handleLogout} />;
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
function MainApp({ teamCode, onLogout }) {
  const [jenisList, setJenisList] = useState(null);
  const [transaksi, setTransaksi] = useState(null);
  const [pengeluaran, setPengeluaran] = useState(null);
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
    let jenisRows, varianRows, transRows, pengeluaranRows;
    try {
      const r1 = await supabase.from('jenis_es').select('*').eq('team_code', teamCode);
      const r2 = await supabase.from('varian_es').select('*').eq('team_code', teamCode);
      const r3 = await supabase.from('transaksi').select('*').eq('team_code', teamCode).order('waktu', { ascending: false });
      const r4 = await supabase.from('pengeluaran').select('*').eq('team_code', teamCode).order('waktu', { ascending: false });

      if (r1.error || r2.error || r3.error || r4.error) {
        const msg = (r1.error || r2.error || r3.error || r4.error).message || 'Gagal mengambil data dari database.';
        setLoadFailMsg(msg);
        setSaveError(true);
        setLoading(false);
        return;
      }
      jenisRows = r1.data;
      varianRows = r2.data;
      transRows = r3.data;
      pengeluaranRows = r4.data;
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
        }))
      );
      setPengeluaran(
        (pengeluaranRows || []).map((p) => ({
          id: p.id,
          deskripsi: p.deskripsi,
          jumlah: p.jumlah,
          waktu: p.waktu,
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
    };
    // optimistic update
    setTransaksi((prev) => [{ ...t, id: row.id, waktu: row.waktu }, ...prev]);
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
    const row = { id: uid(), deskripsi, jumlah, waktu: Date.now(), team_code: teamCode };
    setPengeluaran((prev) => [row, ...prev]);
    const { error } = await supabase.from('pengeluaran').insert(row);
    setSaveError(!!error);
  };

  const hapusPengeluaran = async (id) => {
    setPengeluaran((prev) => prev.filter((p) => p.id !== id));
    const { error } = await supabase.from('pengeluaran').delete().eq('id', id).eq('team_code', teamCode);
    setSaveError(!!error);
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

  if (loading || !jenisList || !transaksi || !pengeluaran) {
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
      <Header saveError={saveError} isOffline={isOffline} onLogout={onLogout} onRetry={loadData} />
      <div style={styles.tabBar}>
        <TabBtn active={tab === 'stok'} onClick={() => setTab('stok')} label="Stok" icon={<Package size={16} />} />
        <TabBtn active={tab === 'pendapatan'} onClick={() => setTab('pendapatan')} label="Pendapatan" icon={<Wallet size={16} />} />
        <TabBtn active={tab === 'pengeluaran'} onClick={() => setTab('pengeluaran')} label="Pengeluaran" icon={<Receipt size={16} />} />
        <TabBtn active={tab === 'riwayat'} onClick={() => setTab('riwayat')} label="Riwayat" icon={<Clock size={16} />} />
        <TabBtn active={tab === 'kelola'} onClick={() => setTab('kelola')} label="Kelola" icon={<ChevronDown size={16} />} />
      </div>

      <div style={styles.content}>
        {tab === 'stok' && <StokView jenisList={jenisList} stokMap={stokMap} onTambahTransaksi={tambahTransaksi} onToggleHabis={toggleHabis} />}
        {tab === 'pendapatan' && <PendapatanView transaksi={transaksi} pengeluaran={pengeluaran} />}
        {tab === 'pengeluaran' && (
          <PengeluaranView pengeluaran={pengeluaran} onTambah={tambahPengeluaran} onHapus={hapusPengeluaran} />
        )}
        {tab === 'riwayat' && <RiwayatView transaksi={transaksi} jenisList={jenisList} onHapus={hapusTransaksi} />}
        {tab === 'kelola' && (
          <KelolaView
            jenisList={jenisList}
            onTambahJenis={tambahJenis}
            onHapusJenis={hapusJenis}
            onTambahVarian={tambahVarian}
            onHapusVarian={hapusVarian}
            onUpdateHarga={updateHargaVarian}
          />
        )}
      </div>
    </div>
  );
}

function Header({ saveError, isOffline, onLogout, onRetry }) {
  let statusText = 'Tersinkron otomatis';
  let statusColor = '#B08968';
  if (isOffline) { statusText = 'Offline — akan sync saat online'; statusColor = '#C0862E'; }
  else if (saveError) { statusText = 'Gagal menyimpan — ketuk untuk coba lagi'; statusColor = '#C0392B'; }

  return (
    <div style={styles.header}>
      <div style={styles.headerIce}>🍧</div>
      <div style={{ flex: 1 }} onClick={saveError ? onRetry : undefined}>
        <div style={styles.headerTitle}>Stok Es</div>
        <div style={{ fontSize: 12, color: statusColor, marginTop: 2 }}>{statusText}</div>
      </div>
      <button style={styles.logoutBtn} onClick={onLogout} aria-label="Ganti tim">
        <LogOut size={16} />
      </button>
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
                    <div style={styles.varianName}>{v.nama}{v.habis ? ' · Habis' : ''}</div>
                    <div style={styles.varianMetaRow}>
                      <span style={{ color: jumlah <= 0 ? '#C0392B' : '#2E7D5B', fontWeight: 600 }}>{jumlah} pcs</span>
                      <span style={styles.hargaTag}>{formatRupiah(v.harga)}</span>
                    </div>
                  </div>
                  <div style={styles.varianActions}>
                    <button
                      style={{ ...styles.roundBtn, background: v.habis ? '#F0E4D4' : '#FFF0DC', color: v.habis ? '#8A6D4E' : '#C0862E' }}
                      onClick={() => onToggleHabis(jenis.id, v.nama, !v.habis)}
                      aria-label={v.habis ? `Tandai ${v.nama} masih ada` : `Tandai ${v.nama} habis`}
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
function PendapatanView({ transaksi, pengeluaran }) {
  const keluar = useMemo(() => transaksi.filter((t) => t.tipe === 'keluar'), [transaksi]);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayOfWeek = now.getDay();
  const startOfWeek = startOfDay - dayOfWeek * 86400000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

  const sumSince = (ts) => keluar.filter((t) => t.waktu >= ts).reduce((a, t) => a + t.jumlah * (t.hargaSatuan || 0), 0);
  const sumPengeluaranSince = (ts) => pengeluaran.filter((p) => p.waktu >= ts).reduce((a, p) => a + p.jumlah, 0);

  const harian = sumSince(startOfDay);
  const mingguan = sumSince(startOfWeek);
  const bulanan = sumSince(startOfMonth);
  const tahunan = sumSince(startOfYear);

  const pengeluaranHarian = sumPengeluaranSince(startOfDay);
  const pengeluaranBulanan = sumPengeluaranSince(startOfMonth);

  const perLokasi = useMemo(() => {
    const map = {};
    for (const t of keluar) {
      const loc = t.lokasi || 'Tanpa lokasi';
      map[loc] = (map[loc] || 0) + t.jumlah * (t.hargaSatuan || 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [keluar]);

  const totalCash = useMemo(() => keluar.filter((t) => t.metodeBayar === 'Cash').reduce((a, t) => a + t.jumlah * (t.hargaSatuan || 0), 0), [keluar]);
  const totalQris = useMemo(() => keluar.filter((t) => t.metodeBayar === 'QRIS').reduce((a, t) => a + t.jumlah * (t.hargaSatuan || 0), 0), [keluar]);

  if (keluar.length === 0) {
    return <EmptyState text="Belum ada penjualan tercatat. Pendapatan akan muncul setelah ada stok keluar." />;
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

      {(totalCash > 0 || totalQris > 0) && (
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
function KelolaView({ jenisList, onTambahJenis, onHapusJenis, onTambahVarian, onHapusVarian, onUpdateHarga }) {
  const [namaJenisBaru, setNamaJenisBaru] = useState('');
  const [varianInput, setVarianInput] = useState({});
  const [hargaInput, setHargaInput] = useState({});

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
};
