import os
import sys

# Add the current directory to sys.path to import from backend
sys.path.append(os.getcwd())

from backend.db_manager import DatabaseManager
from backend.asana_engine import AsanaSyncEngine

def manual_sync():
    db_path = os.path.join("backend", "asana_sentinel.db")
    db = DatabaseManager(db_path=db_path)
    
    pat = db.get_setting("pat")
    project_gid = db.get_setting("project_gid")
    
    if not pat or not project_gid:
        print("Missing PAT or Project GID in settings.")
        return
        
    print(f"Starting sync for project {project_gid}...")
    engine = AsanaSyncEngine(pat=pat, project_gid=project_gid, db_manager=db)
    engine.sync_project_tasks()
    print("Sync complete.")

if __name__ == "__main__":
    manual_sync()
