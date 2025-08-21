import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ConsumptionRecord, Patient, MedicationSchedule } from '../types';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Search,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Pill,
  Filter,
  Eye,
  Edit,
  Plus,
} from 'lucide-react';

const ConsumptionHistory: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<ConsumptionRecord[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPatient, setFilterPatient] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('view');
  const [selectedRecord, setSelectedRecord] = useState<ConsumptionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [realtimeListener, setRealtimeListener] = useState<Unsubscribe | null>(null);

  const [recordForm, setRecordForm] = useState<Partial<ConsumptionRecord>>({
    status: 'taken',
    notes: '',
    sideEffectsReported: [],
  });

  // Load data from Firebase
  useEffect(() => {
    if (user?.id) {
      loadData();
      
      // Set up real-time listener for consumption records
      const unsubscribe = setupRealtimeListener();
      
      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);

      console.log('Loading consumption data for user:', user?.id, 'role:', user?.role);

      // Load patients based on user role
      let patientsQuery;
      if (user?.role === 'operator') {
        patientsQuery = collection(db, 'patients');
      } else {
        patientsQuery = query(
          collection(db, 'patients'),
          where('doctorId', '==', user?.id)
        );
      }
      
      const patientsSnapshot = await getDocs(patientsQuery);
      console.log('Patients for consumption:', patientsSnapshot.size);
      
      const patientsData = patientsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Patient[];

      // Load schedules based on user role
      let schedulesQuery;
      if (user?.role === 'operator') {
        schedulesQuery = collection(db, 'medication_schedules');
      } else {
        schedulesQuery = query(
          collection(db, 'medication_schedules'),
          where('prescribedBy', '==', user?.id)
        );
      }
      
      const schedulesSnapshot = await getDocs(schedulesQuery);
      console.log('Schedules for consumption:', schedulesSnapshot.size);
      
      const schedulesData = schedulesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate() || new Date(),
        endDate: doc.data().endDate?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as MedicationSchedule[];

      // Load consumption records based on user role
      let recordsQuery = null;
      if (user?.role === 'operator') {
        // For operator, get all records without complex query to avoid index requirement
        recordsQuery = collection(db, 'consumption_records');
      } else {
        // For doctors, get records for their patients only
        const patientIds = patientsData.map(p => p.id);
        if (patientIds.length > 0) {
          // Use simple collection query and filter on client side to avoid complex indexes
          recordsQuery = patientIds.length <= 10 ? query(
            collection(db, 'consumption_records'),
            where('patientId', 'in', patientIds.slice(0, 10)), // Firestore 'in' limit is 10
            limit(500)
          ) : collection(db, 'consumption_records');
        }
      }

      let recordsData: ConsumptionRecord[] = [];
      if (recordsQuery) {
        const recordsSnapshot = await getDocs(recordsQuery);
        console.log('Raw consumption records:', recordsSnapshot.size);
        
        recordsData = recordsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          patientName: doc.data().patientName || '',
          medicationName: doc.data().medicationName || '',
          scheduledDate: doc.data().scheduledDate?.toDate() || new Date(),
          scheduledDateTime: doc.data().scheduledDateTime?.toDate() || new Date(),
          actualTime: doc.data().actualTime?.toDate() || null,
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        })) as ConsumptionRecord[];
        
        // Sort manually to avoid index requirement
        recordsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Filter records for doctors to only show their patients' records (client-side filtering)
        if (user?.role !== 'operator') {
          const patientIds = patientsData.map(p => p.id);
          console.log('Filtering records for patient IDs:', patientIds);
          console.log('Records before filtering:', recordsData.length);
          recordsData = recordsData.filter(record => patientIds.includes(record.patientId));
          console.log('Records after filtering:', recordsData.length);
        }
      }

      console.log('Final consumption data - Patients:', patientsData.length, 'Records:', recordsData.length);

      setPatients(patientsData);
      setSchedules(schedulesData);
      setRecords(recordsData);
    } catch (error) {
      console.error('Error loading data:', error);
      // Set empty arrays on error to prevent UI issues
      setPatients([]);
      setSchedules([]);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // Setup real-time listener for consumption records
  const setupRealtimeListener = () => {
    try {
      console.log('ConsumptionHistory - Setting up real-time listener for user:', user?.id, 'role:', user?.role);
      
      let recordsQuery;
      
      if (user?.role === 'operator') {
        // operator sees all records
        recordsQuery = query(
          collection(db, 'consumption_records'),
          orderBy('createdAt', 'desc'),
          limit(500)
        );
      } else {
        // For doctors, we'll need to filter on client side since we can't do complex queries
        recordsQuery = query(
          collection(db, 'consumption_records'),
          orderBy('createdAt', 'desc'),
          limit(500)
        );
      }
      
      const unsubscribe = onSnapshot(recordsQuery, async (snapshot) => {
        console.log('ConsumptionHistory - Real-time update received, processing', snapshot.size, 'records');
        
        let recordsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          patientName: doc.data().patientName || '',
          medicationName: doc.data().medicationName || '',
          scheduledDate: doc.data().scheduledDate?.toDate() || new Date(),
          scheduledDateTime: doc.data().scheduledDateTime?.toDate() || new Date(),
          actualTime: doc.data().actualTime?.toDate() || null,
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        })) as ConsumptionRecord[];
        
        // Filter for doctors (client-side filtering)
        if (user?.role !== 'operator') {
          // Get current patients for this doctor
          const patientsQuery = query(
            collection(db, 'patients'),
            where('doctorId', '==', user?.id)
          );
          
          const patientsSnapshot = await getDocs(patientsQuery);
          const patientIds = patientsSnapshot.docs.map(doc => doc.id);
          
          console.log('ConsumptionHistory - Filtering records for doctor patients:', patientIds);
          recordsData = recordsData.filter(record => patientIds.includes(record.patientId));
        }
        
        console.log('ConsumptionHistory - Real-time update processed:', recordsData.length, 'records');
        setRecords(recordsData);
      }, (error) => {
        console.error('ConsumptionHistory - Real-time listener error:', error);
      });
      
      setRealtimeListener(unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.error('ConsumptionHistory - Error setting up real-time listener:', error);
      return null;
    }
  };

  // Generate consumption records from active schedules
  const generateConsumptionRecords = async () => {
    if (!user || !user.id) {
      alert('User tidak tersedia');
      return;
    }

    try {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      
      // Filter schedules based on user role
      const userSchedules = user.role === 'operator' 
        ? schedules 
        : schedules.filter(s => s.prescribedBy === user.id);
      
      const activeSchedules = userSchedules.filter(s => 
        s.isActive && 
        new Date(s.startDate) <= today && 
        new Date(s.endDate) >= today
      );

      if (activeSchedules.length === 0) {
        alert('Tidak ada jadwal aktif untuk membuat record konsumsi');
        return;
      }

      let recordsCreated = 0;

      for (const schedule of activeSchedules) {
        // Generate records for today and next 7 days
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const targetDate = new Date(todayStart);
          targetDate.setDate(targetDate.getDate() + dayOffset);
          
          // Skip if target date is beyond schedule end date
          if (targetDate > new Date(schedule.endDate)) continue;
          
          for (const time of schedule.times || []) {
            const scheduledDateTime = new Date(targetDate);
            const [hours, minutes] = time.split(':');
            scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            // Check if record already exists for this schedule and time
            const existingRecord = records.find(r => 
              r.scheduleId === schedule.id && 
              r.scheduledDate.toDateString() === targetDate.toDateString() &&
              r.scheduledTime === time
            );

            if (!existingRecord) {
              const recordData = {
                patientId: schedule.patientId,
                patientName: schedule.patientName || '',
                medicationName: schedule.medicationName || '',
                scheduleId: schedule.id,
                scheduledDate: targetDate,
                scheduledTime: time,
                scheduledDateTime: scheduledDateTime,
                dosage: schedule.dosage || '',
                status: 'pending' as const,
                notes: '',
                sideEffectsReported: [],
                recordedBy: 'system',
                createdAt: new Date(),
              };

              await addDoc(collection(db, 'consumption_records'), recordData);
              recordsCreated++;
            }
          }
        }
      }

      alert(`Berhasil membuat ${recordsCreated} record konsumsi baru dari jadwal aktif.`);
      
      // Reload data after generating records
      await loadData();
    } catch (error) {
      console.error('Error generating consumption records:', error);
      alert('Terjadi kesalahan saat membuat record konsumsi');
    }
  };

  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      (record.patientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.medicationName || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = !filterStatus || record.status === filterStatus;
    const matchesPatient = !filterPatient || record.patientId === filterPatient;
    const matchesDate = !filterDate || 
      record.scheduledDate.toISOString().split('T')[0] === filterDate;

    return matchesSearch && matchesStatus && matchesPatient && matchesDate;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'taken':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'missed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'late':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'taken':
        return 'Sudah Diminum';
      case 'missed':
        return 'Terlewat';
      case 'late':
        return 'Terlambat';
      case 'pending':
        return 'Menunggu';
      default:
        return 'Tidak Diketahui';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'taken':
        return 'bg-green-100 text-green-800';
      case 'missed':
        return 'bg-red-100 text-red-800';
      case 'late':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const openModal = (mode: 'add' | 'edit' | 'view', record?: ConsumptionRecord) => {
    setModalMode(mode);
    setSelectedRecord(record || null);
    
    if (record) {
      setRecordForm({
        status: record.status,
        notes: record.notes || '',
        sideEffectsReported: record.sideEffectsReported || [],
      });
    } else {
      setRecordForm({
        status: 'taken',
        notes: '',
        sideEffectsReported: [],
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedRecord(null);
  };

  const handleRecordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    try {
      const updateData: any = {
        status: recordForm.status,
        notes: recordForm.notes,
        sideEffectsReported: recordForm.sideEffectsReported,
        updatedAt: new Date(),
      };

      // Set actual time if status is taken or late
      if (recordForm.status === 'taken' || recordForm.status === 'late') {
        updateData.actualTime = new Date();
      }

      await updateDoc(doc(db, 'consumption_records', selectedRecord.id), updateData);

      await loadData();
      closeModal();
    } catch (error) {
      console.error('Error updating record:', error);
      alert('Terjadi kesalahan saat memperbarui record');
    }
  };

  const canManageRecords = user?.role === 'operator';

  const stats = {
    total: records.length,
    taken: records.filter(r => r.status === 'taken').length,
    missed: records.filter(r => r.status === 'missed').length,
    late: records.filter(r => r.status === 'late').length,
    pending: records.filter(r => r.status === 'pending').length,
    complianceRate: records.length > 0 
      ? Math.round((records.filter(r => r.status === 'taken').length / records.length) * 100)
      : 0,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat riwayat konsumsi...</p>
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
            Riwayat Konsumsi Obat
          </h1>
          <p className="text-gray-600 mt-1">
            {user?.role === 'operator' 
              ? 'Monitor konsumsi obat semua pasien'
              : 'Monitor konsumsi obat pasien Anda'
            }
          </p>
        </div>
        <div>
          <button 
            onClick={generateConsumptionRecords}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Generate Records
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Record</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Calendar className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Sudah Diminum</p>
              <p className="text-2xl font-bold text-green-600">{stats.taken}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Terlewat</p>
              <p className="text-2xl font-bold text-red-600">{stats.missed}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Terlambat</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.late}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Menunggu</p>
              <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Kepatuhan</p>
              <p className="text-2xl font-bold text-teal-600">{stats.complianceRate}%</p>
            </div>
            <CheckCircle className="h-8 w-8 text-teal-500" />
          </div>
        </div>
      </div>

      {/* Info Box for WhatsApp Integration */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Calendar className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Auto-Update Riwayat Konsumsi</h3>
            <p className="text-sm text-blue-700 mt-1">
              Sistem ini otomatis memperbarui riwayat konsumsi setiap kali ada perubahan pada jadwal obat. 
              Setiap penambahan atau perubahan jadwal akan langsung membuat/memperbarui riwayat konsumsi yang sesuai. 
              Data diperbarui secara real-time untuk semua pengguna.
            </p>
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
                placeholder="Cari berdasarkan nama pasien atau obat..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">Semua Status</option>
              <option value="taken">Sudah Diminum</option>
              <option value="missed">Terlewat</option>
              <option value="late">Terlambat</option>
              <option value="pending">Menunggu</option>
            </select>
            <select
              value={filterPatient}
              onChange={(e) => setFilterPatient(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">Semua Pasien</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Pasien
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Obat
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Jadwal
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Waktu Aktual
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Catatan
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-gray-500">
                    {searchTerm || filterStatus || filterPatient || filterDate
                      ? 'Tidak ada record yang sesuai dengan filter.'
                      : 'Belum ada riwayat konsumsi. Pastikan ada jadwal obat aktif, lalu klik "Generate Records" untuk membuat record konsumsi.'}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">
                            {record.patientName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <Pill className="h-4 w-4 text-teal-600 mr-2" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {record.medicationName}
                          </p>
                          <p className="text-xs text-gray-500">{record.dosage}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-gray-600">
                        <p>{record.scheduledDate.toLocaleDateString('id-ID')}</p>
                        <p className="text-xs">{record.scheduledTime}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-gray-600">
                        {record.actualTime ? (
                          <>
                            <p>{record.actualTime.toLocaleDateString('id-ID')}</p>
                            <p className="text-xs">
                              {record.actualTime.toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                          record.status
                        )}`}
                      >
                        {getStatusIcon(record.status)}
                        <span className="ml-1">{getStatusText(record.status)}</span>
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm text-gray-600 max-w-xs truncate">
                        {record.notes || '-'}
                      </p>
                      {record.sideEffectsReported && record.sideEffectsReported.length > 0 && (
                        <p className="text-xs text-red-600 mt-1">
                          Efek samping: {record.sideEffectsReported.join(', ')}
                        </p>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openModal('view', record)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Lihat Detail"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canManageRecords && (
                          <button
                            onClick={() => openModal('edit', record)}
                            className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                            title="Edit Status"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
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
      {isModalOpen && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {modalMode === 'edit' ? 'Edit Status Konsumsi' : 'Detail Konsumsi Obat'}
              </h2>
            </div>

            <form onSubmit={handleRecordUpdate} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pasien
                  </label>
                  <input
                    type="text"
                    value={selectedRecord.patientName}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Obat
                  </label>
                  <input
                    type="text"
                    value={selectedRecord.medicationName}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Jadwal
                  </label>
                  <input
                    type="text"
                    value={`${selectedRecord.scheduledDate.toLocaleDateString('id-ID')} ${selectedRecord.scheduledTime}`}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dosis
                  </label>
                  <input
                    type="text"
                    value={selectedRecord.dosage}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
              </div>

              {modalMode === 'edit' && canManageRecords && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={recordForm.status}
                    onChange={(e) =>
                      setRecordForm((prev) => ({ ...prev, status: e.target.value as any }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="taken">Sudah Diminum</option>
                    <option value="missed">Terlewat</option>
                    <option value="late">Terlambat</option>
                    <option value="pending">Menunggu</option>
                  </select>
                </div>
              )}

              {modalMode === 'view' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status Saat Ini
                  </label>
                  <div className="flex items-center">
                    {getStatusIcon(selectedRecord.status)}
                    <span className="ml-2 text-sm font-medium">
                      {getStatusText(selectedRecord.status)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan
                </label>
                <textarea
                  value={recordForm.notes}
                  onChange={(e) =>
                    setRecordForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  disabled={modalMode === 'view' || !canManageRecords}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                  placeholder="Tambahkan catatan..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Efek Samping (pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  value={Array.isArray(recordForm.sideEffectsReported) ? recordForm.sideEffectsReported.join(', ') : ''}
                  onChange={(e) =>
                    setRecordForm((prev) => ({ 
                      ...prev, 
                      sideEffectsReported: e.target.value.split(',').map(s => s.trim()).filter(s => s)
                    }))
                  }
                  disabled={modalMode === 'view' || !canManageRecords}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                  placeholder="Contoh: Mual, Pusing, Mengantuk"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Tutup
                </button>
                {modalMode === 'edit' && canManageRecords && (
                  <button
                    type="submit"
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                  >
                    Simpan Perubahan
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

export default ConsumptionHistory;