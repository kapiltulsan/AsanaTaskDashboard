import React, { useMemo } from 'react';
import { Activity, CheckCircle2, Clock, AlertTriangle, TrendingUp, Settings as SettingsIcon, Filter, FileText, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFilters } from '../context/FilterContext';
import TaskTable from '../components/TaskTable';

const Dashboard = () => {
    const { filteredTasks, loading, activeFilters, setIsFilterOverlayOpen, customTiles, tasks, matchesCriteria } = useFilters();

    const stats = useMemo(() => {
        const total = filteredTasks.length;
        const completed = filteredTasks.filter(t => t.completed).length;
        const active = total - completed;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        const atRisk = filteredTasks.filter(t =>
            t.priority?.toLowerCase().includes('critical') ||
            t.priority?.toLowerCase().includes('high') ||
            Object.values(t.cfMap || {}).some(v => String(v).toLowerCase().includes('critical'))
        ).length;
        return { total, completed, active, rate, atRisk };
    }, [filteredTasks]);

    const today = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-4 bg-slate-50">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                <span className="text-sm text-slate-500 font-medium">Loading dashboard data…</span>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto bg-slate-50">
            <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">

                {/* ── Page Header ─────────────────────────────── */}
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
                            <Calendar size={13} />
                            {today}
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                            {activeFilters.length > 0 ? 'Filtered View' : 'Executive Dashboard'}
                        </h1>
                        {activeFilters.length > 0 && (
                            <p className="text-sm text-slate-500 mt-1">
                                Showing data for {activeFilters.length} active filter{activeFilters.length !== 1 ? 's' : ''}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={() => setIsFilterOverlayOpen(true)}
                            id="btn-adjust-filters"
                            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                        >
                            <Filter size={14} />
                            Adjust Filters
                        </button>
                        <Link
                            to="/settings"
                            id="link-configuration"
                            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                        >
                            <SettingsIcon size={14} />
                            Configure
                        </Link>
                    </div>
                </div>

                {/* ── KPI Tiles ───────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <KpiCard label="Total Tasks" value={stats.total} icon={<FileText size={18} className="text-indigo-500" />} color="indigo" />
                    <KpiCard label="Completed" value={stats.completed} icon={<CheckCircle2 size={18} className="text-emerald-500" />} color="emerald" />
                    <KpiCard label="Active" value={stats.active} icon={<Activity size={18} className="text-sky-500" />} color="sky" />
                    <KpiCard label="Completion %" value={`${stats.rate}%`} icon={<TrendingUp size={18} className="text-violet-500" />} color="violet" />
                    <KpiCard label="At Risk" value={stats.atRisk} icon={<AlertTriangle size={18} className="text-amber-500" />} color="amber" warn={stats.atRisk > 0} />
                    {/* Custom Tiles */}
                    {customTiles.slice(0, 1).map(tile => {
                        const count = tasks.filter(t => matchesCriteria(t, tile.criteria)).length;
                        return (
                            <KpiCard
                                key={tile.id}
                                label={tile.name}
                                value={count}
                                icon={<Activity size={18} className="text-rose-500" />}
                                color="rose"
                            />
                        );
                    })}
                </div>

                {/* Additional custom tiles in a row if any */}
                {customTiles.length > 1 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {customTiles.slice(1, 6).map(tile => {
                            const count = tasks.filter(t => matchesCriteria(t, tile.criteria)).length;
                            return (
                                <KpiCard
                                    key={tile.id}
                                    label={tile.name}
                                    value={count}
                                    icon={<Activity size={18} className="text-rose-500" />}
                                    color="rose"
                                />
                            );
                        })}
                    </div>
                )}

                {/* ── Task Table Section ──────────────────────── */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-base font-semibold text-slate-800">Project Tasks</h2>
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                {filteredTasks.length} records
                            </span>
                        </div>
                    </div>
                    <TaskTable />
                </div>

            </div>
        </div>
    );
};

const KpiCard = ({ label, value, icon, color, warn }) => {
    const colorMap = {
        indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700' },
        emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700' },
        sky: { bg: 'bg-sky-50', border: 'border-sky-100', text: 'text-sky-700' },
        violet: { bg: 'bg-violet-50', border: 'border-violet-100', text: 'text-violet-700' },
        amber: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700' },
        rose: { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-700' },
    };
    const c = colorMap[color] || colorMap.indigo;

    return (
        <div className={`bg-white rounded-xl border ${warn ? 'border-amber-200 shadow-amber-100' : 'border-slate-200'} p-4 shadow-sm hover:shadow-md transition-shadow`}>
            <div className={`w-9 h-9 rounded-lg ${c.bg} ${c.border} border flex items-center justify-center mb-3`}>
                {icon}
            </div>
            <div className="text-2xl font-bold text-slate-900 leading-none mb-1">{value}</div>
            <div className="text-xs font-medium text-slate-500">{label}</div>
        </div>
    );
};

export default Dashboard;
