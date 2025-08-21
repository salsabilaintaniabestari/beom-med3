import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Patient, MedicationSchedule } from '../types';
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
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sendWebhookNotification, createWebhookPayload } from '../lib/webhookService';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Calendar,
  Clock,
  User,
  Pill,
  Filter,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

const Medications: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPatient, setFilterPatient] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'view'>('add');
  const [selectedSchedule, setSelectedSchedule] = useState<MedicationSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [realtimeListener, setRealtimeListener] = useState<Unsubscribe | null>(null);

  const [scheduleForm, setScheduleForm] = useState<Partial<MedicationSchedule>>({
    patientId: '',
    medicationName: '',
    dosage: '',
    frequency: '',
    times: [],
    startDate: new Date(),
    endDate: new Date(),
    instructions: '',
    notes: '',
    isActive: true,
  });

  // Load data from Firebase
  useEffect(() => {
    if (user?.id) {
      loadData();
      
      // Set up real-time listener for medication schedules
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

      console.log('Loading medications data for user:', user?.id, 'role:', user?.role);

      // Load patients based on user role
      let patientsQuery;
      if (user?.role === 'operator') {
        patientsQuery = query(collection(db, 'patients'), orderBy('createdAt', 'desc'));
      } else {
        // For doctors, get patients they handle using doctorId
        console.log('Medications - Doctor filtering patients with doctorId:', user?.id);
        patientsQuery = query(
          collection(db, 'patients'),
          where('doctorId', '==', user?.id)
        );
      }
      
      const patientsSnapshot = await getDocs(patientsQuery);
      console.log('Medications - Patients loaded:', {
        count: patientsSnapshot.size,
        patients: patientsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          doctorId: doc.data().doctorId
        }))
      });
      
      const patientsData = patientsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Patient[];

      // Load doctors
      const doctorsSnapshot = await getDocs(collection(db, 'doctors'));
      const doctorsData = doctorsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Doctor[];

      // Load ALL schedules first, then filter based on user role
      const allSchedulesQuery = query(
        collection(db, 'medication_schedules'),
        orderBy('createdAt', 'desc')
      );
      
      const schedulesSnapshot = await getDocs(allSchedulesQuery);
      console.log('Medications - All schedules loaded:', schedulesSnapshot.size);
      
      const allSchedulesData = schedulesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate() || new Date(),
        endDate: doc.data().endDate?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as MedicationSchedule[];

      // Filter schedules based on user role
      let schedulesData: MedicationSchedule[];
      if (user?.role === 'operator') {
        // operator sees all schedules
        schedulesData = allSchedulesData;
        console.log('Medications - operator sees all schedules:', schedulesData.length);
      } else {
        // For doctors, get schedules for their patients (regardless of who prescribed)
        const doctorPatientIds = patientsData.map(p => p.id);
        console.log('Medications - Doctor patient IDs:', doctorPatientIds);
        
        schedulesData = allSchedulesData.filter(schedule => 
          doctorPatientIds.includes(schedule.patientId)
        );
        
        console.log('Medications - Filtered schedules for doctor:', {
          totalSchedules: allSchedulesData.length,
          doctorSchedules: schedulesData.length,
          scheduleDetails: schedulesData.map(s => ({
            id: s.id,
            patientId: s.patientId,
            patientName: s.patientName,
            medicationName: s.medicationName,
            prescribedBy: s.prescribedBy
          }))
        });
      }

      console.log('Medications - Final data loaded:', {
        patients: patientsData.length,
        schedules: schedulesData.length,
        doctors: doctorsData.length
      });

      setPatients(patientsData);
      setSchedules(schedulesData);
    } catch (error) {
      console.error('Error loading data:', error);
      // Set empty arrays on error to prevent UI issues
      setPatients([]);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  // Setup real-time listener for medication schedules
  const setupRealtimeListener = () => {
    try {
      console.log('Medications - Setting up real-time listener for user:', user?.id, 'role:', user?.role);
      
      let schedulesQuery;
      
      if (user?.role === 'operator') {
        // Operator sees all schedules
        schedulesQuery = query(
          collection(db, 'medication_schedules'),
          orderBy('createdAt', 'desc')
        );
      } else {
        // For doctors, get schedules they prescribed
        schedulesQuery = query(
          collection(db, 'medication_schedules'),
          where('prescribedBy', '==', user?.id),
          orderBy('createdAt', 'desc')
        );
      }
      
      const unsubscribe = onSnapshot(schedulesQuery, (snapshot) => {
        console.log('Medications - Real-time update received, processing', snapshot.size, 'schedules');
        
        const schedulesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          startDate: doc.data().startDate?.toDate() || new Date(),
          endDate: doc.data().endDate?.toDate() || new Date(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        })) as MedicationSchedule[];
        
        console.log('Medications - Real-time update processed:', schedulesData.length, 'schedules');
        setSchedules(schedulesData);
      }, (error) => {
        console.error('Medications - Real-time listener error:', error);
      });
      
      setRealtimeListener(unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.error('Medications - Error setting up real-time listener:', error);
      return null;
    }
  };

  const filteredSchedules = schedules.filter((schedule) => {
    const matchesSearch =
      (schedule.patientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (schedule.medicationName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.dosage.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPatient = !filterPatient || schedule.patientId === filterPatient;
    const matchesStatus = !filterStatus || 
      (filterStatus === 'active' && schedule.isActive) ||
      (filterStatus === 'inactive' && !schedule.isActive);

    return matchesSearch && matchesPatient && matchesStatus;
  });

  const openModal = (mode: 'add' | 'edit' | 'view', schedule?: MedicationSchedule) => {
    setModalMode(mode);
    setSelectedSchedule(schedule || null);

    if (schedule) {
      setScheduleForm({
        ...schedule,
        times: schedule.times || [],
      });
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      setScheduleForm({
        patientId: '',
        medicationName: '',
        dosage: '',
        frequency: '',
        times: [],
        startDate: tomorrow,
        endDate: nextMonth,
        instructions: '',
        notes: '',
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSchedule(null);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const selectedPatient = patients.find((p) => p.id === scheduleForm.patientId);
      
      const scheduleData = {
        patientId: scheduleForm.patientId,
        patientName: selectedPatient?.name || '',
        medicationName: scheduleForm.medicationName,
        dosage: scheduleForm.dosage,
        frequency: scheduleForm.frequency,
        times: scheduleForm.times || [],
        startDate: scheduleForm.startDate,
        endDate: scheduleForm.endDate,
        prescribedBy: user?.id,
        prescribedByName: user?.name,
        instructions: scheduleForm.instructions,
        notes: scheduleForm.notes,
        isActive: scheduleForm.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (modalMode === 'add') {
        const docRef = await addDoc(collection(db, 'medication_schedules'), scheduleData);
        
        // Auto-generate consumption records for the new schedule
        await generateConsumptionRecordsForSchedule({
          id: docRef.id,
          ...scheduleData,
        } as MedicationSchedule);
        
        // Send webhook notification ONLY for medication_schedules creation
        try {
          console.log('Medications - Preparing webhook for schedule creation:', {
            scheduleId: docRef.id,
            patientName: scheduleData.patientName,
            medicationName: scheduleData.medicationName,
            userId: user?.id,
            userRole: user?.role
          });
          
          const webhookPayload = createWebhookPayload(
            'create',
            'medication_schedules',
            docRef.id,
            {
              ...scheduleData,
              id: docRef.id,
              createdAt: new Date().toISOString(),
            },
            undefined,
            user ? { id: user.id, role: user.role, name: user.name } : undefined
          );
          
          console.log('Medications - Sending webhook payload:', webhookPayload);
          await sendWebhookNotification(webhookPayload);
          console.log('Medications - Webhook sent successfully for schedule creation:', docRef.id);
        } catch (webhookError) {
          console.error('Medications - Webhook failed for schedule creation:', {
            scheduleId: docRef.id,
            error: webhookError.message,
            stack: webhookError.stack
          });
          // Don't throw error to prevent disrupting main schedule creation
        }
      } else if (modalMode === 'edit' && selectedSchedule) {
        const previousData = { ...selectedSchedule };
        await updateDoc(doc(db, 'medication_schedules', selectedSchedule.id), {
          ...scheduleData,
          updatedAt: new Date(),
        });
        
        // If schedule is reactivated or times changed, regenerate consumption records
        if (scheduleData.isActive && (!previousData.isActive || 
            JSON.stringify(scheduleData.times) !== JSON.stringify(previousData.times))) {
          
          // Delete existing consumption records for this schedule
          const existingRecordsQuery = query(
            collection(db, 'consumption_records'),
            where('scheduleId', '==', selectedSchedule.id)
          );
          const existingRecordsSnapshot = await getDocs(existingRecordsQuery);
          
          console.log(`Deleting ${existingRecordsSnapshot.size} existing consumption records before regenerating`);
          
          const deletePromises = existingRecordsSnapshot.docs.map(doc => 
            deleteDoc(doc.ref)
          );
          await Promise.all(deletePromises);
          
          // Generate new consumption records
          await generateConsumptionRecordsForSchedule({
            id: selectedSchedule.id,
            ...scheduleData,
          } as MedicationSchedule);
        } else if (!scheduleData.isActive && previousData.isActive) {
          // If schedule is deactivated, delete related consumption records with pending status
          const pendingRecordsQuery = query(
            collection(db, 'consumption_records'),
            where('scheduleId', '==', selectedSchedule.id),
            where('status', '==', 'pending')
          );
          const pendingRecordsSnapshot = await getDocs(pendingRecordsQuery);
          
          console.log(`Deleting ${pendingRecordsSnapshot.size} pending consumption records for deactivated schedule`);
          
          const deletePromises = pendingRecordsSnapshot.docs.map(doc => 
            deleteDoc(doc.ref)
          );
          await Promise.all(deletePromises);
        }
        
        // NO webhook notification for schedule update (as per requirement)
        console.log('Medications - Schedule updated (no webhook sent):', selectedSchedule.id);
      }

      await loadData();
      closeModal();
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Terjadi kesalahan saat menyimpan jadwal obat');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus jadwal obat ini?')) {
      try {
        const scheduleToDelete = schedules.find(s => s.id === id);
        
        // Delete related consumption records first
        const consumptionQuery = query(
          collection(db, 'consumption_records'),
          where('scheduleId', '==', id)
        );
        const consumptionSnapshot = await getDocs(consumptionQuery);
        
        console.log(`Deleting ${consumptionSnapshot.size} related consumption records for schedule ${id}`);
        
        // Delete all related consumption records
        const deletePromises = consumptionSnapshot.docs.map(doc => 
          deleteDoc(doc.ref)
        );
        await Promise.all(deletePromises);
        
        // Then delete the schedule
        await deleteDoc(doc(db, 'medication_schedules', id));
        
        // NO webhook notification for schedule deletion (as per requirement)
        console.log('Medications - Schedule deleted (no webhook sent):', id);
        
        console.log(`Successfully deleted schedule ${id} and ${consumptionSnapshot.size} related consumption records`);
        await loadData();
      } catch (error) {
        console.error('Error deleting schedule:', error);
        alert('Terjadi kesalahan saat menghapus jadwal obat');
      }
    }
  };

  const getPatientName = (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
    return patient?.name || 'Tidak diketahui';
  };

  const canManageSchedules = user?.role === 'operator' || user?.role === 'doctor';

  // Function to generate consumption records for a specific schedule
  const generateConsumptionRecordsForSchedule = async (schedule: MedicationSchedule) => {
    try {
      console.log('Generating consumption records for schedule:', schedule.id);
      
      const startDate = new Date(schedule.startDate);
      const endDate = new Date(schedule.endDate);
      
      // Calculate total days between start and end date (inclusive)
      const timeDiff = endDate.getTime() - startDate.getTime();
      const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end date
      
      // Calculate total records = total days × frequency (number of times per day)
      const timesPerDay = schedule.times?.length || 0;
      const expectedTotalRecords = totalDays * timesPerDay;
      
      console.log('Consumption calculation:', {
        startDate: startDate.toDateString(),
        endDate: endDate.toDateString(),
        totalDays,
        timesPerDay,
        expectedTotalRecords
      });
      
      let recordsCreated = 0;
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        for (const time of schedule.times || []) {
          const scheduledDateTime = new Date(currentDate);
          const [hours, minutes] = time.split(':');
          scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          
          // Create consumption record (no duplicate check since we delete existing ones first)
          const recordData = {
            patientId: schedule.patientId,
            patientName: schedule.patientName || '',
            medicationName: schedule.medicationName || '',
            scheduleId: schedule.id,
            scheduledDate: new Date(currentDate),
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
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      console.log(`Generated ${recordsCreated} consumption records for schedule ${schedule.id} (Expected: ${expectedTotalRecords})`);
      
      if (recordsCreated > 0) {
        // Show success message
        const message = `Jadwal obat berhasil disimpan dan ${recordsCreated} record konsumsi otomatis dibuat (${totalDays} hari × ${timesPerDay} kali = ${expectedTotalRecords} total record).`;
        // You could show a toast notification here instead of alert
        setTimeout(() => {
          alert(message);
        }, 500);
      }
      
    } catch (error) {
      console.error('Error generating consumption records:', error);
      // Don't throw error to prevent disrupting the main schedule creation
    }
  };
  
  const stats = {
    totalSchedules: schedules.length,
    activeSchedules: schedules.filter(s => s.isActive).length,
    inactiveSchedules: schedules.filter(s => !s.isActive).length,
    totalPatients: new Set(schedules.map(s => s.patientId)).size,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat data obat dan jadwal...</p>
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
            Obat & Jadwal
          </h1>
          <p className="text-gray-600 mt-1">
            {user?.role === 'operator' 
              ? 'Kelola jadwal obat semua pasien'
              : 'Kelola jadwal obat pasien Anda'
            }
          </p>
        </div>
        {canManageSchedules && (
          <button
            onClick={() => openModal('add')}
            className="bg-teal-600 hover:bg-teal-700 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Tambah Jadwal
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Jadwal</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalSchedules}</p>
            </div>
            <Calendar className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Jadwal Aktif</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeSchedules}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Jadwal Nonaktif</p>
              <p className="text-2xl font-bold text-red-600">{stats.inactiveSchedules}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Pasien</p>
              <p className="text-2xl font-bold text-teal-600">{stats.totalPatients}</p>
            </div>
            <User className="h-8 w-8 text-teal-500" />
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
                placeholder="Cari berdasarkan nama pasien, obat, atau dosis..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-3">
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
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Schedules Table */}
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
                  Periode
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Instruksi
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-gray-500">
                    {searchTerm || filterPatient || filterStatus
                      ? 'Tidak ada jadwal yang sesuai dengan filter.'
                      : 'Belum ada jadwal obat. Klik "Tambah Jadwal" untuk membuat jadwal baru.'}
                  </td>
                </tr>
              ) : (
                filteredSchedules.map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">
                            {schedule.patientName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        <Pill className="h-4 w-4 text-teal-600 mr-2" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {schedule.medicationName}
                          </p>
                          <p className="text-xs text-gray-500">{schedule.dosage}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1">
                        {schedule.times && schedule.times.length > 0 ? (
                          schedule.times.slice(0, 3).map((time, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                            >
                              {time}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500">Tidak ada waktu</span>
                        )}
                        {schedule.times && schedule.times.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{schedule.times.length - 3} lagi
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{schedule.frequency}</p>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-gray-600">
                        <p>{schedule.startDate.toLocaleDateString('id-ID')}</p>
                        <p className="text-xs">s/d {schedule.endDate.toLocaleDateString('id-ID')}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          schedule.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {schedule.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm text-gray-600 max-w-xs truncate">
                        {schedule.instructions || '-'}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openModal('view', schedule)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Lihat Detail"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canManageSchedules && (
                          <>
                            <button
                              onClick={() => openModal('edit', schedule)}
                              className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(schedule.id)}
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
                  ? 'Tambah Jadwal Obat'
                  : modalMode === 'edit'
                  ? 'Edit Jadwal Obat'
                  : 'Detail Jadwal Obat'}
              </h2>
            </div>

            <form onSubmit={handleScheduleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pasien
                  </label>
                  <select
                    value={scheduleForm.patientId}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, patientId: e.target.value }))
                    }
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    required
                  >
                    <option value="">Pilih Pasien</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Obat
                  </label>
                  <input
                    type="text"
                    value={scheduleForm.medicationName}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, medicationName: e.target.value }))
                    }
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dosis
                  </label>
                  <input
                    type="text"
                    value={scheduleForm.dosage}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, dosage: e.target.value }))
                    }
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    placeholder="Contoh: 1 tablet, 5ml"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frekuensi
                  </label>
                  <select
                    value={scheduleForm.frequency}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, frequency: e.target.value }))
                    }
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    required
                  >
                    <option value="">Pilih Frekuensi</option>
                    <option value="1x sehari">1x sehari</option>
                    <option value="2x sehari">2x sehari</option>
                    <option value="3x sehari">3x sehari</option>
                    <option value="4x sehari">4x sehari</option>
                    <option value="Sesuai kebutuhan">Sesuai kebutuhan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={scheduleForm.startDate?.toISOString().split('T')[0]}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, startDate: new Date(e.target.value) }))
                    }
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    value={scheduleForm.endDate?.toISOString().split('T')[0]}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, endDate: new Date(e.target.value) }))
                    }
                    disabled={modalMode === 'view'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Waktu Konsumsi (pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  value={Array.isArray(scheduleForm.times) ? scheduleForm.times.join(', ') : ''}
                  onChange={(e) =>
                    setScheduleForm((prev) => ({ 
                      ...prev, 
                      times: e.target.value.split(',').map(t => t.trim()).filter(t => t)
                    }))
                  }
                  disabled={modalMode === 'view'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                  placeholder="Contoh: 08:00, 14:00, 20:00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instruksi Penggunaan
                </label>
                <textarea
                  value={scheduleForm.instructions}
                  onChange={(e) =>
                    setScheduleForm((prev) => ({ ...prev, instructions: e.target.value }))
                  }
                  disabled={modalMode === 'view'}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                  placeholder="Contoh: Diminum setelah makan, jangan dikunyah"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan
                </label>
                <textarea
                  value={scheduleForm.notes}
                  onChange={(e) =>
                    setScheduleForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  disabled={modalMode === 'view'}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:bg-gray-50"
                  placeholder="Catatan tambahan..."
                />
              </div>

              {modalMode !== 'view' && (
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={scheduleForm.isActive}
                    onChange={(e) =>
                      setScheduleForm((prev) => ({ ...prev, isActive: e.target.checked }))
                    }
                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                    Jadwal aktif
                  </label>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {modalMode === 'view' ? 'Tutup' : 'Batal'}
                </button>
                {modalMode !== 'view' && canManageSchedules && (
                  <button
                    type="submit"
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                  >
                    {modalMode === 'add' ? 'Tambah Jadwal' : 'Simpan Perubahan'}
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

export default Medications;