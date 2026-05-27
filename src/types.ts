export type UserRole = 'patient' | 'osm'; // อสม.

export interface Service {
  id: string;
  service_name: string;
  estimated_minutes: number;
  color_code: string;
  is_active?: number;
}

export type QueueStatus = 'Waiting' | 'Calling' | 'In-progress' | 'Completed' | 'Skipped';

export interface Queue {
  id: string;
  queue_number: string;
  patient_id: string;
  service_id: string;
  booking_type: 'Walk-in' | 'Online';
  status: QueueStatus;
  created_at: string;
  called_at: string | null;
  completed_at: string | null;
  
  // Joined fields
  full_name: string;
  citizen_id: string;
  phone: string;
  service_name: string;
  color_code: string;
  estimated_minutes: number;
  preferred_time?: string;
  appointment_date?: string;
  satisfaction_score?: number;
  estimated_wait_time?: number;
  people_in_front?: number;
}
