import sys
import os
import sqlite3

# Add current directory to path so we can import backend
sys.path.append(os.getcwd())

from backend.ai_engine import AIEngine
from dotenv import load_dotenv
load_dotenv()

# Read the HTML notes
with open('backend/pli_html_notes.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

print("--- Testing AI Summary for PLI Task ---")
engine = AIEngine()
if not engine.model:
    print("Error: AI Engine not initialized.")
    sys.exit(1)

# Task info
task_name = "Pre-Launch Inventory On/Off"
# For the prompt, we strip HTML or let the AI handle it. 
# Our NotesRenderer strips HTML usually, so let's provide clean text if possible, 
# but Gemini handles HTML well too.
description = html_content 
stories = [] # DB said 0 stories

res = engine.generate_smart_summary(task_name, description, stories)

if res:
    print(f"Generated Summary for PLI:\n{res}")
    # Let's actually UPDATE the database so the user sees it when they open the dashboard
    db_path = 'backend/asana_sentinel.db'
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("UPDATE tasks SET html_notes = ?, smart_summary = ? WHERE gid = ?", (html_content, res, '120890751829545'))
    conn.commit()
    conn.close()
    print("\nSUCCESS: Database updated with HTML notes and Smart Summary.")
else:
    print("FAILURE: AI could not generate summary.")
