# Firebase Firestore Collections Setup

## Daftar Collections yang Perlu Dibuat

### 1. Collection: `users`

**Deskripsi**: Menyimpan data semua pengguna sistem (operator, dokter)
**Document ID**: Auto-generated atau menggunakan UID dari Firebase Auth

**Contoh Data:**

```json
{
  "id": "operator123",
  "email": "operator@beommed.com",
  "name": "Operator BeomMed",
  "role": "operator",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### 2. Collection: `doctors`

**Deskripsi**: Menyimpan data lengkap dokter
**Document ID**: Sama dengan user ID atau auto-generated

**Contoh Data:**

```json
{
  "id": "doc001",
  "userId": "doc001",
  "name": "Dr. Andi Pratama, Sp.PD",
  "email": "andi.pratama@beommed.com",
  "specialization": "Penyakit Dalam",
  "sip": "SIP.123.456.789.2024",
  "phone": "08111222333",
  "address": "Jl. Kesehatan No. 123, Jakarta",
  "hospital": "RS BeomMed Jakarta",
  "experience": 8,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### 3. Collection: `patients`

**Deskripsi**: Menyimpan data pasien
**Document ID**: Auto-generated

**Contoh Data:**

```json
{
  "id": "patient001",
  "userId": null,
  "name": "Ahmad Wijaya",
  "age": 45,
  "gender": "male",
  "email": "ahmad.wijaya@email.com",
  "phone": "08123456789",
  "condition": "Hipertensi",
  "doctorId": "doc001",
  "allergies": ["Penicillin", "Sulfa"],
  "emergencyContact": "08987654321",
  "emergencyContactName": "Siti Wijaya (Istri)",
  "address": "Jl. Merdeka No. 123, Jakarta Pusat",
  "bloodType": "O+",
  "weight": 70,
  "height": 170,
  "medicalHistory": ["Diabetes", "Kolesterol"],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### 4. Collection: `medications`

**Deskripsi**: Katalog obat yang tersedia
**Document ID**: Auto-generated

**Contoh Data:**

```json
{
  "id": "med001",
  "name": "Amlodipine",
  "genericName": "Amlodipine Besylate",
  "brand": "Norvasc",
  "dosage": "5mg",
  "form": "Tablet",
  "frequency": "1x sehari",
  "sideEffects": ["Pusing", "Pembengkakan kaki", "Kelelahan"],
  "category": "Antihipertensi",
  "description": "Obat untuk menurunkan tekanan darah tinggi",
  "contraindications": ["Alergi amlodipine", "Syok kardiogenik"],
  "storage": "Simpan di tempat sejuk dan kering",
  "manufacturer": "Pfizer",
  "price": 15000,
  "stock": 100,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### 5. Collection: `medication_schedules`

**Deskripsi**: Jadwal konsumsi obat untuk setiap pasien
**Document ID**: Auto-generated

**Contoh Data:**

```json
{
  "id": "schedule001",
  "patientId": "patient001",
  "patientName": "Ahmad Wijaya",
  "medicationId": "med001",
  "medicationName": "Amlodipine 5mg",
  "dosage": "1 tablet",
  "times": ["08:00", "20:00"],
  "frequency": "2x sehari",
  "startDate": "2024-01-15",
  "endDate": "2024-02-15",
  "duration": 30,
  "prescribedBy": "doc001",
  "prescribedByName": "Dr. Andi Pratama, Sp.PD",
  "instructions": "Diminum setelah makan, jangan dikunyah",
  "notes": "Kontrol tekanan darah setiap minggu",
  "isActive": true,
  "totalDoses": 60,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### 6. Collection: `consumption_records`

**Deskripsi**: Record konsumsi obat (auto-generated dari jadwal)
**Document ID**: Auto-generated

**Contoh Data:**

```json
{
  "id": "consumption001",
  "patientId": "patient001",
  "patientName": "Ahmad Wijaya",
  "medicationId": "med001",
  "medicationName": "Amlodipine 5mg",
  "scheduleId": "schedule001",
  "scheduledDate": "2024-01-15",
  "scheduledTime": "08:00",
  "scheduledDateTime": "2024-01-15T08:00:00Z",
  "actualTime": "2024-01-15T08:15:00Z",
  "status": "taken",
  "dosage": "1 tablet",
  "notes": "Diminum tepat waktu setelah sarapan",
  "sideEffectsReported": [],
  "recordedBy": "system",
  "createdAt": "2024-01-15T08:15:00Z",
  "updatedAt": "2024-01-15T08:15:00Z"
}
```

### 7. Collection: `notifications` (Optional)

**Deskripsi**: Notifikasi untuk pasien dan dokter
**Document ID**: Auto-generated

**Contoh Data:**

```json
{
  "id": "notif001",
  "userId": "patient001",
  "type": "medication_reminder",
  "title": "Waktunya Minum Obat",
  "message": "Saatnya minum Amlodipine 5mg - 1 tablet",
  "medicationId": "med001",
  "scheduleId": "schedule001",
  "scheduledTime": "2024-01-15T08:00:00Z",
  "isRead": false,
  "isSent": true,
  "sentAt": "2024-01-15T07:55:00Z",
  "createdAt": "2024-01-15T07:55:00Z"
}
```

### 8. Collection: `medical_reports` (Optional)

**Deskripsi**: Laporan medis dan hasil pemeriksaan
**Document ID**: Auto-generated

**Contoh Data:**

```json
{
  "id": "report001",
  "patientId": "patient001",
  "doctorId": "doc001",
  "reportType": "monthly_checkup",
  "title": "Kontrol Rutin Hipertensi",
  "date": "2024-01-15",
  "bloodPressure": "130/80",
  "weight": 70,
  "symptoms": ["Tidak ada keluhan", "Tidur nyenyak"],
  "diagnosis": "Hipertensi terkontrol",
  "recommendations": ["Lanjutkan obat", "Olahraga teratur", "Diet rendah garam"],
  "nextAppointment": "2024-02-15",
  "attachments": [],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## Status Values Reference

### Patient Gender:

- `"male"` - Laki-laki
- `"female"` - Perempuan

### User Roles:

- `"operator"` - Operator
- `"doctor"` - Dokter
- `"patient"` - Pasien (untuk future use)

### Consumption Status:

- `"taken"` - Sudah diminum
- `"missed"` - Terlewat
- `"late"` - Terlambat
- `"pending"` - Menunggu waktu

### Medication Categories:

- `"Antihipertensi"` - Obat tekanan darah
- `"Antidiabetes"` - Obat diabetes
- `"Antibiotik"` - Antibiotik
- `"Analgesik"` - Pereda nyeri
- `"Vitamin"` - Vitamin dan suplemen
- `"Kardiovaskular"` - Obat jantung
- `"Neurologis"` - Obat saraf

### Notification Types:

- `"medication_reminder"` - Pengingat minum obat
- `"appointment_reminder"` - Pengingat jadwal kontrol
- `"medication_expired"` - Obat habis/expired
- `"side_effect_alert"` - Alert efek samping

## Firestore Security Rules (Recommended)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'operator';
    }

    // Doctors collection
    match /doctors/{doctorId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'operator' ||
         request.auth.uid == doctorId);
    }

    // Patients collection
    match /patients/{patientId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'operator' ||
         resource.data.doctorId == request.auth.uid);
    }

    // Other collections with similar patterns...
  }
}
```

## Setup Instructions

1. **Buat Project Firebase**

   - Buka [Firebase Console](https://console.firebase.google.com)
   - Klik "Add project" dan ikuti langkah-langkahnya

2. **Setup Firestore Database**

   - Pilih "Firestore Database" dari menu
   - Klik "Create database"
   - Pilih mode "Start in test mode" untuk development

3. **Setup Authentication**

   - Pilih "Authentication" dari menu
   - Klik "Get started"
   - Pilih "Email/Password" sebagai sign-in method

4. **Import Data Sample**

   - Gunakan Firebase Console untuk menambah collection dan document
   - Atau gunakan Firebase operator SDK untuk import bulk data

5. **Update Firebase Config**
   - Copy config dari Project Settings
   - Paste ke file `src/lib/firebase.ts`
