
import React, { useState, useEffect, useMemo } from 'react';
import { EMPLOYEES, DAYS_OF_WEEK, formatTimeAmPm, LIBRARY_HOURS } from '../constants';
import type { DayOfWeek, SwapSuggestion, Rule, Shift, Schedule, SwapMode } from '../types';
import { findSwapCandidates } from '../services/geminiService';
import SparklesIcon from './icons/SparklesIcon';

interface SwapAssistantProps {
  currentRules: Rule[];
  csvContext: string;
  selectedShiftFromCalendar?: Shift | null;
  currentSchedule: Schedule | null;
}

const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const calculateNetSelectedHours = (shifts: Shift[]) => {
  if (shifts.length === 0) return 0;
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
  // Iterate via keys for better type safety than Object.values which can return unknown[] in some TS configs
  Object.keys(shiftsByDate).forEach(key => {
    const intervals = shiftsByDate[key];
    const sorted = intervals.sort((a, b) => a.start - b.start);
    const merged = [];
    let current = { ...sorted[0] };
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start <= current.end) {
        current.end = Math.max(current.end, sorted[i].end);
      } else {
        merged.push(current);
        current = { ...sorted[i] };
      }
    }
    merged.push(current);
    totalMinutes += merged.reduce((acc, interval) => acc + (interval.end - interval.start), 0);
  });
  return totalMinutes / 60;
};

