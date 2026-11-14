import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Catatan Tugas Kuliah',
    short_name: 'Tugas Kuliah',
    description: 'Aplikasi pencatat tugas kuliah',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F6F2',
    theme_color: '#1c1917',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}