
import { GoogleGenAI, Type } from "@google/genai";
import type { Rule, Unavailability, Employee, Schedule, SwapSuggestion, DayOfWeek, SwapMode, Shift } from '../types';

// Initialize the Gemini API client using the environment's API key.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const findSwapCandidates = async (
  swapRequest: { name: string, shifts: Shift[], mode: SwapMode },
  allEmployees: Employee[],
  currentRules: Rule[],
  currentSchedule: Schedule | null
): Promise<SwapSuggestion[]> => {
  const scheduleContext = currentSchedule ? JSON.stringify(currentSchedule) : "No schedule yet";
  
  const shiftsDescription = swapRequest.shifts.map(s => 
    `- ${s.date || s.day}: ${s.startTime} to ${s.endTime}`
  ).join('\n');

  const prompt = `
    Find the best ${swapRequest.mode} options for these combined shifts:
    - Requester: ${swapRequest.name}
    - Shifts to Move:
    ${shiftsDescription}
    - Goal: ${swapRequest.mode === 'Coverage' ? 'Find a Sub or colleague to take all these hours' : 'Find a colleague to trade shifts with'}

    Context:
    - Schedule: ${scheduleContext}
    - Staff: ${allEmployees.map(e => `${e.name} (${e.employeeType})`).join(', ')}

    Strict Hour Limits:
    1. Part-time (PT) staff: TARGET 20-30 hours/week. Do NOT exceed 30.
    2. Substitutes (Sub): TARGET 5-20 hours/week.
    3. Full-time staff: IGNORE (they never swap).

    Logic for ${swapRequest.mode}:
    ${swapRequest.mode === 'Coverage' ? `
    - Look for someone who has space in their hours cap to take this total block.
    - Ensure they aren't working during these specific times.
    ` : `
    - Look for someone who has shifts on DIFFERENT days that the requester could take in return.
    - Propose a trade that keeps both parties near their hour targets.
    - Check for double-booking conflicts for both parties.
    `}

    FORMATTING RULES:
    - Always return times in US format (e.g. 9:00 AM - 5:00 PM) in the "tradeShift" description.
    - Return exactly 4 options with accurate "currentHours" and "projectedHours" (calculated from the provided schedule context).
  `;

  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        candidateName: { type: Type.STRING },
        type: { type: Type.STRING, enum: ['Coverage', 'Trade'] },
        reason: { type: Type.STRING },
        confidence: { type: Type.NUMBER },
        tradeShift: { type: Type.STRING, description: "Description of the shift(s) they would give in return if Trade (US TIME FORMAT ONLY)" },
        currentHours: { type: Type.NUMBER },
        projectedHours: { type: Type.NUMBER }
      },
      required: ["candidateName", "type", "reason", "confidence", "currentHours", "projectedHours"]
    }
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  // Extract text safely and handle potential undefined
  const jsonStr = response.text || "[]";
  return JSON.parse(jsonStr.trim());
};

export const analyzeCsvPatterns = async (csvText: string, employees: Employee[]): Promise<{ suggestedRules: string[], inferredAvailability: any }> => {
  const prompt = `
    Analyze this library schedule CSV data:
    ---
    ${csvText}
    ---
    Staff List:
    ${employees.map(e => `- ${e.name} (${e.employeeType})`).join('\n')}

    Rules to keep in mind:
    - Full-time staff (Bill, Chris, Gregory, Diane) work M-F 9-5 and do NOT switch shifts.
    - Focus analysis on Part-time and Sub staff pairings.

    Identify:
    1. Recurring pairings.
    2. Typical shifts for Part-time/Sub staff.
    3. Specific unavailability patterns.
    
    Return a JSON object with suggestedRules (string[]) and inferredAvailability (object).
  `;

  const schema = {
    type: Type.OBJECT,
    properties: {
      suggestedRules: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      },
      inferredAvailability: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING }
        },
        required: ["summary"]
      }
    },
    required: ["suggestedRules", "inferredAvailability"]
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { 
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  // Extract text safely and handle potential undefined
  const jsonStr = response.text || '{"suggestedRules": [], "inferredAvailability": {"summary": ""}}';
  return JSON.parse(jsonStr.trim());
};

export const generateSchedule = async (
  rules: Rule[],
  unavailability: Unavailability[],
  employees: Employee[],
): Promise<Schedule> => {
  const prompt = `
    You are an expert scheduler for a local library. Create a weekly shift schedule.

    **Staff:**
    ${employees.map(e => `- ${e.name} (${e.employeeType})`).join('\n')}

    **Critical Constraints:**
    1. Full-time staff (Bill, Chris, Gregory, Diane) have fixed M-F 9:00 AM - 5:00 PM.
    2. Exactly two employees on desk at all times library is open.
    3. PT hours: 22-30 per week.
    4. Sub hours: 5-20 per week.
    ${rules.map(r => `- ${r.text}`).join('\n')}

    **Unavailability:**
    ${unavailability.map(unavail => {
      const employee = employees.find(e => e.id === unavail.employeeId);
      if (!employee || unavail.slots.length === 0) return '';
      const slotsByDay: { [key: string]: string[] } = {};
      unavail.slots.forEach(slot => {
        if (!slotsByDay[slot.day]) slotsByDay[slot.day] = [];
        slotsByDay[slot.day].push(slot.time);
      });
      return `* ${employee.name} UNAVAILABLE on ${Object.entries(slotsByDay).map(([d, t]) => `${d}: ${t.join(',')}`).join('; ')}`;
    }).join('\n')}

    Output valid JSON.
  `;

  const shiftSchema = {
    type: Type.OBJECT,
    properties: {
      employeeName: { type: Type.STRING },
      startTime: { type: Type.STRING },
      endTime: { type: Type.STRING },
    },
    required: ["employeeName", "startTime", "endTime"],
  };

  const schema = {
    type: Type.OBJECT,
    properties: {
      Monday: { type: Type.ARRAY, items: shiftSchema },
      Tuesday: { type: Type.ARRAY, items: shiftSchema },
      Wednesday: { type: Type.ARRAY, items: shiftSchema },
      Thursday: { type: Type.ARRAY, items: shiftSchema },
      Friday: { type: Type.ARRAY, items: shiftSchema },
      Saturday: { type: Type.ARRAY, items: shiftSchema },
      Sunday: { type: Type.ARRAY, items: shiftSchema },
    },
  };
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  // Extract text safely and handle potential undefined
  const jsonStr = response.text || "{}";
  return JSON.parse(jsonStr.trim()) as Schedule;
};
