import sqlite3
import os

db_path = os.path.join(os.getcwd(), "backend", "asana_sentinel.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    print("Checking if permalink_url column exists...")
    cursor.execute("PRAGMA table_info(tasks)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if "permalink_url" not in columns:
        print("Adding permalink_url column to tasks table...")
        cursor.execute("ALTER TABLE tasks ADD COLUMN permalink_url TEXT")
        conn.commit()
        print("Column added successfully.")
    
    print("Checking if display_order column exists in custom_tiles...")
    cursor.execute("PRAGMA table_info(custom_tiles)")
    tile_columns = [row[1] for row in cursor.fetchall()]
    
    if "display_order" not in tile_columns:
        print("Adding display_order column to custom_tiles table...")
        cursor.execute("ALTER TABLE custom_tiles ADD COLUMN display_order INTEGER DEFAULT 0")
        conn.commit()
        print("Column added successfully.")
    else:
        print("display_order column already exists.")

except Exception as e:
    print(f"Error during migration: {e}")
finally:
    conn.close()
