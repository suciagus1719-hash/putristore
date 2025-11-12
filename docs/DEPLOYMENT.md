## Deployment Automation

Repositori ini sekarang memiliki dua workflow GitHub Actions sehingga build & deploy berjalan otomatis setiap kali ada perubahan kode.

### Frontend → GitHub Pages

- **Workflow**: `.github/workflows/frontend-pages.yml`
- **Trigger**: `push` ke branch utama yang menyentuh folder `frontend/**`, file workflow itu sendiri, atau berkas lock di root. Bisa juga dijalankan manual lewat tab *Actions* → *Run workflow*.
- **Langkah**:
  1. Checkout kode dan setup Node.js 20 dengan cache `npm`.
  2. `npm ci` di root untuk meng-install seluruh workspace.
  3. `npm run build --workspace frontend` (menghasilkan `frontend/dist`).
  4. Upload hasil build sebagai artefak dan *deploy* memakai `actions/deploy-pages@v4`.
- **Prasyarat**: aktifkan GitHub Pages dengan source `GitHub Actions` (Settings → Pages). Vite sudah memakai `base: "/putristore/"` jadi URL akhir tetap `https://USERNAME.github.io/putristore/`.

### Backend → Vercel

- **Workflow**: `.github/workflows/backend-vercel.yml`
- **Trigger**: `push` yang menyentuh `backend/**`, file workflow, atau berkas lock di root. Bisa dijalankan manual.
- **Langkah**:
  1. Checkout dan setup Node.js 20.
  2. `npm install` di `backend/`.
  3. Jalankan `vercel pull`, `vercel build --prod`, dan `vercel deploy --prebuilt --prod`.
  4. URL hasil deploy otomatis ditampilkan pada summary job.
- **Prasyarat**: tambahkan secrets berikut di *Settings → Secrets and variables → Actions*:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`

  Nilai bisa diambil dari dashboard Vercel (Settings → Tokens untuk token, lalu Settings → General pada project untuk Org & Project ID). Workflow akan otomatis skip (dan memberi pesan) jika secrets belum tersedia, jadi push tetap aman.

### Tips

- **Lingkungan**: simpan konfigurasi penting (mis. `FRONTEND_ORIGIN`, API keys) di Vercel Project Settings. GitHub Pages hanya membutuhkan variabel yang dibaca Vite dari `.env.production`.
- **Monitoring**: setiap workflow menyimpan log build di tab *Actions*. Jika deploy gagal, klik run yang merah untuk melihat error.
- **Manual rebuild**: gunakan tombol *Run workflow* di tab Actions (Frontend Pages atau Backend Vercel) tanpa mengubah kode.

Dengan dua workflow ini, tidak perlu lagi menerima perubahan secara manual: cukup merge/push ke `main`, dan pipeline akan rebuild + deploy otomatis untuk frontend maupun backend.
