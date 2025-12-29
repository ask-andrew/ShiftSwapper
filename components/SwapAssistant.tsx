
import React, { useState, useEffect, useMemo } from 'react';
import { EMPLOYEES, DAYS_OF_WEEK, formatTimeAmPm, MIN_PT_HOURS, LIBRARY_HOURS } from '../constants';
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

/**
 * Calculates net hours for selected shifts, merging overlaps.
 */
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
  Object.values(shiftsByDate).forEach(intervals => {
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

const SwapAssistant: React.FC<SwapAssistantProps> = ({ currentRules, csvContext, selectedShiftFromCalendar, currentSchedule }) => {
  const swappableStaff = EMPLOYEES.filter(e => e.employeeType !== 'Full-time');
  
  const [request, setRequest] = useState({
    name: selectedShiftFromCalendar?.employeeName || '',
    selectedShifts: [] as Shift[],
    mode: 'Trade' as SwapMode
  });

  const [suggestions, setSuggestions] = useState<SwapSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Define an interface for the grouped shifts to ensure correct typing.
  interface ShiftGroup {
    label: string;
    date: string;
    dayName: DayOfWeek;
    shifts: Shift[];
  }

  const groupedShifts = useMemo<ShiftGroup[]>(() => {
    if (!currentSchedule || !request.name) return [];
    const groups: Record<string, ShiftGroup> = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    DAYS_OF_WEEK.forEach(day => {
      const dayShifts = currentSchedule[day];
      dayShifts?.forEach(s => {
        if (s.employeeName.toLowerCase() === request.name.toLowerCase()) {
          if (s.dateObj && s.dateObj >= today) {
            const key = s.date || s.day;
            if (!groups[key]) {
              groups[key] = {
                date: s.date || '',
                dayName: day,
                label: s.dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                shifts: []
              };
            }
            groups[key].shifts.push(s);
          }
        }
      });
    });

    return Object.values(groups).sort((a, b) => {
      const dateA = a.shifts[0].dateObj?.getTime() || 0;
      const dateB = b.shifts[0].dateObj?.getTime() || 0;
      return dateA - dateB;
    });
  }, [currentSchedule, request.name]);

  useEffect(() => {
    if (selectedShiftFromCalendar) {
      setRequest(prev => ({
        ...prev,
        name: selectedShiftFromCalendar.employeeName,
        selectedShifts: [selectedShiftFromCalendar]
      }));
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
    const allSelected = shifts.every(s => request.selectedShifts.some(rs => areShiftsEqual(rs, s)));
    
    if (allSelected) {
      // DESELECT ALL IN THIS GROUP
      setRequest(prev => ({
        ...prev,
        selectedShifts: prev.selectedShifts.filter(rs => !shifts.some(s => areShiftsEqual(rs, s)))
      }));
    } else {
      // SELECT ALL IN THIS GROUP
      setRequest(prev => {
        const existing = [...prev.selectedShifts];
        shifts.forEach(s => {
          if (!existing.some(rs => areShiftsEqual(rs, s))) {
            existing.push(s);
          }
        });
        return { ...prev, selectedShifts: existing };
      });
    }
    setSuggestions([]);
    setProposal(null);
  };

  const handleFindSwaps = async () => {
    setLoading(true);
    setProposal(null);
    try {
      const results = await findSwapCandidates({
        name: request.name,
        shifts: request.selectedShifts,
        mode: request.mode
      }, EMPLOYEES, currentRules, currentSchedule);
      setSuggestions(results);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePropose = (s: SwapSuggestion) => {
    const shiftsLabel = request.selectedShifts.map(rs => {
      const formattedDate = rs.date ? new Date(rs.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : rs.day;
      return `${formattedDate} (${formatTimeAmPm(rs.startTime)} – ${formatTimeAmPm(rs.endTime)})`;
    }).join(' and ');

    const cleanedTradeShift = s.tradeShift?.replace(/([01]?[0-9]|2[0-3]):([0-5][0-9])\s*-\s*([01]?[0-9]|2[0-3]):([0-5][0-9])/g, (match, h1, m1, h2, m2) => {
      return `${formatTimeAmPm(`${h1}:${m1}`)} – ${formatTimeAmPm(`${h2}:${m2}`)}`;
    });

    const tradeTemplates = [
      `Hi ${s.candidateName}, I'm looking for a trade for my shifts on ${shiftsLabel}. Would you be open to swapping them for your ${cleanedTradeShift}? It keeps our weekly totals balanced according to the concierge. Let me know!`,
      `Hey ${s.candidateName}! Are you interested in a shift swap? I have ${shiftsLabel} and noticed you have ${cleanedTradeShift}. If we trade, our hours stay pretty consistent. What do you think?`,
      `Hi ${s.candidateName}, I was wondering if you'd like to trade your ${cleanedTradeShift} for my ${shiftsLabel}? Booker the Owl suggested this as a balanced swap for us both! Thanks.`
    ];

    const coverageTemplates = [
      `Hi ${s.candidateName}, would you be able to cover my ${shiftsLabel}? It looks like you have some room in your hours this week according to the concierge. No worries if not!`,
      `Hey ${s.candidateName}, I'm looking for coverage on ${shiftsLabel}. Would you be interested in picking these up? Thanks a lot!`,
      `Hi ${s.candidateName}! Booker indicates you might have space to take my ${shiftsLabel}. Are you looking for extra hours this week? Let me know!`
    ];

    const templatePool = request.mode === 'Trade' ? tradeTemplates : coverageTemplates;
    const text = templatePool[Math.floor(Math.random() * templatePool.length)];
    
    setProposal(text);
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const totalSelectedHours = useMemo(() => calculateNetSelectedHours(request.selectedShifts), [request.selectedShifts]);

  return (
    <div className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-2xl mt-6 border border-slate-100 max-w-5xl mx-auto overflow-hidden pb-32 relative min-h-[700px] animate-pop">
      <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none rotate-12">
        <SparklesIcon className="w-64 h-64 text-indigo-600" />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 relative z-10">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-1 flex items-center gap-3">
            Concierge
            <span className="animate-float">✨</span>
          </h2>
          <p className="text-slate-400 font-bold italic text-sm">Smart matching for the library team.</p>
        </div>
        <div className="flex p-1.5 bg-slate-50 rounded-[1.5rem] w-full md:w-auto border border-slate-100 shadow-inner">
          <button 
            onClick={() => setRequest({...request, mode: 'Trade'})}
            className={`flex-1 md:flex-none px-10 py-3.5 rounded-2xl text-xs font-black tracking-widest transition-all ${request.mode === 'Trade' ? 'bg-white text-indigo-600 shadow-xl border border-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            TRADE
          </button>
          <button 
            onClick={() => setRequest({...request, mode: 'Coverage'})}
            className={`flex-1 md:flex-none px-10 py-3.5 rounded-2xl text-xs font-black tracking-widest transition-all ${request.mode === 'Coverage' ? 'bg-white text-blue-600 shadow-xl border border-blue-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            COVERAGE
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
        <div className="lg:col-span-6 space-y-10">
          <section className="animate-pop" style={{ animationDelay: '0.1s' }}>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-5">1. Who are you?</label>
            <div className="grid grid-cols-3 gap-2.5">
              {swappableStaff.map(e => (
                <button
                  key={e.id}
                  onClick={() => {
                    setRequest({...request, name: e.name, selectedShifts: []});
                    setSuggestions([]);
                    setProposal(null);
                  }}
                  className={`py-3.5 text-xs font-black rounded-2xl border-2 transition-all active:scale-95 ${request.name === e.name ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xl shadow-indigo-100 scale-[1.05]' : 'bg-white text-slate-500 border-slate-50 hover:border-indigo-100'}`}
                >
                  {e.name}
                </button>
              ))}
            </div>
          </section>

          <section className="animate-pop" style={{ animationDelay: '0.2s' }}>
            <div className="flex justify-between items-end mb-5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">2. Select Your Work Blocks</label>
              {request.selectedShifts.length > 0 && (
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 animate-pop">
                    {totalSelectedHours.toFixed(1)}h Net Total
                  </span>
                </div>
              )}
            </div>
            
            {groupedShifts.length > 0 ? (
              <div className="space-y-4 max-h-[550px] overflow-y-auto pr-3 custom-scrollbar">
                {groupedShifts.map((group, groupIdx) => {
                  const allInDaySelected = group.shifts.every(s => request.selectedShifts.some(rs => areShiftsEqual(rs, s)));
                  
                  // For the visual timeline, we use the library hours for that day as the bounds
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
                          className={`text-[9px] font-black uppercase px-4 py-2 rounded-xl transition-all ${allInDaySelected ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100 hover:text-indigo-600 hover:border-indigo-200 shadow-sm'}`}
                        >
                          {allInDaySelected ? 'Deselect Day' : 'Full Day'}
                        </button>
                      </div>

                      <div className="relative h-14 bg-slate-100/50 rounded-2xl mb-4 p-1 overflow-hidden">
                        {/* Time Markers */}
                        <div className="absolute inset-0 flex justify-between px-4 items-center pointer-events-none opacity-20">
                          <span className="text-[8px] font-black">{libHours.open} AM</span>
                          <span className="text-[8px] font-black">{libHours.close > 12 ? libHours.close - 12 : libHours.close} {libHours.close >= 12 ? 'PM' : 'AM'}</span>
                        </div>

                        {/* Shifts as Blocks */}
                        {group.shifts.map((s, idx) => {
                          const startMin = timeToMinutes(s.startTime);
                          const endMin = timeToMinutes(s.endTime);
                          const left = ((startMin - libHours.open * 60) / totalRange) * 100;
                          const width = ((endMin - startMin) / totalRange) * 100;
                          const isSelected = request.selectedShifts.some(rs => areShiftsEqual(rs, s));

                          return (
                            <button
                              key={idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleShift(s);
                              }}
                              style={{ left: `${left}%`, width: `${width}%` }}
                              className={`absolute top-1 bottom-1 rounded-xl transition-all duration-300 z-10 border-2
                                ${isSelected 
                                  ? 'bg-slate-900 border-slate-800 shadow-lg scale-y-105 z-20' 
                                  : 'bg-white border-slate-200 hover:border-indigo-400 hover:z-20'}`}
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

                      {/* Overlap Indicator */}
                      {group.shifts.length > 1 && (
                        <div className="flex items-center gap-2 px-1">
                          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                          <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                            Lunch overlap detected & auto-deducted
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-14 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                <div className="text-4xl mb-4 opacity-30 animate-float">📅</div>
                <p className="text-xs text-slate-400 font-bold italic leading-relaxed">
                  {request.name ? "No upcoming shifts found." : "Select your name to start."}
                </p>
              </div>
            )}
          </section>

          <button
            onClick={handleFindSwaps}
            disabled={loading || request.selectedShifts.length === 0}
            className="w-full bg-indigo-600 text-white font-black py-6 rounded-[2rem] hover:bg-indigo-700 transition-all flex items-center justify-center gap-4 disabled:bg-slate-100 disabled:text-slate-300 shadow-[0_24px_48px_-12px_rgba(79,70,229,0.3)] hover:shadow-[0_32px_64px_-16px_rgba(79,70,229,0.4)] hover:-translate-y-1 active:translate-y-0 group"
          >
            {loading ? "Matching schedules..." : <><SparklesIcon className="w-6 h-6 group-hover:rotate-12 transition-transform" /> Find My Match</>}
          </button>
        </div>

        <div className="lg:col-span-6">
           {!suggestions.length && !loading && (
             <div className="h-full flex flex-col items-center justify-center bg-[#FBFBFC] rounded-[3.5rem] border-2 border-dashed border-slate-100 p-16 text-center animate-pop">
               <div className="w-32 h-32 bg-white rounded-[2.5rem] shadow-sm flex items-center justify-center mb-8 animate-float">
                 <span className="text-6xl">🦉</span>
               </div>
               <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tighter">Booker is waiting!</h3>
               <p className="text-sm text-slate-400 max-w-xs font-medium leading-relaxed italic">"Select your work blocks on the left. I'll search for trades that respect everyone's hour caps!"</p>
             </div>
           )}

           {loading && (
             <div className="h-full space-y-6">
               {[1,2,3,4].map(i => (
                 <div key={i} className="h-40 bg-slate-50 rounded-[3rem] animate-pulse border border-slate-100" />
               ))}
             </div>
           )}

           {suggestions.length > 0 && !loading && (
             <div className="space-y-6">
                <div className="flex items-center justify-between px-3">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Top Matches Found</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">AI Verified</span>
                  </div>
                </div>
                {suggestions.map((s, i) => (
                  <div key={i} className="group bg-white border border-slate-100 rounded-[3rem] p-7 shadow-sm hover:shadow-2xl hover:shadow-indigo-100/30 transition-all duration-500 hover:-translate-y-2 hover:border-indigo-100 animate-pop" style={{ animationDelay: `${i * 0.1}s` }}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-50 flex items-center justify-center text-2xl font-black text-indigo-500 shadow-inner group-hover:scale-110 transition-transform">
                          {s.candidateName[0]}
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-slate-900 tracking-tight">{s.candidateName}</h4>
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl uppercase tracking-widest ${s.type === 'Trade' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                            {s.type}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Impact</div>
                        <div className="flex items-center gap-2 justify-end bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                          <span className={`text-sm font-black ${s.projectedHours < MIN_PT_HOURS ? 'text-orange-500' : 'text-indigo-600'}`}>
                            {s.projectedHours}h total
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-slate-500 font-medium mb-7 italic leading-relaxed pl-4 border-l-4 border-slate-100 group-hover:border-indigo-300 transition-colors">"{s.reason}"</p>

                    {s.tradeShift && (
                      <div className="bg-[#F8FAFC] rounded-[2rem] p-5 border border-slate-100 mb-7 transition-colors group-hover:bg-indigo-50 group-hover:border-indigo-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase block mb-2 tracking-widest">Swap Offer:</span>
                        <div className="text-sm font-black text-slate-800 tracking-tight">{s.tradeShift}</div>
                      </div>
                    )}
                    
                    <button 
                      onClick={() => handlePropose(s)}
                      className="w-full py-4.5 bg-slate-900 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                    >
                      {copyFeedback ? "Template Copied! 🎉" : "Propose this Swap"}
                    </button>
                  </div>
                ))}
             </div>
           )}
        </div>
      </div>

      {proposal && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl bg-slate-900 text-white p-8 rounded-[3rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] z-50 animate-pop border border-white/10">
           <div className="flex justify-between items-center mb-5">
             <div className="flex items-center gap-3">
               <span className="text-3xl animate-float">🐛</span>
               <div>
                 <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-400">Readly's Message Draft</h3>
                 <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Already copied to your clipboard!</p>
               </div>
             </div>
             <button onClick={() => setProposal(null)} className="p-2 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-full">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
               </svg>
             </button>
           </div>
           <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 mb-6">
             <p className="text-base md:text-lg font-bold leading-relaxed text-slate-100 italic">"{proposal}"</p>
           </div>
           <div className="flex gap-3">
             <button 
               onClick={() => {
                 navigator.clipboard.writeText(proposal);
                 setCopyFeedback(true);
                 setTimeout(() => setCopyFeedback(false), 2000);
               }}
               className="flex-1 bg-white text-slate-900 py-4.5 rounded-[1.25rem] text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition shadow-xl active:scale-95"
             >
               {copyFeedback ? "Copied!" : "Copy Again"}
             </button>
             <button onClick={() => setProposal(null)} className="px-10 bg-white/10 text-slate-300 py-4.5 rounded-[1.25rem] text-xs font-black uppercase tracking-widest hover:bg-white/20 transition active:scale-95">Dismiss</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default SwapAssistant;
