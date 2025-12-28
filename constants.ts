
import type { Employee, DayOfWeek } from './types';

export const MIN_PT_HOURS = 20;

export const EMPLOYEES: Employee[] = [
  { id: 1, name: 'Andrew', employeeType: 'Part-time' },
  { id: 2, name: 'Bill', employeeType: 'Full-time' },
  { id: 3, name: 'Beth', employeeType: 'Part-time' },
  { id: 4, name: 'Charlie', employeeType: 'Part-time' },
  { id: 5, name: 'Chris', employeeType: 'Full-time' },
  { id: 6, name: 'Gregory', employeeType: 'Full-time' },
  { id: 7, name: 'Diane', employeeType: 'Full-time' },
  { id: 8, name: 'Danielle', employeeType: 'Part-time' },
  { id: 9, name: 'Kathy', employeeType: 'Part-time' },
  { id: 10, name: 'Julie', employeeType: 'Part-time' },
  { id: 11, name: 'Tylor', employeeType: 'Sub' },
  { id: 12, name: 'Jim', employeeType: 'Sub' },
  { id: 13, name: 'Russ', employeeType: 'Sub' },
  { id: 14, name: 'Donna', employeeType: 'Part-time' },
  { id: 15, name: 'Jorge', employeeType: 'Sub' },
  { id: 16, name: 'David', employeeType: 'Full-time' },
];

export const DAYS_OF_WEEK: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const TIME_SLOTS: string[] = Array.from({ length: (21 - 9) * 2 }, (_, i) => {
  const hour = Math.floor(i / 2) + 9;
  const minute = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

export const LIBRARY_HOURS: Record<DayOfWeek, { open: number; close: number }> = {
  Monday: { open: 9, close: 21 },
  Tuesday: { open: 9, close: 21 },
  Wednesday: { open: 9, close: 21 },
  Thursday: { open: 9, close: 21 },
  Friday: { open: 9, close: 21 },
  Saturday: { open: 9, close: 17 },
  Sunday: { open: 12, close: 18 },
};

export const isLibraryOpen = (day: DayOfWeek, time: string): boolean => {
    const [hour, minute] = time.split(':').map(Number);
    const timeValue = hour + minute / 60;
    const hours = LIBRARY_HOURS[day];
    return timeValue >= hours.open && timeValue < hours.close;
};

export const EMPLOYEE_COLORS: { [key: string]: string } = {
  Andrew: 'bg-purple-100 text-purple-800 border-purple-200',
  Bill: 'bg-slate-200 text-slate-800 border-slate-300', 
  Beth: 'bg-violet-100 text-violet-800 border-violet-200',
  Charlie: 'bg-blue-100 text-blue-800 border-blue-200',
  Chris: 'bg-slate-200 text-slate-800 border-slate-300', 
  Gregory: 'bg-slate-200 text-slate-800 border-slate-300', 
  Diane: 'bg-slate-200 text-slate-800 border-slate-300', 
  Danielle: 'bg-rose-100 text-rose-800 border-rose-200',
  Kathy: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Julie: 'bg-green-100 text-green-800 border-green-200',
  Tylor: 'bg-teal-100 text-teal-800 border-teal-200',
  Jim: 'bg-amber-100 text-amber-800 border-amber-200',
  Russ: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  Donna: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  Jorge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  David: 'bg-slate-200 text-slate-800 border-slate-300',
  Default: 'bg-slate-100 text-slate-800 border-slate-200',
};

export const formatTimeAmPm = (time: string): string => {
    if (!time) return '';
    // Clean string of existing AM/PM to prevent double labels
    const cleaned = time.replace(/\s*[AP]M\s*$/i, '');
    const parts = cleaned.split(':');
    if (parts.length < 2) return time;
    
    let hour = parseInt(parts[0], 10);
    const minutes = parts[1].padStart(2, '0');
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12;
    return `${hour}:${minutes} ${ampm}`;
};
