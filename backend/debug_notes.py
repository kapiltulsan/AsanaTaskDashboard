import sqlite3
import json

db_path = r"asana_sentinel.db"
try:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT name, notes, html_notes FROM tasks WHERE name LIKE 'PLI%' LIMIT 1").fetchone()
    if row:
        with open("pli_html_notes.html", "w", encoding="utf-8") as f:
            f.write(row['html_notes'] or "No HTML notes")
        print(f"Name: {row['name']}")
        print("HTML notes written to pli_html_notes.html")
    else:
        print("Task PLI not found.")
    conn.close()
except Exception as e:
    print(f"Error: {e}")
