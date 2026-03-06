'''
Entry point for the Asana Sentinel Workspace API.
This module defines the FastAPI application, its routes, and Pydantic models
used for request and response validation. It handles settings management,
Asana API interactions (discovery and sync), local database reads, custom
dashboard tiles, and management reporting. Includes serving static frontend files.
'''
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
import os
import json
import sys

from backend.db_manager import DatabaseManager
from backend.asana_engine import AsanaSyncEngine
from backend.reporting_engine import ReportingEngine
from backend.ai_engine import AIEngine

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Global sync state
sync_state = {"in_progress": False, "last_sync": None, "error": None}

app = FastAPI(title="Asana Sentinel Workspace API", version="1.0.0")

# Allow CORS for local React frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get DB Manager
def get_db():
    """
    Dependency function to inject the DatabaseManager instance into FastAPI route handlers.
    Ensures that the database path is resolved securely and consistently.
    
    Returns:
        DatabaseManager: An instance of the local SQLite database manager.
    """
    # Use an absolute or relative path that works securely
    db_path = os.path.join(os.path.dirname(__file__), "asana_sentinel.db")
    return DatabaseManager(db_path=db_path)

# Pydantic Models for Request/Response Validation

class SettingsUpdate(BaseModel):
    """Payload model for updating user settings (PAT and Project GID)."""
    pat: str
    project_gid: str

class PATValidationRequest(BaseModel):
    """Payload model for validating a Personal Access Token (PAT)."""
    pat: str

class ProjectDiscoveryRequest(BaseModel):
    """Payload model for discovering projects within a specific workspace."""
    pat: str
    workspace_gid: str

class TaskUpdate(BaseModel):
    """Payload model for representing updates to an Asana task."""
    name: Optional[str] = None
    completed: Optional[bool] = None
    notes: Optional[str] = None
    # Add other fields as needed

class TileDefinition(BaseModel):
    """Payload model for defining a custom dashboard tile."""
    name: str
    criteria: List[Dict[str, Any]]

# ==================== SETTINGS & CONFIG ====================

@app.get("/api/settings")
def get_settings(db: DatabaseManager = Depends(get_db)):
    """
    Retrieve saved application settings (excluding sensitive PAT).
    
    Args:
        db (DatabaseManager): The database manager dependency.
        
    Returns:
        dict: A dictionary containing project_gid and an is_configured boolean flag.
    """
    project_gid = db.get_setting("project_gid")
    return {
        "project_gid": project_gid,
        "is_configured": db.get_setting("pat") is not None and project_gid is not None
    }

@app.post("/api/settings")
def update_settings(settings: SettingsUpdate, db: DatabaseManager = Depends(get_db)):
    """
    Update configuration settings including user PAT and Project GID.
    
    Args:
        settings (SettingsUpdate): The new configuration values.
        db (DatabaseManager): The database manager dependency.
        
    Returns:
        dict: A success message indicating successful configuration save.
    """
    db.save_setting("pat", settings.pat)
    db.save_setting("project_gid", settings.project_gid)
    return {"status": "success", "message": "Settings updated safely."}

# ==================== ASANA DISCOVERY ====================

@app.post("/api/asana/validate")
def validate_pat(request: PATValidationRequest, db: DatabaseManager = Depends(get_db)):
    """
    Validates a Personal Access Token (PAT) and returns its associated workspaces.
    
    Args:
        request (PATValidationRequest): Request containing the PAT.
        db (DatabaseManager): The database manager dependency.
        
    Returns:
        dict: Success status and list of workspaces found for the token.
    Raises:
        HTTPException: If the token is invalid or fails validation.
    """
    try:
        # Create a temporary engine just for validation
        engine = AsanaSyncEngine(pat=request.pat, project_gid="", db_manager=db)
        workspaces = engine.get_workspaces()
        return {"status": "success", "workspaces": workspaces}
    except Exception as e:
        logger.error(f"PAT Validation failed: {e}", exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=401, detail=f"Validation failed: {str(e)}")

@app.post("/api/asana/projects")
def discover_projects(request: ProjectDiscoveryRequest, db: DatabaseManager = Depends(get_db)):
    """
    Returns a list of projects found in a given workspace using a specific PAT.
    
    Args:
        request (ProjectDiscoveryRequest): Request containing PAT and workspace GID.
        db (DatabaseManager): The database manager dependency.
        
    Returns:
        dict: Success status and list of projects found.
    Raises:
        HTTPException: If unable to discover projects (e.g., due to bad parameters).
    """
    try:
        engine = AsanaSyncEngine(pat=request.pat, project_gid="", db_manager=db)
        projects = engine.get_projects_in_workspace(request.workspace_gid)
        return {"status": "success", "projects": projects}
    except Exception as e:
        logger.error(f"Project discovery failed: {e}")
        raise HTTPException(status_code=400, detail="Failed to fetch projects.")

