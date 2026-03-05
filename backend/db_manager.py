import sqlite3
import json
import logging
from datetime import datetime
from pathlib import Path

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DatabaseManager:
    """
    Manages the local SQLite database for the Asana Sentinel Workspace.
    Provides offline-first caching of Tasks, Stories (comments), Trend Snapshots,
    and simple storage for user credentials.
    """
    
    def __init__(self, db_path="asana_sentinel.db"):
        """
        Initializes the DatabaseManager.
        
        Args:
            db_path (str): The file path to the SQLite database. Defaults to "asana_sentinel.db".
        """
        self.db_path = db_path
        self._initialize_db()

    def _get_connection(self):
        """
        Returns a connection to the SQLite database with row factory enabled.
        This allows row results to be accessed like dictionaries.
        
        Returns:
            sqlite3.Connection: An open database connection object.
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _initialize_db(self):
        """
        Creates the necessary tables if they do not exist.
        Ensures the schema is ready for Tasks, Stories, Settings, Snapshots, and Custom Tiles.
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                # Table for App/User Settings (Credentials)
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS settings (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL
                    )
                ''')
                
                # Table for Asana Tasks
                # Storing core fields and a JSON blob for custom fields to remain flexible
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS tasks (
                        gid TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        completed BOOLEAN DEFAULT 0,
                        assignee TEXT,
                        due_on TEXT,
                        priority TEXT,
                        notes TEXT,
                        html_notes TEXT,
                        custom_fields TEXT,  -- JSON string
                        permalink_url TEXT,
                        last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Table for Task Comments (Stories)
                # Used for "Comment & Story Intelligence" (blockers, management intervention)
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS stories (
                        gid TEXT PRIMARY KEY,
                        task_gid TEXT NOT NULL,
                        text TEXT,
                        type TEXT,
                        created_by TEXT,
                        created_at TEXT,
                        is_blocker BOOLEAN DEFAULT 0,
                        needs_intervention BOOLEAN DEFAULT 0,
                        FOREIGN KEY(task_gid) REFERENCES tasks(gid) ON DELETE CASCADE
                    )
                ''')
                
                # Table for Management Reporting Engine & Trend Tracking
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS snapshots (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        snapshot_date DATE DEFAULT CURRENT_DATE,
                        total_tasks INTEGER DEFAULT 0,
                        completed_tasks INTEGER DEFAULT 0,
                        improving BOOLEAN,
                        slow BOOLEAN,
                        at_risk_tasks INTEGER DEFAULT 0
                    )
                ''')
                
                # Table for Custom Dashboard Tiles
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS custom_tiles (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        criteria TEXT NOT NULL, -- JSON string of rule objects
                        display_order INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                conn.commit()
                logger.info("Database initialized successfully.")
        except sqlite3.Error as e:
            logger.error(f"Error initializing database: {e}")

    # ==================== SETTINGS (CREDENTIALS) ====================

    def save_setting(self, key: str, value: str):
        """
        Saves a configuration setting (e.g., encrypted PAT, project_id).
        Uses an UPSERT (ON CONFLICT DO UPDATE) strategy to overwrite existing keys.
        
        Args:
            key (str): The setting identifier.
            value (str): The value to store.
        """
        with self._get_connection() as conn:
            conn.execute('''
                INSERT INTO settings (key, value) 
                VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value
            ''', (key, value))
            conn.commit()

    def get_setting(self, key: str) -> str:
        """
        Retrieves a configuration setting by its key.
        
        Args:
            key (str): The setting identifier to search for.
            
        Returns:
            str: The stored value, or None if the key does not exist.
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT value FROM settings WHERE key = ?', (key,))
            row = cursor.fetchone()
            return row['value'] if row else None

    # ==================== TASKS ====================

    def upsert_task(self, task_data: dict):
        """
        Inserts or updates an Asana task record in the local cache.
        The custom_fields dictionary is serialized into a JSON string before storage.
        
        Args:
            task_data (dict): Dictionary reflecting the task schema containing keys like 'gid', 'name', etc.
        """
        custom_fields = json.dumps(task_data.get('custom_fields', {}))
        
        with self._get_connection() as conn:
            conn.execute('''
                INSERT INTO tasks (gid, name, completed, assignee, due_on, priority, notes, html_notes, custom_fields, permalink_url, last_synced)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(gid) DO UPDATE SET
                    name=excluded.name,
                    completed=excluded.completed,
                    assignee=excluded.assignee,
                    due_on=excluded.due_on,
                    priority=excluded.priority,
                    notes=excluded.notes,
                    html_notes=excluded.html_notes,
                    custom_fields=excluded.custom_fields,
                    permalink_url=excluded.permalink_url,
                    last_synced=CURRENT_TIMESTAMP
            ''', (
                task_data.get('gid'),
                task_data.get('name'),
                task_data.get('completed', False),
                task_data.get('assignee'),
                task_data.get('due_on'),
                task_data.get('priority'),
                task_data.get('notes'),
                task_data.get('html_notes'),
                custom_fields,
                task_data.get('permalink_url')
            ))
            conn.commit()

    def get_all_tasks(self):
        """
        Retrieves all cached tasks formatted for the UI Grid.
        
        Returns:
            List[Dict]: A list of task dictionaries containing row data.
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM tasks')
            return [dict(row) for row in cursor.fetchall()]

    # ==================== STORIES ====================

    def upsert_story(self, story_data: dict):
        """
        Inserts or updates a task comment/story.
        Updates metadata indicators like 'is_blocker' or 'needs_intervention' during conflicts.
        
        Args:
            story_data (dict): Dictionary with story attributes (gid, text, created_by, etc.).
        """
        with self._get_connection() as conn:
            conn.execute('''
                INSERT INTO stories (gid, task_gid, text, type, created_by, created_at, is_blocker, needs_intervention)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(gid) DO UPDATE SET
                    text=excluded.text,
                    is_blocker=excluded.is_blocker,
                    needs_intervention=excluded.needs_intervention
            ''', (
                story_data.get('gid'),
                story_data.get('task_gid'),
                story_data.get('text'),
                story_data.get('type'),
                story_data.get('created_by'),
                story_data.get('created_at'),
                story_data.get('is_blocker', False),
                story_data.get('needs_intervention', False)
            ))
            conn.commit()

    def get_stories_by_task(self, task_gid: str):
        """
        Fetches all stories (comments) linked explicitly to a specific task, sorted newest first.
        
        Args:
            task_gid (str): The unique parent Task ID.
            
        Returns:
            List[Dict]: List of corresponding story dictionaries.
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM stories WHERE task_gid = ? ORDER BY created_at DESC', (task_gid,))
            return [dict(row) for row in cursor.fetchall()]

    # ==================== SNAPSHOTS ====================

    # ==================== CUSTOM TILES ====================

    def add_custom_tile(self, name: str, criteria: list):
        """
        Adds a new dynamic metric tile configuration for the dashboard.
        
        Args:
            name (str): Display name for the tile.
            criteria (list): List of rule objects dictating how the tile filters tasks.
            
        Returns:
            int: The primary key ID of the newly inserted tile.
        """
        criteria_json = json.dumps(criteria)
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('INSERT INTO custom_tiles (name, criteria) VALUES (?, ?)', (name, criteria_json))
            conn.commit()
            return cursor.lastrowid

    def get_custom_tiles(self):
        """
        Retrieves all custom tiles defined by the user.
        
        Returns:
            List[Dict]: List of tile configuration records, ordered by display parameter.
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM custom_tiles ORDER BY display_order ASC, created_at DESC')
            return [dict(row) for row in cursor.fetchall()]

    def update_custom_tile(self, tile_id: int, name: str, criteria: list):
        """
        Updates an existing custom tile's name and filter criteria.
        
        Args:
            tile_id (int): Database ID of the target tile.
            name (str): The updated display name.
            criteria (list): The updated filtering rule constraints.
        """
        criteria_json = json.dumps(criteria)
        with self._get_connection() as conn:
            conn.execute('''
                UPDATE custom_tiles 
                SET name = ?, criteria = ? 
                WHERE id = ?
            ''', (name, criteria_json, tile_id))
            conn.commit()

    def update_tiles_order(self, order_map: dict):
        """
        Batch updates the display_order field for multiple tiles.
        Used to persist drag-and-drop reordering configurations cleanly.
        
        Args:
            order_map (dict): A mapping of tile_id to new order priority.
        """
        with self._get_connection() as conn:
            for tile_id, order in order_map.items():
                conn.execute('UPDATE custom_tiles SET display_order = ? WHERE id = ?', (order, tile_id))
            conn.commit()

    def delete_custom_tile(self, tile_id: int):
        """
        Permanently removes a custom tile definition from the database.
        
        Args:
            tile_id (int): Database ID of the tile to delete.
        """
        with self._get_connection() as conn:
            conn.execute('DELETE FROM custom_tiles WHERE id = ?', (tile_id,))
            conn.commit()

# Testing execution if run as main file
if __name__ == "__main__":
    db = DatabaseManager('test_sentinel.db')
    print("Test run complete. Tables verified.")
