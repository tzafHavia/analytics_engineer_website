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
  });

  const itemsByCategory = options.itemsByCategory || {};

  // Items shown in the datalist: scoped to the selected category when one is set,
  // otherwise the full list.
  const itemOptions = filters.productCategory
    ? (itemsByCategory[filters.productCategory] || [])
    : options.itemNames;

  function handleChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function handleCategoryChange(event) {
    const nextCategory = event.target.value;
    setFilters((current) => {
      // If the currently typed item isn't part of the new category, clear it so a
      // stale item value doesn't silently filter to nothing.
      const allowedItems = nextCategory ? (itemsByCategory[nextCategory] || []) : null;
      const keepItem = !allowedItems || allowedItems.includes(current.itemName);
      return {
        ...current,
        productCategory: nextCategory,
        itemName: keepItem ? current.itemName : '',
      };
    });
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
          <select name="productCategory" value={filters.productCategory} onChange={handleCategoryChange}>
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
            placeholder={filters.productCategory ? 'All items in category' : 'All items'}
          />
          <datalist id="overview-item-options">
            {itemOptions.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
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
