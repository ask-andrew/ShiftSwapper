
import type { Shift, DayOfWeek } from '../types';
import { DAYS_OF_WEEK, EMPLOYEES } from '../constants';

const convertTo24Hour = (timeStr: string): string => {
  // Normalize: ensure space before AM/PM (e.g., 1:00PM -> 1:00 PM)
  const normalized = timeStr.trim().replace(/(\d+:[0-9:]+)(AM|PM)/i, '$1 $2');
  const parts = normalized.split(' ');
  if (parts.length < 2) return timeStr;

  const ampm = parts[parts.length - 1].toUpperCase();
  const timePart = parts[0];
  let [hours, minutes] = timePart.split(':').map(Number);
  
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const parseLibraryCsv = (csvText: string): Shift[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length <= 1) return [];

  const validNames = new Set(EMPLOYEES.map(e => e.name));
  const shifts: Shift[] = [];

  const dataLines = lines.slice(1);

  dataLines.forEach(line => {
    const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    if (parts.length < 5) return;

    const title = parts[0].replace(/"/g, '').trim();
    const dateStr = parts[1].replace(/"/g, '').trim();
    const startTimeStr = parts[2].replace(/"/g, '').trim();
    const endTimeStr = parts[4].replace(/"/g, '').trim();

    if (!title || parts[5]?.toLowerCase().includes('true')) return;
    if (title.toLowerCase().includes('closed') || title.toLowerCase().includes('birthday')) return;

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return;

    const dayName = DAYS_OF_WEEK[date.getDay() === 0 ? 6 : date.getDay() - 1];

    // Clean name logic: Handle symbols, parentheses, and text like "Julie(1:00)"
    const potentialNames = title.split(/[&]| and | with /i).map(n => {
      return n.replace(/\(.*?\)/g, '')
              .replace(/ covers lunch.*/gi, '')
              .replace(/ lunch coverage/gi, '')
              .replace(/ covers desk.*/gi, '')
              .replace(/ 1:1 .*/gi, '')
              .replace(/[^a-zA-Z\s]/g, ' ') // Strip remaining numbers/punctuation
              .trim();
    });

    potentialNames.forEach(namePart => {
      // Find exact matches for employee names
      const matchedName = Array.from(validNames).find(vn => {
        const words = namePart.split(/\s+/);
        return words.some(w => w.toLowerCase() === vn.toLowerCase());
      });
      
      if (matchedName) {
        const startTime = convertTo24Hour(startTimeStr.replace(/:00 /g, ' '));
        const endTime = convertTo24Hour(endTimeStr.replace(/:00 /g, ' '));

        shifts.push({
          day: dayName as DayOfWeek,
          startTime,
          endTime,
          employeeName: matchedName,
          date: dateStr,
          dateObj: date
        });
      }
    });
  });

  return shifts;
};

export const RAW_SCHEDULE_CSV = `Subject,Start Date,Start Time,End Date,End Time
Andrew & Charlie (1:00),1/2/2026,9:00:00 AM,1/2/2026,1:00:00PM
Charlie & Tylor,1/3/2026,9:00:00 AM,1/3/2026,1:00:00 PM
Kathy & Donna,1/5/2026,9:00:00 AM,1/5/2026,12:30:00 PM
Donna & Julie,1/6/2026,9:00:00 AM,1/6/2026,12:30:00 PM
Andrew & Julie (1:00),1/7/2026,9:00:00 AM,1/7/2026,1:00:00PM
Charlie & Julie (1:00),1/8/2026,9:00:00 AM,1/8/2026,1:00:00PM
Charlie(1:00) & Julie(1:00),1/9/2026,9:00:00 AM,1/9/2026,1:00:00PM
Tylor & Danielle,1/10/2026,9:00:00 AM,1/10/2026,1:00:00 PM
Kathy and Donna ,1/12/2026,9:00:00 AM,1/12/2026,12:30:00 PM
Donna & Julie,1/13/2026,9:00:00 AM,1/13/2026,12:30:00 PM
Andrew & Julie (1:00),1/14/2026,9:00:00 AM,1/14/2026,1:00:00PM
Charlie & Julie (1:00),1/15/2026,9:00:00 AM,1/15/2026,1:00:00PM
Charlie & Julie (1:00),1/16/2026,9:00:00 AM,1/16/2026,1:00:00PM
Charlie & Jim,1/17/2026,9:00:00 AM,1/17/2026,1:00:00 PM
Kathy & Donna,1/19/2026,9:00:00 AM,1/19/2026,12:30:00 PM
Donna & Julie,1/20/2026,9:00:00 AM,1/20/2026,12:30:00 PM
Andrew & Julie (1:00),1/21/2026,9:00:00 AM,1/21/2026,1:00:00PM
Charlie & Julie (1:00),1/22/2026,9:00:00 AM,1/22/2026,1:00:00PM
Andrew & Charlie (1:00),1/23/2026,9:00:00 AM,1/23/2026,1:00:00PM
Julie & Danielle,1/24/2026,9:00:00 AM,1/24/2026,1:00:00 PM
Kathy & Donna,1/26/2026,9:00:00 AM,1/26/2026,12:30:00 PM
Donna & Julie,1/27/2026,9:00:00 AM,1/27/2026,12:30:00 PM
Andrew & Julie (1:00),1/28/2026,9:00:00 AM,1/28/2026,1:00:00PM
Charlie & Julie (1:00),1/29/2026,9:00:00 AM,1/29/2026,1:00:00PM
Charlie(1:00) & Julie,1/30/2026,9:00:00 AM,1/30/2026,1:00:00PM
Kathy & Jim,1/31/2026,9:00:00 AM,1/31/2026,1:00:00 PM
Kathy and Donna ,2/2/2026,9:00:00 AM,2/2/2026,12:30:00 PM
Donna & Julie,2/3/2026,9:00:00 AM,2/3/2026,12:30:00 PM
Andrew & Julie (1:00),2/4/2026,9:00:00 AM,2/4/2026,1:00:00PM
Charlie & Julie (1:00),2/5/2026,9:00:00 AM,2/5/2026,1:00:00PM
Charlie & Julie (1:00),2/6/2026,9:00:00 AM,2/6/2026,1:00:00PM
Danielle & Tylor,2/7/2026,9:00:00 AM,2/7/2026,1:00:00 PM
Kathy & Donna,2/9/2026,9:00:00 AM,2/9/2026,12:30:00 PM
Donna & Julie,2/10/2026,9:00:00 AM,2/10/2026,12:30:00 PM
Andrew & Julie (1:00),2/11/2026,9:00:00 AM,2/11/2026,1:00:00PM
Charlie & Julie (1:00),2/12/2026,9:00:00 AM,2/12/2026,1:00:00PM
Andrew & Charlie (1:00),2/13/2026,9:00:00 AM,2/13/2026,1:00:00PM
Charlie & Jim,2/14/2026,9:00:00 AM,2/14/2026,1:00:00 PM
Kathy & Donna,2/16/2026,9:00:00 AM,2/16/2026,12:30:00 PM
Donna & Julie,2/17/2026,9:00:00 AM,2/17/2026,12:30:00 PM
Charlie(1:00) & Julie,2/20/2026,9:00:00 AM,2/20/2026,1:00:00PM
Julie & Danielle,2/21/2026,9:00:00 AM,2/21/2026,1:00:00 PM
Kathy and Donna ,2/23/2026,9:00:00 AM,2/23/2026,12:30:00 PM
Donna & Julie,2/24/2026,9:00:00 AM,2/24/2026,12:30:00 PM
Charlie & Julie (1:00),2/27/2026,9:00:00 AM,2/27/2026,1:00:00PM
Charlie & Jim,2/28/2026,9:00:00 AM,2/28/2026,1:00:00 PM
Kathy & Russ,1/4/2026,12:00:00 PM,1/4/2026,6:00:00 PM
Tylor & Danielle,1/11/2026,12:00:00 PM,1/11/2026,6:00:00 PM
Charlie & Jim,1/18/2026,12:00:00 PM,1/18/2026,6:00:00 PM
Julie & Andrew,1/25/2026,12:00:00 PM,1/25/2026,6:00:00 PM
Kathy & Russ,2/1/2026,12:00:00 PM,2/1/2026,6:00:00 PM
Danielle & Tylor,2/8/2026,12:00:00 PM,2/8/2026,6:00:00 PM
Charlie & Jim,2/15/2026,12:00:00 PM,2/15/2026,6:00:00 PM
Julie & Andrew,2/22/2026,12:00:00 PM,2/22/2026,6:00:00 PM
Kathy & Russ,3/1/2026,12:00:00 PM,3/1/2026,6:00:00 PM
Andrew & Tylor,1/2/2026,12:30:00 PM,1/2/2026,4:30:00 PM
Andrew (12:00) & Kathy,1/5/2026,12:00:00 PM,1/5/2026,4:30:00 PM
Beth (12:00) & Julie,1/6/2026,12:00:00 PM,1/6/2026,4:30:00 PM
Julie & Andrew,1/7/2026,12:30:00 PM,1/7/2026,4:30:00 PM
Charlie & Jorge,1/8/2026,12:30:00 PM,1/8/2026,4:30:00 PM
Andrew (1:00) & Kathy (1:00),1/9/2026,1:00:00PM,1/9/2026,4:30:00 PM
Andrew (12:00) & Kathy,1/12/2026,12:00:00 PM,1/12/2026,4:30:00 PM
Beth (12:00) & Julie,1/13/2026,12:00:00 PM,1/13/2026,4:30:00 PM
Kathy & Andrew,1/14/2026,12:30:00 PM,1/14/2026,4:30:00 PM
Charlie & Jorge,1/15/2026,12:30:00 PM,1/15/2026,4:30:00 PM
Charlie & Andrew,1/16/2026,12:30:00 PM,1/16/2026,4:30:00 PM
Andrew (12:00) & Kathy,1/19/2026,12:00:00 PM,1/19/2026,4:30:00 PM
Beth (12:00) & Julie,1/20/2026,12:00:00 PM,1/20/2026,4:30:00 PM
Kathy & Andrew,1/21/2026,12:30:00 PM,1/21/2026,4:30:00 PM
Charlie & Jorge,1/22/2026,12:30:00 PM,1/22/2026,4:30:00 PM
Andrew & Julie,1/23/2026,12:30:00 PM,1/23/2026,4:30:00 PM
Andrew (12:00) & Kathy,1/26/2026,12:00:00 PM,1/26/2026,4:30:00 PM
Beth (12:00) & Julie,1/27/2026,12:00:00 PM,1/27/2026,4:30:00 PM
Kathy & Andrew,1/28/2026,12:30:00 PM,1/28/2026,4:30:00 PM
Charlie & Jorge,1/29/2026,12:30:00 PM,1/29/2026,4:30:00 PM
Andrew & Kathy,1/30/2026,12:30:00 PM,1/30/2026,4:30:00 PM
Andrew (12:00) & Kathy,2/2/2026,12:00:00 PM,2/2/2026,4:30:00 PM
Beth (12:00) & Julie,2/3/2026,12:00:00 PM,2/3/2026,4:30:00 PM
Kathy & Andrew,2/4/2026,12:30:00 PM,2/4/2026,4:30:00 PM
Charlie & Jorge,2/5/2026,12:30:00 PM,2/5/2026,4:30:00 PM
Charlie & Andrew,2/6/2026,12:30:00 PM,2/6/2026,4:30:00 PM
Andrew (12:00) & Kathy,2/9/2026,12:00:00 PM,2/9/2026,4:30:00 PM
Beth (12:00) & Julie,2/10/2026,12:00:00 PM,2/10/2026,4:30:00 PM
Kathy & Andrew,2/11/2026,12:30:00 PM,2/11/2026,4:30:00 PM
Charlie & Jorge,2/12/2026,12:30:00 PM,2/12/2026,4:30:00 PM
Andrew & Julie,2/13/2026,12:30:00 PM,2/13/2026,4:30:00 PM
Andrew (12:00) & Kathy,2/16/2026,12:00:00 PM,2/16/2026,4:30:00 PM
Beth (12:00) & Julie,2/17/2026,12:00:00 PM,2/17/2026,4:30:00 PM
Andrew & Kathy,2/20/2026,12:30:00 PM,2/20/2026,4:30:00 PM
Andrew (12:00) & Kathy,2/23/2026,12:00:00 PM,2/23/2026,4:30:00 PM
Beth (12:00) & Julie,2/24/2026,12:00:00 PM,2/24/2026,4:30:00 PM
Charlie & Andrew,2/27/2026,12:30:00 PM,2/27/2026,4:30:00 PM
Andrew & Russ (12:30),1/3/2026,12:30:00 PM,1/3/2026,5:00:00 PM
Tylor & Danielle,1/10/2026,1:00:00 PM,1/10/2026,5:00:00 PM
Russ (12:30) & Jim,1/17/2026,12:30:00 PM,1/17/2026,5:00:00 PM
Andrew (12:30) & Danielle,1/24/2026,12:30:00 PM,1/24/2026,5:00:00 PM
Russ & Charlie,1/31/2026,1:00:00 PM,1/31/2026,5:00:00 PM
Russ (12:30) & Tylor,2/7/2026,12:30:00 PM,2/7/2026,5:00:00 PM
Russ (12:30) & Jim,2/14/2026,12:30:00 PM,2/14/2026,5:00:00 PM
Andrew (12:30) & Danielle,2/21/2026,12:30:00 PM,2/21/2026,5:00:00 PM
Kathy & Russ,2/28/2026,1:00:00 PM,2/28/2026,5:00:00 PM
Russ (4:00) & Tylor,1/2/2026,4:30:00 PM,1/2/2026,9:00:00 PM
Charlie & Tylor,1/5/2026,4:30:00 PM,1/5/2026,9:00:00 PM
Tylor & Russ,1/6/2026,4:30:00 PM,1/6/2026,9:00:00 PM
Russ & Danielle,1/7/2026,4:30:00 PM,1/7/2026,9:00:00 PM
Kathy (4:00) & Jorge,1/8/2026,4:30:00 PM,1/8/2026,9:00:00 PM
Andrew & Tylor,1/9/2026,4:30:00 PM,1/9/2026,9:00:00 PM
Charlie & Danielle,1/12/2026,4:30:00 PM,1/12/2026,9:00:00 PM
Danielle & Russ,1/13/2026,4:30:00 PM,1/13/2026,9:00:00 PM
Russ & Danielle,1/14/2026,4:30:00 PM,1/14/2026,9:00:00 PM
Kathy (4:00) & Jorge,1/15/2026,4:30:00 PM,1/15/2026,9:00:00 PM
Andrew & Tylor ,1/16/2026,4:30:00 PM,1/16/2026,9:00:00 PM
Charlie & Danielle,1/19/2026,4:30:00 PM,1/19/2026,9:00:00 PM
Danielle & Russ,1/20/2026,4:30:00 PM,1/20/2026,9:00:00 PM
Russ & Danielle,1/21/2026,4:30:00 PM,1/21/2026,9:00:00 PM
Kathy (4:00) & Jorge,1/22/2026,4:30:00 PM,1/22/2026,9:00:00 PM
Danielle & Tylor,1/23/2026,4:30:00 PM,1/23/2026,9:00:00 PM
Charlie & Danielle,1/26/2026,4:30:00 PM,1/26/2026,9:00:00 PM
Danielle & Russ,1/27/2026,4:30:00 PM,1/27/2026,9:00:00 PM
Russ & Danielle,1/28/2026,4:30:00 PM,1/28/2026,9:00:00 PM
Kathy (4:00) & Jorge,1/29/2026,4:30:00 PM,1/29/2026,9:00:00 PM
Andrew & Tylor,1/30/2026,4:30:00 PM,1/30/2026,9:00:00 PM
Charlie & Danielle,2/2/2026,4:30:00 PM,2/2/2026,9:00:00 PM
Danielle & Russ,2/3/2026,4:30:00 PM,2/3/2026,9:00:00 PM
Russ & Danielle,2/4/2026,4:30:00 PM,2/4/2026,9:00:00 PM
Kathy (4:00) & Jorge,2/5/2026,4:30:00 PM,2/5/2026,9:00:00 PM
Andrew & Tylor ,2/6/2026,4:30:00 PM,2/6/2026,9:00:00 PM
Charlie & Danielle,2/9/2026,4:30:00 PM,2/9/2026,9:00:00 PM
Danielle & Russ,2/10/2026,4:30:00 PM,2/10/2026,9:00:00 PM
Russ & Danielle,2/11/2026,4:30:00 PM,2/11/2026,9:00:00 PM
Kathy (4:00) & Jorge,2/12/2026,4:30:00 PM,2/12/2026,9:00:00 PM
Danielle & Tylor,2/13/2026,4:30:00 PM,2/13/2026,9:00:00 PM
Charlie & Danielle,2/16/2026,4:30:00 PM,2/16/2026,9:00:00 PM
Danielle & Russ,2/17/2026,4:30:00 PM,2/17/2026,9:00:00 PM
Andrew & Tylor,2/20/2026,4:30:00 PM,2/20/2026,9:00:00 PM
Charlie & Danielle,2/23/2026,4:30:00 PM,2/23/2026,9:00:00 PM
Danielle & Russ,2/24/2026,4:30:00 PM,2/24/2026,9:00:00 PM
Andrew & Tylor ,2/27/2026,4:30:00 PM,2/27/2026,9:00:00 PM`;