# ==================== DATA READ (LOCAL DB) ====================

@app.get("/api/tasks")
def get_tasks(db: DatabaseManager = Depends(get_db)):
    """
    Retrieve all tasks currently cached in the local database.
    
    Args:
        db (DatabaseManager): The database manager dependency.
        
    Returns:
        List[Dict]: List of cached task dictionaries.
    """
    return db.get_all_tasks()

@app.get("/api/tasks/{task_gid}/stories")
def get_stories(task_gid: str, db: DatabaseManager = Depends(get_db)):
    """
    Retrieve cached stories (comments) for a designated task GID.
    
    Args:
        task_gid (str): The unique Asana Task GID.
        db (DatabaseManager): The database manager dependency.
        
    Returns:
        List[Dict]: List of stories corresponding to the task.
    """
    return db.get_stories_by_task(task_gid)

@app.get("/api/dashboard/stats")
def get_dashboard_stats(db: DatabaseManager = Depends(get_db)):
    """
    Retrieve high-level summary statistics across tasks for the dashboard overview.
    
    Args:
        db (DatabaseManager): The database manager dependency.
        
    Returns:
        dict: Statistics including total count, completions, risks, and overall rate.
    """
    tasks = db.get_all_tasks()
    total = len(tasks)
    completed = sum(1 for t in tasks if t.get('completed'))
    
    # Calculate at-risk tasks (based on stories with interventions)
    # This involves fetching stories where needs_intervention is True
    # For a real implementation, a direct SQL query is better. Let's do a simple count for now.
    with db._get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(DISTINCT task_gid) as risk_count FROM stories WHERE needs_intervention = 1')
        row = cursor.fetchone()
        risk_count = row['risk_count'] if row else 0

    return {
        "total_tasks": total,
        "completed_tasks": completed,
        "at_risk_tasks": risk_count,
        "completion_rate": round((completed/total)*100, 1) if total > 0 else 0
    }

@app.get("/api/tasks/{task_gid}/stories")
def get_task_stories(task_gid: str, db: DatabaseManager = Depends(get_db)):
    """
    Fetches comments/stories for a specific task.
    (Duplicates get_stories, kept for backwards compatibility in routing paths).
    """
    return db.get_stories_by_task(task_gid)

@app.get("/api/tasks/{task_gid}/summary")
def get_ai_summary(task_gid: str, force: bool = False, db: DatabaseManager = Depends(get_db)):
    """
    Retrieves a smart AI summary for a task. 
    If a summary is cached in the DB, it returns it unless force=True.
    Otherwise, it gathers task data and comments and generates a new one.
    """
    # Check cache first (Validate format: Must be a dict with TPM keys)
    task = next((t for t in db.get_all_tasks() if t['gid'] == task_gid), None)
    if task and task.get('smart_summary') and not force:
        try:
            summary = json.loads(task['smart_summary'])
            if isinstance(summary, dict) and "pulse" in summary:
                logger.info(f"Valid TPM summary found in cache for {task_gid}")
                return {"status": "success", "summary": summary}
            else:
                logger.info(f"Legacy/invalid summary found for {task_gid}, forcing regeneration.")
        except:
            logger.info(f"Parsing failed for summary of {task_gid}, forcing regeneration.")
            pass

    if not task:
        raise HTTPException(status_code=404, detail="Task not found in cache.")

    # Gather data for AI (Enriched with Date and Author)
    stories = db.get_stories_by_task(task_gid)
    story_texts = []
    for s in stories:
        if s.get('text'):
            date_str = s.get('created_at', 'Unknown Date')[:10]  # Extract YYYY-MM-DD
            author = s.get('created_by', 'Stakeholder')
            story_texts.append(f"[{date_str}] {author}: {s['text']}")
    
    # Extract status card for AI context
    status_card = None
    if task.get('notes'):
        notes = task['notes']
        marker = '"status_card"'
        start_search = 0
        while True:
            marker_idx = notes.find(marker, start_search)
            if marker_idx == -1: break
            
            # Find matching braces
            open_brace_idx = notes.rfind('{', 0, marker_idx)
            if open_brace_idx != -1:
                brace_count = 0
                for i in range(open_brace_idx, len(notes)):
                    if notes[i] == '{': brace_count += 1
                    elif notes[i] == '}': brace_count -= 1
                    if brace_count == 0:
                        try:
                            candidate = json.loads(notes[open_brace_idx:i+1])
                            if 'status_card' in candidate:
                                status_card = candidate['status_card']
                                break
                        except: pass
                        break
            if status_card: break
            start_search = marker_idx + 1

    # Initialize AI Engine
    engine = AIEngine()
    summary_json = engine.generate_smart_summary(
        task_name=task['name'],
        description=task['notes'],
        stories=story_texts,
        status_card=status_card
    )

    if summary_json:
        try:
            parsed = json.loads(summary_json)
            # Ensure it's a dict with the new pulse key
            if isinstance(parsed, dict) and "pulse" in parsed:
                db.update_task_summary(task_gid, summary_json)
                logger.info(f"SUCCESS: Sending TPM summary for {task_gid}")
                return {"status": "success", "summary": parsed}
            else:
                logger.warning(f"AI returned unexpected format for {task_gid}: {summary_json[:100]}")
        except Exception as e:
            logger.error(f"Failed to parse AI summary JSON: {e}")

    # Fallback/Error state with placeholders that explain the state
    logger.warning(f"FAILURE: Returning fallback for {task_gid}")
    return {
        "status": "error", 
        "message": "AI generation failed or returned invalid format.",
        "summary": {
            "pulse": {"current": ["AI failed to generate pulse updates."], "previous": []},
            "impact": {"wins": [], "losses": ["Analysis engine encountered an error."]},
            "critical_path": {"dependencies": [], "risks": ["Check raw comments for details."]}
        }
    }

