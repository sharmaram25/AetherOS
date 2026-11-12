
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const CalendarApp = () => {
  const [date, setDate] = useState(new Date());

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth();
  const today = new Date();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const changeMonth = (offset: number) => {
    setDate(new Date(currentYear, currentMonth + offset, 1));
  };

  const renderDays = () => {
    const totalDays = daysInMonth(currentYear, currentMonth);
    const startDay = firstDayOfMonth(currentYear, currentMonth);
    const days = [];

    // Empty cells for previous month
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10" />);
    }

    // Days
    for (let d = 1; d <= totalDays; d++) {
      const isToday = d === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
      days.push(
        <div 
          key={d} 
          className={`h-10 flex items-center justify-center rounded-full text-sm font-medium transition-all cursor-default
            ${isToday ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50' : 'text-gray-300 hover:bg-white/10'}
          `}
        >
          {d}
        </div>
      );
    }

    return days;
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/90 text-white p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">{monthNames[currentMonth]}</h2>
          <p className="text-white/40 font-mono text-sm">{currentYear}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={20}/></button>
          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><ChevronRight size={20}/></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map(day => (
          <div key={day} className="text-center text-xs font-bold text-white/30 uppercase tracking-wider py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 flex-1">
        {renderDays()}
      </div>
    </div>
  );
};

export default CalendarApp;
