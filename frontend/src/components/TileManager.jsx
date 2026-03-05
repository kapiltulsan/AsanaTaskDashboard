import React, { useState } from 'react';
import { Plus, Trash2, LayoutGrid, CheckCircle, Info } from 'lucide-react';
import { useFilters } from '../context/FilterContext';
import RuleEditor from './RuleEditor';
import api from '../api';

const TileManager = () => {
    const { customTiles, filterMetadata, refreshTiles } = useFilters();
    const [isCreating, setIsCreating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingTileId, setEditingTileId] = useState(null);
    const [newTileName, setNewTileName] = useState('');
    const [newTileCriteria, setNewTileCriteria] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const addRule = () => {
        setNewTileCriteria([...newTileCriteria, {
            id: Math.random().toString(36).substr(2, 9),
            column: 'assignee',
            operator: 'is',
            values: [],
            isCustom: false
        }]);
    };

    const updateRule = (id, updates) => {
        setNewTileCriteria(newTileCriteria.map(r => r.id === id ? { ...r, ...updates } : r));
    };

    const removeRule = (id) => {
        setNewTileCriteria(newTileCriteria.filter(r => r.id !== id));
    };

    const handleSaveTile = async () => {
        if (!newTileName) {
            setError("Title Name is required.");
            return;
        }
        if (newTileCriteria.length === 0) {
            setError("At least one rule is required.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            if (isEditing) {
                await api.put(`/tiles/${editingTileId}`, {
                    name: newTileName,
                    criteria: newTileCriteria
                });
            } else {
                await api.post('/tiles', {
                    name: newTileName,
                    criteria: newTileCriteria
                });
            }
            await refreshTiles();
            cancelForm();
        } catch (err) {
            setError("Failed to save tile configuration.");
        } finally {
            setLoading(false);
        }
    };

    const cancelForm = () => {
        setNewTileName('');
        setNewTileCriteria([]);
        setIsCreating(false);
        setIsEditing(false);
        setEditingTileId(null);
        setError(null);
    };

    const handleEditTile = (tile) => {
        setNewTileName(tile.name);
        setNewTileCriteria(tile.criteria);
        setEditingTileId(tile.id);
        setIsEditing(true);
        setIsCreating(true); // Open the creation form in edit mode
    };

    const handleMove = async (index, direction) => {
        const newTiles = [...customTiles];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= customTiles.length) return;

        // Swap
        [newTiles[index], newTiles[targetIndex]] = [newTiles[targetIndex], newTiles[index]];

        // Prepare order map for backend
        const orderMap = {};
        newTiles.forEach((tile, idx) => {
            orderMap[tile.id] = idx;
        });

        try {
            // Optimistic update would be better, but let's sync first
            await api.post('/tiles/reorder', orderMap);
            await refreshTiles();
        } catch (err) {
            console.error("Reorder sync failed", err);
        }
    };

    const handleDeleteTile = async (id) => {
        if (!window.confirm("Are you sure you want to delete this tile?")) return;
        try {
            await api.delete(`/tiles/${id}`);
            await refreshTiles();
        } catch (err) {
            console.error("Delete error", err);
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                    <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <LayoutGrid size={18} className="text-sky-500" />
                        Dashboard Tiles
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Configure global monitoring nodes for the dashboard</p>
                </div>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        id="btn-new-tile"
                        disabled={customTiles.length >= 6}
                        className={`bg-white border border-slate-300 text-slate-700 px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm ${customTiles.length >= 6 ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
                    >
                        <Plus size={16} /> New Tile
                    </button>
                )}
            </div>

            {customTiles.length >= 6 && !isCreating && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                    <Info size={16} className="text-amber-600" />
                    <p className="text-sm font-medium text-amber-900">
                        Dashboard capacity reached (Max 6 Tiles). Delete an existing node to deploy a new one.
                    </p>
                </div>
            )}

            {error && (
                <div className="text-sm p-3 bg-red-50 text-red-700 font-medium rounded-lg border border-red-200 flex items-center gap-2">
                    <Info size={16} className="text-red-500" /> Configuration error: {error}
                </div>
            )}

            {isCreating && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-6 space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 block">Tile Name</label>
                            <input
                                type="text"
                                id="input-tile-name"
                                placeholder="e.g., 'Urgent Blockers', 'Pending Review'..."
                                value={newTileName}
                                onChange={(e) => setNewTileName(e.target.value)}
                                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all shadow-sm"
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between sticky top-0 bg-white py-1 z-10 border-b border-transparent">
                                <label className="text-sm font-semibold text-slate-700">Logic Constraints</label>
                                <button onClick={addRule} id="btn-add-rule" className="text-sm font-medium text-sky-600 hover:text-sky-700 flex items-center gap-1 transition-colors">
                                    <Plus size={16} /> Add Rule
                                </button>
                            </div>

                            <div className="space-y-3 pb-2">
                                {newTileCriteria.length === 0 ? (
                                    <div className="text-center py-8 border border-dashed border-slate-300 rounded-lg bg-slate-50">
                                        <p className="text-sm text-slate-500">No constraints defined for this tile</p>
                                    </div>
                                ) : (
                                    newTileCriteria.map(rule => (
                                        <RuleEditor
                                            key={rule.id}
                                            filter={rule}
                                            metadata={filterMetadata}
                                            onUpdate={(upd) => updateRule(rule.id, upd)}
                                            onRemove={() => removeRule(rule.id)}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 p-6 bg-slate-50 border-t border-slate-200 sticky bottom-0">
                        <button
                            onClick={cancelForm}
                            id="btn-cancel-tile"
                            className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveTile}
                            id="btn-save-tile"
                            disabled={loading}
                            className="flex-1 bg-sky-600 text-white py-2 text-sm font-medium rounded-lg hover:bg-sky-700 shadow-md disabled:opacity-50 transition-all focus:ring-2 focus:ring-sky-500/20 active:translate-y-px"
                        >
                            {loading ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Node Configuration' : 'Deploy Custom Tile')}
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-3">
                {customTiles.length === 0 && !isCreating ? (
                    <div className="py-12 px-4 text-center bg-white border border-slate-200 rounded-xl shadow-sm">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <LayoutGrid size={24} className="text-slate-400" />
                        </div>
                        <p className="text-sm text-slate-600 font-medium">No custom tiles configured</p>
                        <p className="text-xs text-slate-400 mt-1">Create one to monitor specific task segments</p>
                    </div>
                ) : (
                    customTiles.map((tile, index) => (
                        <div key={tile.id} className="bg-white border border-slate-200 p-4 rounded-lg transition-all hover:border-sky-300 hover:shadow-md flex items-center justify-between group/tile relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-sky-500" />
                            <div className="pl-2 flex-1">
                                <h3 className="text-sm font-semibold text-slate-800">{tile.name}</h3>
                                <div className="flex gap-2 mt-2 flex-wrap">
                                    {tile.criteria.map((c, i) => (
                                        <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-medium border border-slate-200">
                                            {c.column.charAt(0).toUpperCase() + c.column.slice(1)} {c.operator.replace('_', ' ')} {c.values.join(', ')}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover/tile:opacity-100 transition-opacity">
                                <div className="flex flex-col border-r border-slate-200 pr-2 mr-2">
                                    <button
                                        onClick={() => handleMove(index, 'up')}
                                        id={`btn-move-up-tile-${tile.id}`}
                                        disabled={index === 0}
                                        className="p-1 text-slate-400 hover:text-sky-600 disabled:opacity-30 transition-colors"
                                        title="Move Up"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                                    </button>
                                    <button
                                        onClick={() => handleMove(index, 'down')}
                                        id={`btn-move-down-tile-${tile.id}`}
                                        disabled={index === customTiles.length - 1}
                                        className="p-1 text-slate-400 hover:text-sky-600 disabled:opacity-30 transition-colors"
                                        title="Move Down"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                    </button>
                                </div>
                                <button
                                    onClick={() => handleEditTile(tile)}
                                    id={`btn-edit-tile-${tile.id}`}
                                    className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                                    title="Edit Logic"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                </button>
                                <button
                                    onClick={() => handleDeleteTile(tile.id)}
                                    id={`btn-delete-tile-${tile.id}`}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/20"
                                    title="Delete Node"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default TileManager;
