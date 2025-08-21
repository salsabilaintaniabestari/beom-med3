import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Patient, Doctor } from '../types';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sendWebhookNotification, createWebhookPayload } from '../lib/webhookService';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  User,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  Users,
  Filter,
} from 'lucide-react';

const Patients: React.FC = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterDoctor, setFilterDoctor] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('add');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  const [patientForm, setPatientForm] = useState<Partial<Patient>>({
    name: '',
    age: 0,
    gender: 'male',
    email: '',
    phone: '',
    condition: '',
    doctorId: '',
    allergies: [],
    emergencyContact: '',
    address: '',
  });

  // Load data from Firebase
  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);

      console.log('Loading data for user:', user?.id, 'role:', user?.role);

      // Load doctors
      const doctorsSnapshot = await getDocs(collection(db, 'doctors'));
      const doctorsData = doctorsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Doctor[];

      console.log('Doctors loaded:', doctorsData.length);

      // Load patients based on user role
      let patientsQuery;
      if (user?.role === 'operator') {
        patientsQuery = query(collection(db, 'patients'), orderBy('createdAt', 'desc'));
      } else {
        // For doctors, query patients where doctorId matches user.id
        patientsQuery = query(
          collection(db, 'patients'),
          where('doctorId', '==', user?.id)
        );
      }

      console.log('Patients query for role:', user?.role, 'doctorId:', user?.id);

      const patientsSnapshot = await getDocs(patientsQuery);
      console.log('Raw patients snapshot size:', patientsSnapshot.size);
      
      // Debug: Log all patients and their doctorId
      patientsSnapshot.docs.forEach(doc => {
        console.log('Patient:', doc.data().name, 'doctorId:', doc.data().doctorId);
      });

      const patientsData = patientsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Patient[];

      console.log('Patients loaded:', patientsData.length);

      setDoctors(doctorsData);
      setPatients(patientsData);
    } catch (error) {
      console.error('Error loading data:', error);
      // Set empty arrays on error to prevent UI issues
      setDoctors([]);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patients.filter((patient) => {
    const matchesSearch =
      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.condition.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesGender = !filterGender || patient.gender === filterGender;
    const matchesDoctor = !filterDoctor || patient.doctorId === filterDoctor;

    return matchesSearch && matchesGender && matchesDoctor;
  });

  const openModal = (mode: 'add' | 'edit' | 'view', patient?: Patient) => {
    setModalMode(mode);
    setSelectedPatient(patient || null);

    if (patient) {
      setPatientForm(patient);
    } else {
      setPatientForm({
        name: '',
        age: 0,
        gender: 'male',
        email: '',
        phone: '',
        condition: '',
        doctorId: user?.role === 'doctor' ? user.id : '',
        allergies: [],
        emergencyContact: '',
        address: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPatient(null);
  };

  const handlePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const selectedDoctor = doctors.find((d) => d.id === patientForm.doctorId);

      const patientData = {
        ...patientForm,
        allergies: Array.isArray(patientForm.allergies) 
          ? patientForm.allergies 
          : patientForm.allergies?.toString().split(',').map(a => a.trim()).filter(a => a) || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (modalMode === 'add') {
        const docRef = await addDoc(collection(db, 'patients'), patientData);
        
        // No webhook notification for patient creation
        console.log('Patients - Patient created (no webhook sent):', docRef.id);
      } else if (modalMode === 'edit' && selectedPatient) {
        const previousData = { ...selectedPatient };
        await updateDoc(doc(db, 'patients', selectedPatient.id), {
          ...patientData,
          updatedAt: new Date(),
        });
        
        // No webhook notification for patient update
        console.log('Patients - Patient updated (no webhook sent):', selectedPatient.id);
      }

      await loadData();
      closeModal();
    } catch (error) {
      console.error('Error saving patient:', error);
      alert('Terjadi kesalahan saat menyimpan data pasien');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus data pasien ini?')) {
      try {
        const patientToDelete = patients.find(p => p.id === id);
        await deleteDoc(doc(db, 'patients', id));
        
        // No webhook notification for patient deletion
        console.log('Patients - Patient deleted (no webhook sent):', id);
        
        await loadData();
      } catch (error) {
        console.error('Error deleting patient:', error);
        alert('Terjadi kesalahan saat menghapus data pasien');
      }
    }
  };

  const getDoctorName = (doctorId: string) => {
    const doctor = doctors.find((d) => d.id === doctorId);
    return doctor?.name || 'Tidak diketahui';
  };

  const canManagePatients = user?.role === 'operator';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat data pasien...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Manajemen Pasien
          </h1>
          <p className="text-gray-600 mt-1">
            {user?.role === 'operator' 
              ? 'Kelola data semua pasien dalam sistem'
              : 'Lihat data pasien yang Anda tangani'
            }
          </p>
        </div>
        {canManagePatients && (
          <button
            onClick={() => openModal('add')}
            className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Tambah Pasien
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Pasien</p>
              <p className="text-2xl font-bold text-gray-900">{patients.length}</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Laki-laki</p>
              <p className="text-2xl font-bold text-gray-900">
                {patients.filter(p => p.gender === 'male').length}
              </p>
            </div>
            <User className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Perempuan</p>
              <p className="text-2xl font-bold text-gray-900">
                {patients.filter(p => p.gender === 'female').length}
              </p>
            </div>
            <User className="h-8 w-8 text-pink-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Rata-rata Usia</p>
              <p className="text-2xl font-bold text-gray-900">
                {patients.length > 0 
                  ? Math.round(patients.reduce((sum, p) => sum + p.age, 0) / patients.length)
                  : 0
                } tahun
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
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
                placeholder="Cari pasien berdasarkan nama, email, atau kondisi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">Semua Gender</option>
              <option value="male">Laki-laki</option>
              <option value="female">Perempuan</option>
            </select>
            {user?.role === 'operator' && (
              <select
                value={filterDoctor}
                onChange={(e) => setFilterDoctor(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">Semua Dokter</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Pasien
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Kontak
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Kondisi
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Dokter
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Alergi
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center text-gray-500">
                    {searchTerm || filterGender || filterDoctor
                      ? 'Tidak ada pasien yang sesuai dengan filter.'
                      : 'Belum ada data pasien.'}
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          patient.gender === 'male' ? 'bg-blue-100' : 'bg-pink-100'
                        }`}>
                          <User className={`h-5 w-5 ${
                            patient.gender === 'male' ? 'text-blue-600' : 'text-pink-600'
                          }`} />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">
                            {patient.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {patient.age} tahun • {patient.gender === 'male' ? 'L' : 'P'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-600">
                          <Mail className="h-3 w-3 mr-1" />
                          {patient.email}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="h-3 w-3 mr-1" />
                          {patient.phone}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {patient.condition}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm text-gray-900">
                        {getDoctorName(patient.doctorId)}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1">
                        {patient.allergies && patient.allergies.length > 0 ? (
                          patient.allergies.slice(0, 2).map((allergy, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs"
                            >
                              {allergy}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">Tidak ada</span>
                        )}
                        {patient.allergies && patient.allergies.length > 2 && (
                          <span className="text-xs text-gray-500">
                            +{patient.allergies.length - 2} lagi
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openModal('view', patient)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Lihat Detail"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canManagePatients && (
                          <>
                            <button
                              onClick={() => openModal('edit', patient)}
                              className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(patient.id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="Hapus"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
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
                  ? 'Tambah Pasien Baru'
                  : modalMode === 'edit'
                  ? 'Edit Data Pasien'
                  : 'Detail Pasien'}
              </h2>
            </div>

            <form onSubmit={handlePatientSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={patientForm.name}
                    onChange={(e) =>
                      setPatientForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Usia
                  </label>
                  <input
                    type="number"
                    value={patientForm.age}
                    onChange={(e) =>
                      setPatientForm((prev) => ({ ...prev, age: parseInt(e.target.value) || 0 }))
                    }
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={patientForm.gender}
                    onChange={(e) =>
                      setPatientForm((prev) => ({ ...prev, gender: e.target.value as 'male' | 'female' }))
                    }
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                  >
                    <option value="male">Laki-laki</option>
                    <option value="female">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={patientForm.email}
                    onChange={(e) =>
                      setPatientForm((prev) => ({ ...prev, email: e.target.value }))
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
                    value={patientForm.phone}
                    onChange={(e) =>
                      setPatientForm((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dokter yang Menangani
                  </label>
                  <select
                    value={patientForm.doctorId}
                    onChange={(e) =>
                      setPatientForm((prev) => ({ ...prev, doctorId: e.target.value }))
                    }
                    disabled={modalMode === 'view' || (user?.role === 'doctor' && modalMode === 'edit')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    required
                  >
                    <option value="">Pilih Dokter</option>
                    {(user?.role === 'operator' ? doctors : doctors.filter(d => d.id === user?.id)).map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kondisi/Penyakit
                  </label>
                  <input
                    type="text"
                    value={patientForm.condition}
                    onChange={(e) =>
                      setPatientForm((prev) => ({ ...prev, condition: e.target.value }))
                    }
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kontak Darurat
                  </label>
                  <input
                    type="tel"
                    value={patientForm.emergencyContact}
                    onChange={(e) =>
                      setPatientForm((prev) => ({ ...prev, emergencyContact: e.target.value }))
                    }
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alergi (pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  value={Array.isArray(patientForm.allergies) ? patientForm.allergies.join(', ') : patientForm.allergies}
                  onChange={(e) =>
                    setPatientForm((prev) => ({ 
                      ...prev, 
                      allergies: e.target.value.split(',').map(a => a.trim()).filter(a => a)
                    }))
                  }
                  disabled={modalMode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                  placeholder="Contoh: Penicillin, Sulfa, Aspirin"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alamat
                </label>
                <textarea
                  value={patientForm.address}
                  onChange={(e) =>
                    setPatientForm((prev) => ({ ...prev, address: e.target.value }))
                  }
                  disabled={modalMode === 'view'}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                  required
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
                {modalMode !== 'view' && canManagePatients && (
                  <button
                    type="submit"
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                  >
                    {modalMode === 'add' ? 'Tambah Pasien' : 'Simpan Perubahan'}
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

export default Patients;