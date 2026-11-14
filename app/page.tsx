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
  foto_urls: string[] | null;
  created_at: string;
}

const MATKUL_DEFAULT = ['Basis Data', 'PBO', 'Jarkom', 'Pemrograman Web', 'Algoritma'];

export default function Home() {
  const [daftarTugas, setDaftarTugas] = useState<Tugas[]>([]);
  const [filterStatus, setFilterStatus] = useState<'aktif' | 'semua' | 'selesai'>('aktif');
  const [bukaForm, setBukaForm] = useState(false);
  const [tugasTerpilih, setTugasTerpilih] = useState<Tugas | null>(null);

  // State Splash Screen (Animasi Pembuka)
  const [tampilSplash, setTampilSplash] = useState(true);
  const [mulaiFadeOut, setMulaiFadeOut] = useState(false);

  // State Tema & Tanggal
  const [modeGelap, setModeGelap] = useState(false);
  const [tanggalHariIni, setTanggalHariIni] = useState('');

  // State Form (Mendukung banyak foto)
  const [judul, setJudul] = useState('');
  const [mataKuliah, setMataKuliah] = useState('');
  const [tenggatWaktu, setTenggatWaktu] = useState('');
  const [fileFotos, setFileFotos] = useState<File[]>([]);
  const [previewFotos, setPreviewFotos] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    // 1. Cek preferensi tema secepat mungkin agar warna splash screen sesuai
    const temaTersimpan = localStorage.getItem('tema_gelap');
    if (temaTersimpan === 'true') {
      setModeGelap(true);
    }

    // 2. Ambil data dari Supabase di latar belakang selagi animasi berjalan
    ambilTugas();

    // 3. Set tanggal hari ini di sisi browser
    setTanggalHariIni(
      new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    );

    // 4. Atur durasi animasi pembuka (900ms tampil, lalu 350ms memudar halus)
    const timerFade = setTimeout(() => {
      setMulaiFadeOut(true);
    }, 900);

    const timerHilang = setTimeout(() => {
      setTampilSplash(false);
    }, 1250);

    return () => {
      clearTimeout(timerFade);
      clearTimeout(timerHilang);
    };
  }, []);

  function toggleTema() {
    const nilaiBaru = !modeGelap;
    setModeGelap(nilaiBaru);
    localStorage.setItem('tema_gelap', String(nilaiBaru));
  }

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

  function ambilSemuaFotoTugas(tugas: Tugas): string[] {
    if (tugas.foto_urls && tugas.foto_urls.length > 0) {
      return tugas.foto_urls;
    }
    if (tugas.foto_url) {
      return [tugas.foto_url];
    }
    return [];
  }

  function setPintasanTanggal(tambahHari: number) {
    const tanggal = new Date();
    tanggal.setDate(tanggal.getDate() + tambahHari);
    setTenggatWaktu(tanggal.toISOString().split('T')[0]);
  }

  function handlePilihFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const daftarFileBaru = Array.from(files);
    const daftarPreviewBaru = daftarFileBaru.map((file) => URL.createObjectURL(file));

    setFileFotos((prev) => [...prev, ...daftarFileBaru]);
    setPreviewFotos((prev) => [...prev, ...daftarPreviewBaru]);

    e.target.value = '';
  }

  function hapusFotoPilihan(indexHapus: number) {
    setFileFotos((prev) => prev.filter((_, idx) => idx !== indexHapus));
    setPreviewFotos((prev) => prev.filter((_, idx) => idx !== indexHapus));
  }

  function resetForm() {
    setJudul('');
    setTenggatWaktu('');
    setFileFotos([]);
    setPreviewFotos([]);
    setBukaForm(false);
  }

  async function tambahTugas(e: React.FormEvent) {
    e.preventDefault();
    if (!judul.trim() || !mataKuliah.trim()) return;

    setMenyimpan(true);
    const daftarUrlUploaded: string[] = [];

    if (fileFotos.length > 0) {
      for (const file of fileFotos) {
        const ekstensi = file.name.split('.').pop() || 'jpg';
        const namaFileUnik = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ekstensi}`;

        const { error: uploadError } = await supabase.storage
          .from('foto-tugas')
          .upload(namaFileUnik, file);

        if (uploadError) {
          alert('Gagal mengunggah salah satu foto: ' + uploadError.message);
          setMenyimpan(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from('foto-tugas')
          .getPublicUrl(namaFileUnik);

        daftarUrlUploaded.push(publicUrlData.publicUrl);
      }
    }

    const { error } = await supabase.from('tugas').insert([
      {
        judul: judul.trim(),
        mata_kuliah: mataKuliah.trim(),
        tenggat_waktu: tenggatWaktu || null,
        foto_urls: daftarUrlUploaded,
        foto_url: daftarUrlUploaded[0] || null,
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

  function infoDeadline(tanggalStr: string | null, selesai: boolean) {
    if (!tanggalStr) {
      return {
        teks: 'Tanpa tenggat',
        gaya: modeGelap ? 'text-stone-400 bg-stone-800/80' : 'text-stone-400 bg-stone-100',
      };
    }

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
      return {
        teks: formatTanggal,
        gaya: modeGelap ? 'text-stone-500 bg-stone-800/60' : 'text-stone-400 bg-stone-100',
      };
    }
    if (selisihHari <= 0) {
      return {
        teks: formatTanggal,
        gaya: modeGelap
          ? 'text-red-300 bg-red-950/70 border border-red-800/60 font-medium'
          : 'text-red-700 bg-red-50 border border-red-200 font-medium',
      };
    }
    if (selisihHari <= 3) {
      return {
        teks: formatTanggal,
        gaya: modeGelap
          ? 'text-amber-300 bg-amber-950/60 border border-amber-800/60 font-medium'
          : 'text-amber-800 bg-amber-50 border border-amber-200 font-medium',
      };
    }
    return {
      teks: formatTanggal,
      gaya: modeGelap ? 'text-stone-300 bg-stone-800' : 'text-stone-600 bg-stone-100',
    };
  }

  const tugasTersaring = daftarTugas.filter((t) => {
    if (filterStatus === 'aktif') return !t.finish;
    if (filterStatus === 'selesai') return t.finish;
    return true;
  });

  const jumlahAktif = daftarTugas.filter((t) => !t.finish).length;
  const fotoModalDetail = tugasTerpilih ? ambilSemuaFotoTugas(tugasTerpilih) : [];

  return (
    <div
      className={`min-h-screen pb-28 transition-colors duration-200 ${
        modeGelap
          ? 'bg-[#141413] text-stone-100 selection:bg-stone-100 selection:text-stone-900'
          : 'bg-[#F7F6F2] text-stone-900 selection:bg-stone-900 selection:text-white'
      }`}
    >
      {/* SPLASH SCREEN / ANIMASI PEMBUKA */}
      {tampilSplash && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-all duration-350 ease-out ${
            mulaiFadeOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
          } ${modeGelap ? 'bg-[#141413] text-stone-100' : 'bg-[#F7F6F2] text-stone-900'}`}
        >
          <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-500">
            <div
              className={`w-24 h-24 rounded-3xl overflow-hidden shadow-xl border flex items-center justify-center ${
                modeGelap
                  ? 'bg-[#1E1E1C] border-stone-800 shadow-black/50'
                  : 'bg-white border-stone-200/80 shadow-stone-900/10'
              }`}
            >
              <img
                src="/icon.png"
                alt="Logo Tugas Kuliah"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-base font-bold tracking-tight">Cue Tanjungan Bamba</h2>
              <div className="flex items-center justify-center gap-1.5 pt-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.3s] ${
                    modeGelap ? 'bg-stone-400' : 'bg-stone-600'
                  }`}
                />
                <span
                  className={`w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.15s] ${
                    modeGelap ? 'bg-stone-400' : 'bg-stone-600'
                  }`}
                />
                <span
                  className={`w-1.5 h-1.5 rounded-full animate-bounce ${
                    modeGelap ? 'bg-stone-400' : 'bg-stone-600'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Atas */}
      <header
        className={`sticky top-0 z-10 backdrop-blur-md border-b transition-colors duration-200 ${
          modeGelap
            ? 'bg-[#141413]/90 border-stone-800/90'
            : 'bg-[#F7F6F2]/90 border-stone-200/80'
        }`}
      >
        <div className="max-w-lg mx-auto px-5 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-medium ${modeGelap ? 'text-stone-400' : 'text-stone-500'}`}>
                {tanggalHariIni}
              </p>
              <h1
                className={`text-xl font-bold tracking-tight mt-0.5 ${
                  modeGelap ? 'text-stone-100' : 'text-stone-900'
                }`}
              >
                Daftar Tugas
              </h1>
            </div>

            <div className="flex items-center gap-4">
              {/* Tombol Mode Terang / Gelap */}
              <button
                type="button"
                onClick={toggleTema}
                aria-label="Ganti tema tampilan"
                title={modeGelap ? 'Pindah ke Mode Terang' : 'Pindah ke Mode Gelap'}
                className={`p-2 rounded-xl border transition ${
                  modeGelap
                    ? 'bg-[#1E1E1C] border-stone-800 text-amber-300 hover:bg-stone-800'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                {modeGelap ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              <div className="text-right">
                <span
                  className={`text-2xl font-bold tabular-nums ${
                    modeGelap ? 'text-stone-100' : 'text-stone-900'
                  }`}
                >
                  {jumlahAktif}
                </span>
                <span className={`text-xs block ${modeGelap ? 'text-stone-400' : 'text-stone-500'}`}>
                  tersisa
                </span>
              </div>
            </div>
          </div>

          {/* Tab Filter */}
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
                    ? modeGelap
                      ? 'bg-stone-100 text-stone-900'
                      : 'bg-stone-900 text-white'
                    : modeGelap
                    ? 'text-stone-400 hover:bg-stone-800/80'
                    : 'text-stone-600 hover:bg-stone-200/70'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Konten Daftar Tugas */}
      <main className="max-w-lg mx-auto px-5 pt-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`h-20 rounded-xl border animate-pulse ${
                  modeGelap
                    ? 'bg-[#1E1E1C] border-stone-800/70'
                    : 'bg-white border-stone-200/70'
                }`}
              />
            ))}
          </div>
        ) : tugasTersaring.length === 0 ? (
          <div
            className={`text-center py-16 px-4 rounded-2xl border mt-2 ${
              modeGelap
                ? 'bg-[#1E1E1C] border-stone-800/80'
                : 'bg-white border-stone-200/80'
            }`}
          >
            <p className={`text-sm font-medium ${modeGelap ? 'text-stone-300' : 'text-stone-700'}`}>
              {filterStatus === 'aktif'
                ? 'Tidak ada tanggungan tugas aktif'
                : 'Belum ada data di kategori ini'}
            </p>
            <p className={`text-xs mt-1 ${modeGelap ? 'text-stone-500' : 'text-stone-400'}`}>
              Tekan tombol + Catat Tugas di bawah saat ada tugas baru.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {tugasTersaring.map((item) => {
              const badge = infoDeadline(item.tenggat_waktu, item.finish);
              const jumlahFoto = ambilSemuaFotoTugas(item).length;

              return (
                <div
                  key={item.id}
                  className={`flex items-start justify-between gap-3 p-4 rounded-xl border transition ${
                    item.finish
                      ? modeGelap
                        ? 'border-stone-800/50 bg-[#1A1A18]/60'
                        : 'border-stone-200/60 bg-stone-50/70'
                      : modeGelap
                      ? 'bg-[#1E1E1C] border-stone-800 hover:border-stone-700'
                      : 'bg-white border-stone-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-stone-300'
                  }`}
                >
                  {/* Checkbox Selesai */}
                  <button
                    type="button"
                    onClick={() => toggleSelesai(item.id, item.finish)}
                    aria-label="Tandai selesai"
                    className={`mt-0.5 w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center shrink-0 transition ${
                      item.finish
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : modeGelap
                        ? 'border-stone-600 hover:border-stone-300'
                        : 'border-stone-300 hover:border-stone-900'
                    }`}
                  >
                    {item.finish && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Area Tengah: Klik untuk Buka Detail Tugas */}
                  <div
                    onClick={() => setTugasTerpilih(item)}
                    className="space-y-1.5 flex-1 cursor-pointer"
                  >
                    <p
                      className={`text-[15px] font-medium leading-snug ${
                        item.finish
                          ? modeGelap
                            ? 'line-through text-stone-500'
                            : 'line-through text-stone-400'
                          : modeGelap
                          ? 'text-stone-100'
                          : 'text-stone-900'
                      }`}
                    >
                      {item.judul}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`font-medium ${modeGelap ? 'text-stone-400' : 'text-stone-600'}`}>
                        {item.mata_kuliah}
                      </span>
                      <span className={modeGelap ? 'text-stone-700' : 'text-stone-300'}>•</span>
                      <span className={`px-2 py-0.5 rounded-md text-[11px] ${badge.gaya}`}>
                        {badge.teks}
                      </span>

                      {jumlahFoto > 0 && (
                        <>
                          <span className={modeGelap ? 'text-stone-700' : 'text-stone-300'}>•</span>
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] ${
                              modeGelap ? 'text-stone-400' : 'text-stone-500'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {jumlahFoto > 1 ? `${jumlahFoto} Foto` : 'Foto'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tombol Hapus */}
                  <button
                    type="button"
                    onClick={() => hapusTugas(item.id)}
                    aria-label="Hapus tugas"
                    className={`p-1 rounded-lg transition ${
                      modeGelap
                        ? 'text-stone-600 hover:text-red-400'
                        : 'text-stone-300 hover:text-red-600'
                    }`}
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

      {/* Tombol Melayang di Bawah */}
      <div className="fixed bottom-6 inset-x-0 z-20 pointer-events-none">
        <div className="max-w-lg mx-auto px-5 flex justify-end">
          <button
            type="button"
            onClick={() => setBukaForm(true)}
            className={`pointer-events-auto flex items-center gap-2 px-5 py-3.5 active:scale-95 text-sm font-medium rounded-full shadow-lg transition ${
              modeGelap
                ? 'bg-stone-100 hover:bg-white text-stone-900 shadow-black/40'
                : 'bg-stone-900 hover:bg-stone-800 text-white shadow-stone-900/20'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Catat Tugas
          </button>
        </div>
      </div>

      {/* MODAL 1: Detail Tugas */}
      {tugasTerpilih && (
        <div
          onClick={() => setTugasTerpilih(null)}
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px] p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl border max-h-[90vh] overflow-y-auto space-y-4 ${
              modeGelap
                ? 'bg-[#1E1E1C] border-stone-800 text-stone-100'
                : 'bg-white border-stone-200 text-stone-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                  modeGelap ? 'bg-stone-800 text-stone-300' : 'bg-stone-100 text-stone-700'
                }`}
              >
                {tugasTerpilih.mata_kuliah}
              </span>
              <button
                type="button"
                onClick={() => setTugasTerpilih(null)}
                className={`text-sm px-2 py-0.5 ${
                  modeGelap ? 'text-stone-400 hover:text-stone-200' : 'text-stone-400 hover:text-stone-800'
                }`}
              >
                Tutup
              </button>
            </div>

            <div className="space-y-2">
              <h2
                className={`text-lg font-bold leading-snug ${
                  modeGelap ? 'text-stone-100' : 'text-stone-900'
                }`}
              >
                {tugasTerpilih.judul}
              </h2>
              <div
                className={`flex items-center gap-2 text-xs ${
                  modeGelap ? 'text-stone-400' : 'text-stone-500'
                }`}
              >
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

            {fotoModalDetail.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className={`text-xs font-medium ${modeGelap ? 'text-stone-400' : 'text-stone-500'}`}>
                  Lampiran Foto ({fotoModalDetail.length})
                </p>
                <div className="space-y-3">
                  {fotoModalDetail.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block overflow-hidden rounded-xl border ${
                        modeGelap ? 'border-stone-800 bg-stone-900' : 'border-stone-200 bg-stone-50'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Lampiran tugas ${idx + 1}`}
                        className="w-full max-h-80 object-contain mx-auto"
                      />
                    </a>
                  ))}
                </div>
                <p className={`text-[11px] ${modeGelap ? 'text-stone-500' : 'text-stone-400'}`}>
                  Ketuk gambar untuk membuka ukuran penuh
                </p>
              </div>
            )}

            <div
              className={`pt-3 border-t flex gap-2 ${
                modeGelap ? 'border-stone-800' : 'border-stone-100'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSelesai(tugasTerpilih.id, tugasTerpilih.finish)}
                className={`flex-1 py-2.5 text-xs font-semibold rounded-xl border transition ${
                  tugasTerpilih.finish
                    ? modeGelap
                      ? 'bg-stone-800 border-stone-700 text-stone-200 hover:bg-stone-700'
                      : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200'
                    : 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {tugasTerpilih.finish ? 'Tandai Belum Selesai' : 'Tandai Selesai'}
              </button>
              <button
                type="button"
                onClick={() => hapusTugas(tugasTerpilih.id)}
                className={`px-4 py-2.5 text-xs font-medium rounded-xl transition ${
                  modeGelap
                    ? 'text-red-300 bg-red-950/60 hover:bg-red-900/60'
                    : 'text-red-600 bg-red-50 hover:bg-red-100'
                }`}
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Form Tambah Tugas Baru */}
      {bukaForm && (
        <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px] p-0 sm:p-4">
          <div
            className={`w-full max-w-lg rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl border max-h-[92vh] overflow-y-auto ${
              modeGelap
                ? 'bg-[#1E1E1C] border-stone-800 text-stone-100'
                : 'bg-white border-stone-200 text-stone-900'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">Tugas Baru</h2>
              <button
                type="button"
                onClick={resetForm}
                className={`text-sm px-2 py-1 ${
                  modeGelap ? 'text-stone-400 hover:text-stone-200' : 'text-stone-400 hover:text-stone-700'
                }`}
              >
                Tutup
              </button>
            </div>

            <form onSubmit={tambahTugas} className="space-y-4">
              {/* Pilihan Mata Kuliah */}
              <div className="space-y-2">
                <label className={`text-xs font-medium ${modeGelap ? 'text-stone-400' : 'text-stone-600'}`}>
                  Mata Kuliah
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MATKUL_DEFAULT.map((mk) => (
                    <button
                      key={mk}
                      type="button"
                      onClick={() => setMataKuliah(mk)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                        mataKuliah === mk
                          ? modeGelap
                            ? 'bg-stone-100 border-stone-100 text-stone-900 font-medium'
                            : 'bg-stone-900 border-stone-900 text-white font-medium'
                          : modeGelap
                          ? 'bg-stone-900 border-stone-800 text-stone-300 hover:bg-stone-800'
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
                  className={`w-full px-3.5 py-2.5 text-sm border rounded-xl focus:outline-none transition ${
                    modeGelap
                      ? 'bg-[#141413] border-stone-800 text-stone-100 placeholder-stone-500 focus:border-stone-500'
                      : 'bg-stone-50 border-stone-200 text-stone-900 focus:bg-white focus:border-stone-900'
                  }`}
                  required
                />
              </div>

              {/* Detail Tugas */}
              <div className="space-y-1.5">
                <label className={`text-xs font-medium ${modeGelap ? 'text-stone-400' : 'text-stone-600'}`}>
                  Instruksi / Judul Tugas
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Misal: Resume jurnal bab 3 kumpul PDF..."
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-sm border rounded-xl focus:outline-none transition ${
                    modeGelap
                      ? 'bg-[#141413] border-stone-800 text-stone-100 placeholder-stone-500 focus:border-stone-500'
                      : 'bg-stone-50 border-stone-200 text-stone-900 focus:bg-white focus:border-stone-900'
                  }`}
                  required
                />
              </div>

              {/* Tenggat Waktu */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={`text-xs font-medium ${modeGelap ? 'text-stone-400' : 'text-stone-600'}`}>
                    Tenggat Waktu (Opsional)
                  </label>
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
                        className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition ${
                          modeGelap
                            ? 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                        }`}
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
                  style={{ colorScheme: modeGelap ? 'dark' : 'light' }}
                  className={`w-full px-3.5 py-2 text-sm border rounded-xl focus:outline-none transition ${
                    modeGelap
                      ? 'bg-[#141413] border-stone-800 text-stone-200 focus:border-stone-500'
                      : 'bg-stone-50 border-stone-200 text-stone-900 focus:bg-white focus:border-stone-900'
                  }`}
                />
              </div>

              {/* Upload Banyak Foto (Opsional) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={`text-xs font-medium ${modeGelap ? 'text-stone-400' : 'text-stone-600'}`}>
                    Foto Papan Tulis / Slide (Opsional)
                  </label>
                  {previewFotos.length > 0 && (
                    <span className={`text-[11px] ${modeGelap ? 'text-stone-400' : 'text-stone-500'}`}>
                      {previewFotos.length} foto dipilih
                    </span>
                  )}
                </div>

                {previewFotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {previewFotos.map((src, idx) => (
                      <div
                        key={idx}
                        className={`relative aspect-square rounded-xl overflow-hidden border ${
                          modeGelap ? 'border-stone-800 bg-stone-900' : 'border-stone-200 bg-stone-50'
                        }`}
                      >
                        <img
                          src={src}
                          alt={`Pratinjau ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => hapusFotoPilihan(idx)}
                          aria-label="Hapus foto ini"
                          className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-black/75 text-white text-xs hover:bg-red-600 transition"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <label
                  className={`flex items-center justify-center gap-2 w-full py-3 px-4 border border-dashed rounded-xl text-xs font-medium cursor-pointer transition ${
                    modeGelap
                      ? 'border-stone-700 bg-[#141413] hover:bg-stone-900 text-stone-300'
                      : 'border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-600'
                  }`}
                >
                  <svg className="w-4 h-4 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {previewFotos.length > 0 ? '+ Tambah Foto Lagi' : 'Pilih Foto atau Ambil Gambar'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePilihFoto}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={menyimpan}
                className={`w-full py-3 disabled:opacity-50 text-sm font-medium rounded-xl transition ${
                  modeGelap
                    ? 'bg-stone-100 hover:bg-white text-stone-900'
                    : 'bg-stone-900 hover:bg-stone-800 text-white'
                }`}
              >
                {menyimpan
                  ? `Menyimpan${fileFotos.length > 0 ? ` (${fileFotos.length} foto)` : ''}...`
                  : 'Simpan ke Daftar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}