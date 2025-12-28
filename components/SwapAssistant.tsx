
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

  const availableShifts = useMemo(() => {
    if (!currentSchedule || !request.name) return [];
    const shifts: Shift[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    DAYS_OF_WEEK.forEach(day => {
      const dayShifts = currentSchedule[day];
      dayShifts?.forEach(s => {
        if (s.employeeName.toLowerCase() === request.name.toLowerCase()) {
          if (s.dateObj && s.dateObj >= today) {
            shifts.push(s);
          }
        }
      });
    });

    return shifts.sort((a, b) => {
      const dateA = a.dateObj?.getTime() || 0;
      const dateB = b.dateObj?.getTime() || 0;
      if (dateA !== dateB) return dateA - dateB;
      return a.startTime.localeCompare(b.startTime);
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
      return `${formattedDate} (${formatTimeAmPm(rs.startTime)}-${formatTimeAmPm(rs.endTime)})`;
    }).join(' and ');

    const text = `Hi ${s.candidateName}, this is ${request.name}. I'm looking for ${request.mode === 'Trade' ? 'a trade' : 'coverage'} for my shifts on ${shiftsLabel}. ${s.type === 'Trade' ? `Would you be open to swapping them for your ${s.tradeShift}?` : 'Would you be able to take those hours?'} It keeps our weekly totals balanced. Let me know!`;
    
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
    <div className="bg-white p-8 rounded-[2rem] shadow-2xl mt-6 border border-slate-100 max-w-5xl mx-auto overflow-hidden pb-24 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Shift Concierge</h2>
          <p className="text-slate-500 font-medium">Find your match. Protect your hours.</p>
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
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">1. Identify Yourself</label>
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
                  {totalSelectedHours.toFixed(1)}h Selected
                </span>
              )}
            </div>
            {availableShifts.length > 0 ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {availableShifts.map((s, idx) => {
                  const isSelected = request.selectedShifts.some(rs => rs.date === s.date && rs.startTime === s.startTime);
                  const dateLabel = s.dateObj ? s.dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : s.day;
                  return (
                    <button
                      key={idx}
                      onClick={() => toggleShift(s)}
                      className={`w-full flex justify-between items-center p-4 rounded-2xl border-2 transition-all group ${isSelected ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-slate-50 text-slate-600 border-transparent hover:bg-slate-100'}`}
                    >
                      <div className="text-left">
                        <span className={`block text-[10px] font-black uppercase mb-1 ${isSelected ? 'opacity-60' : 'opacity-40'}`}>{dateLabel}</span>
                        <span className="text-sm font-black">{formatTimeAmPm(s.startTime)} - {formatTimeAmPm(s.endTime)}</span>
                      </div>
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${isSelected ? 'bg-indigo-500 border-indigo-400' : 'bg-white border-slate-200 group-hover:border-indigo-200'}`}>
                        {isSelected && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-10 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                <p className="text-xs text-slate-400 font-bold italic leading-relaxed">
                  {request.name ? "No upcoming shifts found." : "Select your name to see your schedule."}
                </p>
              </div>
            )}
          </section>

          <button
            onClick={handleFindSwaps}
            disabled={loading || request.selectedShifts.length === 0}
            className="w-full bg-indigo-600 text-white font-black py-5 rounded-[1.5rem] hover:bg-indigo-700 transition flex items-center justify-center gap-3 disabled:bg-slate-200 shadow-2xl shadow-indigo-100 group"
          >
            {loading ? "Matching Schedules..." : <><SparklesIcon className="w-6 h-6 group-hover:rotate-12 transition-transform" /> Find Matches</>}
          </button>
        </div>

        <div className="lg:col-span-7">
           {!suggestions.length && !loading && (
             <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 p-16 text-center">
               <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-6">
                 <SparklesIcon className="w-10 h-10 text-slate-200" />
               </div>
               <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">Concierge Ready</h3>
               <p className="text-sm text-slate-400 max-w-xs font-medium">Select your shift(s) on the left to see who can help you cover them while staying balanced.</p>
             </div>
           )}

           {loading && (
             <div className="h-full space-y-6 animate-pulse">
               {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-100 rounded-[2rem]" />)}
             </div>
           )}

           {suggestions.length > 0 && !loading && (
             <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Smart Matches</h3>
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
                            {s.projectedHours}h
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 font-medium mb-6 italic leading-relaxed pl-2 border-l-4 border-slate-100 group-hover:border-indigo-200 transition-colors">"{s.reason}"</p>

                    {s.tradeShift && (
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-6">
                        <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">They give you:</span>
                        <div className="text-xs font-black text-slate-800">{s.tradeShift}</div>
                      </div>
                    )}
                    
                    <button 
                      onClick={() => handlePropose(s)}
                      className="w-full py-4 bg-slate-900 text-white rounded-[1.2rem] text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                      {copyFeedback ? "Copied Message!" : "Propose this Swap"}
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
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Message Generated & Copied</h3>
             </div>
             <button onClick={() => setProposal(null)} className="text-slate-500 hover:text-white transition">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
               </svg>
             </button>
           </div>
           <p className="text-sm font-bold leading-relaxed mb-4 text-slate-200 italic">"{proposal}"</p>
           <button 
             onClick={() => {
               navigator.clipboard.writeText(proposal);
               setCopyFeedback(true);
               setTimeout(() => setCopyFeedback(false), 2000);
             }}
             className="w-full bg-white text-slate-900 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition"
           >
             {copyFeedback ? "Copied Again!" : "Copy Template Again"}
           </button>
        </div>
      )}
    </div>
  );
};

export default SwapAssistant;
