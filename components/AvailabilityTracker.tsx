
import React, { useState, useMemo, useRef, useCallback } from 'react';
import type { DayOfWeek, Unavailability } from '../types';
import { DAYS_OF_WEEK, TIME_SLOTS, EMPLOYEES, isLibraryOpen, formatTimeAmPm } from '../constants';

interface UnavailabilityTrackerProps {
  unavailability: Unavailability[];
  onUpdateUnavailability: (employeeId: number, day: DayOfWeek, time: string) => void;
  onSetDayUnavailability: (employeeId: number, day: DayOfWeek, shouldBeUnavailable: boolean) => void;
}

type Mode = 'unavailable' | 'available';

const AvailabilityTracker: React.FC<UnavailabilityTrackerProps> = ({ unavailability, onUpdateUnavailability, onSetDayUnavailability }) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number>(EMPLOYEES[0].id);
  const [mode, setMode] = useState<Mode>('unavailable');
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartSlot, setDragStartSlot] = useState<{day: DayOfWeek, time: string} | null>(null);
  const [draggedSlots, setDraggedSlots] = useState<Set<string>>(new Set());
  const initialDragState = useRef<boolean | null>(null);

  const selectedEmployeeUnavailability = useMemo(() => {
    return unavailability.find(a => a.employeeId === selectedEmployeeId)?.slots || [];
  }, [unavailability, selectedEmployeeId]);

  const isSlotUnavailable = useCallback((day: DayOfWeek, time:string) => {
    return selectedEmployeeUnavailability.some(slot => slot.day === day && slot.time === time);
  },[selectedEmployeeUnavailability]);
  
  const getSlotIdentifier = (day: DayOfWeek, time: string) => `${day}-${time}`;

  const handleMouseDown = (day: DayOfWeek, time: string) => {
    if (!isLibraryOpen(day, time)) return;
    setIsDragging(true);
    setDragStartSlot({day, time});
    const isUnavailable = isSlotUnavailable(day, time);
    const targetState = mode === 'unavailable' ? !isUnavailable : isUnavailable;
    initialDragState.current = targetState;
    const slotId = getSlotIdentifier(day, time);
    setDraggedSlots(new Set([slotId]));
  };

  const handleMouseEnter = (day: DayOfWeek, time: string) => {
    if (!isDragging || !dragStartSlot || !isLibraryOpen(day, time)) return;
    
    const newDraggedSlots = new Set<string>();
    const startIndex = TIME_SLOTS.indexOf(dragStartSlot.time);
    const endIndex = TIME_SLOTS.indexOf(time);
    const dayIndexStart = DAYS_OF_WEEK.indexOf(dragStartSlot.day);
    const dayIndexEnd = DAYS_OF_WEEK.indexOf(day);

    const minDay = Math.min(dayIndexStart, dayIndexEnd);
    const maxDay = Math.max(dayIndexStart, dayIndexEnd);
    const minTime = Math.min(startIndex, endIndex);
    const maxTime = Math.max(startIndex, endIndex);

    for(let d = minDay; d <= maxDay; d++) {
        for(let t = minTime; t <= maxTime; t++) {
           const currentDay = DAYS_OF_WEEK[d];
           const currentTime = TIME_SLOTS[t];
           if(isLibraryOpen(currentDay, currentTime)){
              newDraggedSlots.add(getSlotIdentifier(currentDay, currentTime));
           }
        }
    }
    setDraggedSlots(newDraggedSlots);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    
    draggedSlots.forEach(slotId => {
        const [day, time] = slotId.split('-') as [DayOfWeek, string];
        const isCurrentlyUnavailable = isSlotUnavailable(day, time);
        const shouldBeUnavailable = initialDragState.current ?? false;
        
        if (isCurrentlyUnavailable !== shouldBeUnavailable) {
            onUpdateUnavailability(selectedEmployeeId, day, time);
        }
    });

    setIsDragging(false);
    setDragStartSlot(null);
    setDraggedSlots(new Set());
    initialDragState.current = null;
  };
  
  const handleDayHeaderClick = (day: DayOfWeek) => {
    const openSlotsForDay = TIME_SLOTS.filter(time => isLibraryOpen(day, time));
    const unavailableSlotsForDay = selectedEmployeeUnavailability.filter(slot => slot.day === day);

    let shouldBeUnavailable: boolean;
    if (mode === 'unavailable') {
      // If not all slots are unavailable, make them all unavailable. Otherwise, clear them.
      shouldBeUnavailable = unavailableSlotsForDay.length < openSlotsForDay.length;
    } else { // mode === 'available'
      // If any slot is unavailable, make them all available (not unavailable). Otherwise, make them all unavailable.
      shouldBeUnavailable = unavailableSlotsForDay.length > 0;
    }
    onSetDayUnavailability(selectedEmployeeId, day, shouldBeUnavailable);
  };


  const getSlotClasses = (day: DayOfWeek, time: string) => {
    const isOpen = isLibraryOpen(day, time);
    if (!isOpen) return 'bg-slate-200 cursor-not-allowed';

    const isSlotCurrentlyUnavailable = isSlotUnavailable(day, time);
    const isDragged = draggedSlots.has(getSlotIdentifier(day, time));
    const dragShouldMakeUnavailable = initialDragState.current;

    let baseClass = 'bg-white';
    const hoverClass = mode === 'unavailable' ? 'hover:bg-red-100' : 'hover:bg-green-100';

    if(isDragged) {
      baseClass = dragShouldMakeUnavailable ? 'bg-red-300' : 'bg-green-300';
    } else if (mode === 'unavailable') {
      if (isSlotCurrentlyUnavailable) baseClass = 'bg-red-400';
    } else { // mode === 'available'
      if (!isSlotCurrentlyUnavailable) baseClass = 'bg-green-400';
    }
    
    return `${baseClass} ${hoverClass} cursor-pointer transition-colors`;
  };

  const instructions = {
    unavailable: <>Click or drag on time slots to mark when an employee <span className="font-bold text-red-600">CANNOT</span> work.</>,
    available: <>Click or drag on time slots to mark when an employee <span className="font-bold text-green-600">CAN</span> work.</>
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg mt-6" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <h2 className="text-xl font-bold mb-2 text-slate-700">Employee Availability</h2>
      
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-slate-500 flex-1 pr-4">{instructions[mode]}</p>
        <div className="flex rounded-lg bg-slate-100 p-1">
          <button 
            onClick={() => setMode('unavailable')} 
            className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${mode === 'unavailable' ? 'bg-white text-red-600 shadow' : 'bg-transparent text-slate-600'}`}
          >
            Unavailable
          </button>
          <button 
            onClick={() => setMode('available')} 
            className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${mode === 'available' ? 'bg-white text-green-600 shadow' : 'bg-transparent text-slate-600'}`}
          >
            Available
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="employee-select" className="block text-sm font-medium text-slate-600 mb-1">
          Select Employee:
        </label>
        <select
          id="employee-select"
          value={selectedEmployeeId}
          onChange={(e) => setSelectedEmployeeId(Number(e.target.value))}
          className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          {EMPLOYEES.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name} ({employee.employeeType})
            </option>
          ))}
        </select>
      </div>
      
      <div className="overflow-x-auto max-h-[500px] select-none">
        <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-px bg-slate-200 border border-slate-200">
          <div className="bg-slate-100 p-2 font-semibold text-sm text-slate-600 sticky top-0 z-10">Time</div>
          {DAYS_OF_WEEK.map(day => (
            <div key={day} className="bg-slate-100 p-2 text-center font-semibold text-sm text-slate-600 sticky top-0 z-10">
              <button onClick={() => handleDayHeaderClick(day)} className="hover:text-indigo-600 w-full" title={`Toggle all slots for ${day}`}>{day.substring(0,3)}</button>
            </div>
          ))}

          {TIME_SLOTS.map(time => (
            <React.Fragment key={time}>
              <div className="bg-slate-100 p-2 text-xs font-mono text-slate-500 text-right">{formatTimeAmPm(time)}</div>
              {DAYS_OF_WEEK.map(day => (
                  <div 
                    key={`${day}-${time}`}
                    onMouseDown={() => handleMouseDown(day, time)}
                    onMouseEnter={() => handleMouseEnter(day, time)}
                    className={`p-2 h-6 ${getSlotClasses(day, time)}`}
                    aria-label={`Slot for ${day} at ${time}`}
                  >
                  </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AvailabilityTracker;
