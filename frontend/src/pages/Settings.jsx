import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Server, Key, ExternalLink, CheckCircle, ChevronRight, ChevronLeft, Info, Search, Settings as SettingsIcon, Plus, Trash2, LayoutGrid, Filter, Cpu, Activity, AlertTriangle, Lightbulb, HelpCircle, Copy, Check, ChevronDown } from 'lucide-react';
import { useFilters } from '../context/FilterContext';
import TileManager from '../components/TileManager';

const Settings = () => {
    const [step, setStep] = useState(2);
    const [pat, setPat] = useState('');
    const [showPATInstructions, setShowPATInstructions] = useState(false);
    const [workspaces, setWorkspaces] = useState([]);
    const [selectedWorkspace, setSelectedWorkspace] = useState('');
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState('');
    const [projectSearch, setProjectSearch] = useState('');
    const [activeTab, setActiveTab] = useState('setup'); // 'setup' | 'tiles' | 'insights' | 'help'
    const [copied, setCopied] = useState(false);

    const { filterMetadata, customTiles, refreshTiles, filteredTasks } = useFilters();

    // Ported Stats Logic from Dashboard
    const stats = useMemo(() => {
        const total = filteredTasks.length;
        const completed = filteredTasks.filter(t => t.completed).length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

        const atRisk = filteredTasks.filter(t =>
            t.priority?.toLowerCase().includes('critical') ||
            t.priority?.toLowerCase().includes('high') ||
            Object.values(t.cfMap || {}).some(v => String(v).toLowerCase().includes('critical'))
        ).length;

        return { total, completed, rate, atRisk };
    }, [filteredTasks]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const navigate = useNavigate();

    const handleVerifyPAT = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.post('/asana/validate', { pat });
            setWorkspaces(res.data.workspaces);
            if (res.data.workspaces.length === 1) {
                setSelectedWorkspace(res.data.workspaces[0].gid);
            }
            setStep(3);
        } catch (err) {
            setError(err.response?.data?.detail || "Verification failed. Check your token.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedWorkspace && step === 3) {
            setLoading(true);
            api.post('/asana/projects', { pat, workspace_gid: selectedWorkspace })
                .then(res => setProjects(res.data.projects))
                .catch(err => setError("Failed to load projects."))
                .finally(() => setLoading(false));
        }
    }, [selectedWorkspace, step, pat]);

    const handleSave = async () => {
        if (!selectedProject) {
            setError("Please select a project.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await api.post('/settings', { pat, project_gid: selectedProject });
            setSuccess(true);
            setTimeout(() => navigate('/'), 1000);
        } catch (err) {
            setError("Failed to save configuration.");
        } finally {
            setLoading(false);
        }
    };

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(projectSearch.toLowerCase())
    );

    const handleCopy = () => {
        navigator.clipboard.writeText(SAMPLE_JSON);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="h-full bg-slate-50 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto w-full bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden flex flex-col">

                {/* Header */}
                <div className="bg-indigo-700 px-6 py-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <SettingsIcon size={16} className="text-indigo-300" />
                        <h1 className="text-sm font-bold text-white tracking-wide">Configuration</h1>
                    </div>
                    {activeTab === 'setup' && (
                        <div className="flex gap-1.5">
                            {[2, 3].map(i => (
                                <div key={i} className={`w-2 h-2 rounded-full ${step >= i ? 'bg-indigo-300' : 'bg-indigo-900'}`} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Sub-Navigation Tabs */}
                <div className="flex border-b border-slate-200 shrink-0 bg-white">
                    {[
                        { id: 'setup', label: 'Asana Setup' },
                        { id: 'tiles', label: 'KPI Tiles' },
                        { id: 'insights', label: 'Insights' },
                        { id: 'help', label: '❓ Help' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            id={`tab-${tab.id}`}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-3 text-xs font-semibold tracking-wide transition-all border-b-2 ${activeTab === tab.id
                                ? 'text-indigo-700 border-indigo-600 bg-white'
                                : 'text-slate-500 border-transparent bg-slate-50 hover:text-slate-700 hover:bg-white'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-6 overflow-y-auto thin-scrollbar">
                    {error && (
                        <div className="mb-4 text-[10px] p-2 bg-red-100 text-red-700 font-bold border-l-2 border-red-500 uppercase tracking-tighter">
                            ERROR: {error}
                        </div>
                    )}

                    {activeTab === 'setup' && (
                        <>
                            {/* STEP 2: TOKEN ENTRY (now step 1 visually) */}
                            {step === 2 && (
                                <div className="space-y-4 relative group/step2">
                                    <div className="absolute top-0 right-0 text-slate-200 text-[6px] font-mono opacity-0 group-hover/step2:opacity-100 transition-opacity">[MOD-CFG-STEP2]</div>
                                    <h2 className="text-xs font-black text-slate-900 tracking-wider">MANDATORY AUTHENTICATION</h2>

                                    {/* Collapsible instructions accordion */}
                                    <button
                                        onClick={() => setShowPATInstructions(v => !v)}
                                        className="flex items-center gap-2 text-[10px] font-semibold text-sky-600 hover:text-sky-800 transition-colors"
                                    >
                                        <Info size={11} />
                                        {showPATInstructions ? 'Hide' : 'How to get your Personal Access Token'}
                                    </button>
                                    {showPATInstructions && (
                                        <div className="border border-slate-200 bg-slate-50 p-4 space-y-3 font-mono text-[10px] text-slate-600 rounded">
                                            <div className="flex gap-3">
                                                <span className="text-sky-600 font-bold">01.</span>
                                                <span>Visit <a href="https://app.asana.com/0/developer-console" target="_blank" rel="noreferrer" className="text-sky-600 underline">Developer Console</a></span>
                                            </div>
                                            <div className="flex gap-3">
                                                <span className="text-sky-600 font-bold">02.</span>
                                                <span>Navigate to "Personal Access Token"</span>
                                            </div>
                                            <div className="flex gap-3">
                                                <span className="text-sky-600 font-bold">03.</span>
                                                <span>Click "+ Create new token" &amp; copy GID string</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">Personal Access Token</label>
                                        <input
                                            type="password"
                                            id="input-pat"
                                            value={pat}
                                            onChange={(e) => setPat(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && pat && !loading && handleVerifyPAT()}
                                            placeholder="PASTE TOKEN HERE..."
                                            className="w-full px-3 py-2 border border-slate-300 font-mono text-xs focus:ring-1 focus:ring-sky-500 outline-none"
                                        />
                                    </div>

                                    <button
                                        onClick={handleVerifyPAT}
                                        id="btn-verify-pat"
                                        disabled={!pat || loading}
                                        className="w-full bg-slate-900 text-white py-2 text-[10px] font-bold tracking-widest hover:bg-slate-800 disabled:opacity-50 uppercase"
                                    >
                                        {loading ? 'VALIDATING...' : 'VERIFY & DISCOVER'}
                                    </button>
                                </div>
                            )}

                            {/* STEP 3: DISCOVERY */}
                            {step === 3 && (
                                <div className="space-y-4 relative group/step3">
                                    <div className="absolute top-0 right-0 text-slate-200 text-[6px] font-mono opacity-0 group-hover/step3:opacity-100 transition-opacity">[MOD-CFG-STEP3]</div>
                                    <h2 className="text-xs font-black text-slate-900 tracking-wider">PROJECT TARGETING</h2>

                                    <div className="space-y-3">
                                        {workspaces.length > 1 && (
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-bold text-slate-400 tracking-widest">WORKSPACE</label>
                                                <div className="relative">
                                                    <select
                                                        value={selectedWorkspace}
                                                        id="select-workspace"
                                                        onChange={(e) => setSelectedWorkspace(e.target.value)}
                                                        className="w-full appearance-none p-2 pr-8 border border-slate-300 bg-white text-[11px] outline-none cursor-pointer"
                                                    >
                                                        <option value="">CHOOSE TARGET WORKSPACE</option>
                                                        {workspaces.map(w => <option key={w.gid} value={w.gid}>{w.name}</option>)}
                                                    </select>
                                                    <ChevronLeft size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 -rotate-90 text-slate-400 pointer-events-none" />
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 tracking-widest">SELECT PROJECT TARGET</label>
                                            <div className="relative">
                                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                                                <input
                                                    type="text"
                                                    id="input-search-projects"
                                                    placeholder="SEARCH BY NAME..."
                                                    value={projectSearch}
                                                    onChange={(e) => setProjectSearch(e.target.value)}
                                                    className="w-full px-3 py-2 border border-slate-300 text-[11px] focus:ring-1 focus:ring-sky-500 outline-none uppercase"
                                                />
                                            </div>
                                            <div className="border border-slate-300 h-48 overflow-y-auto">
                                                {loading && projects.length === 0 ? (
                                                    <div className="p-4 text-[10px] text-slate-400 animate-pulse">QUERYING ASANA API...</div>
                                                ) : (
                                                    filteredProjects.map(p => (
                                                        <button
                                                            key={p.gid}
                                                            id={`btn-project-${p.gid}`}
                                                            onClick={() => setSelectedProject(p.gid)}
                                                            className={`w-full text-left p-2.5 border-b border-slate-100 text-[10px] font-bold tracking-tight uppercase flex justify-between items-center transition-colors ${selectedProject === p.gid ? 'bg-sky-500 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                                                        >
                                                            {p.name}
                                                            {selectedProject === p.gid && <CheckCircle size={12} />}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <button onClick={() => setStep(2)} id="btn-back-step2" className="w-12 border border-slate-300 text-slate-500 flex items-center justify-center hover:bg-slate-50"><ChevronLeft size={14} /></button>
                                        <button
                                            onClick={handleSave}
                                            id="btn-save-config"
                                            disabled={!selectedProject || loading || success}
                                            className="flex-1 bg-sky-600 text-white py-2 text-[10px] font-black tracking-widest hover:bg-sky-700 disabled:opacity-50 uppercase shadow-lg shadow-sky-900/10"
                                        >
                                            {loading ? 'PERSISTING...' : success ? 'CONFIG SAVED' : 'INITIALIZE SYSTEM'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* KPI TILES */}
                    {activeTab === 'tiles' && <TileManager />}

                    {/* INSIGHTS */}
                    {activeTab === 'insights' && (
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Cpu size={15} className="text-indigo-500" /> Recommendations</h3>
                                <div className="space-y-3">
                                    {stats.atRisk > 0 && <RecommendationCard type="urgent" label="At-Risk Tasks" desc={`${stats.atRisk} tasks are flagged critical. Review before your next executive session.`} />}
                                    <RecommendationCard type="info" label="Completion Rate" desc={`Current rate is ${stats.rate}%. ${stats.rate >= 70 ? 'On track.' : 'Review blockers.'}`} />
                                    <RecommendationCard type="tip" label="Sync Before Briefing" desc="Always sync before an executive briefing to ensure the latest Asana data is reflected." />
                                </div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Activity size={15} className="text-indigo-500" /> System Health</h3>
                                <HealthItem label="Asana API Bridge" status="Operational" />
                                <HealthItem label="Local Cache" status="Synchronized" />
                                <HealthItem label="Last Sync" status={new Date().toLocaleTimeString()} />
                            </div>
                        </div>
                    )}

                    {/* HELP */}
                    {activeTab === 'help' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
                                    <HelpCircle size={16} className="text-indigo-500" /> Project Status Card
                                </h2>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    To enable the <strong>Project Status</strong> tab in any task's detail panel, paste a JSON block (as shown below) directly into the task's <strong>Asana Description</strong>. The portal will automatically parse it and render the status card. <strong>Variance is auto-calculated</strong> — you never need to enter it.
                                </p>
                            </div>

                            {/* Auto-calculated fields */}
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                                <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wide">✓ Auto-Calculated by Portal</h3>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    {[
                                        { field: 'variance', formula: 'est_end − plan_end (days)' },
                                        { field: 'health', formula: 'Derived from worst variance across phases' },
                                        { field: 'days_remaining', formula: 'planned_golive − today' },
                                        { field: 'on_track', formula: 'estimated_golive === planned_golive' },
                                    ].map(r => (
                                        <div key={r.field} className="bg-white rounded-lg p-2.5 border border-emerald-100">
                                            <code className="text-indigo-600 font-bold block mb-0.5">{r.field}</code>
                                            <span className="text-slate-500">{r.formula}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Health color legend */}
                            <div className="bg-white border border-slate-200 rounded-xl p-4">
                                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Health Color Logic</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3 text-xs">
                                        <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                                        <strong className="text-emerald-700 w-16">GREEN</strong>
                                        <span className="text-slate-500">All phase variances ≤ 0 days</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs">
                                        <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                                        <strong className="text-amber-700 w-16">AMBER</strong>
                                        <span className="text-slate-500">Any phase variance between 1–5 days</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs">
                                        <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                                        <strong className="text-red-700 w-16">RED</strong>
                                        <span className="text-slate-500">Any phase variance &gt; 5 days</span>
                                    </div>
                                </div>
                            </div>

                            {/* Field Reference */}
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Required Fields per Phase</h3>
                                </div>
                                <table className="w-full text-xs">
                                    <thead><tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-4 py-2 text-left font-semibold text-slate-500">Field</th>
                                        <th className="px-4 py-2 text-left font-semibold text-slate-500">Type</th>
                                        <th className="px-4 py-2 text-left font-semibold text-slate-500">Example</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {[
                                            { f: 'name', t: 'string', e: '"Biz Requirement / Planning"' },
                                            { f: 'plan_start', t: 'date', e: '"2026-03-01"' },
                                            { f: 'plan_end', t: 'date', e: '"2026-03-05"' },
                                            { f: 'actual_start', t: 'date', e: '"2026-03-01"' },
                                            { f: 'est_end', t: 'date', e: '"2026-03-07"' },
                                            { f: 'status', t: 'enum', e: '"In Progress" | "Completed" | "Pending"' },
                                        ].map(r => (
                                            <tr key={r.f} className="hover:bg-slate-50">
                                                <td className="px-4 py-2.5"><code className="text-indigo-600 font-bold">{r.f}</code></td>
                                                <td className="px-4 py-2.5 text-slate-500">{r.t}</td>
                                                <td className="px-4 py-2.5 text-slate-600 font-mono">{r.e}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Sample JSON */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Sample JSON Template</h3>
                                    <button
                                        onClick={handleCopy}
                                        id="btn-copy-sample-json"
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${copied ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                                            }`}
                                    >
                                        {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy JSON</>}
                                    </button>
                                </div>
                                <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-[11px] overflow-x-auto leading-relaxed thin-scrollbar font-mono">{SAMPLE_JSON}</pre>
                            </div>

                            {/* Tip */}
                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-700">
                                <strong>💡 Tip:</strong> You can set <code className="bg-indigo-100 px-1 py-0.5 rounded">"health": "GREEN"</code> manually to override the auto-derived health, or remove it entirely to let the portal calculate it from your phases.
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 px-6 py-3 bg-slate-50 flex justify-between items-center">
                    <span className="text-xs text-slate-400">{success ? '✓ Configuration saved' : 'Project Intelligence Portal'}</span>
                    <span className="text-xs text-slate-400">Read-only · Asana → Portal only</span>
                </div>
            </div>
        </div>
    );
};

const RecommendationCard = ({ type, label, desc }) => {
    const colors = {
        urgent: "border-red-500 bg-red-50 text-red-900",
        info: "border-sky-500 bg-sky-50 text-sky-900",
        tip: "border-slate-300 bg-white text-slate-600"
    };

    return (
        <div className={`p-4 border-l-4 rounded-r-lg ${colors[type]} shadow-sm`}>
            <div className="flex items-center gap-2 mb-1.5">
                {type === 'urgent' ? <AlertTriangle size={14} className="text-red-500" /> : <Lightbulb size={14} className="text-slate-500" />}
                <span className="text-sm font-bold tracking-tight">{label}</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600">
                {desc}
            </p>
        </div>
    );
};

const HealthItem = ({ label, status }) => (
    <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-3 last:border-0 last:pb-0">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className="text-teal-600 font-semibold bg-teal-50 px-2.5 py-1 rounded-full text-xs">{status}</span>
    </div>
);

const SAMPLE_JSON = `{
  "status_card": {
    "planned_golive": "2026-03-31",
    "estimated_golive": "2026-03-31",
    "phases": [
      {
        "name": "Biz Requirement / Planning",
        "plan_start": "2026-03-01",
        "plan_end": "2026-03-05",
        "actual_start": "2026-03-01",
        "est_end": "2026-03-05",
        "status": "In Progress"
      },
      {
        "name": "Solutioning / IRM",
        "plan_start": "2026-03-06",
        "plan_end": "2026-03-12",
        "actual_start": "2026-03-06",
        "est_end": "2026-03-14",
        "status": "Completed"
      },
      {
        "name": "BN / Comm. Signoff",
        "plan_start": "2026-03-01",
        "plan_end": "2026-03-13",
        "actual_start": "2026-03-01",
        "est_end": "2026-03-14",
        "status": "Pending"
      },
      {
        "name": "PMO / Dev. / Config",
        "plan_start": "2026-03-01",
        "plan_end": "2026-03-13",
        "actual_start": "2026-03-01",
        "est_end": "2026-03-14",
        "status": "Pending"
      },
      {
        "name": "SIT / UAT / IRM",
        "plan_start": "2026-03-01",
        "plan_end": "2026-03-15",
        "actual_start": "2026-03-01",
        "est_end": "2026-03-24",
        "status": "Pending"
      },
      {
        "name": "Deployed / LIVE",
        "plan_start": "2026-03-01",
        "plan_end": "2026-03-31",
        "actual_start": "2026-03-01",
        "est_end": "2026-03-30",
        "status": "Pending"
      }
    ]
  }
}`;

export default Settings;

