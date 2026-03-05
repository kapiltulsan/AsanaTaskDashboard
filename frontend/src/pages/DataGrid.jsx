import React from 'react';
import { RefreshCw, Download, Filter as FilterIcon } from 'lucide-react';
import { useFilters } from '../context/FilterContext';
import TaskTable from '../components/TaskTable';

const DataGrid = () => {
    const {
        syncing,
        handleSync,
        setIsFilterOverlayOpen,
        activeFilters
    } = useFilters();

    return (
        <div className="h-full flex flex-col space-y-4">
            {/* Minimal Toolbar for DataGrid Page */}
            <div className="flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-slate-800">Global Data Stream</h2>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsFilterOverlayOpen(true)}
                            className={`flex items-center gap-2 text-[10px] font-bold uppercase transition-all px-3 py-1.5 border rounded-lg ${activeFilters.length > 0 ? 'bg-sky-100 text-sky-700 border-sky-300' : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'}`}
                        >
                            <FilterIcon size={12} />
                            {activeFilters.length > 0 ? `Filters Active (${activeFilters.length})` : 'Segment Filter'}
                        </button>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 border border-slate-200 bg-white rounded-lg transition-all text-xs font-bold shadow-sm">
                        <Download size={14} /> Export CSV
                    </button>
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="bg-slate-900 text-white text-xs font-bold px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50 shadow-md"
                    >
                        <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'SCANNING...' : 'SYNC ASANA'}
                    </button>
                </div>
            </div>

            {/* Unified Table Component */}
            <div className="flex-1 overflow-hidden">
                <TaskTable />
            </div>
        </div>
    );
};

export default DataGrid;
