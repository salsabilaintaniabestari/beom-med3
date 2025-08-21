# BeomMed - Sistem Pengingat Obat

BeomMed adalah sistem pengingat obat profesional yang dirancang untuk membantu administrator dan dokter dalam mengelola jadwal pengobatan pasien.

## Fitur Utama

### 🔐 Autentikasi & Otorisasi

- Login dan register dengan Firebase Authentication
- Role-based access control (Administrator, Dokter)
- Protected routes berdasarkan role pengguna

### 📊 Dashboard Analytics

- Statistik real-time untuk pasien, obat, dan jadwal
- Grafik kepatuhan konsumsi obat
- Visualisasi data dengan charts dan pie charts
- Alert dan notifikasi untuk obat terlewat

### 👥 Manajemen Pasien

- **Administrator**: CRUD lengkap untuk semua pasien
- **Dokter**: Akses terbatas hanya untuk pasien yang ditangani
- Form lengkap dengan data medis dan kontak darurat
- Pencarian dan filter pasien

### 💊 Manajemen Obat & Jadwal (Coming Soon)

- Manajemen katalog obat
- Penjadwalan konsumsi obat
- Pengaturan dosis dan frekuensi

### 📋 Riwayat Konsumsi (Coming Soon)

- Tracking konsumsi obat pasien
- Status: diminum, terlewat, terlambat
- Laporan kepatuhan pengobatan

### 👨‍⚕️ Manajemen Dokter (Admin Only - Coming Soon)

- CRUD akun dokter
- Pengelolaan spesialisasi dan SIP

## Teknologi yang Digunakan

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Charts**: Recharts
- **Backend**: Firebase (Auth + Firestore)
- **Routing**: React Router DOM
- **Build Tool**: Vite

## Struktur Project

```
src/
├── components/          # Komponen reusable
│   ├── Layout.tsx      # Layout utama dengan sidebar
│   ├── DashboardCard.tsx # Kartu statistik
│   └── ProtectedRoute.tsx # Route protection
├── hooks/              # Custom hooks
│   └── useAuth.ts      # Hook untuk autentikasi
├── lib/                # Library dan konfigurasi
│   └── firebase.ts     # Konfigurasi Firebase
├── pages/              # Halaman aplikasi
│   ├── Login.tsx       # Halaman login
│   ├── Register.tsx    # Halaman registrasi
│   ├── Dashboard.tsx   # Dashboard utama
│   └── Patients.tsx    # Manajemen pasien
├── types/              # TypeScript interfaces
│   └── index.ts        # Definisi tipe data
└── App.tsx             # Root component
```

## Setup Firebase

1. Buat project Firebase baru di [Firebase Console](https://console.firebase.google.com)
2. Aktifkan Authentication dengan Email/Password
3. Buat Firestore database
4. Copy konfigurasi Firebase ke `src/lib/firebase.ts`

```typescript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

## Struktur Database Firestore

### Collections:

1. **users**

   - id, email, name, role, createdAt

2. **doctors**

   - id, name, email, specialization, sip, phone, createdAt

3. **patients**

   - id, userId, name, age, gender, email, phone, condition, doctorId, allergies, emergencyContact, address, createdAt

4. **medications** (Coming Soon)

   - name, dosage, frequency, sideEffects, category, description, createdAt

5. **medication_schedules** (Coming Soon)

   - patientId, medicationId, times, startDate, endDate, prescribedBy, instructions, createdAt

6. **consumption_records** (Coming Soon)
   - patientId, medicationId, scheduledTime, actualTime, status, notes, createdAt

## Demo Accounts

Untuk testing, gunakan akun demo berikut:

- **Administrator**: admin@beommed.com / admin123
- **Dokter**: doctor@beommed.com / doctor123

## Instalasi dan Menjalankan

```bash
# Install dependencies
npm install

# Jalankan development server
npm run dev

# Build untuk production
npm run build
```

## Role & Permissions

### Administrator

- ✅ Akses penuh ke semua fitur
- ✅ Manajemen pasien (CRUD)
- ✅ Manajemen dokter (CRUD)
- ✅ Manajemen obat dan jadwal (CRUD)
- ✅ View semua riwayat konsumsi

### Dokter

- ✅ Dashboard dengan data pasien sendiri
- ✅ View/Edit/Delete pasien yang ditangani
- ✅ Manajemen jadwal obat untuk pasiennya
- ✅ View riwayat konsumsi pasiennya
- ❌ Tidak bisa menambah pasien baru
- ❌ Tidak bisa akses manajemen dokter

## Color Scheme

- **Primary**: Navy (#1e293b, #334155)
- **Secondary**: Teal (#0f766e, #14b8a6)
- **Accent**: Berbagai warna untuk status dan kategori

## Roadmap

- [ ] Implementasi lengkap manajemen obat & jadwal
- [ ] Sistem notifikasi real-time
- [ ] Riwayat konsumsi dengan tracking otomatis
- [ ] Mobile responsive optimization
- [ ] Export laporan ke PDF
- [ ] Integration dengan WhatsApp notifications
