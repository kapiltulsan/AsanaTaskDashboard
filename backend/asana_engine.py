import time
import logging
from typing import Optional, List, Dict
from datetime import datetime

# You must install the official Asana library: pip install asana
import asana
from asana.rest import ApiException

from backend.db_manager import DatabaseManager

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AsanaSyncEngine:
    """
    Handles bi-directional synchronization between the local SQLite database
    and the Asana API. Features robust rate limiting (exponential backoff)
    and Story Intelligence for management reporting.
    """

    def __init__(self, pat: str, project_gid: str, db_manager: DatabaseManager):
        """
        Initializes the Asana API client and sync engine.
        
        Args:
            pat (str): The Personal Access Token for Asana authentication.
            project_gid (str): The primary Asana Project GID to sync tasks from.
            db_manager (DatabaseManager): An active database manager instance for local caching.
        """
        self.pat = pat
        self.project_gid = project_gid
        self.db = db_manager
        
        # Configure Asana client
        self.configuration = asana.Configuration()
        self.configuration.access_token = self.pat
        self.api_client = asana.ApiClient(self.configuration)
        
        # Initialize specialized APIs
        self.tasks_api = asana.TasksApi(self.api_client)
        self.stories_api = asana.StoriesApi(self.api_client)
        self.workspaces_api = asana.WorkspacesApi(self.api_client)
        self.projects_api = asana.ProjectsApi(self.api_client)

    def _execute_with_backoff(self, func, *args, **kwargs):
        """
        Executes an Asana API call with exponential backoff strategy to handle 
        the standard 150 requests/minute rate limit.
        
        Args:
            func (Callable): The Asana SDK function/method to execute.
            *args: Positional arguments to pass to the function.
            **kwargs: Keyword arguments to pass to the function.
            
        Returns:
            Any: The response from the executed API call.
            
        Raises:
            ApiException: If a non-429 error occurs, or if max retries are exceeded.
        """
        max_retries = 5
        base_delay = 1.0 # 1 second

        for attempt in range(max_retries):
            try:
                # The Asana SDK endpoints return iterators/generators or raw Dicts
                return func(*args, **kwargs)
            except ApiException as e:
                if e.status == 429: # Rate limit exceeded
                    wait_time = base_delay * (2 ** attempt)
                    logger.warning(f"Rate limited by Asana (429). Waiting {wait_time}s... (Attempt {attempt+1}/{max_retries})")
                    time.sleep(wait_time)
                else:
                    logger.error(f"Asana API Exception: Status {e.status} - {e.reason}")
                    raise e
            except Exception as e:
                logger.error(f"Unexpected error during API call: {e}")
                raise e
                
        logger.error("Max retries exceeded for Asana API call.")
        return None

    def _process_story_intelligence(self, text: str) -> dict:
        """
        Analyzes a task comment's text to determine if management intervention is required
        or if a project component is explicitly blocked. This uses rudimentary keyword matching
        designed for non-technical management reporting.
        
        Args:
            text (str): The raw text of the Asana story/comment.
            
        Returns:
            dict: An intelligence assessment dictionary containing boolean flags for:
                - is_blocker: True if blocker keywords are found.
                - needs_intervention: True if escalation keywords are found.
        """
        if not text:
            return {"is_blocker": False, "needs_intervention": False}
            
        text_lower = text.lower()
        
        # Simple heuristic mapping - can be expanded to NLP/LLM logic later
        blocker_keywords = ['blocked', 'blocking', 'stuck', 'cannot proceed', 'waiting on']
        intervention_keywords = ['urgent', 'escalate', 'boss', 'cfo', 'ceo', 'management', 'help', 'critical']
        
        return {
            "is_blocker": any(kw in text_lower for kw in blocker_keywords),
            "needs_intervention": any(kw in text_lower for kw in intervention_keywords)
        }

    def sync_project_tasks(self):
        """
        Fetches all tasks in the configured project and saves them to the local SQLite database.
        It pulls down core fields and custom fields, and sequentially synchronizes stories
        for each fetched task.
        """
        logger.info(f"Starting Task Sync for Project: {self.project_gid}")
        
        opts = {
            'opt_fields': "name,completed,assignee.name,due_on,notes,html_notes,custom_fields,modified_at,permalink_url"
        }
        
        # We need to exhaust the generator/iterator returned by the SDK
        response = self._execute_with_backoff(
            self.tasks_api.get_tasks_for_project,
            self.project_gid,
            opts
        )
        
        if not response:
            return

        sync_count = 0
        
        # Iterate over results
        for task in response:
            sync_count += 1
            assignee_name = task.get('assignee', {}).get('name') if task.get('assignee') else None
            
            task_data = {
                'gid': task.get('gid'),
                'name': task.get('name', 'Untitled Task'),
                'completed': task.get('completed', False),
                'assignee': assignee_name,
                'due_on': task.get('due_on'),
                'notes': task.get('notes'),
                'html_notes': task.get('html_notes'),
                'custom_fields': task.get('custom_fields', {}),
                'permalink_url': task.get('permalink_url')
            }
            
            # Upsert into local SQLite
            self.db.upsert_task(task_data)
            
            # Sync stories for this task
            self.sync_task_stories(task_data['gid'])
            
            # Artificial sleep to avoid aggressive spiking if scanning an entire large project
            time.sleep(0.1) 
            
        logger.info(f"Task Sync Complete. Synced {sync_count} tasks.")

    def sync_task_stories(self, task_gid: str):
        """
        Fetches all stories (comments) for a specific task and saves them locally.
        It runs the text of human-generated comments through a story intelligence processor
        (keyword analysis) to augment the data before saving.
        
        Args:
            task_gid (str): The unique parent Asana Task ID.
        """
        opts = {
            'opt_fields': "text,type,created_at,created_by.name"
        }
        
        response = self._execute_with_backoff(
            self.stories_api.get_stories_for_task,
            task_gid,
            opts
        )
        
        if not response:
            return
            
        for story in response:
            # We are only interested in human or meaningful system comments
            if story.get('type') != 'comment':
                continue
                
            text = story.get('text', '')
            intelligence = self._process_story_intelligence(text)
            
            story_data = {
                'gid': story.get('gid'),
                'task_gid': task_gid,
                'text': text,
                'type': story.get('type'),
                'created_by': story.get('created_by', {}).get('name', 'Unknown'),
                'created_at': story.get('created_at'),
                'is_blocker': intelligence['is_blocker'],
                'needs_intervention': intelligence['needs_intervention']
            }
            
            self.db.upsert_story(story_data)

    # Disabled in SENTINEL Read-Only Mode
    # def push_task_update(self, task_gid: str, updates: dict):
    #     """
    #     Pushes a local update (e.g., closing a task or changing a note)
    #     back to Asana.
    #     """
    #     logger.info(f"Pushing update for task {task_gid} to Asana...")
    #     
    #     # Example payload: {'completed': True, 'name': 'Updated Name'}
    #     self._execute_with_backoff(
    #          self.tasks_api.update_task,
    #          body={"data": updates},
    #          task_gid=task_gid
    #     )
    #     logger.info(f"Task {task_gid} update pushed successfully.")

    def get_workspaces(self) -> List[Dict]:
        """
        Fetches all workspaces accessible to the configured PAT.
        
        Returns:
            List[Dict]: A list of workspace dictionaries containing 'gid' and 'name'.
        """
        response = self._execute_with_backoff(
            self.workspaces_api.get_workspaces,
            {}
        )
        if response:
            return [{"gid": w.get('gid'), "name": w.get('name')} for w in response]
        return []

    def get_projects_in_workspace(self, workspace_gid: str) -> List[Dict]:
        """
        Fetches all projects located within a specific workspace.
        
        Args:
            workspace_gid (str): The target workspace ID.
            
        Returns:
            List[Dict]: A list of project dictionaries containing 'gid' and 'name'.
        """
        response = self._execute_with_backoff(
            self.projects_api.get_projects_for_workspace,
            workspace_gid,
            {}
        )
        if response:
            return [{"gid": p.get('gid'), "name": p.get('name')} for p in response]
        return []

if __name__ == "__main__":
    # Test execution harness
    print("AsanaSyncEngine module loaded. Requires PAT and Project GID to instantiate.")
