import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
from backend.db_manager import DatabaseManager

logger = logging.getLogger(__name__)

class ReportingEngine:
    """
    Analyzes local task data and snapshots to generate management-level reports
    and trend analysis.
    """

    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager

    def get_latest_status_report(self) -> Dict[str, Any]:
        """
        Generates a structured status report based on current data.
        """
        tasks = self.db.get_all_tasks()
        total_tasks = len(tasks)
        completed_tasks = [t for t in tasks if t.get('completed')]
        active_tasks = [t for t in tasks if not t.get('completed')]
        
        # Get blocker/intervention stories
        at_risk_tasks = self._get_at_risk_tasks()
        
        # Determine velocity/trend from snapshots
        trend = self._analyze_trend()

        # Recommendation logic
        recommendations = self._generate_recommendations(at_risk_tasks, trend['status'])

        return {
            "summary": {
                "total": total_tasks,
                "completed": len(completed_tasks),
                "active": len(active_tasks),
                "at_risk": len(at_risk_tasks),
                "velocity": trend['percentage_change'],
                "status": trend['status'] # Improving, Slow, At Risk
            },
            "blockers": at_risk_tasks,
            "recommendations": recommendations,
            "generated_at": datetime.now().isoformat()
        }

    def _get_at_risk_tasks(self) -> List[Dict]:
        """Fetches tasks flagged for management intervention."""
        with self.db._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT DISTINCT t.gid, t.name, t.assignee, s.text as last_comment
                FROM tasks t
                JOIN stories s ON t.gid = s.task_gid
                WHERE s.needs_intervention = 1 AND t.completed = 0
            ''')
            return [dict(row) for row in cursor.fetchall()]

    def _analyze_trend(self) -> Dict[str, Any]:
        """Compares current snapshot with historical data."""
        with self.db._get_connection() as conn:
            cursor = conn.cursor()
            # Get last two snapshots
            cursor.execute('SELECT * FROM snapshots ORDER BY snapshot_date DESC LIMIT 2')
            rows = cursor.fetchall()

        if len(rows) < 2:
            return {"status": "Stable", "percentage_change": 0}

        latest = dict(rows[0])
        previous = dict(rows[1])

        # Calc progress change
        latest_rate = (latest['completed_tasks'] / latest['total_tasks']) if latest['total_tasks'] > 0 else 0
        prev_rate = (previous['completed_tasks'] / previous['total_tasks']) if previous['total_tasks'] > 0 else 0
        
        change = (latest_rate - prev_rate) * 100

        status = "Stable"
        if change > 5:
            status = "Improving"
        elif change < -5 or latest['at_risk_tasks'] > previous['at_risk_tasks']:
            status = "At Risk"
        elif abs(change) <= 5 and latest['completed_tasks'] == previous['completed_tasks'] and latest['total_tasks'] > 0:
            status = "Slow"

        return {
            "status": status,
            "percentage_change": round(change, 1)
        }

    def _generate_recommendations(self, at_risk_tasks: List[Dict], trend_status: str) -> List[str]:
        """Generates actionable advice for management."""
        recs = []
        
        if trend_status == "At Risk":
            recs.append("CRITICAL: Project velocity has dropped or blockers are increasing. Immediate review required.")
        elif trend_status == "Slow":
            recs.append("ADVICE: Progress has stalled. Consider re-allocating resources to clear the backlog.")
            
        if at_risk_tasks:
            recs.append(f"INTERVENTION: {len(at_risk_tasks)} tasks flagged for intervention. Review specific task blockers in the report below.")
            
        if not recs and trend_status == "Improving":
            recs.append("STATUS: Project is on track. Continue current pace.")
            
        return recs

    def get_historical_trends(self) -> List[Dict]:
        """Returns data points for dashboard charts."""
        with self.db._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT snapshot_date, total_tasks, completed_tasks, at_risk_tasks FROM snapshots ORDER BY snapshot_date ASC')
            return [dict(row) for row in cursor.fetchall()]
