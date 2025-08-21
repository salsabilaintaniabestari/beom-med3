import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import DashboardCard from '../components/DashboardCard';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Users,
  Pill,
  Calendar,
  TrendingUp,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { DashboardStats, MedicationSchedule } from '../types';

const Dashboard: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    totalSchedules: 0,
    totalMedications: 0,
    complianceRate: 0,
    todayConsumptions: 0,
    missedMedications: 0,
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [complianceData, setComplianceData] = useState<any[]>([]);
  const [medicationCategoryData, setMedicationCategoryData] = useState<any[]>(
    []
  );
  const [monthlyTrendData, setMonthlyTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeListeners, setRealtimeListeners] = useState<Unsubscribe[]>([]);

  // Load real data from Firebase
  useEffect(() => {
    // Only load data when auth is complete and user is available
    if (!authLoading && user) {
      loadDashboardData();
      
      // Setup real-time listeners
      const listeners = setupRealtimeListeners();
      setRealtimeListeners(listeners);
      
      // Cleanup listeners on unmount
      return () => {
        listeners.forEach(unsubscribe => {
          if (unsubscribe) {
            unsubscribe();
          }
        });
      };
    }
  }, [user, authLoading]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      console.log('Dashboard - Loading data for user:', {
        id: user?.id,
        role: user?.role,
        name: user?.name,
        email: user?.email
      });

      // Load patients count
      let patientsQuery;
      if (user?.role === 'operator') {
        patientsQuery = collection(db, 'patients');
      } else {
        // For doctors, get patients they handle using doctorId
        console.log('Dashboard - Doctor filtering patients with doctorId:', user?.id);
        patientsQuery = query(
          collection(db, 'patients'),
          where('doctorId', '==', user?.id)
        );
      }
      const patientsSnapshot = await getDocs(patientsQuery);
      console.log('Dashboard - Patients loaded:', {
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

      // Load ALL schedules first, then filter based on user role
      const allSchedulesQuery = collection(db, 'medication_schedules');
      const schedulesSnapshot = await getDocs(allSchedulesQuery);
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
        schedulesData = allSchedulesData;
      } else {
        // For doctors, get schedules for their patients
        const doctorPatientIds = patientsData.map(p => p.id);
        schedulesData = allSchedulesData.filter(schedule => 
          doctorPatientIds.includes(schedule.patientId)
        );
      }

      // Load ALL consumption records first, then filter based on user role
      const allRecordsQuery = query(
        collection(db, 'consumption_records'),
        orderBy('createdAt', 'desc'),
        limit(200)
      );
      
      const recordsSnapshot = await getDocs(allRecordsQuery);
      const allRecords = recordsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        scheduledDate: doc.data().scheduledDate?.toDate() || new Date(),
        scheduledDateTime: doc.data().scheduledDateTime?.toDate() || new Date(),
        actualTime: doc.data().actualTime?.toDate() || null,
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));

      // Filter records based on user role
      let records: any[];
      if (user?.role === 'operator') {
        records = allRecords;
      } else {
        // For doctors, get records for their patients
        const patientIds = patientsData.map(p => p.id);
        records = allRecords.filter(record => 
          patientIds.includes(record.patientId)
        );
      }

      console.log('Dashboard - Final data loaded:', {
        userRole: user?.role,
        doctorId: user?.id,
        patients: patientsData.length,
        schedules: schedulesData.length,
        records: records.length
      });

      // Calculate today's records
      const today = new Date();
      const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      const todayRecords = records.filter(
        (r) => r.scheduledDate >= todayStart && r.scheduledDate < todayEnd
      );

      // Calculate compliance data for the last 7 days
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate()
        );
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const dayRecords = records.filter(
          (r) => r.scheduledDate >= dayStart && r.scheduledDate < dayEnd
        );

        const taken = dayRecords.filter((r) => r.status === 'taken').length;
        const total = dayRecords.length;
        const compliance = total > 0 ? Math.round((taken / total) * 100) : 0;
        const missed = total - taken;

        last7Days.push({
          name: date.toLocaleDateString('id-ID', { weekday: 'short' }),
          compliance,
          missed: Math.round((missed / (total || 1)) * 100),
          date: date.toISOString().split('T')[0],
        });
      }

      // Generate medication category data from schedules
      const categoryMap = new Map();
      schedulesData.forEach((schedule) => {
        const medication = schedule.medicationName || 'Tidak Diketahui';
        // Simple categorization based on medication name
        let category = 'Lainnya';
        if (
          medication.toLowerCase().includes('amlodipine') ||
          medication.toLowerCase().includes('captopril')
        ) {
          category = 'Antihipertensi';
        } else if (
          medication.toLowerCase().includes('metformin') ||
          medication.toLowerCase().includes('insulin')
        ) {
          category = 'Antidiabetes';
        } else if (
          medication.toLowerCase().includes('amoxicillin') ||
          medication.toLowerCase().includes('antibiotic')
        ) {
          category = 'Antibiotik';
        } else if (
          medication.toLowerCase().includes('paracetamol') ||
          medication.toLowerCase().includes('ibuprofen')
        ) {
          category = 'Analgesik';
        } else if (medication.toLowerCase().includes('vitamin')) {
          category = 'Vitamin';
        }

        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      });

      const categoryColors = [
        '#0F766E',
        '#059669',
        '#10B981',
        '#34D399',
        '#6EE7B7',
        '#A7F3D0',
      ];
      const categoryData = Array.from(categoryMap.entries()).map(
        ([name, value], index) => ({
          name,
          value,
          color: categoryColors[index % categoryColors.length],
        })
      );

      // Generate monthly trend data from records
      const monthlyMap = new Map();
      const last6Months = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('id-ID', { month: 'short' });

        const monthRecords = records.filter((r) => {
          const recordMonth = `${r.scheduledDate.getFullYear()}-${String(
            r.scheduledDate.getMonth() + 1
          ).padStart(2, '0')}`;
          return recordMonth === monthKey;
        });

        const taken = monthRecords.filter((r) => r.status === 'taken').length;
        const total = monthRecords.length;
        const compliance = total > 0 ? Math.round((taken / total) * 100) : 0;

        last6Months.push({
          name: monthName,
          compliance,
          total: total,
          taken: taken,
        });
      }
      const takenRecords = records.filter((r) => r.status === 'taken').length;
      const totalRecords = records.length;
      const complianceRate =
        totalRecords > 0 ? Math.round((takenRecords / totalRecords) * 100) : 0;

      setStats({
        totalPatients: patientsData.length,
        totalMedications: schedulesData.length,
        totalSchedules: schedulesData.length,
        complianceRate: complianceRate,
        todayConsumptions: todayRecords.filter((r) => r.status === 'taken')
          .length,
        missedMedications: todayRecords.filter((r) => r.status === 'missed')
          .length,
      });

      setComplianceData(last7Days);
      setMedicationCategoryData(categoryData);
      setMonthlyTrendData(last6Months);
      setRecentActivities(records.slice(0, 10));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Setup real-time listeners for dashboard data
  const setupRealtimeListeners = (): Unsubscribe[] => {
    const listeners: Unsubscribe[] = [];
    
    try {
      console.log('Dashboard - Setting up real-time listeners for user:', user?.id, 'role:', user?.role);
      
      // Listen to consumption records changes
      const recordsQuery = user?.role === 'operator' 
        ? query(collection(db, 'consumption_records'), limit(200))
        : query(collection(db, 'consumption_records'), limit(200));
      
      const recordsListener = onSnapshot(recordsQuery, async (snapshot) => {
        console.log('Dashboard - Real-time update: consumption records changed');
        await loadDashboardData(); // Reload all dashboard data
      }, (error) => {
        console.error('Dashboard - Records listener error:', error);
      });
      
      listeners.push(recordsListener);
      
      // Listen to medication schedules changes
      const schedulesQuery = query(collection(db, 'medication_schedules'));
      
      const schedulesListener = onSnapshot(schedulesQuery, async (snapshot) => {
        console.log('Dashboard - Real-time update: medication schedules changed');
        await loadDashboardData(); // Reload all dashboard data
      }, (error) => {
        console.error('Dashboard - Schedules listener error:', error);
      });
      
      listeners.push(schedulesListener);
      
      // Listen to patients changes
      const patientsQuery = user?.role === 'operator'
        ? query(collection(db, 'patients'))
        : query(collection(db, 'patients'), where('doctorId', '==', user?.id || ''));
      
      const patientsListener = onSnapshot(patientsQuery, async (snapshot) => {
        console.log('Dashboard - Real-time update: patients changed');
        await loadDashboardData(); // Reload all dashboard data
      }, (error) => {
        console.error('Dashboard - Patients listener error:', error);
      });
      
      listeners.push(patientsListener);
      
      console.log('Dashboard - Set up', listeners.length, 'real-time listeners');
      
    } catch (error) {
      console.error('Dashboard - Error setting up real-time listeners:', error);
    }
    
    return listeners;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Selamat datang, {user?.name} (
            {user?.role === 'operator' ? 'Operator' : 'Dokter'})
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Hari ini</p>
          <p className="text-lg font-semibold text-gray-900">
            {new Date().toLocaleDateString('id-ID', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard
          title="Total Pasien"
          value={stats.totalPatients}
          icon={Users}
          trend={{ value: 12, isPositive: true }}
          color="blue"
        />
        <DashboardCard
          title="Total Obat"
          value={stats.totalMedications}
          icon={Pill}
          trend={{ value: 8, isPositive: true }}
          color="green"
        />
        <DashboardCard
          title="Jadwal Aktif"
          value={stats.totalSchedules}
          icon={Calendar}
          trend={{ value: 5, isPositive: true }}
          color="purple"
        />
        <DashboardCard
          title="Tingkat Kepatuhan"
          value={`${stats.complianceRate}%`}
          icon={TrendingUp}
          trend={{ value: 3.2, isPositive: true }}
          color="teal"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Konsumsi Hari Ini
            </h3>
            <Activity className="h-5 w-5 text-teal-600" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                <span className="text-sm text-gray-600">Sudah Diminum</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {stats.todayConsumptions}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
                <span className="text-sm text-gray-600">Terlewat</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {stats.missedMedications}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="h-4 w-4 text-yellow-500 mr-2" />
                <span className="text-sm text-gray-600">Menunggu</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {recentActivities.filter((r) => r.status === 'pending').length}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Ringkasan Data
            </h3>
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Pasien</span>
              <span className="text-sm font-medium text-gray-900">
                {stats.totalPatients}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Jadwal Aktif</span>
              <span className="text-sm font-medium text-gray-900">
                {stats.totalSchedules}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Tingkat Kepatuhan</span>
              <span className="text-sm font-medium text-gray-900">
                {stats.complianceRate}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Aktivitas Terbaru
            </h3>
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="space-y-3">
            {recentActivities.length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada aktivitas</p>
            ) : (
              recentActivities.slice(0, 3).map((activity, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    activity.status === 'taken'
                      ? 'bg-green-50'
                      : activity.status === 'missed'
                      ? 'bg-red-50'
                      : activity.status === 'late'
                      ? 'bg-yellow-50'
                      : 'bg-blue-50'
                  }`}
                >
                  <p
                    className={`text-xs font-medium ${
                      activity.status === 'taken'
                        ? 'text-green-800'
                        : activity.status === 'missed'
                        ? 'text-red-800'
                        : activity.status === 'late'
                        ? 'text-yellow-800'
                        : 'text-blue-800'
                    }`}
                  >
                    {activity.patientName}
                  </p>
                  <p
                    className={`text-xs ${
                      activity.status === 'taken'
                        ? 'text-green-600'
                        : activity.status === 'missed'
                        ? 'text-red-600'
                        : activity.status === 'late'
                        ? 'text-yellow-600'
                        : 'text-blue-600'
                    }`}
                  >
                    {activity.medicationName} -{' '}
                    {activity.status === 'taken'
                      ? 'Sudah diminum'
                      : activity.status === 'missed'
                      ? 'Terlewat'
                      : activity.status === 'late'
                      ? 'Terlambat'
                      : 'Menunggu'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Chart */}
        {complianceData.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Tingkat Kepatuhan 7 Hari Terakhir
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={complianceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="compliance" fill="#0F766E" name="Patuh (%)" />
                <Bar dataKey="missed" fill="#DC2626" name="Terlewat (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <BarChart3 className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Belum Ada Data Kepatuhan
            </h3>
            <p className="text-gray-600">
              Tambahkan riwayat konsumsi untuk melihat grafik kepatuhan.
            </p>
          </div>
        )}

        {/* Medication Categories */}
        {medicationCategoryData.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Kategori Obat
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={medicationCategoryData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {medicationCategoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <Pill className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Belum Ada Kategori Obat
            </h3>
            <p className="text-gray-600">
              Tambahkan jadwal obat untuk melihat distribusi kategori.
            </p>
          </div>
        )}
      </div>

      {/* Monthly Trend Chart */}
      {monthlyTrendData.length > 0 &&
        monthlyTrendData.some((d) => d.total > 0) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Tren Kepatuhan 6 Bulan Terakhir
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="compliance"
                  stroke="#0F766E"
                  strokeWidth={2}
                  name="Kepatuhan (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
    </div>
  );
};

export default Dashboard;
