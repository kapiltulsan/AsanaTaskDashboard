import sqlite3
import os

db_path = os.path.join(os.getcwd(), "asana_sentinel.db")
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

try:
    cursor.execute('SELECT gid, name, permalink_url FROM tasks WHERE permalink_url IS NOT NULL LIMIT 5')
    rows = cursor.fetchall()
    print(f"Found {len(rows)} tasks with permalink_url")
    for row in rows:
        print(f"GID: {row['gid']}, Name: {row['name']}, URL: {row['permalink_url']}")
except Exception as e:
    print(f"Error checking DB: {e}")
finally:
    conn.close()
