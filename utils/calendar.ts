
import * as ics from 'ics';
import type { Schedule, DayOfWeek } from '../types';
import { DAYS_OF_WEEK } from '../constants';

const DAY_ORDER_MAP: Record<DayOfWeek, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};


const getNextDateForDay = (dayOfWeek: DayOfWeek): Date => {
  const targetDayNumber = DAY_ORDER_MAP[dayOfWeek];
  const today = new Date();
  const currentDayNumber = today.getDay() === 0 ? 7 : today.getDay(); // Make Sunday 7
  
  const daysToAdd = targetDayNumber >= currentDayNumber 
    ? targetDayNumber - currentDayNumber 
    : 7 - (currentDayNumber - targetDayNumber);

  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysToAdd);
  return nextDate;
};


export const exportScheduleToIcs = (schedule: Schedule) => {
  const events: ics.EventAttributes[] = [];

  for (const day of DAYS_OF_WEEK) {
    const shifts = schedule[day];
    if (!shifts || shifts.length === 0) continue;

    const shiftDate = getNextDateForDay(day);
    const year = shiftDate.getFullYear();
    const month = shiftDate.getMonth() + 1;
    const date = shiftDate.getDate();

    for (const shift of shifts) {
      const [startHour, startMinute] = shift.startTime.split(':').map(Number);
      const [endHour, endMinute] = shift.endTime.split(':').map(Number);

      events.push({
        title: `Library Shift: ${shift.employeeName}`,
        start: [year, month, date, startHour, startMinute],
        end: [year, month, date, endHour, endMinute],
        description: `Shift for ${shift.employeeName} from ${shift.startTime} to ${shift.endTime}.`,
        location: 'Local Library',
      });
    }
  }

  const { error, value } = ics.createEvents(events);

  if (error) {
    console.error("Error creating ICS file:", error);
    alert("Could not create calendar file due to an error.");
    return;
  }

  if (value) {
    const blob = new Blob([value], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'library-schedule.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }
};