@app.get("/api/tiles")
def list_tiles(db: DatabaseManager = Depends(get_db)):
    """
    Returns all custom dashboard tiles and their definitions.
    
    Args:
        db (DatabaseManager): The database manager dependency.
        
    Returns:
        List[Dict]: List of tile configuration dictionaries.
    """
    tiles = db.get_custom_tiles()
    # Parse the criteria JSON string back into a list
    for tile in tiles:
        if isinstance(tile.get('criteria'), str):
            tile['criteria'] = json.loads(tile['criteria'])
    return tiles

@app.post("/api/tiles")
def add_tile(tile: TileDefinition, db: DatabaseManager = Depends(get_db)):
    """
    Creates a new custom tile for dashboard display metrics.
    
    Args:
        tile (TileDefinition): Configuration schema of the tile to add.
        db (DatabaseManager): The database manager dependency.
        
    Returns:
        dict: Success status and newly created tile ID.
    """
    tile_id = db.add_custom_tile(tile.name, tile.criteria)
    return {"status": "success", "id": tile_id}

@app.put("/api/tiles/{tile_id}")
def update_tile(tile_id: int, tile: TileDefinition, db: DatabaseManager = Depends(get_db)):
    """
    Updates an existing custom dashboard tile configuration.
    
    Args:
        tile_id (int): ID of the tile to update.
        tile (TileDefinition): New detailed configuration.
        db (DatabaseManager): The database manager dependency.
        
    Returns:
        dict: Success status message.
    """
    db.update_custom_tile(tile_id, tile.name, tile.criteria)
    return {"status": "success"}

@app.post("/api/tiles/reorder")
def reorder_tiles(order_map: Dict[int, int], db: DatabaseManager = Depends(get_db)):
    """
    Batch updates the visual display placement order for all custom tiles.
    
    Args:
        order_map (Dict[int, int]): A map of { tile_id: target_order_index }.
        db (DatabaseManager): The database manager dependency.
        
    Returns:
        dict: Success status message.
    """
    db.update_tiles_order(order_map)
    return {"status": "success"}

@app.delete("/api/tiles/{tile_id}")
def delete_tile(tile_id: int, db: DatabaseManager = Depends(get_db)):
    """
    Deletes a specific dashboard custom tile by its ID.
    
    Args:
        tile_id (int): Numeric identifier of the tile.
        db (DatabaseManager): The database manager dependency.
        
    Returns:
        dict: Success status message.
    """
    db.delete_custom_tile(tile_id)
    return {"status": "success"}

# ==================== MANAGEMENT REPORTS ====================

@app.get("/api/reports/status")
def get_management_report(db: DatabaseManager = Depends(get_db)):
    """
    Generates a high-level summary report for management audiences.
    Utilizes the ReportingEngine to assemble latest status metrics.
    
    Args:
        db (DatabaseManager): The database manager dependency.
        
    Returns:
        dict: The structured status report payload.
    """
    engine = ReportingEngine(db)
    return engine.get_latest_status_report()

