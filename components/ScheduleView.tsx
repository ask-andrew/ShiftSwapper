
import React, { useMemo } from 'react';
import type { Schedule, DayOfWeek, Shift } from '../types';
import { DAYS_OF_WEEK, TIME_SLOTS, EMPLOYEE_COLORS, isLibraryOpen, formatTimeAmPm } from '../constants';

interface ScheduleViewProps {
  schedule: Schedule | null;
  onSelectShift?: (shift: Shift) => void;
  selectedShift?: Shift | null;
}

const SLOT_HEIGHT_PX = 20;

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTimeIndex = (minutes: number) => {
  const startMinutes = timeToMinutes(TIME_SLOTS[0]);
  return (minutes - startMinutes) / 30;
};

/**
 * Merges overlapping or contiguous time intervals to calculate actual worked hours.
 * Prevents double-counting during shift handoffs or lunch overlaps.
 */
const calculateNetHours = (shifts: Shift[]) => {
  if (shifts.length === 0) return 0;
  
  // Group by specific date string or day name to merge intervals per work session
  const shiftsByDate: Record<string, {start: number, end: number}[]> = {};
  
  shifts.forEach(s => {
    const key = s.date || s.day;
    if (!shiftsByDate[key]) shiftsByDate[key] = [];
    shiftsByDate[key].push({
      start: timeToMinutes(s.startTime),
      end: timeToMinutes(s.endTime)
    });
  });

  let totalMinutes = 0;

  Object.values(shiftsByDate).forEach(dayIntervals => {
    // Sort intervals by start time
    const sorted = dayIntervals.sort((a, b) => a.start - b.start);
    const merged = [];
    if (sorted.length === 0) return;

    let current = { ...sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      // If next interval starts before or at the end of current
      if (next.start <= current.end) {
        current.end = Math.max(current.end, next.end);
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);
    
    totalMinutes += merged.reduce((acc, interval) => acc + (interval.end - interval.start), 0);
  });

  return totalMinutes / 60;
};

interface PositionedShift extends Shift {
  top: number;
  height: number;
  lane: number;
}

const ScheduleView: React.FC<ScheduleViewProps> = ({ schedule, onSelectShift, selectedShift }) => {
  const totalHoursPerEmployee = useMemo(() => {
    if (!schedule) return [];
    
    const employeeShifts: Record<string, Shift[]> = {};
    
    for (const day of DAYS_OF_WEEK) {
        const dayShifts = schedule[day] || [];
        for (const shift of dayShifts) {
            if (!employeeShifts[shift.employeeName]) employeeShifts[shift.employeeName] = [];
            employeeShifts[shift.employeeName].push(shift);
        }
    }

    return Object.entries(employeeShifts).map(([name, shifts]) => ({
      name,
      hours: calculateNetHours(shifts)
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [schedule]);

  const positionedShiftsByDay = useMemo(() => {
    if (!schedule) return {};
    const result: Partial<Record<DayOfWeek, PositionedShift[]>> = {};
    for (const day of DAYS_OF_WEEK) {
      const dayShifts = schedule[day] || [];
      const sortedShifts = [...dayShifts].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      const positionedShifts: PositionedShift[] = [];
      const lanes: number[] = [0, 0];
      for (const shift of sortedShifts) {
        const startMinutes = timeToMinutes(shift.startTime);
        const endMinutes = timeToMinutes(shift.endTime);
        let assignedLane = -1;
        for (let i = 0; i < lanes.length; i++) {
          if (lanes[i] <= startMinutes) { assignedLane = i; break; }
        }
        if (assignedLane === -1) assignedLane = 0;
        lanes[assignedLane] = endMinutes;
        positionedShifts.push({
          ...shift,
          top: minutesToTimeIndex(startMinutes) * SLOT_HEIGHT_PX,
          height: ((endMinutes - startMinutes) / 30) * SLOT_HEIGHT_PX,
          lane: assignedLane,
        });
      }
      result[day] = positionedShifts;
    }
    return result;
  }, [schedule]);

  return (
    <div className="bg-white p-8 rounded-[3rem] shadow-xl mt-6 col-span-1 lg:col-span-2 border border-slate-100 animate-pop">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Active Schedule</h2>
        {schedule && (
          <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100">
             <span className="animate-float">📚</span>
             <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Select any shift to swap</p>
          </div>
        )}
      </div>
      {!schedule ? (
        <div className="flex flex-col items-center justify-center h-96 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
          <span className="text-5xl mb-4 opacity-20">📅</span>
          <p className="text-slate-400 font-bold italic">No schedule generated yet.</p>
        </div>
      ) : (
        <>
          <div className="mb-10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-4">True Weekly Totals</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {totalHoursPerEmployee.map(({ name, hours }) => (
                <div key={name} className={`p-4 rounded-[1.5rem] border transition-all hover:shadow-lg ${hours < 20 ? 'bg-orange-50 border-orange-100 shadow-orange-50' : 'bg-white border-slate-100 shadow-slate-50'}`}>
                  <span className="block text-[10px] font-black text-slate-400 uppercase mb-1 truncate">{name}</span>
                  <span className={`text-lg font-black tracking-tight ${hours < 20 ? 'text-orange-600' : 'text-slate-900'}`}>{hours.toFixed(1)}h</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar pb-4">
            <div className="relative grid grid-cols-[70px_repeat(7,1fr)] min-w-[1100px]">
              <div className="flex flex-col">
                <div className="h-[50px] border-b border-transparent">&nbsp;</div>
                {TIME_SLOTS.map(time => (
                  <div key={time} style={{ height: `${SLOT_HEIGHT_PX}px` }} className="text-[9px] font-black text-slate-300 text-right pr-3 leading-none pt-1">
                    {time.endsWith(':00') ? formatTimeAmPm(time) : ''}
                  </div>
                ))}
              </div>

              {DAYS_OF_WEEK.map(day => (
                <div key={day} className="relative border-l border-slate-100">
                  <div className="h-[50px] p-2 text-center font-black text-[10px] text-slate-400 sticky top-0 bg-white z-10 border-b border-slate-50 uppercase tracking-[0.2em] flex items-center justify-center">{day}</div>
                  
                  {TIME_SLOTS.map((time, index) => (
                    <div key={time} style={{ height: `${SLOT_HEIGHT_PX}px` }} className={`${index % 2 === 0 ? 'border-t border-slate-50' : ''} ${isLibraryOpen(day, time) ? 'bg-white' : 'bg-slate-50/50'} `} />
                  ))}

                  {(positionedShiftsByDay[day] || []).map((shift, idx) => {
                    const isSelected = selectedShift?.employeeName === shift.employeeName && selectedShift?.day === shift.day && selectedShift?.startTime === shift.startTime;
                    return (
                      <button
                        key={idx}
                        onClick={() => onSelectShift?.(shift)}
                        className={`absolute rounded-xl p-2 text-[10px] font-black border flex flex-col justify-start transition-all duration-300 overflow-hidden group
                          ${EMPLOYEE_COLORS[shift.employeeName] || EMPLOYEE_COLORS.Default}
                          ${isSelected ? 'ring-4 ring-indigo-500/20 scale-[1.05] z-30 shadow-2xl border-indigo-400' : 'hover:scale-[1.02] hover:shadow-xl hover:z-20 border-white/50 shadow-md'}`}
                        style={{
                          top: `${shift.top}px`,
                          height: `${shift.height}px`,
                          left: `${shift.lane * 50}%`,
                          width: '50%',
                          transform: 'translateY(50px)',
                        }}
                      >
                        <span className="truncate flex items-center gap-1 uppercase tracking-tight mb-0.5">
                          {shift.employeeName}
                          {isSelected && <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse shadow-sm"></span>}
                        </span>
                        <span className="font-bold opacity-60 truncate text-[9px]">{formatTimeAmPm(shift.startTime)} – {formatTimeAmPm(shift.endTime)}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ScheduleView;
