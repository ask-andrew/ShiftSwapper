
import React, { useState } from 'react';
import type { Rule } from '../types';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';

interface RuleManagerProps {
  rules: Rule[];
  onAddRule: (ruleText: string) => void;
  onDeleteRule: (ruleId: string) => void;
}

const RuleManager: React.FC<RuleManagerProps> = ({ rules, onAddRule, onDeleteRule }) => {
  const [newRule, setNewRule] = useState('');

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRule.trim()) {
      onAddRule(newRule.trim());
      setNewRule('');
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-slate-700">Scheduling Rules</h2>
      <form onSubmit={handleAddRule} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newRule}
          onChange={(e) => setNewRule(e.target.value)}
          placeholder="e.g., Min 2 people on weekends"
          className="flex-grow p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
        />
        <button
          type="submit"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Add
        </button>
      </form>
      <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
        {rules.length === 0 && <p className="text-slate-500 italic">No rules added yet.</p>}
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="flex justify-between items-center bg-slate-100 p-3 rounded-lg group"
          >
            <p className="text-slate-800">{rule.text}</p>
            <button
              onClick={() => onDeleteRule(rule.id)}
              className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Delete rule"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RuleManager;