@app.get("/api/reports/trends")
def get_trend_data(db: DatabaseManager = Depends(get_db)):
    """
    Returns historical data snapshots useful for plotting trends and charts.
    
    Args:
        db (DatabaseManager): The database manager dependency.
        
    Returns:
        List[Dict]: Array of historical data entries.
    """
    engine = ReportingEngine(db)
    return engine.get_historical_trends()

# ==================== SYNC OPERATIONS ====================

def run_sync_background(db: DatabaseManager):
    """
    Executes a background task to synchronize all data from remote Asana servers
    into local caches safely without freezing the main application thread.
    
    Args:
        db (DatabaseManager): The database manager reference.
    """
    pat = db.get_setting("pat")
    project_gid = db.get_setting("project_gid")
    
    if not pat or not project_gid:
        logger.error("Cannot sync: Missing PAT or Project GID.")
        return
        
    sync_state["in_progress"] = True
    sync_state["error"] = None
    
    try:
        engine = AsanaSyncEngine(pat=pat, project_gid=project_gid, db_manager=db)
        engine.sync_project_tasks()
        
        # Taking a trend snapshot after sync
        tasks = db.get_all_tasks()
        total = len(tasks)
        completed = sum(1 for t in tasks if t.get('completed'))
        
        with db._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(DISTINCT task_gid) as c FROM stories WHERE needs_intervention = 1')
            row = cursor.fetchone()
            risk_count = row['c'] if row else 0
            
        db.create_snapshot({
            "total_tasks": total,
            "completed_tasks": completed,
            "at_risk_tasks": risk_count,
            "improving": True,  # Placeholder logic
            "slow": False
        })
        from datetime import datetime
        sync_state["last_sync"] = datetime.now().isoformat()
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        sync_state["error"] = str(e)
    finally:
        sync_state["in_progress"] = False

@app.post("/api/sync")
def trigger_sync(background_tasks: BackgroundTasks, db: DatabaseManager = Depends(get_db)):
    """
    Triggers an asynchronous sync operation fetching tasks and stories from Asana.
    Queues the operation as a FastAPI background task responding instantly to client.
    
    Args:
        background_tasks (BackgroundTasks): Injected handler for background tasks.
        db (DatabaseManager): The database manager dependency.
        
    Returns:
        dict: Status message confirming background execution startup.
    Raises:
        HTTPException: If required setup configs are missing prior to sync.
    """
    pat = db.get_setting("pat")
    project_gid = db.get_setting("project_gid")
    
    if not pat or not project_gid:
        raise HTTPException(status_code=400, detail="Configuration missing. Please set PAT and Project ID.")
        
    background_tasks.add_task(run_sync_background, db)
    return {"status": "sync_started", "message": "Synchronization is running in the background."}

@app.get("/api/sync/status")
def get_sync_status():
    """Returns the current background synchronization status."""
    return sync_state

@app.put("/api/tasks/{task_gid}")
def update_task(task_gid: str, task_update: TaskUpdate, background_tasks: BackgroundTasks, db: DatabaseManager = Depends(get_db)):
    """
    SENTINEL: Read-Only Mode Block Mechanism.
    Intentionally rejects update operations back to Asana enforcing an overarching
    read-only view policy on the dashboard tier.
    
    Args:
        task_gid (str): Unused task ID param for routing match.
        task_update (TaskUpdate): Unused payload for request validation.
        background_tasks (BackgroundTasks): Unused background handler.
        db (DatabaseManager): Unused DB Dependency.
        
    Raises:
        HTTPException: Immediately returning 405 Method Not Allowed policy override.
    """
    raise HTTPException(status_code=405, detail="SENTINEL_MODE_ACTIVE: The dashboard is currently read-only. Updates must be performed in Asana.")
    
# ==================== STATIC FILE SERVING ====================

# Path where PyInstaller places data files, or local dev path
if getattr(sys, 'frozen', False):
    # PyInstaller creates a temp folder and stores path in _MEIPASS
    static_dir = os.path.join(sys._MEIPASS, "static")
else:
    static_dir = os.path.join(os.path.dirname(__file__), "static")

if os.path.exists(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        """
        Catch-all route to serve the React SPA index.html for any path 
        not matched by API routes.
        """
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"error": "Frontend build not found."}

if __name__ == "__main__":
    import uvicorn
    # Use the app object directly for compatibility with PyInstaller --onefile
    # and disable reload which is not supported/needed in a bundled executable.
    uvicorn.run(app, host="127.0.0.1", port=8000)
