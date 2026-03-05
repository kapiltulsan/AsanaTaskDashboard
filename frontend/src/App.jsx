import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Database, Settings as SettingsIcon, Filter, RefreshCw, ChevronRight } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import DataGrid from './pages/DataGrid';
import Settings from './pages/Settings';
import FilterOverlay from './components/FilterOverlay';
import { useFilters } from './context/FilterContext';

const App = () => {
  const location = useLocation();
  const { setIsFilterOverlayOpen, activeFilters, syncing, triggerSync } = useFilters();

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans select-none relative">

      {/* Global Filter Overlay */}
      <FilterOverlay />

      {/* ── TOP HEADER ───────────────────────────────────── */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-50 shadow-sm">
        {/* Wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white font-black text-[11px] tracking-tight">PI</span>
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-slate-900 leading-none tracking-tight">
              Project Intelligence
            </h1>
            <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5 tracking-wide">
              Management Portal
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3">
          {/* Filter Button */}
          <button
            onClick={() => setIsFilterOverlayOpen(true)}
            id="btn-global-filter"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${activeFilters.length > 0
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800'
              }`}
          >
            <Filter size={13} />
            Filters
            {activeFilters.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 bg-indigo-600 text-white rounded-full text-[10px] font-bold">
                {activeFilters.length}
              </span>
            )}
          </button>

          {/* Sync Button */}
          <button
            onClick={triggerSync}
            id="btn-sync"
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-slate-200" />

          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-slate-500">Live</span>
          </div>
        </div>
      </header>

      {/* ── NAVIGATION ───────────────────────────────────── */}
      <nav className="h-10 bg-white border-b border-slate-200 flex items-end px-6 shrink-0 z-40">
        <NavTab to="/" active={location.pathname === '/'} icon={<LayoutDashboard size={14} />} label="Dashboard" />
        <NavTab to="/grid" active={location.pathname === '/grid'} icon={<Database size={14} />} label="Task Repository" />
        <NavTab to="/settings" active={location.pathname === '/settings'} icon={<SettingsIcon size={14} />} label="Configuration" />
      </nav>

      {/* ── MAIN BODY ─────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/grid" element={<DataGrid />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
};

const NavTab = ({ to, active, icon, label }) => (
  <Link
    to={to}
    className={`h-full px-4 flex items-center gap-2 text-[12px] font-semibold tracking-wide border-b-2 transition-all ${active
        ? 'border-indigo-600 text-indigo-700'
        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
      }`}
  >
    {icon}
    {label}
  </Link>
);

export default App;
