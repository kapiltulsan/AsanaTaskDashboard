import React, { useState } from 'react';
import {
    ArrowUp, ArrowDown, ChevronUp, ChevronDown,
    Settings2, Check, X, User, CheckCircle2, Circle, Clock,
    MessageSquare, ExternalLink, Layout, Calendar,
    ChevronRight, FileText, AlertCircle, Tag, Briefcase,
    TrendingUp, TrendingDown, Minus, Activity
} from 'lucide-react';
import { useFilters } from '../context/FilterContext';
import api from '../api';

// ── Variance helpers ────────────────────────────────────────────
/**
 * Calculates the number of days between two date strings.
 * 
 * @param {string|Date} dateA - The starting date.
 * @param {string|Date} dateB - The ending date.
 * @returns {number} Round number of days between the two dates.
 */
const daysBetween = (dateA, dateB) => {
    const a = new Date(dateA);
    const b = new Date(dateB);
};

/**
 * Returns Tailwind CSS classes based on a numeric variance value.
 * Used for styling the phase variance badges.
 * 
 * @param {number} v - The calculated variance in days.
 * @returns {Object} An object containing text, bg, border, and dot Tailwind classes.
 */
const varianceColor = (v) => {
    if (v <= 0) return { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' };
    if (v <= 5) return { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' };
    return { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' };
};

/**
 * Returns Tailwind CSS classes based on a string status value.
 * 
 * @param {string} status - Phase status text (e.g., 'Completed', 'In Progress').
 * @returns {string} Tailwind utility classes for the status badge.
 */
const statusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s === 'in progress') return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
};

const healthConfig = {
    GREEN: { label: 'On Track', bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-300' },
    AMBER: { label: 'At Risk', bg: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-300' },
    RED: { label: 'Delayed', bg: 'bg-red-500', light: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-300' },
};

};

// ── Extract status_card JSON from plain text notes ───────────────
/**
 * Attempts to extract a structured "status_card" from a task's raw notes string.
 * It first tries looking for a JSON block containing "status_card". If that fails,
 * it falls back to a custom tabular text parsing logic often resulting from Excel pastes.
 * 
 * @param {string} notes - The raw text/notes block from an Asana task.
 * @returns {Object|null} Extracted status card data including phases and golive dates, or null.
 */
const extractStatusCard = (notes) => {
    if (!notes) return null;

    // 1. Try to find a JSON block in the text
    try {
        const match = notes.match(/\{[\s\S]*"status_card"[\s\S]*\}/);
        if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.status_card) return parsed.status_card;
        }
    } catch {
        // Fall through to tabular parsing if JSON parsing fails
    }

    // 2. Try Tabular parsing (e.g. pasted from Excel)
    try {
        const lines = notes.split('\n').map(l => l.trim()).filter(Boolean);
        let planned_golive = null;
        let estimated_golive = null;
        const phases = [];

        // Find GoLive dates
        const goLiveLine = lines.find(l => l.toLowerCase().includes('golive') || l.toLowerCase().includes('go-live') || l.toLowerCase().includes('go live'));
        if (goLiveLine) {
            const parts = goLiveLine.split(/\t|\s{2,}/).map(s => s.trim()).filter(Boolean);
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i].toLowerCase();
                if (part.includes('plan') && part.includes('golive') && i + 1 < parts.length) {
                    if (!parts[i + 1].toLowerCase().includes('golive')) planned_golive = parts[i + 1];
                }
                if (part.includes('est') && part.includes('golive') && i + 1 < parts.length) {
                    if (!parts[i + 1].toLowerCase().includes('golive')) estimated_golive = parts[i + 1];
                }
            }
        }

        // Find phases grid: Look for headers "Status", "Plan Start", etc
        let headerIdx = lines.findIndex(l => l.toLowerCase().includes('plan start') || l.toLowerCase().includes('status\tplan'));
        if (headerIdx !== -1) {
            for (let i = headerIdx + 1; i < lines.length; i++) {
                const rowLine = lines[i];
                const rowParts = rowLine.split(/\t/).map(s => s.trim());
                if (rowParts.length >= 4) {
                    let name = rowParts[0];
                    let status = rowParts[1];
                    let plan_start = rowParts[2];
                    let plan_end = rowParts[3];
                    let actual_start = rowParts.length > 4 ? rowParts[4] : '';
                    let est_end = rowParts.length > 5 ? rowParts[5] : plan_end;

                    if (name && plan_start && plan_end) {
                        phases.push({ name, status, plan_start, plan_end, actual_start, est_end });
                    }
                }
            }
        }

        if (phases.length > 0) {
            return {
                planned_golive: planned_golive || phases[phases.length - 1].plan_end,
                estimated_golive: estimated_golive || phases[phases.length - 1].est_end,
                phases
            };
        }
    } catch {
        // Fallback to null
    }

    return null;
};

};

