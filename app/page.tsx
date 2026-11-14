'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Tugas {
  id: number;
  judul: string;
  mata_kuliah: string;
  tenggat_waktu: string | null;
  finish: boolean;
  foto_url: string | null;
  created_at: string;
}

const MATKUL_DEFAULT = ['Basis Data', 'PBO', 'Jarkom', 'Pemrograman Web', 'Algoritma'];

export default function Home() {
  const [daftarTugas, setDaftarTugas] = useState<Tugas[]>([]);
  const [filterStatus, setFilterStatus] = useState<'aktif' | 'semua' | 'selesai'>('aktif');
  const [bukaForm, setBukaForm] = useState(false);

  // State untuk modal detail tugas yang diklik
  const [tugasTerpilih, setTugasTerpilih] = useState<Tugas | null>(null);
const [tanggalHariIni, setTanggalHariIni] = useState('');

  useEffect(() => {
    ambilTugas();
    setTanggalHariIni(
      new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    );
  }, []);
  // State Form
  const [judul, setJudul] = useState('');
  const [mataKuliah, setMataKuliah] = useState('');
  const [tenggatWaktu, setTenggatWaktu] = useState('');
  const [fileFoto, setFileFoto] = useState<File | null>(null);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    ambilTugas();
  }, []);

  async function ambilTugas() {
    setLoading(true);
    const { data, error } = await supabase
      .from('tugas')
      .select('*')
      .order('finish', { ascending: true })
      .order('tenggat_waktu', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDaftarTugas(data);
    }
    setLoading(false);
  }

  function setPintasanTanggal(tambahHari: number) {
    const tanggal = new Date();
    tanggal.setDate(tanggal.getDate() + tambahHari);
    setTenggatWaktu(tanggal.toISOString().split('T')[0]);
  }

  // Menangani pemilihan foto dari galeri / kamera HP
  function handlePilihFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileFoto(file);
    setPreviewFoto(URL.createObjectURL(file)); // Buat URL sementara untuk pratinjau di layar
  }

  function resetForm() {
    setJudul('');
    setTenggatWaktu('');
    setFileFoto(null);
    setPreviewFoto(null);
    setBukaForm(false);
  }

  async function tambahTugas(e: React.FormEvent) {
    e.preventDefault();
    if (!judul.trim() || !mataKuliah.trim()) return;

    setMenyimpan(true);
    let urlFotoUploaded: string | null = null;

    // 1. Jika user melampirkan foto, upload dulu ke Supabase Storage
    if (fileFoto) {
      const ekstensi = fileFoto.name.split('.').pop();
      const namaFileUnik = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ekstensi}`;

      const { error: uploadError } = await supabase.storage
        .from('foto-tugas')
        .upload(namaFileUnik, fileFoto);

      if (uploadError) {
        alert('Gagal mengunggah foto: ' + uploadError.message);
        setMenyimpan(false);
        return;
      }

      // Ambil link publik foto yang baru di-upload
      const { data: publicUrlData } = supabase.storage
        .from('foto-tugas')
        .getPublicUrl(namaFileUnik);

      urlFotoUploaded = publicUrlData.publicUrl;
    }

    // 2. Simpan data tugas beserta link fotonya ke tabel database
    const { error } = await supabase.from('tugas').insert([
      {
        judul: judul.trim(),
        mata_kuliah: mataKuliah.trim(),
        tenggat_waktu: tenggatWaktu || null,
        foto_url: urlFotoUploaded,
      },
    ]);

    if (error) {
      alert('Gagal menyimpan tugas: ' + error.message);
    } else {
      resetForm();
      await ambilTugas();
    }
    setMenyimpan(false);
  }

  async function toggleSelesai(id: number, statusSekarang: boolean) {
    setDaftarTugas((prev) =>
      prev.map((item) => (item.id === id ? { ...item, finish: !statusSekarang } : item))
    );

    // Jika modal detail sedang terbuka untuk tugas ini, ikut perbarui statusnya
    if (tugasTerpilih && tugasTerpilih.id === id) {
      setTugasTerpilih({ ...tugasTerpilih, finish: !statusSekarang });
    }

    const { error } = await supabase
      .from('tugas')
      .update({ finish: !statusSekarang })
      .eq('id', id);

    if (error) ambilTugas();
  }

  async function hapusTugas(id: number) {
    if (!confirm('Hapus tugas ini?')) return;
    setDaftarTugas((prev) => prev.filter((item) => item.id !== id));
    if (tugasTerpilih?.id === id) setTugasTerpilih(null);

    const { error } = await supabase.from('tugas').delete().eq('id', id);
    if (error) ambilTugas();
  }

  // Menampilkan tanggal asli (tanpa kata "Besok" atau "Hari ini")
  function infoDeadline(tanggalStr: string | null, selesai: boolean) {
    if (!tanggalStr) return { teks: 'Tanpa tenggat', gaya: 'text-stone-400 bg-stone-100' };

    const hariIni = new Date();
    hariIni.setHours(0, 0, 0, 0);
    const target = new Date(tanggalStr + 'T00:00:00');
    const selisihHari = Math.round((target.getTime() - hariIni.getTime()) / (1000 * 60 * 60 * 24));

    const formatTanggal = target.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    if (selesai) {
      return { teks: formatTanggal, gaya: 'text-stone-400 bg-stone-100' };
    }
    if (selisihHari <= 0) {
      return { teks: formatTanggal, gaya: 'text-red-700 bg-red-50 border border-red-200 font-medium' };
    }
    if (selisihHari <= 3) {
      return { teks: formatTanggal, gaya: 'text-amber-800 bg-amber-50 border border-amber-200 font-medium' };
    }
    return { teks: formatTanggal, gaya: 'text-stone-600 bg-stone-100' };
  }

  const tugasTersaring = daftarTugas.filter((t) => {
    if (filterStatus === 'aktif') return !t.finish;
    if (filterStatus === 'selesai') return t.finish;
    return true;
  });

  const jumlahAktif = daftarTugas.filter((t) => !t.finish).length;

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-stone-900 pb-28 selection:bg-stone-900 selection:text-white">
      {/* Header Atas */}
      <header className="sticky top-0 z-10 bg-[#F7F6F2]/90 backdrop-blur-md border-b border-stone-200/80">
        <div className="max-w-lg mx-auto px-5 pt-5 pb-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-medium text-stone-500">{tanggalHariIni}</p>
              <h1 className="text-xl font-bold tracking-tight text-stone-900 mt-0.5">
                Daftar Tugas
              </h1>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold tabular-nums text-stone-900">{jumlahAktif}</span>
              <span className="text-xs text-stone-500 block">tersisa</span>
            </div>
          </div>

          
          <div className="flex gap-1.5 mt-4">
            {[
              { id: 'aktif', label: 'Belum Selesai' },
              { id: 'semua', label: 'Semua' },
              { id: 'selesai', label: 'Selesai' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id as 'aktif' | 'semua' | 'selesai')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  filterStatus === tab.id
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:bg-stone-200/70'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

     
      <main className="max-w-lg mx-auto px-5 pt-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 bg-white rounded-xl border border-stone-200/70 animate-pulse" />
            ))}
          </div>
        ) : tugasTersaring.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-2xl border border-stone-200/80 mt-2">
            <p className="text-sm font-medium text-stone-700">
              {filterStatus === 'aktif'
                ? 'Tidak ada tanggungan tugas aktif'
                : 'Belum ada data di kategori ini'}
            </p>
            <p className="text-xs text-stone-400 mt-1">
              Tekan tombol + Catat Tugas di bawah saat ada tugas baru.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {tugasTersaring.map((item) => {
              const badge = infoDeadline(item.tenggat_waktu, item.finish);
              return (
                <div
                  key={item.id}
                  className={`flex items-start justify-between gap-3 p-4 rounded-xl bg-white border transition ${
                    item.finish
                      ? 'border-stone-200/60 bg-stone-50/70'
                      : 'border-stone-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-stone-300'
                  }`}
                >
        
                  <button
                    type="button"
                    onClick={() => toggleSelesai(item.id, item.finish)}
                    aria-label="Tandai selesai"
                    className={`mt-0.5 w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition ${
                      item.finish
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-stone-300 hover:border-stone-900'
                    }`}
                  >
                    {item.finish && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                 
                  <div
                    onClick={() => setTugasTerpilih(item)}
                    className="space-y-1.5 flex-1 cursor-pointer"
                  >
                    <p
                      className={`text-[15px] font-medium leading-snug ${
                        item.finish ? 'line-through text-stone-400' : 'text-stone-900'
                      }`}
                    >
                      {item.judul}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium text-stone-600">{item.mata_kuliah}</span>
                      <span className="text-stone-300">•</span>
                      <span className={`px-2 py-0.5 rounded-md text-[11px] ${badge.gaya}`}>
                        {badge.teks}
                      </span>

                   
                      {item.foto_url && (
                        <>
                          <span className="text-stone-300">•</span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-stone-500">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Foto
                          </span>
                        </>
                      )}
                    </div>
                  </div>

             
                  <button
                    type="button"
                    onClick={() => hapusTugas(item.id)}
                    aria-label="Hapus tugas"
                    className="text-stone-300 hover:text-red-600 p-1 rounded-lg transition"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

    
      <div className="fixed bottom-6 inset-x-0 z-20 pointer-events-none">
        <div className="max-w-lg mx-auto px-5 flex justify-end">
          <button
            type="button"
            onClick={() => setBukaForm(true)}
            className="pointer-events-auto flex items-center gap-2 px-5 py-3.5 bg-stone-900 hover:bg-stone-800 active:scale-95 text-white text-sm font-medium rounded-full shadow-lg shadow-stone-900/20 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Catat Tugas
          </button>
        </div>
      </div>

   
      {tugasTerpilih && (
        <div
          onClick={() => setTugasTerpilih(null)}
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-stone-950/50 backdrop-blur-[2px] p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-stone-100 text-stone-700">
                {tugasTerpilih.mata_kuliah}
              </span>
              <button
                type="button"
                onClick={() => setTugasTerpilih(null)}
                className="text-stone-400 hover:text-stone-800 text-sm px-2 py-0.5"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-stone-900 leading-snug">
                {tugasTerpilih.judul}
              </h2>
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span>Tenggat waktu:</span>
                <span
                  className={`px-2 py-0.5 rounded-md ${
                    infoDeadline(tugasTerpilih.tenggat_waktu, tugasTerpilih.finish).gaya
                  }`}
                >
                  {infoDeadline(tugasTerpilih.tenggat_waktu, tugasTerpilih.finish).teks}
                </span>
              </div>
            </div>

            {/* Tampilkan Foto jika tersedia */}
            {tugasTerpilih.foto_url && (
              <div className="space-y-1.5 pt-1">
                <p className="text-xs font-medium text-stone-500">Lampiran Foto</p>
                <a
                  href={tugasTerpilih.foto_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-xl border border-stone-200 bg-stone-50"
                >
                  <img
                    src={tugasTerpilih.foto_url}
                    alt="Lampiran tugas"
                    className="w-full max-h-80 object-contain mx-auto"
                  />
                </a>
                <p className="text-[11px] text-stone-400">Ketuk gambar untuk membuka ukuran penuh</p>
              </div>
            )}

          
            <div className="pt-3 border-t border-stone-100 flex gap-2">
              <button
                type="button"
                onClick={() => toggleSelesai(tugasTerpilih.id, tugasTerpilih.finish)}
                className={`flex-1 py-2.5 text-xs font-semibold rounded-xl border transition ${
                  tugasTerpilih.finish
                    ? 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200'
                    : 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {tugasTerpilih.finish ? 'Tandai Belum Selesai' : 'Tandai Selesai'}
              </button>
              <button
                type="button"
                onClick={() => hapusTugas(tugasTerpilih.id)}
                className="px-4 py-2.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

     
      {bukaForm && (
        <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-stone-950/40 backdrop-blur-[2px] p-0 sm:p-4">
          <div className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl border border-stone-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-stone-900">Tugas Baru</h2>
              <button
                type="button"
                onClick={resetForm}
                className="text-stone-400 hover:text-stone-700 text-sm px-2 py-1"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={tambahTugas} className="space-y-4">
            
              <div className="space-y-2">
                <label className="text-xs font-medium text-stone-600">Mata Kuliah</label>
                <div className="flex flex-wrap gap-1.5">
                  {MATKUL_DEFAULT.map((mk) => (
                    <button
                      key={mk}
                      type="button"
                      onClick={() => setMataKuliah(mk)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                        mataKuliah === mk
                          ? 'bg-stone-900 border-stone-900 text-white font-medium'
                          : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {mk}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Nama mata kuliah..."
                  value={mataKuliah}
                  onChange={(e) => setMataKuliah(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-stone-900 transition"
                  required
                />
              </div>

             
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Instruksi / Judul Tugas</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Misal: Resume jurnal bab 3 kumpul PDF..."
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-stone-900 transition"
                  required
                />
              </div>

            
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-stone-600">Tenggat Waktu (Opsional)</label>
                  <div className="flex gap-1.5">
                    {[
                      { label: 'Besok', hari: 1 },
                      { label: '+3 Hari', hari: 3 },
                      { label: 'Minggu Depan', hari: 7 },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => setPintasanTanggal(btn.hari)}
                        className="px-2 py-0.5 text-[11px] font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md transition"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="date"
                  value={tenggatWaktu}
                  onChange={(e) => setTenggatWaktu(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:border-stone-900 transition"
                />
              </div>

          
              <div className="space-y-2">
                <label className="text-xs font-medium text-stone-600">
                  Foto Papan Tulis / Slide (Opsional)
                </label>

                {!previewFoto ? (
                  <label className="flex items-center justify-center gap-2 w-full py-3 px-4 border border-dashed border-stone-300 rounded-xl bg-stone-50 hover:bg-stone-100 text-xs font-medium text-stone-600 cursor-pointer transition">
                    <svg className="w-4 h-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Pilih Foto atau Ambil Gambar
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePilihFoto}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-stone-200 bg-stone-50">
                    <img
                      src={previewFoto}
                      alt="Pratinjau foto"
                      className="w-full max-h-48 object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFileFoto(null);
                        setPreviewFoto(null);
                      }}
                      className="absolute top-2 right-2 px-2.5 py-1 text-[11px] font-medium bg-stone-900/80 text-white rounded-lg hover:bg-stone-900"
                    >
                      Hapus Foto
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={menyimpan}
                className="w-full py-3 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition"
              >
                {menyimpan ? 'Menyimpan...' : 'Simpan ke Daftar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}