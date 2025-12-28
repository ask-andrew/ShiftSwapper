
export interface Employee {
  id: number;
  name: string;
  employeeType: 'Full-time' | 'Part-time' | 'Sub';
}

export interface Rule {
  id: string;
  text: string;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export type SwapMode = 'Coverage' | 'Trade';

export interface TimeSlot {
  day: DayOfWeek;
  time: string; // e.g., "09:00"
}

export interface Unavailability {
  employeeId: number;
  slots: TimeSlot[];
}

export interface Shift {
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  employeeName: string;
  date?: string; // Format: MM/DD/YYYY
  dateObj?: Date; // For sorting
}

export type Schedule = Partial<Record<DayOfWeek, Shift[]>>;

export interface SwapSuggestion {
  candidateName: string;
  type: SwapMode;
  reason: string;
  confidence: number;
  currentHours: number;
  projectedHours: number;
  tradeShift?: string; // Optional description of the shift to trade back
}