// ── Extract Highlights and Updates JSON from stories ─────────────
/**
 * Parses through a list of raw task stories/comments looking for injected
 * structured JSON data denoting "highlights" and "updates".
 * 
 * @param {Array} stories - Array of story objects fetched from asana.
 * @returns {Array} List of extracted highlight/update objects, sorted by date descending.
 */
const extractHighlightsAndUpdates = (stories) => {
    const extracted = [];
    (stories || []).forEach(story => {
        if (!story.text) return;
        try {
            const match = story.text.match(/\{[\s\S]*"date"[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                if (parsed.date && (parsed.highlights || parsed.updates)) {
                    extracted.push({
                        ...parsed,
                        created_by: story.created_by,
                        created_at: story.created_at,
                        story_gid: story.gid
                    });
                }
            }
        } catch {
            // ignore parse errors
        }
    });
    return extracted.sort((a, b) => new Date(b.date) - new Date(a.date));
};

};

// ── Auto-derive health from phase variances ──────────────────────
/**
 * Calculates a high-level health status indicator ('GREEN', 'AMBER', 'RED')
 * based on the maximum variance found across all phases.
 * 
 * @param {Array} phases - List of phase objects containing `plan_end` and `est_end`.
 * @returns {string} Health identifier string.
 */
const deriveHealth = (phases) => {
    const maxVariance = Math.max(...phases.map(p => daysBetween(p.plan_end, p.est_end)));
    if (maxVariance > 5) return 'RED';
    if (maxVariance > 0) return 'AMBER';
    return 'GREEN';
};

};

// ── Error boundary to expose silent crashes ──────────────────────
/**
 * A lightweight error boundary wrapper to catch UI rendering crashes
 * specifically within complex card/table rendering blocks.
 */
class CardErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(e) { return { error: e }; }
    render() {
        if (this.state.error) {
            return (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                    <strong>Card Error:</strong> {this.state.error.message}
                </div>
            );
        }
        return this.props.children;
    }
}

// ════════════════════════════════════════════════════════════════
//  Project Status Card Component
// ════════════════════════════════════════════════════════════════
/**
 * Renders the detailed "Project Status" card from extracted phase variance data.
 * Displays derived health metrics, GoLive offsets, and a phase tracking table.
 * 
 * @param {Object} props
 * @param {Object} props.card - The structured status card data object.
 */
