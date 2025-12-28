
import React, { useState, useCallback, useEffect } from 'react';
import type { Rule, Unavailability, TimeSlot, Schedule, DayOfWeek, Shift } from './types';
import { EMPLOYEES, TIME_SLOTS, isLibraryOpen, DAYS_OF_WEEK } from './constants';
import Header from './components/Header';
import RuleManager from './components/RuleManager';
import AvailabilityTracker from './components/AvailabilityTracker';
import ScheduleView from './components/ScheduleView';
import SwapAssistant from './components/SwapAssistant';
import SparklesIcon from './components/icons/SparklesIcon';
import ExportIcon from './components/icons/ExportIcon';
import { generateSchedule, analyzeCsvPatterns } from './services/geminiService';
import { exportScheduleToIcs } from './utils/calendar';
import { parseLibraryCsv, RAW_SCHEDULE_CSV } from './utils/csvParser';

const App: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>([
    { id: '1', text: "Part-time employees work 22-30 hours/week." },
    { id: '2', text: "Sub employees work 5-20 hours/week." },
    { id: '3', text: "Full-time staff work M-F 9:00 AM - 5:00 PM." },
    { id: '4', text: 'Shifts for PT/Subs must be between 4 and 8 hours long.'},
    { id: '5', text: 'Exactly 2 people must be on the desk at all times.'},
  ]);
  const [unavailability, setUnavailability] = useState<Unavailability[]>(
    EMPLOYEES.map(e => ({ employeeId: e.id, slots: [] }))
  );
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [selectedShiftForSwap, setSelectedShiftForSwap] = useState<Shift | null>(null);
  const [csvContent, setCsvContent] = useState<string>(RAW_SCHEDULE_CSV);
  const [isAnalyzingCsv, setIsAnalyzingCsv] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // Defaulting to Concierge as requested
  const [activeTab, setActiveTab] = useState<'build' | 'swap' | 'import'>('swap');

  useEffect(() => {
    const parsedShifts = parseLibraryCsv(RAW_SCHEDULE_CSV);
    const initialSchedule: Schedule = {};
    parsedShifts.forEach(shift => {
      if (!initialSchedule[shift.day]) initialSchedule[shift.day] = [];
      initialSchedule[shift.day]!.push(shift);
    });
    setSchedule(initialSchedule);
  }, []);

  const handleAddRule = (ruleText: string) => {
    const newRule: Rule = { id: crypto.randomUUID(), text: ruleText };
    setRules(prev => [...prev, newRule]);
  };

  const handleDeleteRule = (ruleId: string) => {
    setRules(prev => prev.filter(rule => rule.id !== ruleId));
  };

  const handleUpdateUnavailability = (employeeId: number, day: DayOfWeek, time: string) => {
    setUnavailability(prev => {
      return prev.map(unavail => {
        if (unavail.employeeId === employeeId) {
          const slotIndex = unavail.slots.findIndex(slot => slot.day === day && slot.time === time);
          if (slotIndex > -1) {
            const newSlots = [...unavail.slots];
            newSlots.splice(slotIndex, 1);
            return { ...unavail, slots: newSlots };
          } else {
            const newSlot: TimeSlot = { day, time };
            return { ...unavail, slots: [...unavail.slots, newSlot] };
          }
        }
        return unavail;
      });
    });
  };
  
  const handleSetDayUnavailability = (employeeId: number, day: DayOfWeek, shouldBeUnavailable: boolean) => {
    setUnavailability(prev => {
      const openSlotsForDay = TIME_SLOTS.filter(time => isLibraryOpen(day, time)).map(time => ({ day, time }));
      return prev.map(unavail => {
        if (unavail.employeeId === employeeId) {
          let newSlots = [...unavail.slots];
          if (shouldBeUnavailable) {
            const slotsToAdd = openSlotsForDay.filter(daySlot => !newSlots.some(s => s.day === daySlot.day && s.time === daySlot.time));
            newSlots.push(...slotsToAdd);
          } else {
            const openSlotsSet = new Set(openSlotsForDay.map(s => s.time));
            newSlots = newSlots.filter(s => !(s.day === day && openSlotsSet.has(s.time)));
          }
          return { ...unavail, slots: newSlots };
        }
        return unavail;
      });
    });
  };

  const processCsvIntelligence = async () => {
    if (!csvContent.trim()) return;
    setIsAnalyzingCsv(true);
    try {
      const insight = await analyzeCsvPatterns(csvContent, EMPLOYEES);
      insight.suggestedRules.forEach((rule: string) => handleAddRule(`Inferred: ${rule}`));
      
      const parsedShifts = parseLibraryCsv(csvContent);
      const newSchedule: Schedule = {};
      parsedShifts.forEach(shift => {
        if (!newSchedule[shift.day]) newSchedule[shift.day] = [];
        newSchedule[shift.day]!.push(shift);
      });
      setSchedule(newSchedule);

      alert(`Successfully analyzed CSV. Applied patterns to current schedule.`);
      setActiveTab('swap');
    } catch (e) {
      console.error(e);
      alert("Failed to analyze CSV patterns.");
    } finally {
      setIsAnalyzingCsv(false);
    }
  };

  const handleGenerateSchedule = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSchedule(null);
    try {
      const generated = await generateSchedule(rules, unavailability, EMPLOYEES);
      setSchedule(generated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [rules, unavailability]);

  const handleSelectShift = (shift: Shift) => {
    setSelectedShiftForSwap(shift);
    setActiveTab('swap');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Header />
      <main className="container mx-auto p-4 max-w-7xl">
        <div className="flex border-b border-slate-200 mb-10 space-x-12 relative">
          <button 
            onClick={() => setActiveTab('swap')} 
            className={`pb-4 px-2 font-black text-xs uppercase tracking-[0.15em] transition-all relative ${activeTab === 'swap' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Concierge
            {activeTab === 'swap' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-t-full animate-pop" />}
          </button>
          <button 
            onClick={() => setActiveTab('build')} 
            className={`pb-4 px-2 font-black text-xs uppercase tracking-[0.15em] transition-all relative group flex items-center gap-2 ${activeTab === 'build' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Builder
            <span className="bg-indigo-100 text-indigo-600 text-[8px] px-1.5 py-0.5 rounded-md font-black tracking-normal group-hover:bg-indigo-200 transition-colors">BETA</span>
            {activeTab === 'build' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-t-full animate-pop" />}
          </button>
          <button 
            onClick={() => setActiveTab('import')} 
            className={`pb-4 px-2 font-black text-xs uppercase tracking-[0.15em] transition-all relative ${activeTab === 'import' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Import
            {activeTab === 'import' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-t-full animate-pop" />}
          </button>
        </div>

        <div className="transition-all duration-500 animate-pop">
          {activeTab === 'import' && (
            <div className="max-w-4xl mx-auto bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 relative overflow-hidden">
               <div className="absolute top-10 right-10 text-4xl animate-float">📊</div>
               <h2 className="text-3xl font-black mb-6 text-slate-900 tracking-tight">Data Intelligence</h2>
               <p className="text-slate-500 mb-8 font-medium">Paste your schedule history to train the AI on specific shift pairings and employee preferences.</p>
               <textarea value={csvContent} onChange={(e) => setCsvContent(e.target.value)} placeholder="Paste CSV here..." className="w-full h-96 p-6 border-2 border-slate-100 rounded-[2.5rem] font-mono text-[11px] mb-6 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all custom-scrollbar" />
               <button onClick={processCsvIntelligence} disabled={isAnalyzingCsv || !csvContent} className="bg-slate-900 text-white px-10 py-5 rounded-[1.5rem] font-black text-sm uppercase tracking-widest hover:bg-slate-800 disabled:bg-slate-300 transition w-full shadow-xl shadow-slate-100">{isAnalyzingCsv ? "Extracting Intelligence..." : "Process Data"}</button>
            </div>
          )}

          {activeTab === 'swap' && (
            <SwapAssistant currentRules={rules} csvContext={csvContent} selectedShiftFromCalendar={selectedShiftForSwap} currentSchedule={schedule} />
          )}

          {activeTab === 'build' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              <div className="xl:col-span-4 flex flex-col gap-8">
                <RuleManager rules={rules} onAddRule={handleAddRule} onDeleteRule={handleDeleteRule} />
                <AvailabilityTracker unavailability={unavailability} onUpdateUnavailability={handleUpdateUnavailability} onSetDayUnavailability={handleSetDayUnavailability} />
              </div>

              <div className="xl:col-span-8 flex flex-col">
                <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 mb-8 relative overflow-hidden">
                  <div className="absolute -top-6 -right-6 text-6xl opacity-10 rotate-12">🔧</div>
                  <h2 className="text-xl font-black mb-6 text-slate-900 tracking-tight flex items-center gap-2">
                    Optimization Center
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-black">Experimental</span>
                  </h2>
                  <div className="flex gap-4">
                    <button onClick={handleGenerateSchedule} disabled={isLoading} className="flex-1 bg-indigo-600 text-white font-black px-8 py-5 rounded-2xl hover:bg-indigo-700 transition flex items-center justify-center gap-3 disabled:bg-slate-200 shadow-xl shadow-indigo-100 uppercase text-xs tracking-widest">{isLoading ? "Crunching Shifts..." : <><SparklesIcon className="w-5 h-5" /> Generate Optimization</>}</button>
                    {schedule && <button onClick={() => exportScheduleToIcs(schedule)} className="bg-slate-50 text-slate-700 font-black px-8 py-5 rounded-2xl hover:bg-slate-100 transition flex items-center gap-3 border border-slate-200 text-xs uppercase tracking-widest leading-none"><ExportIcon className="w-5 h-5" /> .ICS</button>}
                  </div>
                  {error && <p className="text-red-600 mt-6 text-sm font-bold bg-red-50 p-4 rounded-xl border border-red-100">{error}</p>}
                </div>
                <ScheduleView schedule={schedule} onSelectShift={handleSelectShift} selectedShift={selectedShiftForSwap} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