const VacationCalendar: React.FC<{
  shiftsByDate: Record<string, Shift[]>;
  onSelectRange: (start: Date | null, end: Date | null) => void;
}> = ({ shiftsByDate, onSelectRange }) => {
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [viewDate, setViewDate] = useState(new Date());

  const monthName = viewDate.toLocaleString('default', { month: 'long' });
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const handleDateClick = (d: number) => {
    const clickedDate = new Date(year, month, d);
    if (!start || (start && end)) {
      setStart(clickedDate);
      setEnd(null);
      onSelectRange(clickedDate, null);
    } else if (clickedDate < start) {
      setStart(clickedDate);
      setEnd(null);
      onSelectRange(clickedDate, null);
    } else {
      setEnd(clickedDate);
      onSelectRange(start, clickedDate);
    }
  };

  const isSelected = (d: number) => {
    const date = new Date(year, month, d);
    if (start && end) return date >= start && date <= end;
    if (start) return date.getTime() === start.getTime();
    return false;
  };

  const hasShift = (d: number) => {
    const checkDate = new Date(year, month, d).toLocaleDateString();
    return Object.keys(shiftsByDate).some(k => new Date(k).toLocaleDateString() === checkDate);
  };

  const totalDays = new Date(year, month + 1, 0).getDate();
  const offset = new Date(year, month, 1).getDay();

  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm animate-pop">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-black text-slate-900 tracking-tight">{monthName} {year}</h3>
        <div className="flex gap-2">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-slate-50 rounded-xl">←</button>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-slate-50 rounded-xl">→</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <span key={d} className="text-[10px] font-black text-slate-300">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => <div key={`empty-${i}`} />)}
        {Array.from({ length: totalDays }).map((_, i) => {
          const d = i + 1;
          const shiftOnDay = hasShift(d);
          const selected = isSelected(d);
          return (
            <button key={d} onClick={() => handleDateClick(d)}
              className={`h-10 w-10 rounded-full text-[11px] font-black transition-all flex flex-col items-center justify-center relative ${selected ? 'bg-indigo-600 text-white shadow-lg scale-110 z-10' : 'hover:bg-indigo-50 text-slate-600'}`}
            >
              {d}
              {shiftOnDay && !selected && <span className="absolute bottom-1.5 w-1 h-1 bg-indigo-400 rounded-full" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const SwapAssistant: React.FC<SwapAssistantProps> = ({ currentRules, selectedShiftFromCalendar, currentSchedule }) => {
  const swappableStaff = EMPLOYEES.filter(e => e.employeeType !== 'Full-time');
  const [request, setRequest] = useState({
    name: selectedShiftFromCalendar?.employeeName || '',
    selectedShifts: [] as Shift[],
    mode: 'Trade' as SwapMode,
    isVacation: false
  });

  const [suggestions, setSuggestions] = useState<SwapSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [coveragePlan, setCoveragePlan] = useState<Record<number, string>>({});

  const allShiftsForPerson = useMemo(() => {
    if (!currentSchedule || !request.name) return [];
    const collected: Shift[] = [];
    // Iterate through DAYS_OF_WEEK to avoid issues with Object.values on Schedule type
    DAYS_OF_WEEK.forEach(day => {
      const dayShifts = currentSchedule[day];
      if (dayShifts) {
        dayShifts.forEach(s => {
          if (s.employeeName.toLowerCase() === request.name.toLowerCase()) collected.push(s);
        });
      }
    });
    return collected.sort((a, b) => (a.dateObj?.getTime() || 0) - (b.dateObj?.getTime() || 0));
  }, [currentSchedule, request.name]);

  const shiftsByDate = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    allShiftsForPerson.forEach(s => {
      const key = s.date || s.day;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [allShiftsForPerson]);

  interface ShiftGroup {
    label: string;
    date: string; // MM/DD/YYYY
    dayName: DayOfWeek;
    shifts: Shift[];
    dateObj: Date;
    originalIndices: number[]; // Indices of these shifts in request.selectedShifts
  }

  const groupedShifts = useMemo<ShiftGroup[]>(() => {
    const groups: Record<string, ShiftGroup> = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // For non-vacation mode, show *all* future shifts for the selected employee
    // For vacation mode, show only the `request.selectedShifts`
    const shiftsToGroup = request.isVacation ? request.selectedShifts : allShiftsForPerson;

    shiftsToGroup.forEach((s, idx) => {
      if (s.dateObj && s.dateObj >= today) { // Only show future shifts
        const key = s.date || s.day;
        if (!groups[key]) {
          groups[key] = {
            date: s.date || '',
            dayName: s.day,
            label: s.dateObj?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) || '',
            shifts: [],
            dateObj: s.dateObj!,
            originalIndices: []
          };
        }
        groups[key].shifts.push(s);
        // If in vacation mode, map back to request.selectedShifts index
        // Otherwise, map to allShiftsForPerson index (which is currently not used for coverage plan)
        groups[key].originalIndices.push(request.isVacation ? idx : allShiftsForPerson.indexOf(s));
      }
    });
    return Object.values(groups).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [request.selectedShifts, allShiftsForPerson, request.isVacation]);

  useEffect(() => {
    if (selectedShiftFromCalendar) {
      setRequest(prev => ({ ...prev, name: selectedShiftFromCalendar.employeeName, selectedShifts: [selectedShiftFromCalendar] }));
    }
  }, [selectedShiftFromCalendar]);

  const areShiftsEqual = (s1: Shift, s2: Shift) => {
    const key1 = s1.date || s1.day;
    const key2 = s2.date || s2.day;
    return key1 === key2 && s1.startTime === s2.startTime && s1.endTime === s2.endTime;
  };

  const toggleShift = (shift: Shift) => {
    const isSelected = request.selectedShifts.some(s => areShiftsEqual(s, shift));
    if (isSelected) {
      setRequest(prev => ({
        ...prev,
        selectedShifts: prev.selectedShifts.filter(s => !areShiftsEqual(s, shift))
      }));
    } else {
      setRequest(prev => ({
        ...prev,
        selectedShifts: [...prev.selectedShifts, shift]
      }));
    }
    setSuggestions([]);
    setProposal(null);
  };

  const selectWholeDay = (shifts: Shift[]) => {
    const allSelectedInDay = shifts.every(s => request.selectedShifts.some(rs => areShiftsEqual(rs, s)));
    if (allSelectedInDay) {
      setRequest(prev => ({
        ...prev,
        selectedShifts: prev.selectedShifts.filter(rs => !shifts.some(s => areShiftsEqual(rs, s)))
      }));
    } else {
      setRequest(prev => {
        const currentSelection = [...prev.selectedShifts];
        shifts.forEach(s => {
          if (!currentSelection.some(rs => areShiftsEqual(rs, s))) {
            currentSelection.push(s);
          }
        });
        return { ...prev, selectedShifts: currentSelection };
      });
    }
    setSuggestions([]);
    setProposal(null);
  };


  const handleSelectRange = (start: Date | null, end: Date | null) => {
    if (!start) {
      setRequest(prev => ({ ...prev, selectedShifts: [] }));
      setCoveragePlan({});
      return;
    }
    const finalEnd = end || start;
    const filtered = allShiftsForPerson.filter(s => {
      if (!s.dateObj) return false;
      const d = new Date(s.dateObj.getFullYear(), s.dateObj.getMonth(), s.dateObj.getDate());
      return d >= start && d <= finalEnd;
    });
    setRequest(prev => ({ ...prev, selectedShifts: filtered }));
    setCoveragePlan({});
    setSuggestions([]);
  };

  const handleFindSwaps = async () => {
    setLoading(true);
    setProposal(null);
    try {
      const results = await findSwapCandidates({
        name: request.name,
        shifts: request.selectedShifts,
        mode: request.isVacation ? 'Coverage' : request.mode
      }, EMPLOYEES, currentRules, currentSchedule);
      setSuggestions(results);
    } catch (e) {
      console.error(e);
      alert("Something went wrong calculating matches. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const addToPlan = (candidate: string, reason: string) => {
    const newPlan = { ...coveragePlan };
    // The reason string from AI is used to infer which shifts the candidate can cover.
    // In a real advanced implementation, the AI would return specific shift indices.
    request.selectedShifts.forEach((s, idx) => {
      const dateStr = s.dateObj?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const timeRange = `${formatTimeAmPm(s.startTime)} – ${formatTimeAmPm(s.endTime)}`;

      // Try to match based on date and time, or if the reason is very general ("all", "entire week")
      if ((dateStr && reason.includes(dateStr) && reason.includes(timeRange.split(' ')[0])) || reason.toLowerCase().includes("all shifts") || reason.toLowerCase().includes("entire week")) {
        newPlan[idx] = candidate;
      } else if (reason.toLowerCase().includes(dateStr?.toLowerCase() || '')) {
        // Fallback: if reason mentions the date, assign it
        newPlan[idx] = candidate;
      }
    });
    setCoveragePlan(newPlan);
  };

  const handleProposePlan = () => {
    const assignments: Record<string, string[]> = {};
    (Object.entries(coveragePlan) as [string, string][]).forEach(([idx, name]) => {
      const s = request.selectedShifts[parseInt(idx)];
      if (!assignments[name]) assignments[name] = [];
      assignments[name].push(`${s.dateObj?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${formatTimeAmPm(s.startTime)} – ${formatTimeAmPm(s.endTime)})`);
    });

    const msgs = Object.entries(assignments).map(([name, shifts]) => 
      `Hi ${name}, would you be able to cover these shifts while I'm away? ${shifts.join(' and ')}. Booker says this works well with your hours! Thanks.`
    );
    setProposal(msgs.join('\n\n---\n\n'));
    navigator.clipboard.writeText(msgs.join('\n\n'));
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const totalSelectedHours = useMemo(() => calculateNetSelectedHours(request.selectedShifts), [request.selectedShifts]);
  const coveredCount = Object.keys(coveragePlan).length;
  const totalCount = request.selectedShifts.length;
  const coveragePercent = totalCount > 0 ? (coveredCount / totalCount) * 100 : 0;

  return (
    <div className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-2xl mt-6 border border-slate-100 max-w-5xl mx-auto overflow-hidden pb-32 relative min-h-[700px] animate-pop">
      <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none rotate-12">
        <SparklesIcon className="w-64 h-64 text-indigo-600" />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 relative z-10">
        <div className="flex items-center gap-6">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-1 flex items-center gap-3">Concierge <span className="animate-float">✨</span></h2>
            <p className="text-slate-400 font-bold italic text-sm">Design your perfect shift swap.</p>
          </div>
          <div className="h-12 w-px bg-slate-100 hidden md:block" />
          <button onClick={() => setRequest(prev => ({ ...prev, isVacation: !prev.isVacation, selectedShifts: [], mode: 'Coverage' }))}
             className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${request.isVacation ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-white border border-slate-100'}`}
          >
             <span className="text-sm">{request.isVacation ? '🌴' : '📅'}</span> Vacation Mode
          </button>
        </div>
        
        {!request.isVacation && (
          <div className="flex p-1.5 bg-slate-50 rounded-[1.5rem] w-full md:w-auto border border-slate-100 shadow-inner">
            <button onClick={() => setRequest({...request, mode: 'Trade'})} className={`flex-1 md:flex-none px-10 py-3.5 rounded-2xl text-xs font-black tracking-widest transition-all ${request.mode === 'Trade' ? 'bg-white text-indigo-600 shadow-xl border border-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}>TRADE</button>
            <button onClick={() => setRequest({...request, mode: 'Coverage'})} className={`flex-1 md:flex-none px-10 py-3.5 rounded-2xl text-xs font-black tracking-widest transition-all ${request.mode === 'Coverage' ? 'bg-white text-blue-600 shadow-xl border border-blue-100' : 'text-slate-400 hover:text-slate-600'}`}>COVERAGE</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
        <div className="lg:col-span-6 space-y-10">
          <section>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-5">1. Select Staff</label>
            <div className="grid grid-cols-3 gap-2.5">
              {swappableStaff.map(e => (
                <button key={e.id} onClick={() => { setRequest({...request, name: e.name, selectedShifts: []}); setSuggestions([]); setCoveragePlan({}); }}
                  className={`py-3.5 text-xs font-black rounded-2xl border-2 transition-all ${request.name === e.name ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xl' : 'bg-white text-slate-500 border-slate-50 hover:border-indigo-100'}`}
                >
                  {e.name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-end mb-5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">2. {request.isVacation ? 'Select Leave Range' : 'Select Work Blocks'}</label>
              {request.selectedShifts.length > 0 && (
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                  {request.isVacation ? `${coveredCount}/${totalCount} Covered` : `${totalSelectedHours.toFixed(1)}h Impact`}
                </span>
              )}
            </div>
            
            {request.name ? (
              request.isVacation ? (
                <div className="space-y-6">
                  <VacationCalendar shiftsByDate={shiftsByDate} onSelectRange={handleSelectRange} />
                  {request.selectedShifts.length > 0 && (
                    <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar">
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-2">
                        <div className="bg-indigo-500 h-full transition-all duration-700" style={{ width: `${coveragePercent}%` }} />
                      </div>
                      {groupedShifts.map((group, gIdx) => (
                        <div key={gIdx} className="space-y-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{group.label}</span>
                          {group.shifts.map((s, sIdx) => {
                            const originalIdx = group.originalIndices[sIdx];
                            const assigned = coveragePlan[originalIdx];
                            return (
                              <div key={sIdx} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${assigned ? 'bg-emerald-50 border-emerald-100 shadow-sm' : 'bg-white border-slate-200 shadow-xs'}`}>
                                <span className="text-[11px] font-bold text-slate-700">{formatTimeAmPm(s.startTime)} – {formatTimeAmPm(s.endTime)}</span>
                                {assigned ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tight">Covered by {assigned}</span>
                                    <button onClick={() => { const p = {...coveragePlan}; delete p[originalIdx]; setCoveragePlan(p); }} className="text-slate-300 hover:text-red-400 transition-colors">✕</button>
                                  </div>
                                ) : (
                                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest animate-pulse">Needs Help</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : ( // Non-vacation mode: show upcoming shifts for selection
                <div className="space-y-4 max-h-[550px] overflow-y-auto pr-3 custom-scrollbar">
                  {groupedShifts.map((group, groupIdx) => {
                    const allInDaySelected = group.shifts.every(s => request.selectedShifts.some(rs => areShiftsEqual(rs, s)));
                    const libHours = LIBRARY_HOURS[group.dayName] || { open: 9, close: 21 };
                    const totalRange = (libHours.close - libHours.open) * 60;

                    return (
                      <div key={groupIdx} className="bg-[#FBFBFC] p-6 rounded-[2.5rem] border border-slate-100 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-100 group">
                        <div className="flex justify-between items-center mb-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-slate-900 tracking-tight">{group.label}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{group.dayName}</span>
                          </div>
                          <button 
                            onClick={() => selectWholeDay(group.shifts)}
                            className={`text-[9px] font-black uppercase px-4 py-2 rounded-xl transition-all ${allInDaySelected ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100 hover:text-indigo-600 shadow-sm'}`}
                          >
                            {allInDaySelected ? 'Deselect Day' : 'Select Day'}
                          </button>
                        </div>

                        <div className="relative h-14 bg-slate-100/50 rounded-2xl mb-4 p-1 overflow-hidden">
                          <div className="absolute inset-0 flex justify-between px-4 items-center pointer-events-none opacity-20">
                            <span className="text-[8px] font-black">{libHours.open} AM</span>
                            <span className="text-[8px] font-black">{libHours.close > 12 ? libHours.close - 12 : libHours.close} {libHours.close >= 12 ? 'PM' : 'AM'}</span>
                          </div>
                          {group.shifts.map((s, idx) => {
                            const startMin = timeToMinutes(s.startTime);
                            const endMin = timeToMinutes(s.endTime);
                            const left = ((startMin - libHours.open * 60) / totalRange) * 100;
                            const width = ((endMin - startMin) / totalRange) * 100;
                            const isSelected = request.selectedShifts.some(rs => areShiftsEqual(rs, s));
                            return (
                              <button key={idx} onClick={(e) => { e.stopPropagation(); toggleShift(s); }} style={{ left: `${left}%`, width: `${width}%` }}
                                className={`absolute top-1 bottom-1 rounded-xl transition-all duration-300 z-10 border-2 ${isSelected ? 'bg-slate-900 border-slate-800 shadow-lg scale-y-105 z-20' : 'bg-white border-slate-200 hover:border-indigo-400 hover:z-20'}`}
                              >
                                <div className={`w-full h-full flex flex-col items-center justify-center overflow-hidden px-1 ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                  <span className="text-[8px] font-black leading-none truncate">{formatTimeAmPm(s.startTime).split(' ')[0]}</span>
                                  <span className="text-[8px] font-black leading-none truncate opacity-50">–</span>
                                  <span className="text-[8px] font-black leading-none truncate">{formatTimeAmPm(s.endTime).split(' ')[0]}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : <div className="p-12 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-center text-slate-400 italic">Select your name above.</div>}
          </section>

          <button onClick={handleFindSwaps} disabled={loading || request.selectedShifts.length === 0}
            className="w-full bg-indigo-600 text-white font-black py-6 rounded-[2rem] hover:bg-indigo-700 transition-all flex items-center justify-center gap-4 disabled:bg-slate-100 shadow-[0_24px_48px_-12px_rgba(79,70,229,0.3)]"
          >
            {loading ? "Matching Team Availability..." : <><SparklesIcon className="w-6 h-6" /> {request.isVacation ? 'Find Best Coverage Team' : 'Find My Match'}</>}
          </button>
        </div>

        <div className="lg:col-span-6">
           {!suggestions.length && !loading && (
             <div className="h-full flex flex-col items-center justify-center bg-[#FBFBFC] rounded-[3.5rem] border-2 border-dashed border-slate-100 p-16 text-center">
               <span className="text-6xl mb-8 animate-float">{request.isVacation ? '🌴' : '🦉'}</span>
               <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tighter">{request.isVacation ? 'Your Leave Concierge' : 'Booker is waiting!'}</h3>
               <p className="text-sm text-slate-400 max-w-xs font-medium leading-relaxed italic">
                 {request.isVacation ? "Select your leave range. I'll identify the best combination of Subs and colleagues to protect your weekly hours." : "Select your shifts on the left. I'll search for trades that respect everyone's hour caps!"}
               </p>
             </div>
           )}

           {loading && (
             <div className="h-full space-y-6">
               {[1,2,3,4].map(i => <div key={i} className="h-40 bg-slate-50 rounded-[3rem] animate-pulse" />)}
             </div>
           )}

           {suggestions.length > 0 && !loading && (
             <div className="space-y-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] px-3">Potential Coverage Partners</h3>
                {suggestions.map((s, i) => (
                  <div key={i} className="group bg-white border border-slate-100 rounded-[3rem] p-7 shadow-sm hover:shadow-2xl transition-all duration-500 animate-pop">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-50 flex items-center justify-center text-2xl font-black text-indigo-500">{s.candidateName[0]}</div>
                        <div>
                          <h4 className="text-xl font-black text-slate-900 tracking-tight">{s.candidateName}</h4>
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-xl uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100">Ready to Assist</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">Impact: {s.projectedHours}h</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 font-medium mb-7 italic border-l-4 border-indigo-100 pl-4">"{s.reason}"</p>
                    <button onClick={() => addToPlan(s.candidateName, s.reason)} className="w-full py-4.5 bg-slate-900 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-2">
                      {request.isVacation ? 'Assign to Shifts' : 'Propose this Swap'}
                    </button>
                  </div>
                ))}
                
                {coveredCount > 0 && (
                  <button onClick={handleProposePlan} className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-2xl transition-all animate-pop">
                    Assemble Message Draft ({coveredCount}/{totalCount})
                  </button>
                )}
             </div>
           )}
        </div>
      </div>

      {proposal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
           <div className="bg-slate-900 text-white w-full max-w-2xl p-10 rounded-[4rem] shadow-2xl border border-white/10 animate-pop relative">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <span className="text-4xl">🦉</span>
                  <h3 className="text-sm font-black uppercase tracking-[0.25em] text-indigo-400">Readly's Coverage Plan</h3>
                </div>
                <button onClick={() => setProposal(null)} className="p-3 text-slate-500 hover:text-white bg-white/5 rounded-full transition-colors">✕</button>
              </div>
              <div className="bg-white/5 p-8 rounded-[3rem] border border-white/5 mb-10 overflow-y-auto max-h-[400px] custom-scrollbar">
                <p className="text-base font-bold leading-relaxed text-slate-100 italic whitespace-pre-line leading-relaxed">"{proposal}"</p>
              </div>
              <div className="flex gap-4">
                <button onClick={() => { navigator.clipboard.writeText(proposal); setCopyFeedback(true); setTimeout(() => setCopyFeedback(false), 2000); }}
                  className="flex-1 bg-white text-slate-900 py-6 rounded-[2rem] text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition active:scale-95 shadow-xl"
                >
                  {copyFeedback ? "Copied All! 🎉" : "Copy All to Clipboard"}
                </button>
                <button onClick={() => setProposal(null)} className="px-12 bg-white/10 text-slate-300 py-6 rounded-[2rem] text-xs font-black uppercase tracking-widest hover:bg-white/20 transition">Dismiss</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default SwapAssistant;
