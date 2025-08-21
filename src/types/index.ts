export interface User {
  id: string;
  email: string;
  name: string;
  role: 'operator' | 'doctor' | 'patient';
  createdAt: Date;
}

export interface Doctor {
  id: string;
  name: string;
  email: string;
  specialization: string;
  sip: string;
  phone: string;
  address?: string;
  hospital?: string;
  experience?: number;
  createdAt: Date;
}

export interface Patient {
  id: string;
  userId?: string;
  name: string;
  age: number;
  gender: 'male' | 'female';
  email: string;
  phone: string;
  condition: string;
  doctorId: string;
  allergies: string[];
  emergencyContact: string;
  address: string;
  createdAt: Date;
}

export interface Medication {
  id: string;
  name: string;
  genericName?: string;
  brand?: string;
  dosage: string;
  form: string;
  frequency: string;
  sideEffects: string[];
  category: string;
  description: string;
  contraindications: string[];
  storage: string;
  manufacturer: string;
  price: number;
  stock: number;
  createdAt: Date;
}

export interface MedicationSchedule {
  id: string;
  patientId: string;
  patientName?: string;
  medicationName?: string;
  dosage: string;
  times: string[];
  frequency: string;
  startDate: Date;
  endDate: Date;
  duration?: number;
  prescribedBy: string;
  prescribedByName?: string;
  instructions: string;
  notes?: string;
  isActive: boolean;
  totalDoses?: number;
  createdAt: Date;
}

export interface ConsumptionRecord {
  id: string;
  patientId: string;
  patientName: string;
  medicationName: string;
  scheduleId: string;
  scheduledDate: Date;
  scheduledTime: string;
  scheduledDateTime: Date;
  actualTime?: Date;
  dosage: string;
  status: 'taken' | 'missed' | 'late' | 'pending';
  notes?: string;
  sideEffectsReported?: string[];
  recordedBy: string;
  createdAt: Date;
}

export interface DashboardStats {
  totalPatients: number;
  totalMedications: number;
  totalSchedules: number;
  complianceRate: number;
  todayConsumptions: number;
  missedMedications: number;
}
