
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
    const shiftsLabel = request.selectedShifts.map(rs => {
      const formattedDate = rs.date ? new Date(rs.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : rs.day;
      return `${formattedDate} (${formatTimeAmPm(rs.startTime)} - ${formatTimeAmPm(rs.endTime)})`;
    }).join(' and ');

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
    <div className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-2xl mt-6 border border-slate-100 max-w-5xl mx-auto overflow-hidden pb-32 relative min-h-[700px]">
      <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
        <SparklesIcon className="w-64 h-64 text-indigo-600 rotate-12" />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 relative z-10">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-1 flex items-center gap-3">
            Concierge
            <span className="animate-float">✨</span>
          </h2>
          <p className="text-slate-400 font-bold italic text-sm">Balanced shifts for the library family.</p>
        </div>
        <div className="flex p-1.5 bg-slate-50 rounded-[1.5rem] w-full md:w-auto border border-slate-100">
          <button 
            onClick={() => setRequest({...request, mode: 'Trade'})}
            className={`flex-1 md:flex-none px-10 py-3.5 rounded-2xl text-xs font-black tracking-widest transition-all ${request.mode === 'Trade' ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-50 border border-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            TRADE
          </button>
          <button 
            onClick={() => setRequest({...request, mode: 'Coverage'})}
            className={`flex-1 md:flex-none px-10 py-3.5 rounded-2xl text-xs font-black tracking-widest transition-all ${request.mode === 'Coverage' ? 'bg-white text-blue-600 shadow-xl shadow-blue-50 border border-blue-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            COVERAGE
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
        <div className="lg:col-span-5 space-y-10">
          <section className="animate-pop" style={{ animationDelay: '0.1s' }}>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-5">1. Identify Yourself</label>
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
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">2. Select Shift(s)</label>
              {request.selectedShifts.length > 0 && (
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 animate-pop">
                    {totalSelectedHours.toFixed(1)}h Total
                  </span>
                </div>
              )}
            </div>
            {Object.keys(groupedShifts).length > 0 ? (
              <div className="space-y-6 max-h-[480px] overflow-y-auto pr-3 custom-scrollbar">
                {Object.values(groupedShifts).map((group, groupIdx) => {
                  const allInDaySelected = group.shifts.every(s => request.selectedShifts.some(rs => rs.date === s.date && rs.startTime === s.startTime));
                  return (
                    <div key={groupIdx} className="bg-[#FBFBFC] p-5 rounded-[2.5rem] border border-slate-100 transition-colors hover:bg-slate-50">
                      <div className="flex justify-between items-center mb-4 px-1">
                        <span className="text-[12px] font-black text-slate-800 uppercase tracking-tight">{group.label}</span>
                        {group.shifts.length > 1 && (
                          <button 
                            onClick={() => selectWholeDay(group.shifts)}
                            className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-xl transition-all ${allInDaySelected ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100 hover:text-indigo-600 hover:border-indigo-100'}`}
                          >
                            {allInDaySelected ? 'Selected All' : 'Select Day'}
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {group.shifts.map((s, idx) => {
                          const isSelected = request.selectedShifts.some(rs => rs.date === s.date && rs.startTime === s.startTime);
                          return (
                            <button
                              key={idx}
                              onClick={() => toggleShift(s)}
                              className={`w-full flex justify-between items-center p-4 rounded-[1.25rem] border-2 transition-all group ${isSelected ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-600 border-transparent hover:border-indigo-100'}`}
                            >
                              <span className="text-xs font-black tracking-tight">{formatTimeAmPm(s.startTime)} - {formatTimeAmPm(s.endTime)}</span>
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all ${isSelected ? 'bg-indigo-400 border-indigo-300' : 'bg-slate-50 border-slate-100 group-hover:border-indigo-100'}`}>
                                {isSelected && <div className="w-2 h-2 bg-white rounded-full animate-pop" />}
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
              <div className="p-14 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                <div className="text-4xl mb-4 opacity-30">📅</div>
                <p className="text-xs text-slate-400 font-bold italic leading-relaxed">
                  {request.name ? "No upcoming shifts found." : "Pick your name to start."}
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

        <div className="lg:col-span-7">
           {!suggestions.length && !loading && (
             <div className="h-full flex flex-col items-center justify-center bg-[#FBFBFC] rounded-[3.5rem] border-2 border-dashed border-slate-100 p-16 text-center animate-pop">
               <div className="w-32 h-32 bg-white rounded-[2.5rem] shadow-sm flex items-center justify-center mb-8 animate-float">
                 <span className="text-6xl">🦉</span>
               </div>
               <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tighter">Booker is waiting!</h3>
               <p className="text-sm text-slate-400 max-w-xs font-medium leading-relaxed">Select your shift(s) on the left and Booker the Owl will find the perfect trade that keeps everyone's hours balanced. 📚✨</p>
             </div>
           )}

           {loading && (
             <div className="h-full space-y-6">
               {[1,2,3,4].map(i => (
                 <div key={i} className="h-32 bg-slate-50 rounded-[2.5rem] animate-pulse border border-slate-100" />
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
                      {copyFeedback ? "Message Copied! 🎉" : "Propose this Swap"}
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
                 <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
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
               {copyFeedback ? "Copied Again!" : "Copy Template Again"}
             </button>
             <button onClick={() => setProposal(null)} className="px-10 bg-white/10 text-slate-300 py-4.5 rounded-[1.25rem] text-xs font-black uppercase tracking-widest hover:bg-white/20 transition active:scale-95">Dismiss</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default SwapAssistant;
