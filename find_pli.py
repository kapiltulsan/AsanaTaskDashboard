import sqlite3
import json

db_path = 'backend/asana_sentinel.db'
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("--- Searching for PLI tasks ---")
cursor.execute("SELECT gid, name, completed, notes, smart_summary FROM tasks WHERE name LIKE ?", ('%PLI%',))
rows = cursor.fetchall()

if not rows:
    print("No tasks found matching 'PLI'.")
else:
    for row in rows:
        task = dict(row)
        print(f"Task Found: {task['name']} (GID: {task['gid']})")
        print(f"Status: {'Completed' if task['completed'] else 'Incomplete'}")
        print(f"Notes Length: {len(task['notes']) if task['notes'] else 0}")
        print(f"Existing Summary: {task['smart_summary'] is not None}")
        
        print("\n--- Fetching Stories (Comments) ---")
        cursor.execute("SELECT text, created_by, created_at FROM stories WHERE task_gid = ? ORDER BY created_at DESC", (task['gid'],))
        stories = cursor.fetchall()
        print(f"Total Stories: {len(stories)}")
        for s in stories[:3]: # Show last 3
             print(f"- {s['created_by']} at {s['created_at']}: {s['text'][:100]}...")

conn.close()
