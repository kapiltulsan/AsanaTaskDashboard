import React, { useState, useEffect } from 'react';
import { X, Plus, Search, Trash2, ChevronDown, CheckCircle, Info, Filter as FilterIcon } from 'lucide-react';
import RuleEditor from './RuleEditor';
import { useFilters } from '../context/FilterContext';

/**
 * FilterOverlay Component
 * 
 * Provides a global UI overlay for users to define advanced data filters and textual search queries.
 * Integrates directly with the `useFilters` context to apply these criteria across
 * all dashboard views synchronously.
 * 
 * @returns {React.ReactElement|null} The overlay portal or null if not open.
 */
const FilterOverlay = () => {
    const {
        isFilterOverlayOpen,
        setIsFilterOverlayOpen,
        searchQuery,
        setSearchQuery,
        activeFilters,
        setActiveFilters,
        filterMetadata
    } = useFilters();

    // Escape key closes the overlay
    useEffect(() => {
        if (!isFilterOverlayOpen) return;
        const handler = (e) => { if (e.key === 'Escape') setIsFilterOverlayOpen(false); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isFilterOverlayOpen]);

    if (!isFilterOverlayOpen) return null;

    /**
     * Instantiates a new, blank filter rule segment with default values.
     */
    const addFilter = () => {
        // Use functional update to ensure we always have the latest state
        setActiveFilters(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            column: 'assignee',
            operator: 'is',
            values: [],
            isCustom: false
        }]);
    };

    /**
     * Updates specific properties of an existing filter rule.
     * @param {string} id - The unique identifier of the rule to update.
     * @param {Object} updates - Dictionary of properties to patch into the rule.
     */
    const updateFilter = (id, updates) => {
        setActiveFilters(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    /**
     * Removes a filter rule segment entirely from the active set.
     * @param {string} id - The unique identifier of the rule to remove.
     */
    const removeFilter = (id) => {
        setActiveFilters(prev => prev.filter(f => f.id !== id));
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl h-[85vh] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative flex flex-col animate-fade-in">

                {/* Header */}
                <div className="bg-white px-6 py-5 flex items-center justify-between border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg">
                            <FilterIcon size={18} className="text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-slate-900 tracking-tight">Advanced Filters</h2>
                            <p className="text-xs text-slate-500 mt-0.5">Refine your project data view</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsFilterOverlayOpen(false)}
                        id="btn-close-overlay"
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 thin-scrollbar pb-32">
                    {/* Text Search Rule */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                            <Search size={14} className="text-slate-400" />
                            Primary Keyword
                        </label>
                        <input
                            type="text"
                            id="input-keyword-search"
                            autoFocus
                            placeholder="Search by task name (e.g., 'API', 'UI', 'Bug')..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all placeholder:text-slate-400 shadow-sm"
                        />
                    </div>

                    {/* Advanced Rules */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                                <FilterIcon size={14} className="text-slate-400" />
                                Custom Filter Rules
                            </label>
                            {activeFilters.length > 0 && (
                                <button onClick={() => setActiveFilters([])} id="btn-clear-filters" className="text-xs font-medium text-slate-500 hover:text-red-600 transition-colors">Clear all segments</button>
                            )}
                        </div>

                        <div className="space-y-4">
                            {activeFilters.length === 0 ? (
                                <div className="border border-dashed border-slate-300 p-8 text-center rounded-xl bg-slate-50">
                                    <p className="text-sm text-slate-500 mb-4">No custom filters active</p>
                                    <button
                                        onClick={addFilter}
                                        id="btn-add-first-rule"
                                        className="bg-white border border-slate-300 text-slate-700 px-5 py-2 text-sm font-medium rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm flex items-center gap-2 mx-auto"
                                    >
                                        <Plus size={16} /> Add First Rule
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {activeFilters.map((filter) => (
                                        <RuleEditor
                                            key={filter.id}
                                            filter={filter}
                                            metadata={filterMetadata}
                                            onUpdate={(upd) => updateFilter(filter.id, upd)}
                                            onRemove={() => removeFilter(filter.id)}
                                        />
                                    ))}
                                    <button
                                        onClick={addFilter}
                                        id="btn-add-filter-rule"
                                        className="flex items-center justify-center gap-2 w-full py-3 mt-2 border border-dashed border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:border-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-all"
                                    >
                                        <Plus size={16} /> Add Another Rule
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer - Fixed at bottom */}
                <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-t border-slate-200 shrink-0 z-[60]">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Info size={14} className="text-sky-500" />
                        Filters apply globally across the dashboard
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsFilterOverlayOpen(false)}
                            id="btn-cancel-filters"
                            className="bg-white text-slate-700 px-5 py-2 text-sm font-medium rounded-lg hover:bg-slate-50 transition-all border border-slate-300 shadow-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => setIsFilterOverlayOpen(false)}
                            id="btn-apply-filters"
                            className="bg-indigo-600 text-white px-6 py-2 text-sm font-semibold rounded-xl shadow-sm hover:bg-indigo-700 transition-all"
                        >
                            Apply Filters
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};



export default FilterOverlay;
