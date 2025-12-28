
import type { Shift, DayOfWeek } from '../types';
import { DAYS_OF_WEEK, EMPLOYEES } from '../constants';

const convertTo24Hour = (timeStr: string): string => {
  const [time, ampm] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

export const parseLibraryCsv = (csvText: string): Shift[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length <= 1) return [];

  const validNames = new Set(EMPLOYEES.map(e => e.name));
  const shifts: Shift[] = [];

  // Remove header
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

    const namesInTitle = title.split(/[&]| and | with /i).map(n => {
      return n.replace(/\(.*?\)/g, '')
              .replace(/ covers lunch.*/gi, '')
              .replace(/ lunch coverage/gi, '')
              .replace(/ covers desk.*/gi, '')
              .replace(/ 1:1 .*/gi, '')
              .trim();
    });

    namesInTitle.forEach(name => {
      const matchedName = Array.from(validNames).find(vn => {
        const firstWord = name.split(' ')[0];
        return firstWord.toLowerCase() === vn.toLowerCase();
      });
      
      if (matchedName) {
        // Store internally in 24h format for consistent comparison
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

export const RAW_SCHEDULE_CSV = `"Subject","Start Date","Start Time","End Date","End Time","All day event"
"Julie and Donna ","11/10/2025","9:00:00 AM","11/10/2025","12:30:00 PM","False"
"Kathy and Donna ","12/1/2025","9:00:00 AM","12/1/2025","12:30:00 PM","False"
"Kathy and Andrew","12/22/2025","9:00:00 AM","12/22/2025","12:30:00 PM","False"
"Kathy and Donna ","1/12/2026","9:00:00 AM","1/12/2026","12:30:00 PM","False"
"Kathy and Donna ","2/2/2026","9:00:00 AM","2/2/2026","12:30:00 PM","False"
"Kathy and Donna ","2/23/2026","9:00:00 AM","2/23/2026","12:30:00 PM","False"
"Julie & Bill ","11/17/2025","9:00:00 AM","11/17/2025","12:30:00 PM","False"
"Kathy & Gregory","12/8/2025","9:00:00 AM","12/8/2025","12:30:00 PM","False"
"Kathy & Tylor","12/29/2025","9:00:00 AM","12/29/2025","12:30:00 PM","False"
"Kathy & Donna","1/19/2026","9:00:00 AM","1/19/2026","12:30:00 PM","False"
"Kathy & Donna","2/9/2026","9:00:00 AM","2/9/2026","12:30:00 PM","False"
"Kathy & Donna","11/3/2025","9:00:00 AM","11/3/2025","12:30:00 PM","False"
"Andrew & Donna","11/24/2025","9:00:00 AM","11/24/2025","12:30:00 PM","False"
"Chris & Donna","12/15/2025","9:00:00 AM","12/15/2025","12:30:00 PM","False"
"Kathy & Donna","1/5/2026","9:00:00 AM","1/5/2026","12:30:00 PM","False"
"Kathy & Donna","1/26/2026","9:00:00 AM","1/26/2026","12:30:00 PM","False"
"Kathy & Donna","2/16/2026","9:00:00 AM","2/16/2026","12:30:00 PM","False"
"Charlie & Julie (1:00)","11/13/2025","9:00:00 AM","11/13/2025","12:30:00 PM","False"
"Charlie & Julie (1:00)","12/4/2025","9:00:00 AM","12/4/2025","12:30:00 PM","False"
"Charlie & Julie (1:00)","1/15/2026","9:00:00 AM","1/15/2026","12:30:00 PM","False"
"Charlie & Julie (1:00)","2/5/2026","9:00:00 AM","2/5/2026","12:30:00 PM","False"
"Charlie & Julie (1:00)","11/6/2025","9:00:00 AM","11/6/2025","12:30:00 PM","False"
"Charlie & Julie (1:00)","12/18/2025","9:00:00 AM","12/18/2025","12:30:00 PM","False"
"Charlie & Julie (1:00)","1/8/2026","9:00:00 AM","1/8/2026","12:30:00 PM","False"
"Charlie & Julie (1:00)","1/29/2026","9:00:00 AM","1/29/2026","12:30:00 PM","False"
"Danielle & Tylor","11/21/2025","4:30:00 PM","11/21/2025","9:00:00 PM","False"
"Danielle & Russ","12/12/2025","4:30:00 PM","12/12/2025","9:00:00 PM","False"
"Russ (4:00) & Tylor","1/2/2026","4:30:00 PM","1/2/2026","9:00:00 PM","False"
"Danielle & Tylor","1/23/2026","4:30:00 PM","1/23/2026","9:00:00 PM","False"
"Danielle & Tylor","2/13/2026","4:30:00 PM","2/13/2026","9:00:00 PM","False"
"Andrew & Julie (1:00)","11/5/2025","9:00:00 AM","11/5/2025","12:30:00 PM","False"
"Andrew & Julie (1:00)","11/12/2025","9:00:00 AM","11/12/2025","12:30:00 PM","False"
"Andrew & Kathy (1:00)","11/19/2025","9:00:00 AM","11/19/2025","12:30:00 PM","False"
"Danielle & Kathy ","11/26/2025","9:00:00 AM","11/26/2025","12:30:00 PM","False"
"Kathy & Julie ","12/3/2025","9:00:00 AM","12/3/2025","12:30:00 PM","False"
"Andrew & Julie ","12/10/2025","9:00:00 AM","12/10/2025","12:30:00 PM","False"
"Andrew (1:00) & Julie","12/17/2025","9:00:00 AM","12/17/2025","12:30:00 PM","False"
"Andrew & Jim (1:00)","12/31/2025","9:00:00 AM","12/31/2025","12:30:00 PM","False"
"Andrew & Julie (1:00)","1/7/2026","9:00:00 AM","1/7/2026","12:30:00 PM","False"
"Andrew & Julie (1:00)","1/14/2026","9:00:00 AM","1/14/2026","12:30:00 PM","False"
"Andrew & Julie (1:00)","1/21/2026","9:00:00 AM","1/21/2026","12:30:00 PM","False"
"Andrew & Julie (1:00)","1/28/2026","9:00:00 AM","1/28/2026","12:30:00 PM","False"
"Andrew & Julie (1:00)","2/4/2026","9:00:00 AM","2/4/2026","12:30:00 PM","False"
"Andrew & Julie (1:00)","2/11/2026","9:00:00 AM","2/11/2026","12:30:00 PM","False"
"Beth (12:00) & Julie","11/4/2025","12:30:00 PM","11/4/2025","4:30:00 PM","False"
"Beth (12:00) & Kathy","11/11/2025","12:30:00 PM","11/11/2025","4:30:00 PM","False"
"Beth (12:00) & Kathy","11/18/2025","12:30:00 PM","11/18/2025","4:30:00 PM","False"
"Beth (12:00) & Julie","11/25/2025","12:30:00 PM","11/25/2025","4:30:00 PM","False"
"Beth (12:00) & Julie","12/2/2025","12:30:00 PM","12/2/2025","4:30:00 PM","False"
"Beth (3:00) & Andrew (3:00-4:30) & Julie","12/9/2025","12:30:00 PM","12/9/2025","4:30:00 PM","False"
"Beth (12:00) & Andrew","12/16/2025","12:30:00 PM","12/16/2025","4:30:00 PM","False"
"Beth & Tylor","12/23/2025","12:30:00 PM","12/23/2025","4:30:00 PM","False"
"Beth (12-3) & Kathy","12/30/2025","12:30:00 PM","12/30/2025","4:30:00 PM","False"
"Donna & Julie","11/4/2025","9:00:00 AM","11/4/2025","12:30:00 PM","False"
"Donna & Kathy","11/11/2025","9:00:00 AM","11/11/2025","12:30:00 PM","False"
"Donna & Kathy","11/18/2025","9:00:00 AM","11/18/2025","12:30:00 PM","False"
"Donna & Julie","11/25/2025","9:00:00 AM","11/25/2025","12:30:00 PM","False"
"Donna & Julie","12/2/2025","9:00:00 AM","12/2/2025","12:30:00 PM","False"
"Beth & Julie","12/9/2025","9:00:00 AM","12/9/2025","12:30:00 PM","False"
"Donna & Julie","12/16/2025","9:00:00 AM","12/16/2025","12:30:00 PM","False"
"Beth & Tylor","12/23/2025","9:00:00 AM","12/23/2025","12:30:00 PM","False"
"Gregory & Kathy","12/30/2025","9:00:00 AM","12/30/2025","12:30:00 PM","False"
"Charlie & Julie (1:00)","11/20/2025","9:00:00 AM","11/20/2025","12:30:00 PM","False"
"Charlie & Julie (1:00)","12/11/2025","9:00:00 AM","12/11/2025","12:30:00 PM","False"
"Charlie & Julie (1:00)","1/22/2026","9:00:00 AM","1/22/2026","12:30:00 PM","False"
"Charlie & Julie (1:00)","2/12/2026","9:00:00 AM","2/12/2026","12:30:00 PM","False"
"Charlie & Jorge","11/6/2025","12:30:00 PM","11/6/2025","4:30:00 PM","False"
"Charlie & Jorge","11/13/2025","12:30:00 PM","11/13/2025","4:30:00 PM","False"
"Charlie & Jorge","11/20/2025","12:30:00 PM","11/20/2025","4:30:00 PM","False"
"Charlie & Jorge","12/4/2025","12:30:00 PM","12/4/2025","4:30:00 PM","False"
"Charlie & Jorge","12/11/2025","12:30:00 PM","12/11/2025","4:30:00 PM","False"
"Charlie & Danielle","12/18/2025","12:30:00 PM","12/18/2025","4:30:00 PM","False"
"Charlie & Jorge","1/8/2026","12:30:00 PM","1/8/2026","4:30:00 PM","False"
"Charlie & Jorge","1/15/2026","12:30:00 PM","1/15/2026","4:30:00 PM","False"
"Charlie & Jorge","1/22/2026","12:30:00 PM","1/22/2026","4:30:00 PM","False"
"Charlie & Jorge","1/29/2026","12:30:00 PM","1/29/2026","4:30:00 PM","False"
"Charlie & Jorge","2/5/2026","12:30:00 PM","2/5/2026","4:30:00 PM","False"
"Charlie & Jorge","2/12/2026","12:30:00 PM","2/12/2026","4:30:00 PM","False"
"Andrew (12:00) & Kathy","11/3/2025","12:30:00 PM","11/3/2025","4:30:00 PM","False"
"Andrew (12:00) & Julie","11/10/2025","12:30:00 PM","11/10/2025","4:30:00 PM","False"
"Andrew (12:00) & Julie","11/17/2025","12:30:00 PM","11/17/2025","4:30:00 PM","False"
"Andrew & Kathy (12:00)","11/24/2025","12:30:00 PM","11/24/2025","4:30:00 PM","False"
"Danielle & Kathy","12/1/2025","12:30:00 PM","12/1/2025","4:30:00 PM","False"
"Andrew (12:00) & Kathy","1/5/2026","12:30:00 PM","1/5/2026","4:30:00 PM","False"
"Andrew (12:00) & Kathy","1/12/2026","12:30:00 PM","1/12/2026","4:30:00 PM","False"
"Andrew (12:00) & Kathy","1/19/2026","12:30:00 PM","1/19/2026","4:30:00 PM","False"
"Andrew (12:00) & Kathy","1/26/2026","12:30:00 PM","1/26/2026","4:30:00 PM","False"
"Andrew (12:00) & Kathy","2/2/2026","12:30:00 PM","2/2/2026","4:30:00 PM","False"
"Andrew (12:00) & Kathy","2/9/2026","12:30:00 PM","2/9/2026","4:30:00 PM","False"
"Andrew (12:00) & Kathy","2/16/2026","12:30:00 PM","2/16/2026","4:30:00 PM","False"
"Andrew (12:00) & Kathy","2/23/2026","12:30:00 PM","2/23/2026","4:30:00 PM","False"
"Charlie & Danielle","11/3/2025","4:30:00 PM","11/3/2025","9:00:00 PM","False"
"Charlie & Danielle","11/10/2025","4:30:00 PM","11/10/2025","9:00:00 PM","False"
"Charlie & Danielle","11/17/2025","4:30:00 PM","11/17/2025","9:00:00 PM","False"
"Russ & Danielle","11/24/2025","4:30:00 PM","11/24/2025","9:00:00 PM","False"
"Charlie & Danielle","12/1/2025","4:30:00 PM","12/1/2025","9:00:00 PM","False"
"Charlie & Danielle","12/8/2025","4:30:00 PM","12/8/2025","9:00:00 PM","False"
"Charlie & Danielle (3:00)","12/15/2025","4:30:00 PM","12/15/2025","9:00:00 PM","False"
"Charlie & Danielle","12/22/2025","4:30:00 PM","12/22/2025","9:00:00 PM","False"
"Russ & Andrew","12/29/2025","4:30:00 PM","12/29/2025","9:00:00 PM","False"
"Charlie & Tylor","1/5/2026","4:30:00 PM","1/5/2026","9:00:00 PM","False"
"Charlie & Danielle","1/12/2026","4:30:00 PM","1/12/2026","9:00:00 PM","False"
"Charlie & Danielle","1/19/2026","4:30:00 PM","1/19/2026","9:00:00 PM","False"
"Charlie & Danielle","1/26/2026","4:30:00 PM","1/26/2026","9:00:00 PM","False"
"Charlie & Danielle","2/2/2026","4:30:00 PM","2/2/2026","9:00:00 PM","False"
"Charlie & Danielle","2/9/2026","4:30:00 PM","2/9/2026","9:00:00 PM","False"
"Charlie & Danielle","2/16/2026","4:30:00 PM","2/16/2026","9:00:00 PM","False"
"Charlie & Danielle","2/23/2026","4:30:00 PM","2/23/2026","9:00:00 PM","False"
"Andrew & Julie","11/21/2025","12:30:00 PM","11/21/2025","4:30:00 PM","False"
"Andrew & Julie","12/12/2025","12:30:00 PM","12/12/2025","4:30:00 PM","False"
"Andrew & Tylor","1/2/2026","12:30:00 PM","1/2/2026","4:30:00 PM","False"
"Andrew & Julie","1/23/2026","12:30:00 PM","1/23/2026","4:30:00 PM","False"
"Andrew & Julie","2/13/2026","12:30:00 PM","2/13/2026","4:30:00 PM","False"
"Andrew & Charlie (1:00)","11/21/2025","9:00:00 AM","11/21/2025","12:30:00 PM","False"
"Andrew & Charlie (1:00)","12/12/2025","9:00:00 AM","12/12/2025","12:30:00 PM","False"
"Andrew & Charlie (1:00)","1/2/2026","9:00:00 AM","1/2/2026","12:30:00 PM","False"
"Andrew & Charlie (1:00)","1/23/2026","9:00:00 AM","1/23/2026","12:30:00 PM","False"
"Andrew & Charlie (1:00)","2/13/2026","9:00:00 AM","2/13/2026","12:30:00 PM","False"
"Charlie & Andrew (2:00 Arrival)","11/14/2025","12:30:00 PM","11/14/2025","4:30:00 PM","False"
"Charlie & Kathy","12/5/2025","12:30:00 PM","12/5/2025","4:30:00 PM","False"
"Danielle & Andrew","12/26/2025","12:30:00 PM","12/26/2025","4:30:00 PM","False"
"Charlie & Andrew","1/16/2026","12:30:00 PM","1/16/2026","4:30:00 PM","False"
"Charlie & Andrew","2/6/2026","12:30:00 PM","2/6/2026","4:30:00 PM","False"
"Charlie & Andrew","2/27/2026","12:30:00 PM","2/27/2026","4:30:00 PM","False"
"Charlie & Julie (2:00)","11/14/2025","9:00:00 AM","11/14/2025","12:30:00 PM","False"
"Charlie & Julie (1:00)","12/5/2025","9:00:00 AM","12/5/2025","12:30:00 PM","False"
"Danielle & Andrew","12/26/2025","9:00:00 AM","12/26/2025","12:30:00 PM","False"
"Charlie & Julie (1:00)","1/16/2026","9:00:00 AM","1/16/2026","12:30:00 PM","False"
"Charlie & Julie (1:00)","2/6/2026","9:00:00 AM","2/6/2026","12:30:00 PM","False"
"Charlie & Julie (1:00)","2/27/2026","9:00:00 AM","2/27/2026","12:30:00 PM","False"
"Andrew & Julie","11/7/2025","12:30:00 PM","11/7/2025","4:30:00 PM","False"
"Russ & Tylor","11/28/2025","12:30:00 PM","11/28/2025","4:30:00 PM","False"
"Andrew (1:00) & Kathy","12/19/2025","12:30:00 PM","12/19/2025","4:30:00 PM","False"
"Andrew (1:00) & Kathy (1:00)","1/9/2026","12:30:00 PM","1/9/2026","4:30:00 PM","False"
"Andrew & Kathy","1/30/2026","12:30:00 PM","1/30/2026","4:30:00 PM","False"
"Andrew & Kathy","2/20/2026","12:30:00 PM","2/20/2026","4:30:00 PM","False"
"Charlie (1:00) & Julie","11/7/2025","9:00:00 AM","11/7/2025","12:30:00 PM","False"
"Jim & Kathy","11/28/2025","9:00:00 AM","11/28/2025","12:30:00 PM","False"
"Charlie (1:00) & Kathy","12/19/2025","9:00:00 AM","12/19/2025","12:30:00 PM","False"
"Charlie(1:00) & Julie(1:00)","1/9/2026","9:00:00 AM","1/9/2026","12:30:00 PM","False"
"Charlie(1:00) & Julie","1/30/2026","9:00:00 AM","1/30/2026","12:30:00 PM","False"
"Charlie(1:00) & Julie","2/20/2026","9:00:00 AM","2/20/2026","12:30:00 PM","False"
"Kathy & Russ","3/1/2026","12:00:00 PM","3/1/2026","6:00:00 PM","False"
"Kathy & Russ","2/28/2026","1:00:00 PM","2/28/2026","5:00:00 PM","False"
"Charlie & Jim","2/28/2026","9:00:00 AM","2/28/2026","1:00:00 PM","False"
"Julie & Andrew","2/22/2026","12:00:00 PM","2/22/2026","6:00:00 PM","False"
"Andrew (12:30) & Danielle","2/21/2026","1:00:00 PM","2/21/2026","5:00:00 PM","False"
"Julie & Danielle","2/21/2026","9:00:00 AM","2/21/2026","1:00:00 PM","False"
"Charlie & Jim","2/15/2026","12:00:00 PM","2/15/2026","6:00:00 PM","False"
"Russ (12:30) & Jim","2/14/2026","1:00:00 PM","2/14/2026","5:00:00 PM","False"
"Charlie & Jim","2/14/2026","9:00:00 AM","2/14/2026","1:00:00 PM","False"
"Danielle & Tylor","2/8/2026","12:00:00 PM","2/8/2026","6:00:00 PM","False"
"Russ (12:30) & Tylor","2/7/2026","1:00:00 PM","2/7/2026","5:00:00 PM","False"
"Danielle & Tylor","2/7/2026","9:00:00 AM","2/7/2026","1:00:00 PM","False"
"Kathy & Russ","2/1/2026","12:00:00 PM","2/1/2026","6:00:00 PM","False"
"Russ & Charlie","1/31/2026","1:00:00 PM","1/31/2026","5:00:00 PM","False"
"Kathy & Jim","1/31/2026","9:00:00 AM","1/31/2026","1:00:00 PM","False"
"Julie & Andrew","1/25/2026","12:00:00 PM","1/25/2026","6:00:00 PM","False"
"Andrew (12:30) & Danielle","1/24/2026","1:00:00 PM","1/24/2026","5:00:00 PM","False"
"Julie & Danielle","1/24/2026","9:00:00 AM","1/24/2026","1:00:00 PM","False"
"Charlie & Jim","1/18/2026","12:00:00 PM","1/18/2026","6:00:00 PM","False"
"Russ (12:30) & Jim","1/17/2026","1:00:00 PM","1/17/2026","5:00:00 PM","False"
"Charlie & Jim","1/17/2026","9:00:00 AM","1/17/2026","1:00:00 PM","False"
"Tylor & Danielle","1/11/2026","12:00:00 PM","1/11/2026","6:00:00 PM","False"
"Tylor & Danielle","1/10/2026","1:00:00 PM","1/10/2026","5:00:00 PM","False"
"Tylor & Danielle","1/10/2026","9:00:00 AM","1/10/2026","1:00:00 PM","False"
"Kathy & Russ","1/4/2026","12:00:00 PM","1/4/2026","6:00:00 PM","False"
"Andrew & Russ (12:30)","1/3/2026","1:00:00 PM","1/3/2026","5:00:00 PM","False"
"Charlie & Tylor","1/3/2026","9:00:00 AM","1/3/2026","1:00:00 PM","False"
"Danielle & Andrew","12/28/2025","12:00:00 PM","12/28/2025","6:00:00 PM","False"
"Andrew (12:30) & Danielle","12/27/2025","1:00:00 PM","12/27/2025","5:00:00 PM","False"
"Tylor & Danielle","12/27/2025","9:00:00 AM","12/27/2025","1:00:00 PM","False"
"Charlie & Jim","12/21/2025","12:00:00 PM","12/21/2025","5:00:00 PM","False"
"Russ (12:30) & Jim","12/20/2025","1:00:00 PM","12/20/2025","5:00:00 PM","False"
"Charlie & Jim","12/20/2025","9:00:00 AM","12/20/2025","1:00:00 PM","False"
"Russ & Tylor","12/14/2025","12:00:00 PM","12/14/2025","6:00:00 PM","False"
"Russ (12:30) & Tylor","12/13/2025","1:00:00 PM","12/13/2025","5:00:00 PM","False"
"Danielle & Tylor","12/13/2025","9:00:00 AM","12/13/2025","1:00:00 PM","False"
"Kathy & Russ","12/7/2025","12:00:00 PM","12/7/2025","6:00:00 PM","False"
"Andrew & Charlie","12/6/2025","1:00:00 PM","12/6/2025","5:00:00 PM","False"
"Kathy & Julie","12/6/2025","9:00:00 AM","12/6/2025","1:00:00 PM","False"
"Tylor & Russ","11/30/2025","12:00:00 PM","11/30/2025","6:00:00 PM","False"
"Russ (12:30) & Danielle","11/29/2025","1:00:00 PM","11/29/2025","5:00:00 PM","False"
"Tylor & Danielle","11/29/2025","9:00:00 AM","11/29/2025","1:00:00 PM","False"
"Charlie & Jim","11/23/2025","12:00:00 PM","11/23/2025","6:00:00 PM","False"
"Russ & Tylor","11/22/2025","1:00:00 PM","11/22/2025","5:00:00 PM","False"
"Charlie & Jim","11/22/2025","9:00:00 AM","11/22/2025","1:00:00 PM","False"
"Julie & Danielle","11/16/2025","12:00:00 PM","11/16/2025","6:00:00 PM","False"
"Julie & Danielle","11/15/2025","1:00:00 PM","11/15/2025","5:00:00 PM","False"
"Julie & Danielle","11/15/2025","9:00:00 AM","11/15/2025","1:00:00 PM","False"
"Tylor & Russ","11/9/2025","12:00:00 PM","11/9/2025","6:00:00 PM","False"
"Tylor & Russ (12:30)","11/8/2025","1:00:00 PM","11/8/2025","5:00:00 PM","False"
"Tylor & Danielle (10:00) & Julie (10:00-1:00)","11/8/2025","9:00:00 AM","11/8/2025","1:00:00 PM","False"
"Julie & Andrew","11/2/2025","12:00:00 PM","11/2/2025","6:00:00 PM","False"
"Andrew (12:30) & Danielle","11/1/2025","1:00:00 PM","11/1/2025","5:00:00 PM","False"
"Julie & Danielle","11/1/2025","9:00:00 AM","11/1/2025","1:00:00 PM","False"
"Tylor & Russ","1/6/2026","4:30:00 PM","1/6/2026","9:00:00 PM","False"
"Danielle & Russ","1/13/2026","4:30:00 PM","1/13/2026","9:00:00 PM","False"
"Danielle & Russ","1/20/2026","4:30:00 PM","1/20/2026","9:00:00 PM","False"
"Danielle & Russ","1/27/2026","4:30:00 PM","1/27/2026","9:00:00 PM","False"
"Danielle & Russ","2/3/2026","4:30:00 PM","2/3/2026","9:00:00 PM","False"
"Danielle & Russ","2/10/2026","4:30:00 PM","2/10/2026","9:00:00 PM","False"
"Danielle & Russ","2/17/2026","4:30:00 PM","2/17/2026","9:00:00 PM","False"
"Danielle & Russ","2/24/2026","4:30:00 PM","2/24/2026","9:00:00 PM","False"
"Beth (12:00) & Julie","1/6/2026","12:30:00 PM","1/6/2026","4:30:00 PM","False"
"Beth (12:00) & Julie","1/13/2026","12:30:00 PM","1/13/2026","4:30:00 PM","False"
"Beth (12:00) & Julie","1/20/2026","12:30:00 PM","1/20/2026","4:30:00 PM","False"
"Beth (12:00) & Julie","1/27/2026","12:30:00 PM","1/27/2026","4:30:00 PM","False"
"Beth (12:00) & Julie","2/3/2026","12:30:00 PM","2/3/2026","4:30:00 PM","False"
"Beth (12:00) & Julie","2/10/2026","12:30:00 PM","2/10/2026","4:30:00 PM","False"
"Beth (12:00) & Julie","2/17/2026","12:30:00 PM","2/17/2026","4:30:00 PM","False"
"Beth (12:00) & Julie","2/24/2026","12:30:00 PM","2/24/2026","4:30:00 PM","False"
"Donna & Julie","1/6/2026","9:00:00 AM","1/6/2026","12:30:00 PM","False"
"Donna & Julie","1/13/2026","9:00:00 AM","1/13/2026","12:30:00 PM","False"
"Donna & Julie","1/20/2026","9:00:00 AM","1/20/2026","12:30:00 PM","False"
"Donna & Julie","1/27/2026","9:00:00 AM","1/27/2026","12:30:00 PM","False"
"Donna & Julie","2/3/2026","9:00:00 AM","2/3/2026","12:30:00 PM","False"
"Donna & Julie","2/10/2026","9:00:00 AM","2/10/2026","12:30:00 PM","False"
"Donna & Julie","2/17/2026","9:00:00 AM","2/17/2026","12:30:00 PM","False"
"Donna & Julie","2/24/2026","9:00:00 AM","2/24/2026","12:30:00 PM","False"
"Andrew & Russ","11/14/2025","4:30:00 PM","11/14/2025","9:00:00 PM","False"
"Kathy & Tylor (4:00)","12/5/2025","4:30:00 PM","12/5/2025","9:00:00 PM","False"
"Russ & Tylor ","12/26/2025","4:30:00 PM","12/26/2025","9:00:00 PM","False"
"Andrew & Tylor ","1/16/2026","4:30:00 PM","1/16/2026","9:00:00 PM","False"
"Andrew & Tylor ","2/6/2026","4:30:00 PM","2/6/2026","9:00:00 PM","False"
"Andrew & Tylor ","2/27/2026","4:30:00 PM","2/27/2026","9:00:00 PM","False"
"Andrew & Tylor","11/7/2025","4:30:00 PM","11/7/2025","9:00:00 PM","False"
"Russ & Tylor","11/28/2025","4:30:00 PM","11/28/2025","9:00:00 PM","False"
"Andrew & Tylor","12/19/2025","4:30:00 PM","12/19/2025","9:00:00 PM","False"
"Andrew & Tylor","1/9/2026","4:30:00 PM","1/9/2026","9:00:00 PM","False"
"Andrew & Tylor","1/30/2026","4:30:00 PM","1/30/2026","9:00:00 PM","False"
"Andrew & Tylor","2/20/2026","4:30:00 PM","2/20/2026","9:00:00 PM","False"
"Kathy (4:00) & Jorge","11/13/2025","4:30:00 PM","11/13/2025","9:00:00 PM","False"
"Kathy (4:00) & Jorge","12/4/2025","4:30:00 PM","12/4/2025","9:00:00 PM","False"
"Kathy (4:00) & Jorge","1/15/2026","4:30:00 PM","1/15/2026","9:00:00 PM","False"
"Kathy (4:00) & Jorge","2/5/2026","4:30:00 PM","2/5/2026","9:00:00 PM","False"
"Kathy (4:00) & Jorge","11/6/2025","4:30:00 PM","11/6/2025","9:00:00 PM","False"
"Kathy & Jorge","12/18/2025","4:30:00 PM","12/18/2025","9:00:00 PM","False"
"Kathy (4:00) & Jorge","1/8/2026","4:30:00 PM","1/8/2026","9:00:00 PM","False"
"Kathy (4:00) & Jorge","1/29/2026","4:30:00 PM","1/29/2026","9:00:00 PM","False"
"Kathy (4:00) & Jorge","11/20/2025","4:30:00 PM","11/20/2025","9:00:00 PM","False"
"Kathy (4:00) & Jorge","12/11/2025","4:30:00 PM","12/11/2025","9:00:00 PM","False"
"Kathy (4:00) & Jorge","1/22/2026","4:30:00 PM","1/22/2026","9:00:00 PM","False"
"Kathy (4:00) & Jorge","2/12/2026","4:30:00 PM","2/12/2026","9:00:00 PM","False"
"Danielle & Andrew","11/4/2025","4:30:00 PM","11/4/2025","9:00:00 PM","False"
"Danielle & Russ","11/11/2025","4:30:00 PM","11/11/2025","9:00:00 PM","False"
"Danielle & Russ","11/18/2025","4:30:00 PM","11/18/2025","9:00:00 PM","False"
"Danielle & Russ","11/25/2025","4:30:00 PM","11/25/2025","9:00:00 PM","False"
"Danielle & Russ","12/2/2025","4:30:00 PM","12/2/2025","9:00:00 PM","False"
"Danielle & Russ","12/9/2025","4:30:00 PM","12/9/2025","9:00:00 PM","False"
"Danielle & Russ","12/16/2025","4:30:00 PM","12/16/2025","9:00:00 PM","False"
"Danielle (4:00) & Russ","12/23/2025","4:30:00 PM","12/23/2025","9:00:00 PM","False"
"Chris & Russ (3:00)","12/30/2025","4:30:00 PM","12/30/2025","9:00:00 PM","False"`;
