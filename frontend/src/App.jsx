import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Database, Settings as SettingsIcon, Filter, RefreshCw, Search, X as XIcon } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import DataGrid from './pages/DataGrid';
import Settings from './pages/Settings';
import FilterOverlay from './components/FilterOverlay';
import { useFilters } from './context/FilterContext';

/**
 * Root Application Component
 * 
 * Sets up the main layout structure, routing context (via react-router-dom),
 * and the topmost global navigation header. Mounts the global FilterOverlay
 * which listens to the application-wide context.
 */
const App = () => {
  const location = useLocation();
  const { setIsFilterOverlayOpen, activeFilters, syncing, triggerSync, searchQuery, setSearchQuery } = useFilters();

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans select-none relative">

      {/* Global Filter Overlay */}
      <FilterOverlay />

      {/* Global Sync Loading Indicator */}
      {syncing && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-white/60 backdrop-blur-[2px] transition-all">
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <RefreshCw size={16} className="text-indigo-600 animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-sm font-bold text-slate-900">Synchronizing Data</h3>
              <p className="text-[11px] text-slate-500 font-medium">Fetching latest tasks from Asana...</p>
            </div>
          </div>
        </div>
      )}

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

          {/* Inline Search Bar */}
          <div className="relative flex items-center">
            <Search size={13} className="absolute left-3 text-slate-400 pointer-events-none" />
            <input
              id="input-header-search"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks…"
              className="pl-8 pr-7 py-1.5 w-48 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-slate-400 hover:text-slate-600 transition-colors"
                title="Clear search"
              >
                <XIcon size={12} />
              </button>
            )}
          </div>

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

/**
 * Navigation Tab sub-component.
 * Renders a stylized link item in the bottom navigation bar of the application header.
 * 
 * @param {Object} props
 * @param {string} props.to - The URL path to route to.
 * @param {boolean} props.active - Optional flag forcing the active visual state.
 * @param {React.ReactNode} props.icon - An icon component (e.g., Lucide icon) to display.
 * @param {string} props.label - The text label for the navigation tab.
 */
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
