export interface BarbershopSettings {
  id: string;
  name: string;
  phone: string;
  address: string;
  min_cancellation_hours: number;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  active: boolean;
  created_at: string;
}

export interface BusinessHour {
  id: number;
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  break_start: string | null;
  break_end: string | null;
}

export interface Appointment {
  id: string;
  service_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  start_time: string;
  end_time: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  is_walk_in: boolean;
  created_at: string;
  updated_at: string;
  services?: Service | null;
}

export interface BlockedTime {
  id: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  created_at: string;
}
