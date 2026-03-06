import React, { useState, useRef, useEffect } from 'react';
import { X, Trash2, ChevronDown, CheckCircle } from 'lucide-react';

/**
 * RuleEditor Component
 * 
 * Renders an individual filter segment allowing users to select a field (Standard or Custom),
 * an operator (e.g., 'is', 'is_not'), and one or more matching values from a dynamically
 * positioned dropdown menu.
 * 
 * @param {Object} props
 * @param {Object} props.filter - The current state of this specific filter rule.
 * @param {Object} props.metadata - Available fields and constraint options to populate dropdowns.
 * @param {Function} props.onUpdate - Callback triggered when any part of the rule changes.
 * @param {Function} props.onRemove - Callback triggered to delete this rule entirely.
 */
const RuleEditor = ({ filter, metadata, onUpdate, onRemove }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [openUpwards, setOpenUpwards] = useState(false);
    const triggerRef = useRef(null);
    const dropdownContainerRef = useRef(null);

    /**
     * Effect hook to determine the optimal dropdown rendering direction.
     * Prevents the dropdown from being clipped by the bottom edge of the screen
     * by forcing it to open upwards if screen space is insufficient.
     */
    useEffect(() => {
        if (isDropdownOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            // If less than 260px (approx dropdown height) below, open upwards
            if (spaceBelow < 260 && rect.top > 260) {
                setOpenUpwards(true);
            } else {
                setOpenUpwards(false);
            }
        }
    }, [isDropdownOpen]);

    // Close value dropdown when clicking outside
    useEffect(() => {
        if (!isDropdownOpen) return;
        const handler = (e) => {
            if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isDropdownOpen]);

    const standardColumns = [
        { id: 'assignee', label: 'Assignee', isCustom: false },
        { id: 'status', label: 'Status', isCustom: false },
        { id: 'priority', label: 'Priority', isCustom: false },
    ];

    const allColumns = [
        ...standardColumns,
        ...metadata.customFields.map(cf => ({ id: cf.id, label: cf.name, isCustom: true }))
    ];

    /**
     * Resolves the list of selectable values based on the currently chosen field column.
     * Maps standard fields to static lists and custom fields to their respective fetched metadata arrays.
     * 
     * @returns {Array<string>} The valid constraint options for the selected column.
     */
    const getValuesForCurrentSelection = () => {
        if (!filter.isCustom) {
            if (filter.column === 'assignee') return metadata.assignees || [];
            if (filter.column === 'priority') return metadata.priorities || [];
            if (filter.column === 'status') return ['completed', 'incomplete'];
        } else {
            const cf = metadata.customFields.find(c => c.id === filter.column);
            return cf ? cf.values : [];
        }
        return [];
    };

    /**
     * Toggles a selected constraint value on or off within the active rule.
     * 
     * @param {string} val - The specific constraint string value.
     */
    const toggleValue = (val) => {
        const newValues = filter.values.includes(val)
            ? filter.values.filter(v => v !== val)
            : [...filter.values, val];
        onUpdate({ values: newValues });
    };

    return (
        <div className="flex flex-col gap-3 bg-white p-4 border border-slate-200 shadow-sm rounded-lg relative group/rule hover:border-sky-300 transition-colors">
            <div className="flex items-center gap-3">
                <div className="w-1.5 h-full absolute left-0 top-0 bottom-0 bg-transparent group-hover/rule:bg-sky-400 rounded-l-lg transition-colors" />

                {/* Field select — styled wrapper */}
                <div className="relative">
                    <select
                        value={filter.column}
                        id={`select-rule-column-${filter.id}`}
                        onChange={(e) => {
                            const col = allColumns.find(c => c.id === e.target.value);
                            onUpdate({ column: e.target.value, isCustom: col?.isCustom, values: [] });
                        }}
                        className="w-48 appearance-none bg-slate-50 text-slate-700 text-sm font-medium border border-slate-300 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 py-2 pl-3 pr-8 rounded-lg outline-none cursor-pointer hover:bg-white transition-colors"
                    >
                        <optgroup label="Standard Fields">
                            {standardColumns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </optgroup>
                        <optgroup label="Custom Fields" className="text-sky-600">
                            {metadata.customFields.map(cf => <option key={cf.id} value={cf.id}>{cf.name}</option>)}
                        </optgroup>
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {/* Operator select — styled wrapper */}
                <div className="relative">
                    <select
                        value={filter.operator}
                        id={`select-rule-operator-${filter.id}`}
                        onChange={(e) => onUpdate({ operator: e.target.value })}
                        className="w-28 appearance-none bg-white border border-slate-300 text-sm font-medium text-slate-700 cursor-pointer focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 py-2 pl-3 pr-8 rounded-lg outline-none hover:bg-slate-50 transition-colors"
                    >
                        <option value="is">Is</option>
                        <option value="is_not">Is Not</option>
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                <button onClick={onRemove} id={`btn-remove-rule-${filter.id}`} className="ml-auto p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20">
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="relative mt-1" ref={dropdownContainerRef}>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Value Constraints</label>
                <div
                    ref={triggerRef}
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    id={`btn-rule-value-trigger-${filter.id}`}
                    className="flex flex-wrap gap-2 p-2 bg-white border border-slate-300 rounded-lg min-h-[42px] cursor-pointer hover:border-sky-400 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all shadow-sm"
                >
                    {filter.values.length === 0 && (
                        <div className="flex items-center justify-between w-full px-2">
                            <span className="text-sm text-slate-400">Select constraint values...</span>
                            <ChevronDown size={16} className="text-slate-400" />
                        </div>
                    )}
                    {filter.values.map(v => (
                        <div key={v} className="bg-sky-50 text-sky-700 px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 border border-sky-100 animate-in zoom-in-95 duration-100">
                            <span className="truncate max-w-[200px]">{v}</span>
                            <X
                                size={14}
                                className="text-sky-400 hover:text-sky-700 hover:bg-sky-100 rounded-full p-0.5 cursor-pointer transition-colors"
                                onClick={(e) => { e.stopPropagation(); toggleValue(v); }}
                            />
                        </div>
                    ))}
                    {filter.values.length > 0 && <ChevronDown size={16} className="ml-auto text-slate-400 self-center mr-2" />}
                </div>

                {isDropdownOpen && (
                    <div className={`absolute ${openUpwards ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 right-0 bg-white border border-slate-200 shadow-lg rounded-lg z-[110] max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 thin-scrollbar`}>
                        <div className="sticky top-0 bg-slate-50/90 backdrop-blur-sm px-4 py-2 border-b border-slate-200 flex items-center justify-between z-10">
                            <span className="text-xs font-semibold text-slate-500">Available Options</span>
                            <button onClick={(e) => { e.stopPropagation(); setIsDropdownOpen(false); }} id={`btn-close-dropdown-${filter.id}`} className="text-xs font-medium text-slate-400 hover:text-slate-700">Close</button>
                        </div>
                        {getValuesForCurrentSelection().map(val => (
                            <button
                                key={val}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleValue(val); }}
                                className={`w-full text-left px-4 py-2.5 text-sm flex justify-between items-center transition-colors group/item focus:outline-none ${filter.values.includes(val) ? 'bg-sky-50/50 text-sky-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                <span className={`truncate mr-4 ${filter.values.includes(val) ? 'font-semibold' : ''}`}>{val}</span>
                                {filter.values.includes(val) && <CheckCircle size={16} className="text-sky-600" />}
                            </button>
                        ))}
                        {getValuesForCurrentSelection().length === 0 && (
                            <div className="p-8 text-center text-sm text-slate-400 italic">No valid options found</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RuleEditor;
