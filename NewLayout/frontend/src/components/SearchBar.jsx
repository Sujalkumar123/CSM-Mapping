import { useState, useRef, useEffect } from 'react';
import { IconSearch } from './Icons';

export default function SearchBar({ onSearch, clientsList = [] }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const ql = query.toLowerCase();
  const getCsmNames = () => {
    const names = new Set();
    clientsList.forEach(c => {
      if (c.csm1?.name) names.add(c.csm1.name);
      if (c.csm2?.name) names.add(c.csm2.name);
    });
    return [...names].sort();
  };

  const companies = query
    ? [...new Set(clientsList.map(c => c.legalName))].filter(n => n.toLowerCase().includes(ql)).slice(0, 5)
    : [];
  const names = query
    ? getCsmNames().filter(n => n.toLowerCase().includes(ql)).slice(0, 5)
    : [];
  const hasResults = companies.length > 0 || names.length > 0;

  const handleSelect = (value) => {
    setQuery(value);
    setIsOpen(false);
    onSearch(value);
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(val.length > 0);
    if (val === '') onSearch('');
  };

  return (
    <div className="search" ref={wrapRef}>
      <IconSearch />
      <input
        type="text"
        placeholder="Search by company or CSM name…"
        autoComplete="off"
        value={query}
        onChange={handleInput}
      />
      {isOpen && query && (
        <div className="search-panel">
          {!hasResults ? (
            <div className="search-empty">No matches for "{query}"</div>
          ) : (
            <>
              {companies.length > 0 && (
                <>
                  <div className="search-group-label">Companies</div>
                  {companies.map(c => (
                    <div key={c} className="search-option company" onClick={() => handleSelect(c)}>
                      <span className="tag">🏢</span>{c}
                    </div>
                  ))}
                </>
              )}
              {names.length > 0 && (
                <>
                  <div className="search-group-label">CSMs</div>
                  {names.map(n => (
                    <div key={n} className="search-option person" onClick={() => handleSelect(n)}>
                      <span className="tag">👤</span>{n}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
