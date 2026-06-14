'use client';

import { startTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const RANGES = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

const DAY_MODES = [
  { value: 'weekday', label: 'Weekday' },
  { value: 'date', label: 'Date' },
];

export default function TestDashControls({
  range,
  year,
  month,
  weekOfMonth,
  dayOfWeek,
  weeksInMonth,
  dayMode,
  date,
  monthStart,
  refDate,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Apply a set of param updates, optionally removing some keys (e.g. the
  // other mode's stale sub-filter when switching range).
  function pushParams(updates, removeKeys = []) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      params.set(key, String(value));
    });
    removeKeys.forEach((key) => params.delete(key));
    const queryString = params.toString();
    startTransition(() => {
      router.replace(`${pathname}${queryString ? `?${queryString}` : ''}`, { scroll: false });
    });
  }

  // Switching range drops the other mode's sub-filter param so a stale/invalid
  // value never leaks across modes (backend defaults handle absence).
  function changeRange(nextRange) {
    const removeKeys = [];
    if (nextRange !== 'day') removeKeys.push('dow', 'daymode', 'date');
    if (nextRange !== 'week') removeKeys.push('week');
    pushParams({ range: nextRange }, removeKeys);
  }

  // Switching day-mode drops the other mode's sub-filter so a stale value never
  // leaks (backend defaults handle absence).
  function changeDayMode(nextMode) {
    const removeKeys = nextMode === 'date' ? ['dow'] : ['date'];
    pushParams({ daymode: nextMode }, removeKeys);
  }

  const activeDayMode = dayMode === 'date' ? 'date' : 'weekday';
  const dayModeIndex = Math.max(0, DAY_MODES.findIndex((item) => item.value === activeDayMode));

  const weekCount = Number.isInteger(weeksInMonth) && weeksInMonth > 0 ? weeksInMonth : 5;
  const weekOptions = Array.from({ length: weekCount }, (_, i) => i + 1);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const activeIndex = Math.max(0, RANGES.findIndex((item) => item.value === range));

  return (
    <div className="td-controls">
      <div
        className="td-seg"
        role="group"
        aria-label="Time range"
        style={{ '--seg-index': activeIndex, '--seg-count': RANGES.length }}
      >
        {/* Sliding active highlight — sits behind the button labels (z-index). */}
        <span className="td-seg-thumb" aria-hidden />
        {RANGES.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`td-seg-btn${range === item.value ? ' is-active' : ''}`}
            aria-pressed={range === item.value}
            onClick={() => changeRange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="td-control-group">
        <label className="td-control-field">
          <span>Month</span>
          <div className="td-select-wrap">
            <select
              className="td-select"
              value={month}
              onChange={(event) => pushParams({ month: event.target.value, year })}
            >
              {MONTHS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="td-control-field">
          <span>Year</span>
          <div className="td-select-wrap">
            <select
              className="td-select"
              value={year}
              onChange={(event) => pushParams({ year: event.target.value, month })}
            >
              {years.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </label>

        {range === 'day' && (
          <div className="td-subfilter td-daymode-group">
            <div
              className="td-daymode-seg"
              role="group"
              aria-label="Day mode"
              style={{ '--seg-index': dayModeIndex, '--seg-count': DAY_MODES.length }}
            >
              <span className="td-daymode-thumb" aria-hidden />
              {DAY_MODES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`td-daymode-btn${activeDayMode === item.value ? ' is-active' : ''}`}
                  aria-pressed={activeDayMode === item.value}
                  onClick={() => changeDayMode(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {activeDayMode === 'weekday' ? (
              <label className="td-control-field td-dayfield">
                <span>Day of week</span>
                <div className="td-select-wrap">
                  <select
                    className="td-select"
                    value={dayOfWeek}
                    onChange={(event) => pushParams({ dow: event.target.value })}
                  >
                    {WEEKDAYS.map((label, index) => (
                      <option key={label} value={index}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            ) : (
              <label className="td-control-field td-dayfield">
                <span>Date</span>
                <input
                  type="date"
                  className="td-date-input"
                  value={date || ''}
                  min={monthStart || undefined}
                  max={refDate || undefined}
                  onChange={(event) => {
                    if (event.target.value) pushParams({ date: event.target.value });
                  }}
                />
              </label>
            )}
          </div>
        )}

        {range === 'week' && (
          <label className="td-control-field td-subfilter">
            <span>Week</span>
            <div className="td-select-wrap">
              <select
                className="td-select"
                value={weekOfMonth}
                onChange={(event) => pushParams({ week: event.target.value })}
              >
                {weekOptions.map((value) => (
                  <option key={value} value={value}>
                    {`Week ${value}`}
                  </option>
                ))}
              </select>
            </div>
          </label>
        )}
      </div>
    </div>
  );
}