const ProjectStatusCard = ({ card }) => {
    const health = card.health || deriveHealth(card.phases || []);
    const hc = healthConfig[health] || healthConfig.GREEN;

    const today = new Date();
    const golive = new Date(card.planned_golive);
    const daysRemaining = Math.round((golive - today) / (1000 * 60 * 60 * 24));
    const onTrack = card.estimated_golive === card.planned_golive;

    const phases = (card.phases || []).map(p => ({
        ...p,
        variance: daysBetween(p.plan_end, p.est_end)
    }));

    const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

    return (
        <div className="flex flex-col gap-2 animate-fade-in">

            {/* ── Compact Header Strip ─────────────────────────── */}
            <div className="grid grid-cols-4 gap-2">
                <div className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-center">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Planned GoLive</div>
                    <div className="text-sm font-black text-slate-900 mt-0.5">{fmt(card.planned_golive)}</div>
                </div>
                <div className={`rounded-lg border px-3 py-2 text-center ${hc.light} ring-1 ${hc.ring}`}>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Health</div>
                    <div className="flex items-center justify-center gap-1.5 mt-0.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${hc.bg} shrink-0`} />
                        <span className={`text-xs font-black ${hc.text}`}>{hc.label}</span>
                    </div>
                </div>
                <div className={`rounded-lg border px-3 py-2 text-center ${onTrack ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Est. GoLive</div>
                    <div className={`text-sm font-black mt-0.5 ${onTrack ? 'text-emerald-700' : 'text-amber-700'}`}>{fmt(card.estimated_golive)}</div>
                    <div className={`text-[9px] font-bold ${onTrack ? 'text-emerald-600' : 'text-amber-600'}`}>{onTrack ? '✓ ON TRACK' : '⚠ REVISED'}</div>
                </div>
                <div className={`rounded-lg border px-3 py-2 text-center ${daysRemaining < 7 ? 'bg-red-50 border-red-200' :
                    daysRemaining < 14 ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-100'
                    }`}>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Days Left</div>
                    <div className={`text-lg font-black mt-0.5 ${daysRemaining < 7 ? 'text-red-700' : daysRemaining < 14 ? 'text-amber-700' : 'text-indigo-700'
                        }`}>{daysRemaining}</div>
                </div>
            </div>

            {/* ── Compact Phase Table ────────────────────────────── */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                        <Activity size={11} className="text-indigo-500" /> Phase Execution Variance
                    </span>
                    <span className="text-[9px] text-slate-400">Plan vs. Actual / Est.</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50">
                                <th className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wide">Phase</th>
                                <th className="px-2 py-1.5 text-[9px] font-bold text-slate-500 uppercase">Plan Start</th>
                                <th className="px-2 py-1.5 text-[9px] font-bold text-slate-500 uppercase">Plan End</th>
                                <th className="px-2 py-1.5 text-[9px] font-bold text-slate-500 uppercase">Act. Start</th>
                                <th className="px-2 py-1.5 text-[9px] font-bold text-slate-500 uppercase">Est. End</th>
                                <th className="px-2 py-1.5 text-[9px] font-bold text-slate-500 uppercase">Status</th>
                                <th className="px-2 py-1.5 text-[9px] font-bold text-slate-500 uppercase text-right">Var.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {phases.map((phase, i) => {
                                const vc = varianceColor(phase.variance);
                                return (
                                    <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="px-3 py-1.5 text-[11px] font-semibold text-slate-800 whitespace-nowrap">{phase.name}</td>
                                        <td className="px-2 py-1.5 text-[10px] text-slate-500 font-mono whitespace-nowrap">{fmt(phase.plan_start)}</td>
                                        <td className="px-2 py-1.5 text-[10px] text-slate-500 font-mono whitespace-nowrap">{fmt(phase.plan_end)}</td>
                                        <td className="px-2 py-1.5 text-[10px] text-slate-500 font-mono whitespace-nowrap">{fmt(phase.actual_start) || '—'}</td>
                                        <td className="px-2 py-1.5 text-[10px] text-slate-600 font-mono font-semibold whitespace-nowrap">{fmt(phase.est_end)}</td>
                                        <td className="px-2 py-1.5">
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${statusColor(phase.status)}`}>
                                                {phase.status}
                                            </span>
                                        </td>
                                        <td className="px-2 py-1.5 text-right">
                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black ${vc.bg} ${vc.text} ${vc.border} border`}>
                                                <span className={`w-1 h-1 rounded-full ${vc.dot}`} />
                                                {phase.variance > 0 ? `+${phase.variance}` : phase.variance}d
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════════
//  Main TaskTable Component
// ════════════════════════════════════════════════════════════════
/**
 * Primary Data Grid component for the application. 
 * Manages the rendering of filtered tasks, column visibility and ordering,
 * multi-sort handling, and acts as the container for the task details side-drawer.
 */
const TaskTable = () => {
    const {
        filteredTasks, loading, filterMetadata,
        visibleColumns, setVisibleColumns,
        columnOrder, setColumnOrder,
        sortCriteria, setSortCriteria
    } = useFilters();

    const [isColumnManagerOpen, setIsColumnManagerOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [selectedTaskStories, setSelectedTaskStories] = useState([]);
    const [loadingStories, setLoadingStories] = useState(false);
    const [detailTab, setDetailTab] = useState('status'); // 'status' | 'activity'

    const allColumns = [
        { id: 'name', label: 'Task Name', type: 'system' },
        { id: 'assignee', label: 'Assignee', type: 'system' },
        { id: 'status', label: 'Status', type: 'system' },
        { id: 'due_on', label: 'Due Date', type: 'system' },
        { id: 'priority', label: 'Priority', type: 'system' },
        ...filterMetadata.customFields.map(cf => ({ id: `cf:${cf.name}`, label: cf.name, type: 'custom' }))
    ];

    const handleSort = (columnId, isMulti) => {
        setSortCriteria(prev => {
            const existing = prev.find(s => s.key === columnId);
            if (!isMulti) {
                if (existing) return [{ key: columnId, direction: existing.direction === 'asc' ? 'desc' : 'asc' }];
                return [{ key: columnId, direction: 'asc' }];
            } else {
                if (existing) {
                    if (existing.direction === 'asc') return prev.map(s => s.key === columnId ? { ...s, direction: 'desc' } : s);
                    return prev.filter(s => s.key !== columnId);
                }
                return [...prev, { key: columnId, direction: 'asc' }];
            }
        });
    };

    const getSortIndicator = (columnId) => {
        const criteria = sortCriteria.find(s => s.key === columnId);
        if (!criteria) return null;
        const index = sortCriteria.findIndex(s => s.key === columnId);
        return (
            <span className="ml-1 inline-flex items-center gap-0.5 text-indigo-600">
                {criteria.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {sortCriteria.length > 1 && <span className="text-[9px] font-bold bg-indigo-600 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center">{index + 1}</span>}
            </span>
        );
    };

    const toggleColumn = (id) => {
        if (id === 'name') return;
        setVisibleColumns(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
        if (!columnOrder.includes(id)) setColumnOrder(prev => [...prev, id]);
    };

    const moveColumn = (id, direction) => {
        const idx = columnOrder.indexOf(id);
        const newOrder = [...columnOrder];
        const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= newOrder.length) return;
        [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
        setColumnOrder(newOrder);
    };

    const handleTaskClick = async (task) => {
        setSelectedTask(task);
        setSelectedTaskStories([]);
        setDetailTab('status');
        setLoadingStories(true);
        try {
            const res = await api.get(`/tasks/${task.gid}/stories`);
            setSelectedTaskStories(res.data);
        } catch (err) {
            console.error('Error fetching stories:', err);
        } finally {
            setLoadingStories(false);
        }
    };

    const closePanel = () => setSelectedTask(null);

    const renderCell = (task, columnId) => {
        if (columnId === 'name') return (
            <div className="flex items-center gap-3 min-w-0">
                <div className={`shrink-0 ${task.completed ? 'text-emerald-500' : 'text-slate-300'}`}>
                    {task.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                </div>
                <span className={`font-medium text-sm truncate ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.name}</span>
            </div>
        );
        if (columnId === 'assignee') return (
            <div className="flex items-center gap-2 text-sm text-slate-600">
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {(task.assignee || '?').charAt(0).toUpperCase()}
                </div>
                <span className="truncate">{task.assignee || '—'}</span>
            </div>
        );
        if (columnId === 'status') return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${task.completed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                {task.completed ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                {task.completed ? 'Completed' : 'In Progress'}
            </span>
        );
        if (columnId === 'due_on') return (
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <Calendar size={12} className="text-slate-400" /> {task.due_on || '—'}
            </div>
        );
        if (columnId === 'priority') {
            const p = (task.priority || '').toLowerCase();
            const cls = p.includes('high') || p.includes('critical') ? 'bg-red-50 text-red-700 border-red-200'
                : p.includes('med') ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200';
            return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${cls}`}>{task.priority || '—'}</span>;
        }
        if (columnId.startsWith('cf:')) return <span className="text-sm text-slate-600">{task.cfMap?.[columnId.replace('cf:', '')] || '—'}</span>;
        return <span className="text-slate-400">—</span>;
    };

    const orderedVisibleCols = columnOrder.filter(id => visibleColumns.includes(id));

    // Parse status card from selected task
    const statusCard = selectedTask
        ? extractStatusCard(selectedTask.notes) || (selectedTask.html_notes ? extractStatusCard(selectedTask.html_notes.replace(/<[^>]+>/g, ' ')) : null)
        : null;

    const extractedUpdatesData = extractHighlightsAndUpdates(selectedTaskStories);
    const highlightsCount = extractedUpdatesData.filter(d => d.highlights && d.highlights.length > 0).length;
    const updatesCount = extractedUpdatesData.filter(d => d.updates && d.updates.length > 0).length;

    return (
        <>
            {/* ── TABLE CARD ──────────────────────────────────────── */}
            <div className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-fade-in">
                <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <Layout size={16} className="text-indigo-500" />
                        <span className="text-sm font-semibold text-slate-700">Task List</span>
                    </div>
                    <button onClick={() => setIsColumnManagerOpen(true)} id="btn-column-config" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100 transition-all">
                        <Settings2 size={13} /> Columns
                    </button>
                </div>
                <div className="overflow-auto">
                    {loading ? (
                        <div className="h-48 flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                        </div>
                    ) : (
                        <table className="min-w-full">
                            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                                <tr>
                                    {orderedVisibleCols.map((colId, index) => {
                                        const col = allColumns.find(c => c.id === colId);
                                        return (
                                            <th key={colId} id={`col-header-${colId}`} onClick={(e) => handleSort(colId, e.shiftKey)}
                                                className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-800 hover:bg-slate-100 transition-colors select-none uppercase tracking-wide ${index === 0 ? 'pl-5' : ''}`}>
                                                <span className="inline-flex items-center gap-1">{col?.label}{getSortIndicator(colId)}</span>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredTasks.length > 0 ? filteredTasks.map(task => (
                                    <tr key={task.gid} id={`row-task-${task.gid}`} onClick={() => handleTaskClick(task)}
                                        className={`hover:bg-indigo-50/40 transition-all duration-100 cursor-pointer border-l-2 ${selectedTask?.gid === task.gid ? 'bg-indigo-50/60 border-l-indigo-500' : 'border-l-transparent'}`}>
                                        {orderedVisibleCols.map((colId, index) => (
                                            <td key={colId} className={`px-4 py-3 ${index === 0 ? 'pl-5' : ''}`}>{renderCell(task, colId)}</td>
                                        ))}
                                    </tr>
                                )) : (
                                    <tr><td colSpan={orderedVisibleCols.length} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-2.5">
                                            <FileText size={28} className="text-slate-200" />
                                            <span className="text-sm text-slate-400 font-medium">No tasks match your current filters</span>
                                        </div>
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ── COLUMN MANAGER MODAL ────────────────────────────── */}
            {isColumnManagerOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setIsColumnManagerOpen(false)} />
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-10 overflow-hidden border border-slate-200 animate-fade-in">
                        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                            <div>
                                <h4 className="text-sm font-bold text-slate-800">Column Configuration</h4>
                                <p className="text-xs text-slate-500 mt-0.5">Show, hide, or reorder columns</p>
                            </div>
                            <button onClick={() => setIsColumnManagerOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"><X size={16} /></button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
                            {columnOrder.map((colId, idx) => {
                                const col = allColumns.find(c => c.id === colId);
                                if (!col) return null;
                                const isVisible = visibleColumns.includes(colId);
                                return (
                                    <div key={colId} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isVisible ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => toggleColumn(colId)} id={`btn-toggle-col-${colId}`}
                                                className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${isVisible ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>
                                                {isVisible && <Check size={11} />}
                                            </button>
                                            <div>
                                                <div className="text-sm font-semibold text-slate-700">{col.label}</div>
                                                <div className="text-xs text-slate-400 capitalize">{col.type}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => moveColumn(colId, 'left')} id={`btn-move-left-${colId}`} disabled={idx === 0} className="p-1 text-slate-400 hover:text-indigo-600 rounded disabled:opacity-20 transition-colors"><ArrowUp size={13} className="-rotate-90" /></button>
                                            <button onClick={() => moveColumn(colId, 'right')} id={`btn-move-right-${colId}`} disabled={idx === columnOrder.length - 1} className="p-1 text-slate-400 hover:text-indigo-600 rounded disabled:opacity-20 transition-colors"><ArrowDown size={13} className="-rotate-90" /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-4 border-t border-slate-100">
                            <button onClick={() => setIsColumnManagerOpen(false)} id="btn-apply-col-config" className="w-full bg-indigo-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-sm">Apply</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── TASK DETAIL DRAWER ───────────────────────────────── */}
            {selectedTask && (
                <div className="fixed inset-0 z-[150] flex items-stretch">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={closePanel} />
                    <div className="absolute inset-y-0 right-0 w-[90%] max-w-5xl bg-white shadow-2xl flex flex-col animate-slide-in">

                        {/* Panel Header */}
                        <div className="shrink-0 bg-indigo-700 text-white px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-3 h-3 rounded-full shrink-0 ring-2 ring-white/30 ${selectedTask.completed ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                <h2 className="text-base font-bold text-white truncate">{selectedTask.name}</h2>
                                <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${selectedTask.completed ? 'bg-emerald-500/30 text-emerald-100 ring-1 ring-emerald-400/30' : 'bg-amber-400/20 text-amber-100 ring-1 ring-amber-400/30'}`}>
                                    {selectedTask.completed ? 'Completed' : 'In Progress'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-4">
                                {selectedTask.permalink_url && (
                                    <a href={selectedTask.permalink_url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all">
                                        <ExternalLink size={12} /> Open in Asana
                                    </a>
                                )}
                                <button onClick={closePanel} id="panel-detail-close" className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/80 hover:text-white">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Inner Tab Bar */}
                        <div className="shrink-0 flex border-b border-slate-200 bg-white px-6">
                            {[
                                { id: 'status', label: 'Project Status', badge: statusCard ? '✓' : null },
                                { id: 'highlights', label: `Highlights (${highlightsCount})` },
                                { id: 'updates', label: `Updates (${updatesCount})` },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setDetailTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${detailTab === tab.id
                                        ? 'border-indigo-600 text-indigo-700'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                        }`}
                                >
                                    {tab.label}
                                    {tab.badge && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-bold">{tab.badge}</span>}
                                </button>
                            ))}
                        </div>

                        {/* Panel Body */}
                        <div className="flex-1 overflow-hidden flex flex-row">

                            {/* LEFT: always-visible meta sidebar */}
                            <div className="w-52 shrink-0 border-r border-slate-100 bg-slate-50 overflow-y-auto thin-scrollbar p-4 space-y-4">
                                <MetaCard icon={<User size={13} className="text-indigo-500" />} label="Assignee" value={selectedTask.assignee || '—'} />
                                <MetaCard icon={<Calendar size={13} className="text-indigo-500" />} label="Due Date" value={selectedTask.due_on || '—'} />
                                {selectedTask.priority && (
                                    <MetaCard icon={<AlertCircle size={13} className="text-indigo-500" />} label="Priority" value={selectedTask.priority} />
                                )}
                                {selectedTask.cfMap && Object.entries(selectedTask.cfMap).filter(([, v]) => v).map(([k, v]) => (
                                    <MetaCard key={k} icon={<Tag size={13} className="text-slate-400" />} label={k} value={String(v)} />
                                ))}
                            </div>

                            {/* RIGHT: tabbed content */}
                            <div className="flex-1 overflow-y-auto thin-scrollbar p-4">

                                {/* STATUS TAB */}
                                {detailTab === 'status' && (
                                    statusCard ? (
                                        <CardErrorBoundary>
                                            <ProjectStatusCard card={statusCard} />
                                        </CardErrorBoundary>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
                                            <Activity size={36} className="text-slate-200" />
                                            <p className="text-sm font-semibold text-slate-500">No Status Card Found</p>
                                            <p className="text-xs text-slate-400 max-w-xs">
                                                Add a <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">status_card</code> JSON block to this task's Asana description to enable this view.
                                                See the <strong>Help</strong> tab in Configuration for the format.
                                            </p>
                                        </div>
                                    )
                                )}

                                {/* HIGHLIGHTS TAB */}
                                {detailTab === 'highlights' && (
                                    <div className="space-y-4 animate-fade-in">
                                        {loadingStories ? (
                                            <div className="py-10 flex justify-center">
                                                <div className="w-6 h-6 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                                            </div>
                                        ) : highlightsCount === 0 ? (
                                            <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-xl">
                                                <Activity size={24} className="text-slate-200 mx-auto mb-2" />
                                                <p className="text-sm text-slate-400 font-medium">No highlights available</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                {extractedUpdatesData.filter(d => d.highlights && d.highlights.length > 0).map((data, idx) => (
                                                    <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                                        <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2 flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <Calendar size={14} className="text-indigo-600" />
                                                                <span className="text-xs font-bold text-indigo-900">{new Date(data.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                            </div>
                                                            <div className="text-[10px] font-medium text-indigo-500">
                                                                by {data.created_by || 'Unknown'}
                                                            </div>
                                                        </div>
                                                        <div className="p-4">
                                                            <ul className="space-y-2">
                                                                {data.highlights.map((item, i) => (
                                                                    <li key={i} className="flex gap-2 text-sm text-slate-700">
                                                                        <span className="text-emerald-500 shrink-0 mt-0.5"><CheckCircle2 size={14} /></span>
                                                                        <span>{item}</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* UPDATES TAB */}
                                {detailTab === 'updates' && (
                                    <div className="space-y-4 animate-fade-in">
                                        {loadingStories ? (
                                            <div className="py-10 flex justify-center">
                                                <div className="w-6 h-6 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                                            </div>
                                        ) : updatesCount === 0 ? (
                                            <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-xl">
                                                <MessageSquare size={24} className="text-slate-200 mx-auto mb-2" />
                                                <p className="text-sm text-slate-400 font-medium">No updates available</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                {extractedUpdatesData.filter(d => d.updates && d.updates.length > 0).map((data, idx) => (
                                                    <div key={idx} className="flex gap-4">
                                                        <div className="flex flex-col items-center">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0 border border-slate-200">
                                                                {(data.created_by || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                                            </div>
                                                            {idx !== extractedUpdatesData.filter(d => d.updates && d.updates.length > 0).length - 1 && (
                                                                <div className="w-0.5 h-full bg-slate-100 mt-2"></div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 pb-4">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="text-sm font-bold text-slate-800">{new Date(data.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                                <span className="text-xs text-slate-500">— {data.created_by}</span>
                                                            </div>
                                                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                                                                <ul className="space-y-2.5">
                                                                    {data.updates.map((item, i) => (
                                                                        <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />
                                                                            <span>{item}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// ── Shared sub-components ───────────────────────────────────────

/**
 * Small metadata key-value pairing component used in the task side-drawer.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.icon - Lucide icon component.
 * @param {string} props.label - Short meta label.
 * @param {string|number} props.value - Display value.
 */
const MetaCard = ({ icon, label, value }) => (
    <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{icon} {label}</div>
        <div className="text-xs font-semibold text-slate-800 leading-snug break-words">{value}</div>
    </div>
);

const NotesRenderer = ({ notes }) => {
    if (!notes) return (
        <div className="flex flex-col items-center justify-center h-40 text-center">
            <FileText size={28} className="text-slate-200 mb-2" />
            <p className="text-sm text-slate-400">No description provided for this task.</p>
        </div>
    );
    const lines = notes.split('\n');
    const tableData = [];
    let isInTable = false;
    lines.forEach(line => {
        const segments = line.split(/\t|\s{2,}/).map(s => s.trim()).filter(Boolean);
        if (segments.length >= 2) { tableData.push(segments); isInTable = true; }
        else if (isInTable && line.trim() !== '') tableData.push([line.trim()]);
    });
    if (isInTable && tableData.length > 0) {
        return (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left">
                    <tbody>
                        {tableData.map((row, i) => (
                            <tr key={i} className={`border-b border-slate-100 hover:bg-slate-50 ${i === 0 ? 'bg-indigo-50' : 'bg-white'}`}>
                                {row.map((cell, j) => (
                                    <td key={j} className={`px-4 py-2.5 text-xs ${i === 0 ? 'font-bold text-indigo-700 uppercase tracking-wide' : 'font-medium text-slate-700'}`}>{cell}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }
    return <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{notes}</p>;
};

export default TaskTable;
