'use client';

import { startTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Compact per-tab filter bar for the Inventory / Products tabs.
 *
 * Renders one <select> per entry in `selectors` and writes the chosen value to
 * the URL via router.replace, PRESERVING every other active query param
 * (especially `tab`, plus date/category filters). Selecting the empty "All"
 * option deletes that param.
 *
 * @param {Array<{param: string, label: string, allLabel: string,
 *                options: Array<{value: string, label: string}>}>} selectors
 */
export default function TabFilterBar({ selectors = [] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const usable = selectors.filter((s) => s && s.options && s.options.length > 0);
  if (usable.length === 0) return null;

  function handleChange(param, value) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(param, value);
    } else {
      params.delete(param);
    }
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  const hasAny = usable.some((s) => searchParams.get(s.param));

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    usable.forEach((s) => params.delete(s.param));
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <div className="od-tab-filter-bar">
      {usable.map((selector) => (
        <label key={selector.param} className="od-filter-field od-filter-field--inline">
          <span>{selector.label}</span>
          <select
            value={searchParams.get(selector.param) || ''}
            onChange={(event) => handleChange(selector.param, event.target.value)}
          >
            <option value="">{selector.allLabel || 'All'}</option>
            {selector.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {hasAny && (
        <button type="button" className="btn-ghost od-tab-filter-clear" onClick={clearAll}>
          Clear
        </button>
      )}
    </div>
  );
}
