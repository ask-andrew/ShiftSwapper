
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

interface PositionedShift extends Shift {
  top: number;
  height: number;
  lane: number;
}

const ScheduleView: React.FC<ScheduleViewProps> = ({ schedule, onSelectShift, selectedShift }) => {
  const totalHoursPerEmployee = useMemo(() => {
    if (!schedule) return [];
    const hoursMap: { [name: string]: number } = {};
    for (const day of DAYS_OF_WEEK) {
        const dayShifts = schedule[day] || [];
        for (const shift of dayShifts) {
            if (!hoursMap[shift.employeeName]) hoursMap[shift.employeeName] = 0;
            const startMinutes = timeToMinutes(shift.startTime);
            const endMinutes = timeToMinutes(shift.endTime);
            hoursMap[shift.employeeName] += (endMinutes - startMinutes) / 60;
        }
    }
    return Object.entries(hoursMap).map(([name, hours]) => ({ name, hours })).sort((a, b) => a.name.localeCompare(b.name));
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
    <div className="bg-white p-6 rounded-xl shadow-lg mt-6 col-span-1 lg:col-span-2">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-slate-700">Generated Schedule</h2>
        {schedule && (
          <p className="text-xs text-slate-500 italic">Tip: Click any shift to request a swap.</p>
        )}
      </div>
      {!schedule ? (
        <div className="flex items-center justify-center h-96 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
          <p className="text-slate-500">Generate a schedule to see results here.</p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2 text-slate-600">Weekly Hours Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {totalHoursPerEmployee.map(({ name, hours }) => (
                <div key={name} className={`p-2 rounded-lg border flex flex-col items-center justify-center ${hours < 20 ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-xs font-bold text-slate-700">{name}</span>
                  <span className={`text-sm font-mono ${hours < 20 ? 'text-orange-600 font-bold' : 'text-slate-500'}`}>{hours.toFixed(1)}h</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="relative grid grid-cols-[60px_repeat(7,1fr)] min-w-[1000px]">
              <div className="flex flex-col">
                <div className="h-[38px]">&nbsp;</div>
                {TIME_SLOTS.map(time => (
                  <div key={time} style={{ height: `${SLOT_HEIGHT_PX}px` }} className="text-[10px] font-mono text-slate-400 text-right pr-2">
                    {time.endsWith(':00') ? formatTimeAmPm(time) : ''}
                  </div>
                ))}
              </div>

              {DAYS_OF_WEEK.map(day => (
                <div key={day} className="relative border-l border-slate-200">
                  <div className="p-2 text-center font-bold text-xs text-slate-600 sticky top-0 bg-white z-10 border-b uppercase tracking-wider">{day}</div>
                  
                  {TIME_SLOTS.map((time, index) => (
                    <div key={time} style={{ height: `${SLOT_HEIGHT_PX}px` }} className={`${index % 2 === 0 ? 'border-t' : ''} ${isLibraryOpen(day, time) ? 'bg-white' : 'bg-slate-100'} border-slate-50`} />
                  ))}

                  {(positionedShiftsByDay[day] || []).map((shift, idx) => {
                    const isSelected = selectedShift?.employeeName === shift.employeeName && selectedShift?.day === shift.day && selectedShift?.startTime === shift.startTime;
                    return (
                      <button
                        key={idx}
                        onClick={() => onSelectShift?.(shift)}
                        className={`absolute rounded-md p-1.5 text-[10px] font-bold border flex flex-col justify-center transition-all group
                          ${EMPLOYEE_COLORS[shift.employeeName] || EMPLOYEE_COLORS.Default}
                          ${isSelected ? 'ring-2 ring-indigo-500 scale-[1.02] z-20 shadow-lg' : 'hover:scale-[1.01] hover:shadow-md'}`}
                        style={{
                          top: `${shift.top}px`,
                          height: `${shift.height}px`,
                          left: `${shift.lane * 50}%`,
                          width: '50%',
                          transform: 'translateY(38px)',
                        }}
                      >
                        <span className="truncate flex items-center gap-1">
                          {shift.employeeName}
                          {isSelected && <span className="w-1 h-1 bg-indigo-600 rounded-full animate-pulse"></span>}
                        </span>
                        <span className="font-normal opacity-70 truncate">{formatTimeAmPm(shift.startTime)}</span>
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
