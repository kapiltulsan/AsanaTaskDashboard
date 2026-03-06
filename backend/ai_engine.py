import logging
import os
import json
from typing import List, Optional
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

class AIEngine:
    """
    Handles interactions with the Google Gemini API to provide smart AI summaries
    and other intelligent analysis features.
    """

    def __init__(self, api_key: Optional[str] = None):
        """
        Initializes the Gemini client.
        
        Args:
            api_key (str, optional): The Google API Key. If not provided, 
                                     it will be read from the GOOGLE_API_KEY env var.
        """
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            logger.warning("GOOGLE_API_KEY not found in environment. AI features will be disabled.")
            self.model = None
            return

        try:
            genai.configure(api_key=self.api_key)
            # Using Gemini 2.0 Flash for speed and cost-efficiency
            self.model = genai.GenerativeModel('gemini-2.0-flash')
            logger.info("AI Engine initialized successfully with Gemini 1.5 Flash.")
        except Exception as e:
            logger.error(f"Failed to initialize AI Engine: {e}")
            self.model = None

    def generate_smart_summary(self, task_name: str, description: str, stories: List[str], status_card: Optional[dict] = None) -> Optional[str]:
        """
        Generates a multi-tier TPM-style Executive Overview.
        
        Args:
            task_name (str): The name of the task.
            description (str): The raw task description.
            stories (List[str]): A list of texts from comments/status updates.
            status_card (dict, optional): Parsed status card data (phases, go-live dates).
            
        Returns:
            str: A formatted JSON string with pulse, impact, and critical_path fields.
        """
        if not self.model:
            return "AI Engine not configured. Please add GOOGLE_API_KEY."

        # Prepare context
        today_str = "2026-03-06"  # Current reference date provided in metadata
        context = f"TASK NAME: {task_name}\n\nDESCRIPTION:\n{description or 'No description provided.'}\n\n"
        
        if status_card:
            context += f"PROJECT STATUS METRICS:\n{json.dumps(status_card, indent=2)}\n\n"
            
        context += "RECENT ACTIVITY/STORIES (with timestamps):\n"
        context += "\n".join([f"- {s}" for s in stories]) if stories else "No recent status updates found."

        prompt = f"""
        You are a high-level Technical Program Manager (TPM). Your goal is to process the following Asana task data 
        and generate a multi-tier Executive Overview for senior management review.
        
        Today's Date: {today_str}

        ### Data Processing Rules:
        1. **Metadata Awareness:** Each activity log entry starts with `[YYYY-MM-DD] Author:`. Use these to calculate recency and identify stakeholder voices.
        2. **Prioritize JSON blocks:** If a comment contains a JSON-like structure (e.g., highlights/updates blocks), prioritize that data as the source of truth for progress.
        3. **Intent Guessing:** If the `PROJECT STATUS METRICS` (JSON) is missing or incomplete, analyze the `DESCRIPTION` and `RECENT ACTIVITY` to "guess" the project timelines, estimated go-live, and phase statuses based on natural language content.

        ### Logical Requirements:
        1. **Recency Tiering (Rolling Window):**
           - **Pulse Current (T-0 to T-8 days):** Extract specific progress markers, blocker resolutions, or new stakeholder inputs from recent logs.
           - **Pulse Previous (T-9 to T-15 days):** Summarize the "How we got here" to provide continuity.
        2. **Performance Metrics (Impact Board):**
           - **Wins:** Identify tasks marked 'Completed' or variances showing ahead of schedule (0d or negative). Look for positive sentiment in user communications.
           - **Losses/Slips:** Identify any phase with delay (>+2d variance) or 'On Hold' / 'Blocked' status.
        3. **Strategic Identifiers (Critical Path):**
           - **Dependencies:** Scan for keywords like "required," "needs," "dependent on," "until," or "waiting for".
           - **Risks:** Highlight any date shifts, specifically looking at 'estimated_golive' vs 'planned_golive'.

        Information:
        {context}

        Return ONLY a strict JSON object with this EXACT structure (No preamble, no backticks, no extra text):
        {{
            "pulse": {{
                "current": ["Specific progress marker 1", "Specific progress marker 2"],
                "previous": ["Contextual milestone 1"]
            }},
            "impact": {{
                "wins": ["Completed/Ahead milestone 1"],
                "losses": ["Delayed/Blocked milestone 1"]
            }},
            "critical_path": {{
                "dependencies": ["Prerequisite 1"],
                "risks": ["Potential threat 1"]
            }}
        }}
        
        Important: Today is {today_str}. If no data fits a window, return an empty array [].
        """

        try:
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            # Clean up potential markdown formatting
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            
            # Debug: Write to a file we can check easily
            with open("last_ai_response.json", "w", encoding="utf-8") as f:
                f.write(text.strip())
                
            return text.strip()
        except Exception as e:
            logger.error(f"Error generating TPM summary: {e}")
            return None

if __name__ == "__main__":
    # Test script
    engine = AIEngine()
    res = engine.generate_smart_summary("Test Task", "Implement login", ["Need to fix API", "UI is done"])
    print(res)
