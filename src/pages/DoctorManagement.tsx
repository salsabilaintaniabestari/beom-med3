import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Doctor, User } from '../types';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { sendWebhookNotification, createWebhookPayload } from '../lib/webhookService';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  Award,
  Building,
  Calendar,
} from 'lucide-react';

const DoctorManagement: React.FC = () => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecialization, setFilterSpecialization] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('add');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);

  const [doctorForm, setDoctorForm] = useState<
    Partial<Doctor & { password?: string }>
  >({
    name: '',
    email: '',
    specialization: '',
    sip: '',
    phone: '',
    address: '',
    hospital: '',
    experience: 0,
    password: '',
  });

  const specializations = [
    'Penyakit Dalam',
    'Jantung',
    'Saraf',
    'Anak',
    'Kandungan',
    'Bedah',
    'Mata',
    'THT',
    'Kulit',
    'Jiwa',
    'Radiologi',
    'Anestesi',
    'Patologi',
    'Rehabilitasi Medik',
    'Kedokteran Keluarga',
  ];

  // Load data from Firebase
  useEffect(() => {
    if (user?.role === 'operator') {
      loadDoctors();
    }
  }, [user]);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const doctorsQuery = query(
        collection(db, 'doctors'),
        orderBy('createdAt', 'desc')
      );
      const doctorsSnapshot = await getDocs(doctorsQuery);
      const doctorsData = doctorsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Doctor[];

      setDoctors(doctorsData);
    } catch (error) {
      console.error('Error loading doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = doctors.filter((doctor) => {
    const matchesSearch =
      doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doctor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doctor.sip.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSpecialization =
      !filterSpecialization || doctor.specialization === filterSpecialization;

    return matchesSearch && matchesSpecialization;
  });

  const openModal = (mode: 'add' | 'edit' | 'view', doctor?: Doctor) => {
    setModalMode(mode);
    setSelectedDoctor(doctor || null);

    if (doctor) {
      setDoctorForm({ ...doctor, password: '' });
    } else {
      setDoctorForm({
        name: '',
        email: '',
        specialization: '',
        sip: '',
        phone: '',
        address: '',
        hospital: '',
        experience: 0,
        password: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDoctor(null);
  };

  const handleDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (modalMode === 'add') {
        // Store current user credentials
        const currentUser = auth.currentUser;
        const currentUserEmail = user?.email;
        const currentUserPassword = prompt('Masukkan password Anda untuk konfirmasi:');
        
        if (!currentUserPassword) {
          alert('Password diperlukan untuk membuat akun dokter baru');
          return;
        }

        // Create new doctor account
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          doctorForm.email!,
          doctorForm.password!
        );

        console.log('DoctorManagement - Created user with UID:', userCredential.user.uid);

        // Create user document with the same ID as UID
        const userData = {
          id: userCredential.user.uid,
          name: doctorForm.name,
          email: doctorForm.email,
          role: 'doctor',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await setDoc(doc(db, 'users', userCredential.user.uid), userData);
        console.log('DoctorManagement - Created user document:', userData);

        // Create doctor document with the same ID as UID
        const doctorData = {
          id: userCredential.user.uid, // Ensure ID is set
          name: doctorForm.name,
          email: doctorForm.email,
          specialization: doctorForm.specialization,
          sip: doctorForm.sip,
          phone: doctorForm.phone,
          address: doctorForm.address,
          hospital: doctorForm.hospital,
          experience: doctorForm.experience || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await setDoc(doc(db, 'doctors', userCredential.user.uid), doctorData);
        console.log('DoctorManagement - Created doctor document with ID:', userCredential.user.uid);

        // No webhook notifications for user and doctor creation
        console.log('DoctorManagement - Doctor created (no webhook sent):', userCredential.user.uid);

        // Sign out the newly created user and sign back in as operator
        await signOut(auth);
        
        // Re-authenticate as operator
        if (currentUserEmail && currentUserPassword) {
          await signInWithEmailAndPassword(auth, currentUserEmail, currentUserPassword);
        }

        alert('Dokter berhasil ditambahkan!');
      } else if (modalMode === 'edit' && selectedDoctor) {
        const previousData = { ...selectedDoctor };
        
        const doctorData = {
          name: doctorForm.name,
          email: doctorForm.email,
          specialization: doctorForm.specialization,
          sip: doctorForm.sip,
          phone: doctorForm.phone,
          address: doctorForm.address,
          hospital: doctorForm.hospital,
          experience: doctorForm.experience || 0,
          updatedAt: new Date(),
        };

        await updateDoc(doc(db, 'doctors', selectedDoctor.id), doctorData);
        
        // Also update user document
        const userUpdateData = {
          name: doctorForm.name,
          email: doctorForm.email,
          updatedAt: new Date(),
        };
        
        await updateDoc(doc(db, 'users', selectedDoctor.id), userUpdateData);
        
        // No webhook notification for doctor update
        console.log('DoctorManagement - Doctor updated (no webhook sent):', selectedDoctor.id);
        
        await updateDoc(doc(db, 'users', selectedDoctor.id), {
          name: doctorForm.name,
          email: doctorForm.email,
          updatedAt: new Date(),
        });
      }

      await loadDoctors();
      closeModal();
    } catch (error: any) {
      console.error('Error saving doctor:', error);
      alert(`Terjadi kesalahan: ${error.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus data dokter ini? Akun pengguna juga akan dihapus.')) {
      try {
        const doctorToDelete = doctors.find(d => d.id === id);
        
        // Delete doctor document
        await deleteDoc(doc(db, 'doctors', id));
        
        // Delete user document
        await deleteDoc(doc(db, 'users', id));
        
        // No webhook notifications for doctor and user deletion
        console.log('DoctorManagement - Doctor deleted (no webhook sent):', id);
        
        // Note: Firebase Auth user deletion requires special handling
        // You might want to implement a cloud function for this
        
        await loadDoctors();
        alert('Data dokter berhasil dihapus');
      } catch (error) {
        console.error('Error deleting doctor:', error);
        alert('Terjadi kesalahan saat menghapus data dokter');
      }
    }
  };

  // Only operator can access this page
  if (user?.role !== 'operator') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Akses Ditolak
          </h1>
          <p className="text-gray-600">
            Hanya operator yang dapat mengakses halaman ini.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat data dokter...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Dokter</h1>
          <p className="text-gray-600 mt-1">Kelola data dokter dalam sistem</p>
        </div>
        <button
          onClick={() => openModal('add')}
          className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Tambah Dokter
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Dokter</p>
              <p className="text-2xl font-bold text-gray-900">
                {doctors.length}
              </p>
            </div>
            <UserCheck className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Spesialisasi</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(doctors.map((d) => d.specialization)).size}
              </p>
            </div>
            <Award className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Rata-rata Pengalaman
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {doctors.length > 0
                  ? Math.round(
                      doctors.reduce((sum, d) => sum + (d.experience || 0), 0) /
                        doctors.length
                    )
                  : 0}{' '}
                tahun
              </p>
            </div>
            <Calendar className="h-8 w-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Rumah Sakit</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(doctors.map((d) => d.hospital).filter((h) => h)).size}
              </p>
            </div>
            <Building className="h-8 w-8 text-teal-500" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari dokter berdasarkan nama, email, atau SIP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <select
              value={filterSpecialization}
              onChange={(e) => setFilterSpecialization(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">Semua Spesialisasi</option>
              {specializations.map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Doctors Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Dokter
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Kontak
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Spesialisasi
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  SIP
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Rumah Sakit
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Pengalaman
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDoctors.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 px-4 text-center text-gray-500"
                  >
                    {searchTerm || filterSpecialization
                      ? 'Tidak ada dokter yang sesuai dengan filter.'
                      : 'Belum ada data dokter. Klik "Tambah Dokter" untuk menambah dokter baru.'}
                  </td>
                </tr>
              ) : (
                filteredDoctors.map((doctor) => (
                  <tr key={doctor.id} className="hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center">
                          <UserCheck className="h-5 w-5 text-teal-600" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">
                            {doctor.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {doctor.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="h-3 w-3 mr-1" />
                          {doctor.phone}
                        </div>
                        {doctor.address && (
                          <div className="flex items-center text-sm text-gray-600">
                            <MapPin className="h-3 w-3 mr-1" />
                            <span className="truncate max-w-xs">
                              {doctor.address}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {doctor.specialization}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm font-mono text-gray-900">
                        {doctor.sip}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm text-gray-900">
                        {doctor.hospital || '-'}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm text-gray-900">
                        {doctor.experience || 0} tahun
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openModal('view', doctor)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Lihat Detail"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openModal('edit', doctor)}
                          className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(doctor.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {modalMode === 'add'
                  ? 'Tambah Dokter Baru'
                  : modalMode === 'edit'
                  ? 'Edit Data Dokter'
                  : 'Detail Dokter'}
              </h2>
            </div>

            <form onSubmit={handleDoctorSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={doctorForm.name}
                    onChange={(e) =>
                      setDoctorForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={doctorForm.email}
                    onChange={(e) =>
                      setDoctorForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    disabled={modalMode === 'view' || modalMode === 'edit'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    required
                  />
                </div>
                {modalMode === 'add' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={doctorForm.password}
                      onChange={(e) =>
                        setDoctorForm((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      required
                      minLength={6}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Spesialisasi
                  </label>
                  <select
                    value={doctorForm.specialization}
                    onChange={(e) =>
                      setDoctorForm((prev) => ({
                        ...prev,
                        specialization: e.target.value,
                      }))
                    }
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    required
                  >
                    <option value="">Pilih Spesialisasi</option>
                    {specializations.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nomor SIP
                  </label>
                  <input
                    type="text"
                    value={doctorForm.sip}
                    onChange={(e) =>
                      setDoctorForm((prev) => ({
                        ...prev,
                        sip: e.target.value,
                      }))
                    }
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nomor Telepon
                  </label>
                  <input
                    type="tel"
                    value={doctorForm.phone}
                    onChange={(e) =>
                      setDoctorForm((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rumah Sakit
                  </label>
                  <input
                    type="text"
                    value={doctorForm.hospital}
                    onChange={(e) =>
                      setDoctorForm((prev) => ({
                        ...prev,
                        hospital: e.target.value,
                      }))
                    }
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pengalaman (tahun)
                  </label>
                  <input
                    type="number"
                    value={doctorForm.experience}
                    onChange={(e) =>
                      setDoctorForm((prev) => ({
                        ...prev,
                        experience: parseInt(e.target.value) || 0,
                      }))
                    }
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alamat
                </label>
                <textarea
                  value={doctorForm.address}
                  onChange={(e) =>
                    setDoctorForm((prev) => ({
                      ...prev,
                      address: e.target.value,
                    }))
                  }
                  disabled={modalMode === 'view'}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {modalMode === 'view' ? 'Tutup' : 'Batal'}
                </button>
                {modalMode !== 'view' && (
                  <button
                    type="submit"
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                  >
                    {modalMode === 'add' ? 'Tambah Dokter' : 'Simpan Perubahan'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorManagement;