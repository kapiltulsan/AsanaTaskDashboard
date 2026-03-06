import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import api from '../api';

const FilterContext = createContext();

export const FilterProvider = ({ children }) => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState(null);

    // Filter Logic States
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilters, setActiveFilters] = useState([]); // [{ id, column, operator, values, isCustom }]
    const [isFilterOverlayOpen, setIsFilterOverlayOpen] = useState(false);

    // Custom Tiles State
    const [customTiles, setCustomTiles] = useState([]);

    // Grid Preferences (Saved in LocalStorage)
    const [visibleColumns, setVisibleColumns] = useState(() => {
        const saved = localStorage.getItem('sentinel_visible_columns');
        return saved ? JSON.parse(saved) : ['name', 'assignee', 'status', 'due_on'];
    });

    const [columnOrder, setColumnOrder] = useState(() => {
        const saved = localStorage.getItem('sentinel_column_order');
        return saved ? JSON.parse(saved) : ['name', 'assignee', 'status', 'due_on'];
    });

    const [sortCriteria, setSortCriteria] = useState(() => {
        const saved = localStorage.getItem('sentinel_sort_criteria');
        return saved ? JSON.parse(saved) : []; // [{ key, direction: 'asc'|'desc' }]
    });

    useEffect(() => {
        localStorage.setItem('sentinel_visible_columns', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    useEffect(() => {
        localStorage.setItem('sentinel_column_order', JSON.stringify(columnOrder));
    }, [columnOrder]);

    useEffect(() => {
        localStorage.setItem('sentinel_sort_criteria', JSON.stringify(sortCriteria));
    }, [sortCriteria]);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const res = await api.get('/tasks');

            const processed = res.data.map(task => {
                let parsedCF = {};
                try {
                    parsedCF = typeof task.custom_fields === 'string'
                        ? JSON.parse(task.custom_fields)
                        : (task.custom_fields || []);
                } catch (e) { console.error("CF Parse Error", e); }

                const cfMap = {};
                if (Array.isArray(parsedCF)) {
                    parsedCF.forEach(cf => {
                        if (cf.name) {
                            cfMap[cf.name] = cf.display_value || cf.text_value || cf.number_value || null;
                        }
                    });
                }
                return { ...task, cfMap };
            });

            setTasks(processed);
            setError(null);
        } catch (err) {
            console.error("Context fetch error:", err);
            setError("Database connection error.");
        } finally {
            setLoading(false);
        }
    };

    const fetchTiles = async () => {
        try {
            const res = await api.get('/tiles');
            setCustomTiles(res.data);
        } catch (err) {
            console.error("Error fetching custom tiles:", err);
        }
    };

    useEffect(() => {
        fetchTasks();
        fetchTiles();

        // Trigger auto-sync on mount
        handleSync();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pollSyncStatus = async (attempts = 0) => {
        // Safety break after 5 minutes (150 * 2s)
        if (attempts > 150) {
            console.warn("Sync polling timed out after 5 minutes.");
            setSyncing(false);
            return;
        }

        try {
            const res = await api.get('/sync/status');
            if (res.data.in_progress) {
                // Keep polling
                setTimeout(() => pollSyncStatus(attempts + 1), 2000);
            } else {
                setSyncing(false);
                fetchTasks();
                if (res.data.error) {
                    console.error("Sync completed with error:", res.data.error);
                    setError("Synchronization failed: " + res.data.error);
                }
            }
        } catch (e) {
            console.error("Polling error:", e);
            // On persistent error, stop polling to avoid loop
            setSyncing(false);
        }
    };

    const handleSync = async () => {
        if (syncing) return;
        setSyncing(true);
        try {
            await api.post('/sync');
            // Start polling for status
            pollSyncStatus();
        } catch (e) {
            setError("Sync failed.");
            setSyncing(false);
        }
    };

    // Metadata Discovery
    const filterMetadata = useMemo(() => {
        const assignees = Array.from(new Set(tasks.map(t => t.assignee).filter(Boolean))).sort();
        const priorities = Array.from(new Set(tasks.map(t => t.priority).filter(Boolean))).sort();

        const cfNames = new Set();
        const cfValuesMap = {};

        tasks.forEach(task => {
            Object.entries(task.cfMap || {}).forEach(([name, val]) => {
                if (val !== null && val !== undefined) {
                    cfNames.add(name);
                    if (!cfValuesMap[name]) cfValuesMap[name] = new Set();
                    cfValuesMap[name].add(String(val));
                }
            });
        });

        const customFields = Array.from(cfNames).sort().map(name => ({
            id: name,
            name: name,
            values: Array.from(cfValuesMap[name] || []).sort()
        }));

        return { assignees, priorities, customFields };
    }, [tasks]);

    const matchesCriteria = (task, criteria) => {
        for (const rule of criteria) {
            const { column, operator, values, isCustom } = rule;
            if (!column || values.length === 0) continue;

            let taskValue;
            if (isCustom) {
                taskValue = String(task.cfMap?.[column] || '');
            } else if (column === 'status') {
                taskValue = task.completed ? 'completed' : 'incomplete';
            } else {
                taskValue = task[column];
            }

            const matchesValues = values.includes(taskValue);
            if (operator === 'is' && !matchesValues) return false;
            if (operator === 'is_not' && matchesValues) return false;
        }
        return true;
    };

    // Filtering & Sorting Logic
    const filteredTasks = useMemo(() => {
        // 1. Filter
        let result = tasks.filter(task => {
            if (searchQuery && !task.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                return false;
            }
            return matchesCriteria(task, activeFilters);
        });

        // 2. Multi-Column Sort
        if (sortCriteria.length > 0) {
            result.sort((a, b) => {
                for (const criteria of sortCriteria) {
                    const { key, direction } = criteria;
                    let valA, valB;

                    // Handle nested or custom values
                    if (key.startsWith('cf:')) {
                        const cfName = key.replace('cf:', '');
                        valA = a.cfMap?.[cfName] || '';
                        valB = b.cfMap?.[cfName] || '';
                    } else {
                        valA = a[key] || '';
                        valB = b[key] || '';
                    }

                    if (valA === valB) continue;

                    const multiplier = direction === 'asc' ? 1 : -1;

                    // Simple natural sort for strings and numbers
                    if (typeof valA === 'string' && typeof valB === 'string') {
                        return valA.localeCompare(valB) * multiplier;
                    }
                    return (valA < valB ? -1 : 1) * multiplier;
                }
                return 0;
            });
        }

        return result;
    }, [tasks, searchQuery, activeFilters, sortCriteria]);

    const value = {
        tasks,
        filteredTasks,
        loading,
        syncing,
        error,
        searchQuery,
        setSearchQuery,
        activeFilters,
        setActiveFilters,
        isFilterOverlayOpen,
        setIsFilterOverlayOpen,
        filterMetadata,
        handleSync,
        triggerSync: handleSync,
        refreshData: fetchTasks,
        customTiles,
        refreshTiles: fetchTiles,
        matchesCriteria,
        // Grid Preferences
        visibleColumns,
        setVisibleColumns,
        columnOrder,
        setColumnOrder,
        sortCriteria,
        setSortCriteria
    };

    return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
};

export const useFilters = () => {
    const context = useContext(FilterContext);
    if (!context) throw new Error("useFilters must be used within FilterProvider");
    return context;
};
