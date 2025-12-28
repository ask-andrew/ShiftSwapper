
import React, { useState, useEffect, useMemo } from 'react';
import { EMPLOYEES, DAYS_OF_WEEK, formatTimeAmPm, MIN_PT_HOURS } from '../constants';
import type { DayOfWeek, SwapSuggestion, Rule, Shift, Schedule, SwapMode } from '../types';
import { findSwapCandidates } from '../services/geminiService';
import SparklesIcon from './icons/SparklesIcon';

interface SwapAssistantProps {
  currentRules: Rule[];
  csvContext: string;
  selectedShiftFromCalendar?: Shift | null;
  currentSchedule: Schedule | null;
}

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

  // Group user shifts by date for easier multi-selection
  const groupedShifts = useMemo(() => {
    if (!currentSchedule || !request.name) return {};
    const groups: Record<string, { label: string, date: string, shifts: Shift[] }> = {};
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
                label: s.dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                shifts: []
              };
            }
            groups[key].shifts.push(s);
          }
        }
      });
    });

    // Sort dates
    return Object.fromEntries(
      Object.entries(groups).sort((a, b) => {
        const dateA = a[1].shifts[0].dateObj?.getTime() || 0;
        const dateB = b[1].shifts[0].dateObj?.getTime() || 0;
        return dateA - dateB;
      })
    );
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

  const toggleShift = (shift: Shift) => {
    const isSelected = request.selectedShifts.some(s => s.date === shift.date && s.startTime === shift.startTime);
    if (isSelected) {
      setRequest(prev => ({
        ...prev,
        selectedShifts: prev.selectedShifts.filter(s => !(s.date === shift.date && s.startTime === shift.startTime))
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
    const allSelected = shifts.every(s => request.selectedShifts.some(rs => rs.date === s.date && rs.startTime === s.startTime));
    if (allSelected) {
      setRequest(prev => ({
        ...prev,
        selectedShifts: prev.selectedShifts.filter(rs => !shifts.some(s => s.date === rs.date && s.startTime === rs.startTime))
      }));
    } else {
      const newShifts = [...request.selectedShifts];
      shifts.forEach(s => {
        if (!newShifts.some(rs => rs.date === s.date && rs.startTime === s.startTime)) {
          newShifts.push(s);
        }
      });
      setRequest(prev => ({ ...prev, selectedShifts: newShifts }));
    }
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
    // Generate dates label e.g., "Jan 10 (9:00 AM - 1:00 PM) and Jan 10 (1:00 PM - 5:00 PM)"
    const shiftsLabel = request.selectedShifts.map(rs => {
      const formattedDate = rs.date ? new Date(rs.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : rs.day;
      return `${formattedDate} (${formatTimeAmPm(rs.startTime)} - ${formatTimeAmPm(rs.endTime)})`;
    }).join(' and ');

    // Normalize AI-suggested trade shift to US format
    const cleanedTradeShift = s.tradeShift?.replace(/([01]?[0-9]|2[0-3]):([0-5][0-9])\s*-\s*([01]?[0-9]|2[0-3]):([0-5][0-9])/g, (match, h1, m1, h2, m2) => {
      return `${formatTimeAmPm(`${h1}:${m1}`)} - ${formatTimeAmPm(`${h2}:${m2}`)}`;
    });

    const text = `Hi ${s.candidateName}, I'm looking for ${request.mode === 'Trade' ? 'a trade' : 'coverage'} for my shifts on ${shiftsLabel}. ${s.type === 'Trade' ? `Would you be open to swapping them for your ${cleanedTradeShift}?` : 'Would you be able to take those hours?'} It keeps our weekly totals balanced. Let me know!`;
    
    setProposal(text);
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const totalSelectedHours = request.selectedShifts.reduce((acc, s) => {
    const [h1, m1] = s.startTime.split(':').map(Number);
    const [h2, m2] = s.endTime.split(':').map(Number);
    return acc + (h2 + m2/60) - (h1 + m1/60);
  }, 0);

  return (
    <div className="bg-white p-8 rounded-[2rem] shadow-2xl mt-6 border border-slate-100 max-w-5xl mx-auto overflow-hidden pb-24 relative min-h-[600px]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Shift Concierge</h2>
          <p className="text-slate-500 font-medium italic">Balanced swaps for the part-time team.</p>
        </div>
        <div className="flex p-1.5 bg-slate-100 rounded-2xl w-full md:w-auto">
          <button 
            onClick={() => setRequest({...request, mode: 'Trade'})}
            className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-sm font-black transition-all ${request.mode === 'Trade' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            TRADE
          </button>
          <button 
            onClick={() => setRequest({...request, mode: 'Coverage'})}
            className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-sm font-black transition-all ${request.mode === 'Coverage' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            COVERAGE
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-8">
          <section>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">1. Who are you?</label>
            <div className="grid grid-cols-3 gap-2">
              {swappableStaff.map(e => (
                <button
                  key={e.id}
                  onClick={() => {
                    setRequest({...request, name: e.name, selectedShifts: []});
                    setSuggestions([]);
                    setProposal(null);
                  }}
                  className={`py-3 text-xs font-black rounded-2xl border-2 transition-all ${request.name === e.name ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-100 scale-[1.05]' : 'bg-white text-slate-600 border-slate-100 hover:border-indigo-200'}`}
                >
                  {e.name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-end mb-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">2. Select Shift(s)</label>
              {request.selectedShifts.length > 0 && (
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">
                  {totalSelectedHours.toFixed(1)}h Total
                </span>
              )}
            </div>
            {Object.keys(groupedShifts).length > 0 ? (
              <div className="space-y-6 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.values(groupedShifts).map((group, groupIdx) => {
                  const allInDaySelected = group.shifts.every(s => request.selectedShifts.some(rs => rs.date === s.date && rs.startTime === s.startTime));
                  return (
                    <div key={groupIdx} className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                      <div className="flex justify-between items-center mb-3 px-1">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">{group.label}</span>
                        {group.shifts.length > 1 && (
                          <button 
                            onClick={() => selectWholeDay(group.shifts)}
                            className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg transition-colors ${allInDaySelected ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50'}`}
                          >
                            {allInDaySelected ? 'Selected All' : 'Select Day'}
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {group.shifts.map((s, idx) => {
                          const isSelected = request.selectedShifts.some(rs => rs.date === s.date && rs.startTime === s.startTime);
                          return (
                            <button
                              key={idx}
                              onClick={() => toggleShift(s)}
                              className={`w-full flex justify-between items-center p-3 rounded-2xl border-2 transition-all ${isSelected ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-transparent hover:border-indigo-100'}`}
                            >
                              <span className="text-xs font-black">{formatTimeAmPm(s.startTime)} - {formatTimeAmPm(s.endTime)}</span>
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center border-2 ${isSelected ? 'bg-indigo-400 border-indigo-400' : 'bg-slate-100 border-slate-200'}`}>
                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-10 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                <p className="text-xs text-slate-400 font-bold italic leading-relaxed">
                  {request.name ? "No upcoming shifts found." : "Pick your name to see your shifts."}
                </p>
              </div>
            )}
          </section>

          <button
            onClick={handleFindSwaps}
            disabled={loading || request.selectedShifts.length === 0}
            className="w-full bg-indigo-600 text-white font-black py-5 rounded-[1.5rem] hover:bg-indigo-700 transition flex items-center justify-center gap-3 disabled:bg-slate-200 shadow-2xl shadow-indigo-100 group"
          >
            {loading ? "Matching Schedules..." : <><SparklesIcon className="w-6 h-6 group-hover:rotate-12 transition-transform" /> Find My Match</>}
          </button>
        </div>

        <div className="lg:col-span-7">
           {!suggestions.length && !loading && (
             <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 p-16 text-center">
               <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-6">
                 <SparklesIcon className="w-10 h-10 text-slate-200" />
               </div>
               <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">AI Matching Ready</h3>
               <p className="text-sm text-slate-400 max-w-xs font-medium">Select your shift(s) to find candidates who can help. Works great for double shifts!</p>
             </div>
           )}

           {loading && (
             <div className="h-full space-y-6 animate-pulse">
               {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-100 rounded-[2rem]" />)}
             </div>
           )}

           {suggestions.length > 0 && !loading && (
             <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Top Matches</h3>
                  <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">Optimized</span>
                </div>
                {suggestions.map((s, i) => (
                  <div key={i} className="group bg-white border-2 border-slate-100 rounded-[2.5rem] p-6 shadow-sm hover:shadow-2xl transition-all duration-500 hover:border-indigo-100">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-xl font-black text-indigo-400">
                          {s.candidateName[0]}
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-slate-900">{s.candidateName}</h4>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider ${s.type === 'Trade' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {s.type}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Impact</div>
                        <div className="flex items-center gap-2 justify-end bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                          <span className={`text-xs font-black ${s.projectedHours < MIN_PT_HOURS ? 'text-orange-500' : 'text-indigo-600'}`}>
                            {s.projectedHours}h total
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 font-medium mb-6 italic leading-relaxed pl-2 border-l-4 border-slate-100 group-hover:border-indigo-200 transition-colors">"{s.reason}"</p>

                    {s.tradeShift && (
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-6">
                        <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Trade Shift:</span>
                        <div className="text-xs font-black text-slate-800">{s.tradeShift}</div>
                      </div>
                    )}
                    
                    <button 
                      onClick={() => handlePropose(s)}
                      className="w-full py-4 bg-slate-900 text-white rounded-[1.2rem] text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                      {copyFeedback ? "Template Copied!" : "Propose this Swap"}
                    </button>
                  </div>
                ))}
             </div>
           )}
        </div>
      </div>

      {proposal && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl bg-slate-900 text-white p-6 rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] z-50 animate-in fade-in slide-in-from-bottom-8 duration-500">
           <div className="flex justify-between items-center mb-4">
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Message Copied to Clipboard</h3>
             </div>
             <button onClick={() => setProposal(null)} className="text-slate-500 hover:text-white transition">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
               </svg>
             </button>
           </div>
           <p className="text-sm font-bold leading-relaxed mb-4 text-slate-200 italic">"{proposal}"</p>
           <div className="flex gap-2">
             <button 
               onClick={() => {
                 navigator.clipboard.writeText(proposal);
                 setCopyFeedback(true);
                 setTimeout(() => setCopyFeedback(false), 2000);
               }}
               className="flex-1 bg-white text-slate-900 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition"
             >
               {copyFeedback ? "Copied!" : "Copy Again"}
             </button>
             <button onClick={() => setProposal(null)} className="px-6 bg-slate-800 text-slate-400 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:text-white transition">Dismiss</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default SwapAssistant;
