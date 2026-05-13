'use client';

import { useState, startTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';

function buildQueryString(filters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim()) {
      params.set(key, value.trim());
    }
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

export default function OverviewFilters({ initialFilters, options }) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState({
    dateFrom: initialFilters.dateFrom || '',
    dateTo: initialFilters.dateTo || '',
    productCategory: initialFilters.productCategory || '',
    itemName: initialFilters.itemName || '',
    stockStatus: initialFilters.stockStatus || '',
    velocityBand: initialFilters.velocityBand || '',
  });

  function handleChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    startTransition(() => {
      router.replace(`${pathname}${buildQueryString(filters)}`, { scroll: false });
    });
  }

  function resetFilters() {
    const emptyFilters = {
      dateFrom: '',
      dateTo: '',
      productCategory: '',
      itemName: '',
      stockStatus: '',
      velocityBand: '',
    };

    setFilters(emptyFilters);
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }

  return (
    <section className="od-filter-panel">
      <div className="od-panel-head">
        <div>
          <p className="od-panel-kicker">Global filters</p>
          <h3>Interactive Overview controls</h3>
        </div>
      </div>
      <p className="od-panel-copy">
        Date range updates the KPI and trend blocks. Product and inventory filters apply
        wherever the underlying reporting tables support them.
      </p>

      <form className="od-filter-form" onSubmit={applyFilters}>
        <label className="od-filter-field">
          <span>Date from</span>
          <input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleChange} />
        </label>

        <label className="od-filter-field">
          <span>Date to</span>
          <input type="date" name="dateTo" value={filters.dateTo} onChange={handleChange} />
        </label>

        <label className="od-filter-field">
          <span>Product category</span>
          <select name="productCategory" value={filters.productCategory} onChange={handleChange}>
            <option value="">All categories</option>
            {options.productCategories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="od-filter-field">
          <span>Item</span>
          <input
            list="overview-item-options"
            name="itemName"
            value={filters.itemName}
            onChange={handleChange}
            placeholder="All items"
          />
          <datalist id="overview-item-options">
            {options.itemNames.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </label>

        <label className="od-filter-field">
          <span>Stock status</span>
          <select name="stockStatus" value={filters.stockStatus} onChange={handleChange}>
            <option value="">All stock states</option>
            {options.stockStatuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="od-filter-field">
          <span>Velocity band</span>
          <select name="velocityBand" value={filters.velocityBand} onChange={handleChange}>
            <option value="">All velocity bands</option>
            {options.velocityBands.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="od-filter-actions">
          <button type="submit" className="btn-primary">
            Apply filters
          </button>
          <button type="button" className="btn-ghost od-reset-button" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </form>
    </section>
  );
}