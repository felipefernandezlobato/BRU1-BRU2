"use client";

interface CalendarDay {
  date: string;
  count: number;
}

interface CalendarViewProps {
  year: number;
  month: number;
  selectedDate: string | null;
  calendarData: CalendarDay[];
  onSelectDate: (date: string | null) => void;
  onMonthChange: (year: number, month: number) => void;
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

function ChevronLeft() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function CalendarView({
  year,
  month,
  selectedDate,
  calendarData,
  onSelectDate,
  onMonthChange,
}: CalendarViewProps) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const movementDates = new Map<string, number>();
  for (const d of calendarData) {
    movementDates.set(d.date, d.count);
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function dateStr(day: number): string {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function handlePrev() {
    if (month === 0) onMonthChange(year - 1, 11);
    else onMonthChange(year, month - 1);
  }

  function handleNext() {
    if (month === 11) onMonthChange(year + 1, 0);
    else onMonthChange(year, month + 1);
  }

  function handleDayClick(day: number) {
    const ds = dateStr(day);
    onSelectDate(selectedDate === ds ? null : ds);
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm" style={{ border: "1px solid #E5E7EB" }}>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={handlePrev}
          className="p-2 rounded-lg text-[#6B7280] active:bg-[#F3F4F6] touch-manipulation"
          aria-label="Mes anterior"
        >
          <ChevronLeft />
        </button>
        <h2 className="text-base font-semibold text-[#1A1A1A]">
          {MONTH_NAMES[month]} {year}
        </h2>
        <button
          onClick={handleNext}
          className="p-2 rounded-lg text-[#6B7280] active:bg-[#F3F4F6] touch-manipulation"
          aria-label="Mes siguiente"
        >
          <ChevronRight />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((label) => (
          <div key={label} className="text-center text-xs font-medium text-[#9CA3AF] py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="min-h-[40px]" />;
          }

          const ds = dateStr(day);
          const isToday = ds === todayStr;
          const isSelected = ds === selectedDate;
          const count = movementDates.get(ds) || 0;
          const hasMovements = count > 0;

          let cellClass = "relative flex flex-col items-center justify-center rounded-lg text-sm touch-manipulation transition-colors min-h-[40px]";
          if (isSelected) {
            cellClass += " bg-[#861A22] text-white";
          } else if (hasMovements) {
            cellClass += " bg-[#F8F0F1] text-[#1A1A1A]";
          } else {
            cellClass += " text-[#1A1A1A]";
          }
          if (isToday && !isSelected) {
            cellClass += " ring-1 ring-[#861A22]";
          }

          return (
            <button
              key={day}
              onClick={() => handleDayClick(day)}
              className={cellClass}
            >
              <span className={isSelected ? "font-bold" : hasMovements ? "font-semibold" : ""}>
                {day}
              </span>
              {hasMovements && (
                <span className={`text-[10px] leading-none mt-0.5 ${isSelected ? "text-white/80" : "text-[#861A22]"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
