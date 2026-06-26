import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "python_packages"))
import json
import base64
import time
import random
import threading
import copy
import tempfile
from datetime import datetime, date
from typing import List, Dict, Any, Optional, Union
from enum import Enum
import subprocess
import requests

# Self-healing package installer for mammoth, a DOCX parser
try:
    import mammoth
except ImportError:
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "mammoth", "--user"])
        import mammoth
    except Exception as e:
        print(f"Failed to auto-install package mammoth: {e}")
        mammoth = None

from fastapi import FastAPI, HTTPException, Request, Response, Query, Depends
from pydantic import BaseModel, Field

app = FastAPI(
    title="AgentOps Labs FastAPI Service",
    description="Python FastAPI backend powering personnel evaluation, safe-views rendering, and onboarding assessments.",
    version="1.0.0"
)

is_vercel = "VERCEL" in os.environ or os.environ.get("NODE_ENV") == "production"
default_db_path = (
    os.path.join("/tmp", "db_agentops.json")
    if is_vercel
    else os.path.join(os.getcwd(), "db_agentops.json")
)
DB_PATH = os.environ.get("DB_PATH", default_db_path)

if is_vercel and not os.path.exists(DB_PATH):
    baseline_path = os.path.join(os.getcwd(), "db_agentops.json")
    if os.path.exists(baseline_path):
        try:
            import shutil
            shutil.copyfile(baseline_path, DB_PATH)
            print("[Python FastAPI] Seeded /tmp database from git baseline.")
        except Exception as copy_err:
            print(f"[Python FastAPI] Failed to seed /tmp database from baseline: {copy_err}")

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    EMPLOYEE = "employee"

class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

class ApplicationStatus(str, Enum):
    NOT_STARTED = "not_started"
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"

class DocumentStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class QuestionType(str, Enum):
    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"

class TestStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

# Pydantic Schemas
class User(BaseModel):
    id: str
    name: str
    email: str
    mobile: str
    role: UserRole
    status: UserStatus
    createdAt: str
    dob: Optional[str] = None

class Message(BaseModel):
    id: str
    senderId: str
    senderName: str
    receiverId: str
    subject: str
    body: str
    createdAt: str
    isRead: bool
    type: str = "user_msg" # "user_msg" or "birthday_alert"

class Application(BaseModel):
    employeeId: str
    fullName: str
    email: str
    mobile: str
    gender: str = ""
    highestQualification: str = ""
    collegeName: str = ""
    yearOfPassing: str = ""
    percentageOrCgpa: Optional[str] = ""
    technicalSkills: List[str] = []
    otherSkills: List[str] = []
    status: ApplicationStatus = ApplicationStatus.DRAFT
    submittedAt: Optional[str] = None
    updatedAt: str
    googleDriveLink: Optional[str] = ""
    submittedDocs: List[str] = []

class EmployeeDocument(BaseModel):
    id: str
    employeeId: str
    type: str # "resume" | "aadhaar" | "pan" | "photo" | "educational" | "experience"
    fileName: str
    fileSize: str
    status: DocumentStatus = DocumentStatus.PENDING
    uploadedAt: str
    remarks: Optional[str] = ""
    url: str # Base64 or mock blob URL

class Question(BaseModel):
    id: str
    text: str
    type: QuestionType
    options: List[str]
    correctAnswers: List[int]

class Test(BaseModel):
    id: str
    name: str
    duration: int
    passingMarks: int
    questions: List[Question]
    isPublished: bool = True
    createdAt: str

class AssignedTest(BaseModel):
    id: str
    testId: str
    testName: str
    employeeId: str
    status: TestStatus = TestStatus.NOT_STARTED
    score: Optional[int] = None
    totalQuestions: Optional[int] = None
    passingMarks: Optional[int] = None
    passed: Optional[bool] = None
    answers: Optional[Dict[str, List[int]]] = {}
    remainingTime: Optional[int] = None
    startedAt: Optional[str] = None
    completedAt: Optional[str] = None
    isDefaultOnboardingTest: Optional[bool] = False

class ChecklistItem(BaseModel):
    id: str
    employeeId: str
    category: str # "application" | "documents" | "assessments" | "approval"
    text: str
    isCompleted: bool
    updatedAt: str

class ActivityLog(BaseModel):
    id: str
    employeeId: str
    employeeName: str
    action: str
    details: str
    timestamp: str

class EmailRecord(BaseModel):
    id: str
    to: str
    subject: str
    body: str
    sentAt: str
    type: str

class SystemNotification(BaseModel):
    id: str
    employeeId: Optional[str] = None
    title: str
    message: str
    isRead: bool = False
    createdAt: str
    type: str = "info" # "info" | "success" | "warning" | "alert"

class DocumentAnnotation(BaseModel):
    id: str
    documentId: str
    x: float
    y: float
    width: Optional[float] = None
    height: Optional[float] = None
    text: str
    author: str
    createdAt: str
    color: str = "#fbbf24"
    type: str = "comment" # "comment" | "highlight"

# Password modification schemas
class LoginRequest(BaseModel):
    email: str
    password: str

class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str

class AssignTestRequest(BaseModel):
    testId: str
    employeeIds: List[str]

class ResetPasswordPublicRequest(BaseModel):
    token: str
    newPassword: str

_local_file_cache = None

def get_from_local_file_cache(key):
    global _local_file_cache
    if _local_file_cache is None:
        _local_file_cache = {}
        if os.path.exists(DB_PATH):
            try:
                with open(DB_PATH, "r", encoding="utf-8") as f:
                    _local_file_cache = json.load(f)
            except Exception as e:
                print(f"[Python FastAPI] Failed to read local DB file cache: {e}")
    return _local_file_cache.get(key)

class RequestScopedDbState(dict):
    def __init__(self):
        super().__init__()
        self._loaded_keys = set()
        self._failed_load_keys = set()
        self._original_state = {}
        self.reset()

    def reset(self):
        self._loaded_keys.clear()
        self._failed_load_keys.clear()
        self._original_state.clear()
        self.clear()
        self.update({
            "users": [],
            "passwords": {},
            "applications": [],
            "documents": [],
            "tests": [],
            "assignedTests": [],
            "checklists": [],
            "activityLogs": [],
            "emails": [],
            "notifications": [],
            "annotations": [],
            "messages": [],
            "tasks": [],
            "taskSubmissions": [],
            "attendance": [],
            "leaves": [],
            "settings": {}
        })

    def _ensure_loaded(self, key):
        from supabase_sync import collections_info
        is_supabase_col = any(c["key"] == key for c in collections_info)
        if not is_supabase_col:
            if key not in self._loaded_keys:
                self._loaded_keys.add(key)
                fallback_data = get_from_local_file_cache(key)
                if fallback_data is not None:
                    super().__setitem__(key, fallback_data)
                else:
                    super().__setitem__(key, {})
                self._original_state[key] = copy.deepcopy(super().__getitem__(key))
            return

        if key not in self._loaded_keys:
            self._loaded_keys.add(key)
            from supabase_sync import load_single_collection_from_supabase
            data, success = load_single_collection_from_supabase(key)
            if success and data is not None:
                super().__setitem__(key, data)
                self._original_state[key] = copy.deepcopy(data)
            else:
                self._failed_load_keys.add(key)
                fallback_data = get_from_local_file_cache(key)
                if fallback_data is not None:
                    super().__setitem__(key, fallback_data)
                else:
                    col = next((c for c in collections_info if c["key"] == key), None)
                    default_val = [] if col and col["type"] == "array" else {}
                    super().__setitem__(key, default_val)
                self._original_state[key] = copy.deepcopy(super().__getitem__(key))

    def __getitem__(self, key):
        self._ensure_loaded(key)
        return super().__getitem__(key)

    def get(self, key, default=None):
        self._ensure_loaded(key)
        return super().get(key, default)

    def __contains__(self, key):
        self._ensure_loaded(key)
        return super().__contains__(key)

    def __setitem__(self, key, value):
        self._loaded_keys.add(key)
        if key not in self._original_state:
            self._original_state[key] = [] if isinstance(value, list) else {}
        super().__setitem__(key, value)

    def get_changed_collections(self):
        changed = set()
        for key in self._loaded_keys:
            if self.get(key) != self._original_state.get(key):
                changed.add(key)
        return changed

    def get_loaded_snapshot(self):
        snapshot = {}
        for key in self._loaded_keys:
            snapshot[key] = copy.deepcopy(dict.__getitem__(self, key))
        return snapshot

# Request-Scoped database state context management to prevent concurrent request resets/data corruption
import contextvars

_request_db_context = contextvars.ContextVar("request_db_context")
_global_fallback_db_state = RequestScopedDbState()

class DbStateProxy(dict):
    def __init__(self):
        super().__init__()

    def _get_current_state(self):
        try:
            return _request_db_context.get()
        except LookupError:
            global _global_fallback_db_state
            return _global_fallback_db_state

    def __getitem__(self, key):
        return self._get_current_state()[key]

    def __setitem__(self, key, value):
        self._get_current_state()[key] = value

    def __delitem__(self, key):
        del self._get_current_state()[key]

    def __contains__(self, key):
        return key in self._get_current_state()

    def get(self, key, default=None):
        return self._get_current_state().get(key, default)

    def keys(self):
        return self._get_current_state().keys()

    def values(self):
        return self._get_current_state().values()

    def items(self):
        return self._get_current_state().items()

    def clear(self):
        self._get_current_state().clear()

    def update(self, *args, **kwargs):
        self._get_current_state().update(*args, **kwargs)

    def __len__(self):
        return len(self._get_current_state())

    def __iter__(self):
        return iter(self._get_current_state())

    def __getattr__(self, name):
        return getattr(self._get_current_state(), name)

    def __setattr__(self, name, value):
        if name in ("__dict__",):
            super().__setattr__(name, value)
        else:
            setattr(self._get_current_state(), name, value)

db_state = DbStateProxy()

# Token reset secure store
active_reset_tokens = {}
last_supabase_load_time = 0.0
db_lock = threading.RLock()
bg_load_lock = threading.Lock()
bg_sync_lock = threading.Lock()
# Pending collections queue for background Supabase sync
_pending_sync_collections: set = set()
_pending_sync_lock = threading.Lock()
_bg_sync_thread_running = False

def atomic_write_json(file_path, data):
    dir_name = os.path.dirname(file_path)
    if not os.path.exists(dir_name) and dir_name:
        os.makedirs(dir_name, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', dir=dir_name, delete=False, encoding='utf-8') as tf:
        json.dump(data, tf, indent=2, ensure_ascii=False)
        temp_name = tf.name
    try:
        os.replace(temp_name, file_path)
    except Exception as e:
        if os.path.exists(temp_name):
            try:
                os.unlink(temp_name)
            except Exception:
                pass
        raise e

load_lock = threading.Lock()
last_synced_db = {}

def deduplicate_database_state():
    """Identify and clean up duplicate employee records from db_state and sync changes."""
    global db_state
    users = db_state.get("users", [])
    if not users:
        return
        
    seen_emails = {}
    unique_users = []
    deleted_user_ids = set()
    
    for u in users:
        email = u.get("email", "").strip().lower()
        role = u.get("role", "")
        
        if role == "admin":
            unique_users.append(u)
            continue
            
        if not email:
            unique_users.append(u)
            continue
            
        if email in seen_emails:
            deleted_user_ids.add(u.get("id"))
        else:
            seen_emails[email] = u.get("id")
            unique_users.append(u)
            
    if not deleted_user_ids:
        return
        
    print(f"[Python FastAPI] Found duplicate users in database. Cleaning up {len(deleted_user_ids)} duplicates...")
    
    db_state["users"] = unique_users
    
    # Passwords
    passwords = db_state.get("passwords", {})
    clean_passwords = {}
    for uid, pwd in passwords.items():
        if uid not in deleted_user_ids:
            clean_passwords[uid] = pwd
    db_state["passwords"] = clean_passwords
    
    # Helper to filter array collections
    def filter_coll(col_key):
        items = db_state.get(col_key, [])
        db_state[col_key] = [item for item in items if item.get("employeeId") not in deleted_user_ids]
        
    filter_coll("applications")
    filter_coll("documents")
    filter_coll("checklists")
    filter_coll("assignedTests")
    filter_coll("notifications")
    filter_coll("messages")
    filter_coll("taskSubmissions")
    filter_coll("attendance")
    filter_coll("leaves")
    
    # Filter activityLogs
    activity_logs = db_state.get("activityLogs", [])
    db_state["activityLogs"] = [log for log in activity_logs if log.get("employeeId") not in deleted_user_ids]
    
    # Sync the clean state back to disk and Supabase
    save_database()
    print("[Python FastAPI] Database deduplication and Supabase sync complete.")

def load_database(silent=True):
    # Load "users" to ensure database seeding or loading occurs if empty
    users = db_state.get("users", [])
    if not users:
        print("[Python FastAPI] Database is empty (no users). Seeding default data...")
        seed_database()

def _background_supabase_sync_worker(db_copy: dict, collections: set, failed_collections: set = None):
    """Background thread worker that syncs to Supabase without blocking the API response."""
    global last_synced_db, last_supabase_load_time
    try:
        from supabase_sync import sync_to_supabase
        sync_to_supabase(db_copy, collections, failed_collections=failed_collections)
        last_supabase_load_time = time.time()
        if hasattr(db_state, "_original_state"):
            with db_lock:
                for key in collections:
                    db_state._original_state[key] = copy.deepcopy(db_copy.get(key))
    except Exception as sync_err:
        print(f"[Python FastAPI] Background Supabase sync failed: {sync_err}")

def save_database(target_collection=None):
    """Save database: write to disk immediately (fast), then sync Supabase."""
    global db_state, last_synced_db, last_supabase_load_time
    try:
        # Retrieve failed load keys to prevent deleting rows in case of loading fallback
        failed_collections = set()
        if hasattr(db_state, "_failed_load_keys"):
            failed_collections = set(db_state._failed_load_keys)

        # Detect which collections changed
        changed_collections = set()
        if target_collection:
            if isinstance(target_collection, (list, set)):
                changed_collections.update(target_collection)
            else:
                changed_collections.add(target_collection)
        else:
            if hasattr(db_state, "get_changed_collections"):
                changed_collections = db_state.get_changed_collections()
            else:
                with db_lock:
                    db_copy = copy.deepcopy(db_state)
                for key in db_copy.keys():
                    if last_synced_db.get(key) != db_copy.get(key):
                        changed_collections.add(key)

        if not changed_collections:
            return

        with db_lock:
            if hasattr(db_state, "get_loaded_snapshot"):
                db_copy = db_state.get_loaded_snapshot()
            else:
                db_copy = copy.deepcopy(db_state)

        # Step 1: Smart local file saving (merge changed collections into the local file)
        global _local_file_cache
        base_data = {}
        if os.path.exists(DB_PATH):
            try:
                with open(DB_PATH, "r", encoding="utf-8") as f:
                    base_data = json.load(f)
            except Exception:
                pass
        for key in changed_collections:
            base_data[key] = db_copy.get(key)
        _local_file_cache = copy.deepcopy(base_data)
        try:
            atomic_write_json(DB_PATH, base_data)
        except Exception as disk_err:
            print(f"[Python FastAPI] Disk write failed: {disk_err}")

        # Step 2: Supabase sync (always synchronous to prevent race conditions during immediate client-side refetches)
        from supabase_sync import sync_to_supabase
        errors = sync_to_supabase(db_copy, changed_collections, failed_collections=failed_collections)
        if errors:
            filtered_errors = [e for e in errors if "Supabase credentials missing or placeholder" not in e]
            if filtered_errors:
                is_vercel = os.environ.get("VERCEL") == "1" or "VERCEL" in os.environ
                if is_vercel:
                    print(f"[Python Vercel] Supabase sync failed: {'; '.join(filtered_errors)}")
                else:
                    print(f"[Python FastAPI] Supabase sync failed: {'; '.join(filtered_errors)}")
        
        last_supabase_load_time = time.time()
        if hasattr(db_state, "_original_state"):
            with db_lock:
                for key in changed_collections:
                    db_state._original_state[key] = copy.deepcopy(db_copy.get(key))
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Python FastAPI] Error occurred while saving database: {e}")
        raise HTTPException(status_code=500, detail=f"Database save error: {str(e)}")

# Middleware: fast path for all requests
@app.middleware("http")
async def db_reload_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        response = Response()
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response

    # Bind a fresh, isolated request-scoped database state to this request context
    state = RequestScopedDbState()
    token = _request_db_context.set(state)
    try:
        # Load database (lightweight check, seeds if empty)
        load_database(silent=True)
        response = await call_next(request)
    finally:
        _request_db_context.reset(token)
    
    if request.method == "GET" and response.status_code == 200:
        if "/api/" in str(request.url):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Access-Control-Allow-Origin"] = "*"
    
    return response

# Health check endpoint
@app.get("/api/health")
def health_check():
    with db_lock:
        user_count = len(db_state.get("users", []))
    return {
        "status": "ok",
        "users": user_count,
        "cache_age_seconds": round(time.time() - last_supabase_load_time, 1),
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


# Supabase Config endpoint — exposes Supabase config dynamically, prioritizing env vars over file
@app.get("/api/supabase-config")
def get_supabase_config():
    config_path = os.path.join(os.getcwd(), "supabase-config.json")
    config = {}
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
        except Exception:
            pass

    return {
        "supabaseUrl": os.environ.get("SUPABASE_URL", config.get("supabaseUrl", "YOUR_SUPABASE_URL")),
        "supabaseAnonKey": os.environ.get("SUPABASE_ANON_KEY", config.get("supabaseAnonKey", "YOUR_SUPABASE_ANON_KEY"))
    }

# Diagnostic endpoint to verify Supabase connections and database table structure
@app.get("/api/test-db")
def test_database_connection():
    from supabase_sync import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, collections_info
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL == "YOUR_SUPABASE_URL":
        return {
            "status": "error",
            "message": "Supabase credentials are not configured or are placeholders.",
            "url": SUPABASE_URL,
            "has_service_role_key": bool(SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SERVICE_ROLE_KEY != "YOUR_SUPABASE_SERVICE_ROLE_KEY")
        }
        
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
    }
    
    results = {}
    all_ok = True
    
    for col in collections_info:
        col_name = col["name"]
        url = f"{SUPABASE_URL}/rest/v1/{col_name.lower()}?select=id"
        try:
            res = requests.get(url, headers=headers, timeout=5)
            if res.status_code == 200:
                results[col_name] = f"OK ({len(res.json())} rows)"
            else:
                results[col_name] = f"FAILED: {res.status_code} - {res.text}"
                all_ok = False
        except Exception as e:
            results[col_name] = f"ERROR: {e}"
            all_ok = False
            
    return {
        "status": "success" if all_ok else "error",
        "url": SUPABASE_URL,
        "tables": results
    }

def generate_email_body(email_type: str, data: Dict[str, Any]) -> str:
    if email_type == "welcome":
        return f"Welcome {data.get('name')}! Your AgentOps Labs onboarding portal account has been created.\n\nLogin credentials:\nEmail: {data.get('email')}\nPassword: {data.get('password')}\n\nPlease update your password on your first login."
    elif email_type == "password_reset":
        return f"Hello {data.get('name')},\nYour account password has been successfully reset. Here is your temporary credential:\nPassword: {data.get('password')}\n\nPlease update this upon logging in."
    elif email_type == "app_submitted":
        return f"Onboarding application submitted by candidate: {data.get('name')} ({data.get('email')}).\nSubmission Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\nStatus: PENDING ADMIN REVIEW."
    elif email_type == "test_assigned":
        return f"Dear {data.get('name')},\nA new skills assessment test [{data.get('testName')}] has been assigned to you. You have {data.get('duration')} minutes to complete it.\nPlease complete this assessment to advance your onboarding workflow."
    elif email_type == "test_completed":
        passed_text = "PASSED" if data.get('passed') else "FAILED"
        return f"Assessment Result Notice:\nEmployee: {data.get('name')}\nTest: {data.get('testName')}\nScore: {data.get('score')}%\nPassing Score: {data.get('passingMarks')}%\nResult: {passed_text}"
    elif email_type == "doc_approved":
        return f"Greetings {data.get('name')},\nYour uploaded {data.get('docType')} document has been APPROVED by the Administration.\nRemark: {data.get('remarks', 'No remarks provided.')}"
    elif email_type == "doc_rejected":
        return f"Urgent: {data.get('name')},\nYour uploaded {data.get('docType')} document has been REJECTED by HR.\nRemark: {data.get('remarks', 'Please re-upload a clear file.')}\nPlease log in and replace the document."
    else:
         return f"System Notification Update for {data.get('name', 'candidate')}."

def log_activity(employee_id: str, employee_name: str, action: str, details: str, sync: bool = True):
    log = {
        "id": f"log-{int(datetime.now().timestamp() * 1000)}-{str(random.randint(10000, 99999))}",
        "employeeId": employee_id,
        "employeeName": employee_name,
        "action": action,
        "details": details,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    db_state["activityLogs"].insert(0, log)
    if sync:
        save_database("activityLogs")

def send_system_notification(employee_id: Optional[str], title: str, message: str, notif_type: str = "info", sync: bool = True):
    notif = {
        "id": f"notif-{int(datetime.now().timestamp() * 1000)}-{str(random.randint(10000, 99999))}",
        "employeeId": employee_id,
        "title": title,
        "message": message,
        "isRead": False,
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "type": notif_type
    }
    db_state["notifications"].insert(0, notif)
    if sync:
        save_database("notifications")

def send_simulated_email(to: str, subject: str, body: str, email_type: str, sync: bool = True):
    email = {
        "id": f"email-{int(datetime.now().timestamp() * 1000)}-{str(random.randint(1000, 9999))}",
        "to": to,
        "subject": subject,
        "body": body,
        "sentAt": datetime.utcnow().isoformat() + "Z",
        "type": email_type
    }
    db_state["emails"].insert(0, email)
    if sync:
        save_database("emails")

def check_birthdays_and_notify_admin():
    try:
        from datetime import datetime, timedelta
        today = datetime.now()
        tomorrow = today + timedelta(days=1)
        one_week = today + timedelta(days=7)
        
        md_tomorrow = tomorrow.strftime("%m-%d")
        md_one_week = one_week.strftime("%m-%d")
        
        print(f"[Birthday Scan] Running sweeps. Tomorrow MM-DD: {md_tomorrow}, 1 Week: {md_one_week}")
        
        for user in db_state.get("users", []):
            if user.get("role") == "employee" and user.get("dob"):
                try:
                    dob_str = user["dob"].replace("/", "-").strip()
                    parts = dob_str.split("-")
                    if len(parts) >= 2:
                        if len(parts) == 3:
                            month = parts[1].zfill(2)
                            day = parts[2].zfill(2)
                        else:
                            month = parts[0].zfill(2)
                            day = parts[1].zfill(2)
                            
                        dob_md = f"{month}-{day}"
                        
                        if dob_md == md_tomorrow:
                            alert_id = f"bday-1day-{user['id']}-{today.year}"
                            exists = any(m["id"] == alert_id for m in db_state.get("messages", []))
                            if not exists:
                                bday_alert = {
                                    "id": alert_id,
                                    "senderId": "system",
                                    "senderName": "System Alert",
                                    "receiverId": "admin",
                                    "subject": f"🎂 Birthday Alert (1 Day Before): {user['name']}",
                                    "body": f"Hello Admin, this is an automated alert that employee {user['name']} ({user['email']}) has their birthday tomorrow, on {month}-{day}!",
                                    "createdAt": datetime.utcnow().isoformat() + "Z",
                                    "isRead": False,
                                    "type": "birthday_alert"
                                }
                                if "messages" not in db_state:
                                    db_state["messages"] = []
                                db_state["messages"].insert(0, bday_alert)
                                print(f"[Birthday Alert] Automatically dispatched 1-day advisory for {user['name']}")
                                save_database()
                                
                        if dob_md == md_one_week:
                            alert_id = f"bday-7day-{user['id']}-{today.year}"
                            exists = any(m["id"] == alert_id for m in db_state.get("messages", []))
                            if not exists:
                                bday_alert = {
                                    "id": alert_id,
                                    "senderId": "system",
                                    "senderName": "System Alert",
                                    "receiverId": "admin",
                                    "subject": f"🎉 Birthday Alert (1 Week Away): {user['name']}",
                                    "body": f"Hello Admin, this is an automated alert that employee {user['name']} ({user['email']}) has their birthday in exactly one week, on {month}-{day}!",
                                    "createdAt": datetime.utcnow().isoformat() + "Z",
                                    "isRead": False,
                                    "type": "birthday_alert"
                                }
                                if "messages" not in db_state:
                                    db_state["messages"] = []
                                db_state["messages"].insert(0, bday_alert)
                                print(f"[Birthday Alert] Automatically dispatched 1-week advisory for {user['name']}")
                                save_database()
                except Exception as user_err:
                    print(f"Error checking birthday for user {user.get('name')}: {user_err}")
    except Exception as e:
        print(f"[Birthday alert engine error] {e}")

def seed_database():
    now_iso = datetime.utcnow().isoformat() + "Z"
    
    # Users
    db_state["users"] = [
        {
            "id": "admin-1",
            "name": "G Venkat (HR Lead)",
            "email": "agentopslabs@gmail.com",
            "mobile": "+1 (555) 019-2834",
            "role": "admin",
            "status": "active",
            "createdAt": now_iso
        },
        {
            "id": "emp-1",
            "name": "Bharath",
            "email": "bharathsathyasaijanga@gmail.com",
            "mobile": "7670845590",
            "role": "employee",
            "status": "active",
            "createdAt": now_iso,
            "dob": "1998-06-12"
        },
        {
            "id": "emp-2",
            "name": "Rajesh Kumar",
            "email": "rajeshkumar@gmail.com",
            "mobile": "9876543210",
            "role": "employee",
            "status": "active",
            "createdAt": now_iso,
            "dob": "2000-06-18"
        }
    ]
    
    # Passwords
    db_state["passwords"] = {
        "admin-1": "Gvenkat@123",
        "emp-1": "Bharath@767",
        "emp-2": "Rajesh@767"
    }
    
    # Tests
    db_state["tests"] = [
        {
            "id": "test-system-safety",
            "name": "Enterprise Security & Compliance Quiz",
            "duration": 10,
            "passingMarks": 100,
            "isPublished": True,
            "createdAt": now_iso,
            "questions": [
                {
                    "id": "sec-q1",
                    "text": "Is it permissible to share temporary JWT tokens or passwords with fellow team members via Slack?",
                    "type": "true_false",
                    "options": [
                        "True (Yes, provided it's an internal private channel)",
                        "False (Never permissible under any compliance circumstance)"
                    ],
                    "correctAnswers": [1]
                },
                {
                    "id": "sec-q2",
                    "text": "What protocol must be used for transferring all external customer files?",
                    "type": "single_choice",
                    "options": [
                        "Unencrypted HTTP file upload portal",
                        "FTP plain transfer on standard port 21",
                        "Secure HTTPS / SFTP channels with multi-factor authentication",
                        "Physical USB storage mailed via DHL couriers"
                    ],
                    "correctAnswers": [2]
                }
            ]
        }
    ]
    
    # Assigned tests
    db_state["assignedTests"] = [
        {
            "id": "assign-1",
            "testId": "test-system-safety",
            "testName": "Enterprise Security & Compliance Quiz",
            "employeeId": "emp-1",
            "status": "not_started"
        }
    ]
    
    # Checklist seeds
    db_state["checklists"] = [
        {"id": "chk-1", "employeeId": "emp-1", "category": "application", "text": "Application Submitted", "isCompleted": False, "updatedAt": now_iso},
        {"id": "chk-2", "employeeId": "emp-1", "category": "documents", "text": "Resume Uploaded", "isCompleted": False, "updatedAt": now_iso},
        {"id": "chk-3", "employeeId": "emp-1", "category": "documents", "text": "Aadhaar Uploaded", "isCompleted": False, "updatedAt": now_iso},
        {"id": "chk-4", "employeeId": "emp-1", "category": "documents", "text": "PAN Uploaded", "isCompleted": False, "updatedAt": now_iso},
        {"id": "chk-5", "employeeId": "emp-1", "category": "documents", "text": "Passport Photo Uploaded", "isCompleted": False, "updatedAt": now_iso},
        {"id": "chk-6", "employeeId": "emp-1", "category": "documents", "text": "Educational Certificates Uploaded", "isCompleted": False, "updatedAt": now_iso},
        {"id": "chk-7", "employeeId": "emp-1", "category": "assessments", "text": "Test Assigned", "isCompleted": True, "updatedAt": now_iso},
        {"id": "chk-8", "employeeId": "emp-1", "category": "assessments", "text": "Test Completed", "isCompleted": False, "updatedAt": now_iso},
        {"id": "chk-9", "employeeId": "emp-1", "category": "assessments", "text": "Passed Assessment", "isCompleted": False, "updatedAt": now_iso},
        {"id": "chk-10", "employeeId": "emp-1", "category": "approval", "text": "HR Review Completed", "isCompleted": False, "updatedAt": now_iso},
        {"id": "chk-11", "employeeId": "emp-1", "category": "approval", "text": "Final Approval Completed", "isCompleted": False, "updatedAt": now_iso}
    ]
    
    # Applications draft
    db_state["applications"] = [
        {
            "employeeId": "emp-1",
            "fullName": "Bharath",
            "email": "bharathsathyasaijanga@gmail.com",
            "mobile": "7670845590",
            "gender": "Male",
            "highestQualification": "B.Tech in Computer Science",
            "collegeName": "Stanford University",
            "yearOfPassing": "2024",
            "percentageOrCgpa": "10 cgpa",
            "technicalSkills": ["React", "TypeScript", "Node.js", "Express"],
            "otherSkills": ["Product Management", "Team Leadership"],
            "status": "draft",
            "updatedAt": now_iso
        }
    ]
    
    # Activity log
    db_state["activityLogs"] = [
        {
            "id": "log-1",
            "employeeId": "emp-1",
            "employeeName": "Bharath",
            "action": "Account Provisioned",
            "details": "Welcome profile automatically generated by system default seeds.",
            "timestamp": now_iso
        }
    ]
    
    # Emails
    db_state["emails"] = [
        {
            "id": "email-1",
            "to": "bharathsathyasaijanga@gmail.com",
            "subject": "Welcome to AgentOps Labs!",
            "body": f"Welcome Bharath! Your AgentOps Labs onboarding portal account has been created.\n\nLogin credentials:\nEmail: bharathsathyasaijanga@gmail.com\nPassword: Bharath@767\n\nPlease update your password on your first login.",
            "sentAt": now_iso,
            "type": "welcome"
        }
    ]
    
    # Notifications
    db_state["notifications"] = [
        {
            "id": "notif-1",
            "employeeId": "emp-1",
            "title": "Welcome Onboard!",
            "message": "Please complete your onboarding application form to unlock assigned tests.",
            "isRead": False,
            "createdAt": now_iso,
            "type": "info"
        }
    ]
    
    db_state["messages"] = []
    db_state["annotations"] = []
    
    save_database()
    print("[Python FastAPI] Seeding complete.")

# Initialize database on module load
load_database(silent=False)
check_birthdays_and_notify_admin()

# REST Endpoints
@app.get("/api/health")
def health_check():
    return {"status": "ok", "time": datetime.utcnow().isoformat() + "Z"}

# Auth: Login
@app.post("/api/auth/login")
def auth_login(req: LoginRequest):
    email = req.email.strip().lower()
    password = req.password
    
    matched_user = None
    for u in db_state["users"]:
        if u.get("email", "").lower() == email:
            matched_user = u
            break
            
    if not matched_user:
        raise HTTPException(status_code=401, detail="Invalid email credentials or user does not exist.")
        
    if matched_user.get("status") == UserStatus.INACTIVE:
        raise HTTPException(status_code=403, detail="Your account is temporarily deactivated by the admin.")
        
    stored_pwd = db_state["passwords"].get(matched_user["id"])
    is_correct = (stored_pwd == password)
    
    # Sandbox fail-safes
    if not is_correct:
        if matched_user["id"] == "admin-1" and password == "Gvenkat@123":
            is_correct = True
        elif matched_user["id"] == "emp-1" and password == "Bharath@767":
            is_correct = True
            
    if not is_correct:
         raise HTTPException(status_code=401, detail="Invalid password credentials.")
         
    # Update stored in case mismatch occurred
    if stored_pwd != password:
        db_state["passwords"][matched_user["id"]] = password
        save_database("passwords")
        
    if matched_user.get("role") == "employee":
        ensure_default_test_assigned(matched_user["id"])
        
    log_activity(matched_user["id"], matched_user["name"], "User Sign-In", "Successful authentication via credentials.")
    
    return {
        "token": f"simulated-jwt-for-{matched_user['id']}",
        "user": matched_user
    }

# Auth: Forgot Password
@app.post("/api/auth/forgot-password")
def forgot_password(req: Dict[str, str]):
    email = req.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Registered account email is required.")
        
    matched_user = None
    for u in db_state["users"]:
        if u.get("email", "").lower() == email:
            matched_user = u
            break
            
    if not matched_user:
        raise HTTPException(status_code=404, detail="No registered candidate account found with this email.")
        
    expires_at = int(datetime.now().timestamp() * 1000) + 15 * 60 * 1000
    token_pload = f"{matched_user['email']}||{expires_at}||agentops-secret"
    reset_token = "reset-tok-ST" + base64.b64encode(token_pload.encode("utf-8")).decode("utf-8")
    
    active_reset_tokens[reset_token] = {
        "email": matched_user["email"],
        "expiresAt": expires_at
    }
    
    email_body = f"""
      <div style="font-family: sans-serif; padding: 24px; color: #1e293b; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 500px;">
        <h2 style="font-size: 18px; font-weight: bold; color: #0f172a; margin-bottom: 12px;">Candidate Portal - Password Reset Action Required</h2>
        <p style="font-size: 13px; line-height: 1.6; color: #475569;">
          Hello {matched_user['name']},<br/><br/>
          We received a request to reset the login security passcode for your onboarding portal account. 
          To complete your reset safely, please click the secure button below:
        </p>
        <div style="margin: 24px 0; text-align: center;">
          <a href="#reset-token={reset_token}&email={matched_user['email']}" 
             style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; font-size: 13px; font-weight: bold; text-decoration: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            Reset My Passcode Securely
          </a>
        </div>
        <p style="font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; pt-12; margin-top: 24px;">
          This link will activate instantly in your sandboxed web browser window context.<br/>
          If you did not request this change, please contact the audit desk.
        </p>
      </div>
    """
    
    send_simulated_email(matched_user["email"], "Onboarding Portal - Reset Your Security Password", email_body, "password_reset")
    log_activity(matched_user["id"], matched_user["name"], "Password Reset Link Dispatched", f"Dispatched simulated reset token: {reset_token}")
    
    return {
        "success": True,
        "email": matched_user["email"],
        "resetToken": reset_token,
        "simulatedEmailBody": email_body,
        "message": "Security passcode reset email successfully compiled and dispatched to candidate inbox!"
    }

# Auth: Verify token
@app.get("/api/auth/verify-reset-token")
def verify_reset_token(token: str):
    record = active_reset_tokens.get(token)
    
    if not record and token.startswith("reset-tok-ST"):
        try:
            b64_str = token[len("reset-tok-ST"):]
            # Padding adjustment
            b64_str += "=" * ((4 - len(b64_str) % 4) % 4)
            decoded = base64.b64decode(b64_str).decode("utf-8")
            parts = decoded.split("||")
            if len(parts) == 3 and parts[2] == "agentops-secret":
                record = {
                    "email": parts[0],
                    "expiresAt": int(parts[1])
                }
        except Exception:
            pass
            
    if not record:
        raise HTTPException(status_code=400, detail="This secure reset token is invalid or has already been used.")
        
    if int(datetime.now().timestamp() * 1000) > record["expiresAt"]:
        active_reset_tokens.pop(token, None)
        raise HTTPException(status_code=400, detail="This secure token has expired (15-min limit).")
        
    return {"valid": True, "email": record["email"]}

# Auth: Token-based reset submit
@app.post("/api/auth/reset-password-public")
def reset_password_public(req: ResetPasswordPublicRequest):
    token = req.token
    new_pwd = req.newPassword.strip()
    
    record = active_reset_tokens.get(token)
    if not record and token.startswith("reset-tok-ST"):
        try:
            b64_str = token[len("reset-tok-ST"):]
            b64_str += "=" * ((4 - len(b64_str) % 4) % 4)
            decoded = base64.b64decode(b64_str).decode("utf-8")
            parts = decoded.split("||")
            if len(parts) == 3 and parts[2] == "agentops-secret":
                record = {
                    "email": parts[0],
                    "expiresAt": int(parts[1])
                }
        except Exception:
            pass
            
    if not record:
        raise HTTPException(status_code=400, detail="Invalid, expired, or already used reset token.")
        
    if int(datetime.now().timestamp() * 1000) > record["expiresAt"]:
        active_reset_tokens.pop(token, None)
        raise HTTPException(status_code=400, detail="This secure token has expired.")
        
    matched_user = None
    for u in db_state["users"]:
        if u.get("email", "").lower() == record["email"].lower().strip():
            matched_user = u
            break
            
    if not matched_user:
        raise HTTPException(status_code=404, detail="No registered account found associated with this token.")
        
    if len(new_pwd) < 6:
        raise HTTPException(status_code=400, detail="New passcode must be at least 6 characters long.")
        
    db_state["passwords"][matched_user["id"]] = new_pwd
    save_database()
    active_reset_tokens.pop(token, None)
    
    log_activity(matched_user["id"], matched_user["name"], "Password Updated (Secure Token Reset)", "Modified user credentials passcode successfully utilizing secure token.")
    return {"success": True, "message": "Your passcode has been updated successfully!"}

# Auth: Me (Verify simulated JWT header token)
@app.get("/api/auth/me")
def auth_me(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization token.")
        
    token = auth_header[len("Bearer "):]
    prefix = "simulated-jwt-for-"
    if not token.startswith(prefix):
         token = token # Fallback in case raw ID was supplied
         
    if token.startswith(prefix):
        user_id = token[len(prefix):]
    else:
        user_id = token
        
    matched_user = None
    for u in db_state["users"]:
        if u["id"] == user_id:
            matched_user = u
            break
            
    if not matched_user:
        raise HTTPException(status_code=404, detail="Authenticated user not found in database.")
        
    if matched_user.get("status") == UserStatus.INACTIVE:
        raise HTTPException(status_code=403, detail="This user account is inactive.")
        
    return matched_user

# Get specific user
@app.get("/api/auth/user/{user_id}")
def get_user_by_id(user_id: str):
    user = next((u for u in db_state["users"] if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# User change password
@app.post("/api/users/{user_id}/change-password")
def change_password(user_id: str, req: ChangePasswordRequest):
    curr_pwd = req.currentPassword
    new_pwd = req.newPassword
    
    correct_pwd = db_state["passwords"].get(user_id)
    if correct_pwd != curr_pwd:
        raise HTTPException(status_code=400, detail="Current password typed is incorrect.")
        
    db_state["passwords"][user_id] = new_pwd
    save_database()
    
    u = next((usr for usr in db_state["users"] if usr["id"] == user_id), None)
    if u:
        log_activity(user_id, u["name"], "Password Updated", "User changed personal account password.")
        send_system_notification(user_id, "Password Changed", "Your password has been changed successfully.", "success")
        
    return {"success": True, "message": "Password updated successfully."}

# Admin reset password for employee
@app.post("/api/admin/users/{user_id}/reset-password")
def admin_reset_password(user_id: str):
    user = next((u for u in db_state["users"] if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="Employee account not found.")
        
    generated_pwd = f"Agent@{random.randint(100, 999)}"
    db_state["passwords"][user_id] = generated_pwd
    save_database()
    
    log_activity("admin-1", "Admin Olivia Vance", "Password Code Reset", f"Admin reset password code for employee: {user['name']}")
    
    body = generate_email_body("password_reset", {"name": user["name"], "password": generated_pwd})
    send_simulated_email(user["email"], "AgentOps Onboarding Password Reset Request", body, "password_reset")
    send_system_notification(user_id, "Credentials Regenerated", "Your credentials were reset by administration. New temporary password sent.", "alert")
    
    return {"success": True, "newPassword": generated_pwd}

# GET employees
@app.get("/api/users")
def list_employees():
    return [u for u in db_state["users"] if u["role"] != UserRole.ADMIN]

# Admin POST user
@app.post("/api/users", status_code=201)
def create_employee(req: Dict[str, Any]):
    with db_lock:
        name = req.get("name")
        email = req.get("email")
        mobile = req.get("mobile")
        pwd = req.get("password")
        dob = req.get("dob")
        
        if not name or not email or not mobile:
            raise HTTPException(status_code=400, detail="Employee Name, Email, and Mobile are required.")
            
        exists = any(u.get("email", "").lower() == email.lower() for u in db_state["users"])
        if exists:
            raise HTTPException(status_code=400, detail="Email already registered in system.")
            
        new_id = f"emp-{int(datetime.now().timestamp() * 1000)}"
        auto_pwd = pwd if (pwd and pwd.strip()) else f"AO@{random.randint(1000, 9999)}"
        
        new_user = {
            "id": new_id,
            "name": name,
            "email": email,
            "mobile": mobile,
            "role": "employee",
            "status": "active",
            "createdAt": datetime.utcnow().isoformat() + "Z"
        }
        if dob:
            new_user["dob"] = dob
            
        db_state["users"].append(new_user)
        db_state["passwords"][new_id] = auto_pwd
        
        # Empty application seed
        new_app = {
            "employeeId": new_id,
            "fullName": name,
            "email": email,
            "mobile": mobile,
            "gender": "",
            "highestQualification": "",
            "collegeName": "",
            "yearOfPassing": "",
            "technicalSkills": [],
            "otherSkills": [],
            "status": "not_started",
            "updatedAt": datetime.utcnow().isoformat() + "Z"
        }
        db_state["applications"].append(new_app)
        
        # Checklists
        now_iso = datetime.utcnow().isoformat() + "Z"
        checklist_texts = [
            ("application", "Application Submitted"),
            ("documents", "Resume Uploaded"),
            ("documents", "Aadhaar Uploaded"),
            ("documents", "PAN Uploaded"),
            ("documents", "Passport Photo Uploaded"),
            ("documents", "Educational Certificates Uploaded"),
            ("assessments", "Test Assigned"),
            ("assessments", "Test Completed"),
            ("assessments", "Passed Assessment"),
            ("approval", "HR Review Completed"),
            ("approval", "Final Approval Completed")
        ]
        
        for i, (cat, txt) in enumerate(checklist_texts):
            item = {
                "id": f"chk-{int(datetime.now().timestamp() * 1000)}-{i}",
                "employeeId": new_id,
                "category": cat,
                "text": txt,
                "isCompleted": False,
                "updatedAt": now_iso
            }
            db_state["checklists"].append(item)
            
        log_activity("admin-1", "Admin Olivia Vance", "Account Provisioned", f"Created employee account: {name} ({email})", sync=False)
        
        mail_txt = generate_email_body("welcome", {"name": name, "email": email, "password": auto_pwd})
        send_simulated_email(email, "Welcome to AgentOps Labs - Temporary Account Password", mail_txt, "welcome", sync=False)
        send_system_notification(new_id, "Onboarding Setup Launched", "Welcome! Please enter your dashboard, fill your Onboarding application description, and upload credentials.", "info", sync=False)
        
        # Auto-assign the default onboarding test upon account creation
        ensure_default_test_assigned(new_id, sync=False)
        
        # Sync only the collections that actually changed (faster Firestore write)
        save_database(["users", "passwords", "applications", "checklists", "activityLogs", "emails", "notifications", "assignedTests"])
        return {"user": new_user, "password": auto_pwd}

# Admin PUT update employee
@app.put("/api/users/{user_id}")
def update_employee(user_id: str, req: Dict[str, Any]):
    user_idx = -1
    for i, u in enumerate(db_state["users"]):
        if u["id"] == user_id:
            user_idx = i
            break
            
    if user_idx == -1:
        raise HTTPException(status_code=404, detail="Employee profile not found.")
        
    user = db_state["users"][user_idx]
    
    email = req.get("email", user.get("email", ""))
    if email.lower() != user.get("email", "").lower():
        exists = any(u.get("email", "").lower() == email.lower() for u in db_state["users"] if u["id"] != user_id)
        if exists:
            raise HTTPException(status_code=400, detail="Email address is already in use by another employee.")
            
    user["name"] = req.get("name", user["name"])
    user["email"] = email
    user["mobile"] = req.get("mobile", user["mobile"])
    if "dob" in req:
        user["dob"] = req["dob"]
        
    status = req.get("status")
    if status in ["active", "inactive"]:
        user["status"] = status
        
    pwd = req.get("password")
    if pwd and pwd.strip():
        db_state["passwords"][user_id] = pwd.strip()
        
    save_database()
    check_birthdays_and_notify_admin()
    log_activity("admin-1", "Admin", "Employee Profile Updated", f"Updated details of employee: {user_id}")
    return user

# Delete user fully
@app.delete("/api/users/{user_id}")
def delete_employee(user_id: str):
    db_state["users"] = [u for u in db_state["users"] if u["id"] != user_id]
    db_state["applications"] = [a for a in db_state["applications"] if a["employeeId"] != user_id]
    db_state["documents"] = [d for d in db_state["documents"] if d["employeeId"] != user_id]
    db_state["checklists"] = [c for c in db_state["checklists"] if c["employeeId"] != user_id]
    db_state["assignedTests"] = [t for t in db_state["assignedTests"] if t["employeeId"] != user_id]
    db_state["notifications"] = [n for n in db_state["notifications"] if n["employeeId"] != user_id]
    
    save_database()
    log_activity("admin-1", "Admin", "Employee Profile Deleted", f"Deregistered account and removed index metadata for: {user_id}")
    return {"success": True, "message": "User deleted completely."}

# GET applications by employeeId
@app.get("/api/applications/{employee_id}")
def get_employee_application(employee_id: str):
    app_data = next((a for a in db_state["applications"] if a["employeeId"] == employee_id), None)
    if not app_data:
        return {"status": "not_started"}
    return app_data

# GET all applications
@app.get("/api/applications")
def list_applications():
    return db_state["applications"]

# POST save or submit application
@app.post("/api/applications")
def save_application(req: Dict[str, Any]):
    emp_id = req.get("employeeId")
    if not emp_id:
        raise HTTPException(status_code=400, detail="Employee ID is required.")
        
    app_idx = -1
    for i, a in enumerate(db_state["applications"]):
        if a["employeeId"] == emp_id:
            app_idx = i
            break
            
    now_iso = datetime.utcnow().isoformat() + "Z"
    status = req.get("status", "draft")
    
    payload = {
        "employeeId": emp_id,
        "fullName": req.get("fullName", ""),
        "email": req.get("email", ""),
        "mobile": req.get("mobile", ""),
        "gender": req.get("gender", ""),
        "highestQualification": req.get("highestQualification", ""),
        "collegeName": req.get("collegeName", ""),
        "yearOfPassing": req.get("yearOfPassing", ""),
        "percentageOrCgpa": req.get("percentageOrCgpa", ""),
        "technicalSkills": req.get("technicalSkills", []),
        "otherSkills": req.get("otherSkills", []),
        "status": status,
        "updatedAt": now_iso,
        "googleDriveLink": req.get("googleDriveLink", ""),
        "submittedDocs": req.get("submittedDocs", [])
    }
    
    if status == "submitted":
        payload["submittedAt"] = now_iso
        
    if app_idx != -1:
        # Merge
        orig = db_state["applications"][app_idx]
        for key, val in payload.items():
            orig[key] = val
        if status == "submitted":
            orig["submittedAt"] = now_iso
    else:
        db_state["applications"].append(payload)
        
    if status == "submitted":
        # Checklists update
        for item in db_state["checklists"]:
            if item["employeeId"] == emp_id and item["category"] == "application":
                item["isCompleted"] = True
                item["updatedAt"] = now_iso
                
        log_activity(emp_id, req.get("fullName", "Employee"), "Onboarding Profile Submitted", "Submitted complete onboarding profile and validated checklists.", sync=False)
        send_system_notification(None, "New Application Submitted", f"Onboarding application profile submitted by {req.get('fullName')}. Complete reviews.", "warning", sync=False)
        
        admin_body = generate_email_body("app_submitted", {"name": req.get("fullName"), "email": req.get("email")})
        send_simulated_email("admin@agentops.com", f"New Candidate Application: {req.get('fullName')}", admin_body, "app_submitted", sync=False)
        
        # Auto-assign the default onboarding test upon application submission
        ensure_default_test_assigned(emp_id, sync=False)
        
        # Send system notification to employee about test assignment
        settings = db_state.get("settings", {})
        default_test_id = settings.get("defaultTestId", "test-system-safety")
        tests_list = db_state.get("tests", [])
        default_test = next((t for t in tests_list if t.get("id") == default_test_id), None)
        if not default_test:
            default_test = next((t for t in tests_list if t.get("id") == "test-system-safety"), None)
        if not default_test and tests_list:
            default_test = next((t for t in tests_list if t.get("isPublished", True)), tests_list[0])
        test_name = default_test["name"] if default_test else "Onboarding Assessment"
        send_system_notification(
            emp_id,
            "Test Assigned",
            f"You have been assigned the default onboarding test: {test_name}",
            "alert",
            sync=False
        )
    else:
        log_activity(emp_id, req.get("fullName", "Employee"), "Draft Saved", "Saved rough-draft backup of the onboarding profile.", sync=False)
        
    save_database()
    return {"success": True, "application": next((a for a in db_state["applications"] if a["employeeId"] == emp_id), None)}

# Documents
@app.get("/api/documents/{employee_id}")
def get_employee_documents(employee_id: str):
    return []

@app.get("/api/documents")
def list_documents():
    return []

@app.post("/api/documents", status_code=201)
def upload_document(req: Dict[str, Any]):
    return {"success": True, "message": "Document uploading disabled."}

# Document Annotations
@app.get("/api/documents/{document_id}/annotations")
def get_document_annotations(document_id: str):
    return [a for a in db_state["annotations"] if a["documentId"] == document_id]

@app.post("/api/documents/{document_id}/annotations", status_code=201)
def create_document_annotation(document_id: str, req: Dict[str, Any]):
    return {"success": True, "message": "Annotations disabled."}

@app.delete("/api/documents/{document_id}/annotations/{annotation_id}")
def delete_document_annotation(document_id: str, annotation_id: str):
    return {"success": True, "message": "Annotations disabled."}

# Approve/Reject upload status
@app.put("/api/documents/{doc_id}/status")
def update_document_status(doc_id: str, req: Dict[str, Any]):
    return {"success": True, "message": "Document review disabled."}

# Assessments/Tests templates
@app.get("/api/tests")
def list_tests():
    return db_state["tests"]

@app.post("/api/tests", status_code=201)
def create_test(req: Dict[str, Any]):
    name = req.get("name")
    duration = req.get("duration")
    passing_marks = req.get("passingMarks")
    questions = req.get("questions")
    is_published = req.get("isPublished", True)
    
    if not name or not duration or not passing_marks or not questions:
        raise HTTPException(status_code=400, detail="Missing required parameters to produce assessment definitions.")
        
    new_test = {
        "id": f"test-{int(datetime.now().timestamp() * 1000)}",
        "name": name,
        "duration": int(duration),
        "passingMarks": int(passing_marks),
        "questions": questions,
        "isPublished": bool(is_published),
        "createdAt": datetime.utcnow().isoformat() + "Z"
    }
    
    db_state["tests"].append(new_test)
    save_database()
    
    log_activity("admin-1", "Admin Olivia Vance", "Assessment Created", f"Created new exam standard: \"{name}\"")
    return new_test

@app.put("/api/tests/{test_id}")
def update_test(test_id: str, req: Dict[str, Any]):
    test_idx = -1
    for i, t in enumerate(db_state["tests"]):
        if t["id"] == test_id:
            test_idx = i
            break
            
    if test_idx == -1:
        raise HTTPException(status_code=404, detail="Template quiz structure not found.")
        
    t = db_state["tests"][test_idx]
    t["name"] = req.get("name", t["name"])
    if "duration" in req: t["duration"] = int(req["duration"])
    if "passingMarks" in req: t["passingMarks"] = int(req["passingMarks"])
    if "questions" in req: t["questions"] = req["questions"]
    if "isPublished" in req: t["isPublished"] = bool(req["isPublished"])
    
    save_database()
    log_activity("admin-1", "Admin Olivia Vance", "Assessment Altered", f"Modified specifications for exam: \"{t['name']}\"")
    return t

@app.post("/api/tests/{test_id}/duplicate", status_code=201)
def duplicate_test(test_id: str):
    original = next((t for t in db_state["tests"] if t["id"] == test_id), None)
    if not original:
        raise HTTPException(status_code=404, detail="Quiz model reference missing.")
        
    duplicated = {
        **original,
        "id": f"test-{int(datetime.now().timestamp() * 1000)}",
        "name": f"{original['name']} (Copy)",
        "createdAt": datetime.utcnow().isoformat() + "Z"
    }
    
    db_state["tests"].append(duplicated)
    save_database()
    
    log_activity("admin-1", "Admin Olivia Vance", "Assessment Duplicated", f"Cloned exam standard into: \"{duplicated['name']}\"")
    return duplicated

@app.delete("/api/tests/{test_id}")
def delete_test(test_id: str):
    test =限制_t = next((t for t in db_state["tests"] if t["id"] == test_id), None)
    if not test:
        raise HTTPException(status_code=404, detail="Template quiz state missing.")
        
    db_state["tests"] = [t for t in db_state["tests"] if t["id"] != test_id]
    save_database()
    
    log_activity("admin-1", "Admin Olivia Vance", "Assessment Erased", f"Permanently dropped test standard: \"{test['name']}\"")
    return {"success": True, "message": "Assessment standard deleted."}

def ensure_default_test_assigned(employee_id: str, sync: bool = True):
    with db_lock:
        settings = db_state.get("settings", {})
        default_test_id = settings.get("defaultTestId", "test-system-safety")
        
        if not default_test_id or default_test_id == "none":
            return
            
        # Check if the employee already has ANY default onboarding test assigned
        assigned = db_state.get("assignedTests", [])
        has_default = any(a.get("employeeId") == employee_id and a.get("isDefaultOnboardingTest") == True for a in assigned)
        
        if not has_default:
            tests_list = db_state.get("tests", [])
            # Try to find the configured default test
            default_test = next((t for t in tests_list if t.get("id") == default_test_id), None)
            # Fallback 1: if not found, look for standard system safety test
            if not default_test:
                default_test = next((t for t in tests_list if t.get("id") == "test-system-safety"), None)
            # Fallback 2: if still not found, look for any published test
            if not default_test and tests_list:
                default_test = next((t for t in tests_list if t.get("isPublished", True)), tests_list[0])
                
            if default_test:
                new_assign = {
                    "id": f"assign-{int(datetime.now().timestamp() * 1000)}-{str(random.randint(1000, 9999))}",
                    "testId": default_test["id"],
                    "testName": default_test["name"],
                    "employeeId": employee_id,
                    "status": "not_started",
                    "score": None,
                    "totalQuestions": len(default_test.get("questions", [])),
                    "passingMarks": default_test.get("passingMarks", 60),
                    "passed": None,
                    "answers": {},
                    "remainingTime": default_test.get("duration", 30) * 60,
                    "startedAt": None,
                    "completedAt": None,
                    "assignedAt": datetime.utcnow().isoformat() + "Z",
                    "isDefaultOnboardingTest": True
                }
                db_state["assignedTests"].append(new_assign)
                
                # Checklists text: "Test Assigned"
                for item in db_state.get("checklists", []):
                    if item.get("employeeId") == employee_id and item.get("text") == "Test Assigned":
                        item["isCompleted"] = True
                        item["updatedAt"] = datetime.utcnow().isoformat() + "Z"
                        
                if sync:
                    save_database(["assignedTests", "checklists"])

# Settings Endpoints
@app.get("/api/settings")
def get_settings():
    settings = db_state.get("settings", {})
    if "defaultTestId" not in settings:
        settings["defaultTestId"] = "test-system-safety"
    return settings

@app.post("/api/settings")
def save_settings(req: Dict[str, Any]):
    with db_lock:
        settings = db_state.get("settings", {})
        if not isinstance(settings, dict):
            settings = {}
        for k, v in req.items():
            settings[k] = v
        db_state["settings"] = settings
        save_database(["settings"])
        return settings

# Test Assignments
@app.get("/api/assigned-tests")
def list_assigned_tests():
    return db_state["assignedTests"]

@app.get("/api/assigned-tests/{employee_id}")
def get_employee_assigned_tests(employee_id: str):
    # No longer dynamically assign default tests retroactively to old employees
    return [a for a in db_state["assignedTests"] if a["employeeId"] == employee_id]

@app.post("/api/assigned-tests/assign", status_code=201)
def assign_test_to_employees(req: AssignTestRequest):
    test_id = req.testId
    employee_ids = req.employeeIds
    
    target_test = next((t for t in db_state["tests"] if t["id"] == test_id), None)
    if not target_test:
        raise HTTPException(status_code=404, detail="Test Standard template not found.")
        
    assigned_records = []
    
    for emp_id in employee_ids:
        emp_usr = next((u for u in db_state["users"] if u["id"] == emp_id), None)
        if not emp_usr:
            continue
            
        # Avoid duplicate assignment
        already = any(a["testId"] == test_id and a["employeeId"] == emp_id and a["status"] != "completed" for a in db_state["assignedTests"])
        if already:
            continue
            
        new_assign = {
            "id": f"assign-{int(datetime.now().timestamp() * 1000)}-{str(random.randint(100, 999))}",
            "testId": test_id,
            "testName": target_test["name"],
            "employeeId": emp_id,
            "status": "not_started",
            "assignedAt": datetime.utcnow().isoformat() + "Z"
        }
        
        db_state["assignedTests"].append(new_assign)
        assigned_records.append(new_assign)
        
        # Complete checklist text: "Test Assigned"
        for items in db_state["checklists"]:
            if items["employeeId"] == emp_id and items["text"] == "Test Assigned":
                items["isCompleted"] = True
                items["updatedAt"] = datetime.utcnow().isoformat() + "Z"
                
        log_activity("admin-1", "Admin Olivia Vance", "Assigned Test Standard", f"Drafted exam deployment [{target_test['name']}] to {emp_usr['name']}")
        
        body = generate_email_body("test_assigned", {"name": emp_usr["name"], "testName": target_test["name"], "duration": target_test["duration"]})
        send_simulated_email(emp_usr["email"], f"EXAM ASSIGNED: {target_test['name']}", body, "test_assigned")
        send_system_notification(emp_id, "New Assessment Assigned", f"Admin assigned standard certification exam: \"{target_test['name']}\". Start assessment when ready.", "warning")
        
    save_database()
    return {"success": True, "count": len(assigned_records)}

# Start exam
@app.post("/api/assigned-tests/{assign_id}/start")
def start_assigned_test(assign_id: str):
    idx = -1
    for i, a in enumerate(db_state["assignedTests"]):
        if a["id"] == assign_id:
            idx = i
            break
            
    if idx == -1:
        raise HTTPException(status_code=404, detail="No such assigned test deployment found.")
        
    record = db_state["assignedTests"][idx]
    record["status"] = "in_progress"
    record["startedAt"] = datetime.utcnow().isoformat() + "Z"
    
    template = next((t for t in db_state["tests"] if t["id"] == record["testId"]), None)
    if template:
        if record.get("remainingTime") is None:
            record["remainingTime"] = template["duration"] * 60
            
    if "answers" not in record or not record["answers"]:
        record["answers"] = {}
        
    save_database()
    emp = next((u for u in db_state["users"] if u["id"] == record["employeeId"]), None)
    emp_name = emp["name"] if emp else "Employee"
    log_activity(record["employeeId"], emp_name, "Exam Commenced", f"Began taking quiz assignment: \"{record['testName']}\"")
    return record

# Pause exam
@app.post("/api/assigned-tests/{assign_id}/pause")
def pause_assigned_test(assign_id: str, req: Dict[str, Any]):
    idx = -1
    for i, a in enumerate(db_state["assignedTests"]):
        if a["id"] == assign_id:
            idx = i
            break
            
    if idx == -1:
        raise HTTPException(status_code=404, detail="No such assigned test deployment found.")
        
    record = db_state["assignedTests"][idx]
    record["status"] = "not_started"
    
    answers = req.get("answers")
    rem_time = req.get("remainingTime")
    
    if answers:
        record["answers"] = {**(record.get("answers") or {}), **answers}
    if rem_time is not None:
        record["remainingTime"] = rem_time
        
    save_database()
    emp = next((u for u in db_state["users"] if u["id"] == record["employeeId"]), None)
    emp_name = emp["name"] if emp else "Employee"
    log_activity(record["employeeId"], emp_name, "Exam Paused", f"Paused taking quiz assignment: \"{record['testName']}\"")
    return record

# Progress sync
@app.post("/api/assigned-tests/{assign_id}/progress")
def sync_assigned_test_progress(assign_id: str, req: Dict[str, Any]):
    idx = -1
    for i, a in enumerate(db_state["assignedTests"]):
        if a["id"] == assign_id:
            idx = i
            break
            
    if idx == -1:
        raise HTTPException(status_code=404, detail="No such assigned test deployment found.")
        
    record = db_state["assignedTests"][idx]
    answers = req.get("answers")
    rem_time = req.get("remainingTime")
    
    if answers:
        record["answers"] = {**(record.get("answers") or {}), **answers}
    if rem_time is not None:
         record["remainingTime"] = rem_time
         
    save_database()
    return record

# Submit exam & auto grader
@app.post("/api/assigned-tests/{assign_id}/submit")
def grade_and_submit_test(assign_id: str, req: Dict[str, Any]):
    answers = req.get("answers", {})
    
    idx = -1
    for i, a in enumerate(db_state["assignedTests"]):
        if a["id"] == assign_id:
            idx = i
            break
            
    if idx == -1:
        raise HTTPException(status_code=404, detail="Assigned test index context missing.")
        
    record = db_state["assignedTests"][idx]
    test_template = next((t for t in db_state["tests"] if t["id"] == record["testId"]), None)
    if not test_template:
        raise HTTPException(status_code=404, detail="Source Test Standard template has been erased.")
        
    correct_count = 0
    questions = test_template["questions"]
    
    for q in questions:
        q_id = q["id"]
        sub_ans = answers.get(q_id, [])
        corr_ans = q.get("correctAnswers", [])
        
        if sorted(sub_ans) == sorted(corr_ans):
            correct_count += 1
            
    tot_qs = len(questions)
    score_val = round((correct_count / tot_qs) * 100) if tot_qs > 0 else 0
    is_passed = score_val >= test_template["passingMarks"]
    
    record["status"] = "completed"
    record["score"] = score_val
    record["totalQuestions"] = tot_qs
    record["passingMarks"] = test_template["passingMarks"]
    record["passed"] = is_passed
    record["answers"] = answers
    record["completedAt"] = datetime.utcnow().isoformat() + "Z"
    
    emp_id = record["employeeId"]
    emp_usr = next((u for u in db_state["users"] if u["id"] == emp_id), None)
    emp_name = emp_usr["name"] if emp_usr else "Employee"
    
    # Checklists update
    for item in db_state["checklists"]:
        if item["employeeId"] == emp_id and item["text"] == "Test Completed":
            item["isCompleted"] = True
            item["updatedAt"] = datetime.utcnow().isoformat() + "Z"
            
    if is_passed:
        for item in db_state["checklists"]:
            if item["employeeId"] == emp_id and item["text"] == "Passed Assessment":
                item["isCompleted"] = True
                item["updatedAt"] = datetime.utcnow().isoformat() + "Z"
                
    log_activity(
        emp_id,
        emp_name,
        "Assessment Completed",
        f"Finished exam [{test_template['name']}]. Score: {score_val}%. Grade Result: {'PASSED' if is_passed else 'FAILED'}",
        sync=False
    )
    
    email_type = "pass" if is_passed else "fail"
    subject = f"CONGRATULATIONS: You Passed Your Assessment [{test_template['name']}]" if is_passed else f"ATTENTION: Assessment Retake Notification [{test_template['name']}]"
    
    email_body = generate_email_body("test_completed", {
        "name": emp_name,
        "testName": test_template["name"],
        "score": score_val,
        "passingMarks": test_template["passingMarks"],
        "passed": is_passed
    })
    
    if emp_usr:
        send_simulated_email(emp_usr["email"], subject, email_body, email_type, sync=False)
        send_system_notification(
            emp_id,
            "Congratulations! Test Passed" if is_passed else "Quiz Finished (Fail Threshold)",
            f"Your score on {test_template['name']} is {score_val}% (Required: {test_template['passingMarks']}%).",
            "success" if is_passed else "alert",
            sync=False
        )
        
    send_simulated_email("admin@agentops.com", f"Assessment Results: {emp_name} - {test_template['name']}", email_body, email_type, sync=False)
    send_system_notification(
        None,
        "Assessment Completed",
        f"Candidate {emp_name} has completed \"{test_template['name']}\" scoring {score_val}%. Result: {'PASSED' if is_passed else 'FAILED'}.",
        "success" if is_passed else "alert",
        sync=False
    )
    
    save_database()
    return record

# Checklists
@app.get("/api/checklists/{employee_id}")
def get_employee_checklist(employee_id: str):
    return [c for c in db_state["checklists"] if c["employeeId"] == employee_id]

@app.put("/api/checklists/{item_id}")
def update_checklist_item(item_id: str, req: Dict[str, Any]):
    idx = -1
    for i, c in enumerate(db_state["checklists"]):
        if c["id"] == item_id:
            idx = i
            break
            
    if idx == -1:
        raise HTTPException(status_code=404, detail="Checklist item not recognized.")
        
    item = db_state["checklists"][idx]
    is_completed = bool(req.get("isCompleted", False))
    item["isCompleted"] = is_completed
    item["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    
    emp_id = item["employeeId"]
    chk_text = item["text"]
    emp_usr = next((u for u in db_state["users"] if u["id"] == emp_id), None)
    emp_name = emp_usr["name"] if emp_usr else "Employee"
    
    log_activity("admin-1", "Admin Olivia Vance", "Verification checklist action", f"Marked checklist item \"{chk_text}\" as {'COMPLETE' if is_completed else 'INCOMPLETE'} for client {emp_name}.")
    
    if chk_text == "HR Review Completed" and is_completed:
        send_system_notification(emp_id, "Onboarding Progress Update", "HR Review checklist completed by Administrator. Candidate profile cleared for final staging.", "success")
        
    if chk_text == "Final Approval Completed" and is_completed:
        for app_form in db_state["applications"]:
            if app_form["employeeId"] == emp_id:
                app_form["status"] = "approved"
        send_system_notification(emp_id, "Onboarding Cleared!", "Congratulations! Your final employment clearance checks are complete. Welcome to AgentOps Labs!", "success")
        log_activity(emp_id, emp_name, "Onboarding Cleared", "Final verification checklist item marked complete. Registration onboarding cleared.")
        
    save_database()
    return item

@app.post("/api/checklists/item", status_code=201)
def add_checklist_item(req: Dict[str, Any]):
    emp_id = req.get("employeeId")
    cat = req.get("category")
    text = req.get("text")
    
    if not emp_id or not cat or not text:
        raise HTTPException(status_code=400, detail="employeeId, category, and text are required.")
        
    new_chk = {
        "id": f"chk-{int(datetime.now().timestamp() * 1000)}",
        "employeeId": emp_id,
        "category": cat,
        "text": text,
        "isCompleted": False,
        "updatedAt": datetime.utcnow().isoformat() + "Z"
    }
    
    db_state["checklists"].append(new_chk)
    save_database()
    return new_chk

@app.delete("/api/checklists/{item_id}")
def delete_checklist_item(item_id: str):
    db_state["checklists"] = [c for c in db_state["checklists"] if c["id"] != item_id]
    save_database()
    return {"success": True, "message": "Item deleted."}

# System logs, Emails
@app.get("/api/activity-logs")
def get_activity_logs():
    return db_state["activityLogs"]

@app.get("/api/emails")
def list_sent_emails():
    return db_state["emails"]

@app.get("/api/notifications")
def get_system_notifications():
    return db_state["notifications"]

@app.post("/api/notifications/clear")
def clear_user_notifications(req: Dict[str, str]):
    user_id = req.get("userId")
    if not user_id:
        raise HTTPException(status_code=400, detail="userId is required")
        
    usr = next((u for u in db_state["users"] if u["id"] == user_id), None)
    role = usr["role"] if usr else "employee"
    
    if role == "admin":
         # Keep only those starting with admin or general
         db_state["notifications"] = [n for n in db_state["notifications"] if n.get("employeeId") and not n["employeeId"].startswith("admin")]
    else:
         db_state["notifications"] = [n for n in db_state["notifications"] if n.get("employeeId") != user_id]
         
    save_database()
    return {"success": True}

@app.delete("/api/notifications/{notif_id}")
def delete_single_notification(notif_id: str):
    db_state["notifications"] = [n for n in db_state["notifications"] if n.get("id") != notif_id]
    save_database("notifications")
    return {"success": True}

# Messaging Inbox
@app.get("/api/messages")
def get_mailbox_messages(userId: str, role: Optional[str] = None):
    check_birthdays_and_notify_admin()
    filtered = []
    
    user_role = role
    if not user_role:
        usr = next((u for u in db_state["users"] if u["id"] == userId), None)
        user_role = usr["role"] if usr else "employee"
        
    if user_role == "admin" or userId == "admin":
        filtered = [
            m for m in db_state["messages"]
            if m["receiverId"] == "admin" or m["receiverId"] == userId or m["senderId"] == userId or m["senderId"] == "system"
        ]
    else:
        filtered = [
            m for m in db_state["messages"]
            if m["receiverId"] == userId or m["senderId"] == userId
        ]
        
    return filtered

@app.post("/api/messages", status_code=201)
def compile_new_message(req: Dict[str, Any]):
    snd_id = req.get("senderId")
    snd_name = req.get("senderName")
    rcv_id = req.get("receiverId")
    subj = req.get("subject")
    body = req.get("body")
    msg_type = req.get("type", "user_msg")
    
    if not snd_id or not rcv_id or not subj or not body:
         raise HTTPException(status_code=400, detail="Missing required message fields.")
         
    # Only Admin can send messages
    snd_user = next((u for u in db_state["users"] if u["id"] == snd_id), None)
    if not snd_user or snd_user["role"] != "admin":
         raise HTTPException(status_code=403, detail="Only Admins are permitted to send messages.")
         
    if rcv_id == "all":
        employees = [u for u in db_state["users"] if u["role"] == "employee"]
        created_messages = []
        now_ts = int(datetime.now().timestamp() * 1000)
        
        for idx, emp in enumerate(employees):
            new_msg = {
                "id": f"msg-{now_ts}-{str(random.randint(100, 999))}-{idx}",
                "senderId": snd_id,
                "senderName": snd_name or "Anonymous",
                "receiverId": emp["id"],
                "subject": subj,
                "body": body,
                "createdAt": datetime.utcnow().isoformat() + "Z",
                "isRead": False,
                "type": msg_type
            }
            db_state["messages"].insert(0, new_msg)
            send_system_notification(
                emp["id"],
                "New HR Message Received",
                f"Admin sent you a new message: '{subj}'",
                "info",
                sync=False
            )
            created_messages.append(new_msg)
            
        save_database()
        return created_messages[0] if created_messages else {"success": True}
        
    else:
        new_msg = {
            "id": f"msg-{int(datetime.now().timestamp() * 1000)}-{str(random.randint(100, 999))}",
            "senderId": snd_id,
            "senderName": snd_name or "Anonymous",
            "receiverId": rcv_id,
            "subject": subj,
            "body": body,
            "createdAt": datetime.utcnow().isoformat() + "Z",
            "isRead": False,
            "type": msg_type
        }
        
        db_state["messages"].insert(0, new_msg)
        send_system_notification(
            rcv_id,
            "New HR Message Received",
            f"Admin sent you a new message: '{subj}'",
            "info"
        )
        save_database()
        return new_msg

@app.put("/api/messages/{msg_id}/read")
def read_message(msg_id: str):
    msg = next((m for m in db_state["messages"] if m["id"] == msg_id), None)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")
        
    msg["isRead"] = True
    save_database()
    return msg

# Document safe-view helpers
def generate_mock_pdf_server(file_name: str, doc_type: str, doc_id: str) -> bytes:
    current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    digest_id = doc_id.replace("doc-", "")[:12].upper()
    pdf_text = f"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 595 842] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 450 >>
stream
BT
/F1 16 Tf
50 800 Td
(AGENTOPS SYSTEMS - COMPLIANCE MANAGEMENT) Tj
/F1 12 Tf
0 -30 Td
(OFFICIAL ENCRYPTED DOCUMENT VERIFICATION REGISTER) Tj
0 -40 Td
(Document Category: {doc_type}) Tj
0 -20 Td
(Associated File: {file_name}) Tj
0 -20 Td
(Verification ID Reference: {doc_id}) Tj
0 -20 Td
(Database Sync Timestamp: {current_date}) Tj
/F1 10 Tf
0 -40 Td
(This digital credential was verified by AgentOps Compliance & Audits Team.) Tj
0 -20 Td
(The original archive contains matching binary hash structures and was passed) Tj
0 -15 Td
(for compliance clearance. Integrity checks returned STATUS_APPROVED.) Tj
0 -15 Td
(Checksum: SHA256-{digest_id}) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 000000 n 
0000000249 00000 n 
0000000318 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
820
%%EOF"""
    return pdf_text.encode("latin1")

def generate_mock_svg_server(file_name: str, doc_type: str, doc_id: str) -> bytes:
    current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    svg_text = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="100%" height="100%">
      <rect width="600" height="400" fill="url(#bgGrad)" />
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#312e81" />
        </linearGradient>
      </defs>
      <!-- Borders -->
      <rect x="10" y="10" width="580" height="380" fill="none" stroke="#4f46e5" stroke-width="8" />
      <rect x="20" y="20" width="560" height="360" fill="none" stroke="#10b981" stroke-width="2" />
      
      <!-- Watermark logo -->
      <text x="300" y="220" font-family="sans-serif" font-size="60" font-weight="bold" fill="rgba(255, 255, 255, 0.05)" text-anchor="middle">AGENTOPS</text>
      
      <!-- Content -->
      <text x="50" y="70" font-family="sans-serif" font-size="20" font-weight="bold" fill="#ffffff">AGENTOPS COMPLIANCE VERIFICATION</text>
      <text x="50" y="100" font-family="monospace" font-size="12" font-weight="bold" fill="#10b981">STATUS: VERIFIED SECURE</text>
      
      <line x1="50" y1="120" x2="550" y2="120" stroke="#ffffff" stroke-opacity="0.15" />
      
      <text x="50" y="155" font-family="sans-serif" font-size="12" fill="#94a3b8">Document Type:</text>
      <text x="180" y="155" font-family="sans-serif" font-size="14" font-weight="bold" fill="#f8fafc">{doc_type.upper()}</text>
      
      <text x="50" y="195" font-family="sans-serif" font-size="12" fill="#94a3b8">Filename Info:</text>
      <text x="180" y="195" font-family="monospace" font-size="14" fill="#f8fafc">{file_name}</text>
      
      <text x="50" y="235" font-family="sans-serif" font-size="12" fill="#94a3b8">Credential ID:</text>
      <text x="180" y="235" font-family="monospace" font-size="14" fill="#f8fafc">{doc_id}</text>
      
      <text x="50" y="275" font-family="sans-serif" font-size="12" fill="#94a3b8">System Timestamp:</text>
      <text x="180" y="275" font-family="sans-serif" font-size="13" fill="#f8fafc">{current_date}</text>
      
      <!-- Certified Stamp seal -->
      <circle cx="480" cy="240" r="45" fill="#10b981" />
      <text x="480" y="238" font-family="sans-serif" font-size="10" font-weight="bold" fill="#ffffff" text-anchor="middle">APPROVED</text>
      <text x="480" y="252" font-family="monospace" font-size="9" fill="#ffffff" text-anchor="middle">COMPLIANT</text>
    </svg>"""
    return svg_text.encode("utf-8")

# Safe-view API Core Endpoints (Inline HTML Renderer and Binary Streaming Pipeline)
@app.get("/api/documents/safe-view/{doc_id}")
def safe_view_document(doc_id: str, response: Response):
    doc = next((d for d in db_state["documents"] if d["id"] == doc_id), None)
    if not doc:
        return Response("Document not found in enterprise records.", status_code=404)
        
    url = doc.get("url", "")
    low_name = doc["fileName"].lower()
    
    # Firebase Storage URLs: redirect directly — browser handles viewing natively
    if url.startswith("https://") or url.startswith("http://"):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=url, status_code=302)
    
    is_preseed = ("TG9hZGVkIGZpbGUgdGV4dCBjb250ZW50IHNpbXVsYXRpb24=" in url) or \
                 ("U2ltdWxhdGVkIGZpbGUgZGF0YSBvbiBBZ2VudE9wcw==" in url)
                 
    is_word = low_name.endswith(".docx") or low_name.endswith(".doc")
    
    if is_word:
        if is_preseed:
            styled_html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{doc['fileName']}</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      margin: 0;
      padding: 32px;
      background-color: #f8fafc;
      color: #334155;
      line-height: 1.6;
    }}
    .sheet {{
      max-width: 720px;
      margin: 0 auto;
      background: #ffffff;
      padding: 48px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
    }}
    h1 {{ font-size: 20px; color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-top: 0; font-weight: 800; }}
    h3 {{ font-size: 13px; text-transform: uppercase; color: #1e293b; margin-top: 24px; letter-spacing: 0.05em; font-weight: 700; border-left: 3px solid #3b82f6; padding-left: 8px; }}
    p, li {{ font-size: 13px; color: #475569; }}
    ul {{ padding-left: 20px; }}
    li {{ margin-bottom: 6px; }}
  </style>
</head>
<body>
  <div class="sheet">
    <div style="font-size: 10px; color: #3b82f6; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; display: flex; justify-content: space-between; font-family: monospace;">
      <span>Compliance Verified Record</span>
      <span>ID: {doc['id']}</span>
    </div>
    <h1>VERIFIED PROFILE / EVALUATION DOSSIER</h1>
    <p><strong>Authenticated Owner:</strong> Candidate Profile</p>
    <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 16px 0;"/>
    <h3>EXECUTIVE ARCHETYPE</h3>
    <p>Exemplary team leader with extensive competence in regulatory compliance coordination, records integrity, and end-to-end personnel onboarding audits.</p>
    
    <h3>TACTICAL ABILITIES</h3>
    <ul>
      <li>Secure Records Management &amp; HTTPS Web Synchronization</li>
      <li>Regulatory HR Compliance &amp; Cross-Browser Rendering</li>
      <li>Database Schema Integrations &amp; Process Diagnostics</li>
      <li>Multi-Channel Integrity Vetting</li>
    </ul>

    <h3>AUDIT &amp; INTEGRITY DECLARATION</h3>
    <p>This document has been safely converted, formatted, and validated on the server. Compliance Signature: SHA256-{doc_id.replace("doc-", "")[:12].upper()}</p>
  </div>
</body>
</html>"""
            response.headers["Content-Type"] = "text/html; charset=utf-8"
            response.headers["Content-Disposition"] = f"inline; filename={doc['fileName']}"
            return Response(content=styled_html, media_type="text/html")
        else:
            # User custom uploaded docx
            try:
                if url.startswith("data:"):
                     base64_data = url.split(",")[1]
                     file_bytes = base64.b64decode(base64_data)
                else:
                     file_bytes = url.encode("utf-8")
                     
                if mammoth:
                     # Render HTML from buffer
                     import io
                     result = mammoth.convert_to_html(io.BytesIO(file_bytes))
                     docx_html = result.value or "<p>Blank document or empty formatting vector.</p>"
                else:
                     docx_html = f"<p>Python Mammoth packages is resolving. Base content extracted perfectly. Length: {len(file_bytes)} bytes</p>"
                     
                parsed_styles = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{doc['fileName']}</title>
  <style>
    body {{ font-family: -apple-system, sans-serif; margin: 0; padding: 24px; background-color: #f8fafc; color: #334155; line-height: 1.6; }}
    .container {{ max-width: 720px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e2e8f0; }}
    .header {{ border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; }}
    .stamp {{ font-family: monospace; font-size: 10px; color: #10b981; background: #ecfdf5; padding: 4px 8px; border: 1px solid #a7f3d0; border-radius: 4px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
         <div style="font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase;">Secure Word Preview</div>
         <div style="font-size: 16px; font-weight: 800; color: #1e293b;">{doc['fileName']}</div>
      </div>
      <div class="stamp">COMPLIANT NATIVE PREVIEW</div>
    </div>
    <div class="content">{docx_html}</div>
    <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 11px; color: #94a3b8; font-family: monospace;">
      End of secure inline Word reader preview &bull; ID Ref: {doc['id']}
    </div>
  </div>
</body>
</html>"""
                response.headers["Content-Type"] = "text/html; charset=utf-8"
                response.headers["Content-Disposition"] = f"inline; filename={doc['fileName']}"
                return Response(content=parsed_styles, media_type="text/html")
            except Exception as e:
                fallback_html = f"<!DOCTYPE html><html><body><h3>Word extraction error</h3><p>{e}</p></body></html>"
                return Response(content=fallback_html, media_type="text/html")
                
    # PDF and Image formats pre-seed check
    content_bytes = b""
    content_mime = "application/octet-stream"
    
    if is_preseed:
        if low_name.endswith(".pdf"):
            content_mime = "application/pdf"
            content_bytes = generate_mock_pdf_server(doc["fileName"], doc["type"], doc["id"])
        elif any(low_name.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".gif"]):
            content_mime = "image/svg+xml"
            content_bytes = generate_mock_svg_server(doc["fileName"], doc["type"], doc["id"])
        else:
            content_mime = "text/plain"
            content_bytes = f"AGENTOPS CERTIFICATION INVENTORY\n{doc['type'].upper()}: {doc['fileName']}\nVerified: Approved\n\nCompliance registry completed.".encode("utf-8")
    else:
        if url.startswith("data:"):
            try:
                parts = url.split(",")
                header = parts[0]
                content_mime = header.split(";")[0].split(":")[1]
                content_bytes = base64.b64decode(parts[1])
            except Exception:
                content_mime = "text/plain"
                content_bytes = url.encode("utf-8")
        else:
            content_mime = "text/plain"
            content_bytes = url.encode("utf-8")
            
    response.headers["Content-Type"] = content_mime
    response.headers["Content-Disposition"] = f"inline; filename={doc['fileName']}"
    return Response(content=content_bytes, media_type=content_mime)

# Safe attachments download stream
@app.get("/api/documents/safe-download/{doc_id}")
def safe_download_document(doc_id: str, response: Response):
    doc = next((d for d in db_state["documents"] if d["id"] == doc_id), None)
    if not doc:
        return Response("Document not found in enterprise records.", status_code=404)
        
    url = doc.get("url", "")
    low_name = doc["fileName"].lower()
    
    # Firebase Storage URLs: redirect to download directly
    if url.startswith("https://") or url.startswith("http://"):
        from fastapi.responses import RedirectResponse
        # Add dl=1 or use content-disposition attachment via redirect
        return RedirectResponse(url=url, status_code=302)
    
    is_preseed = ("TG9hZGVkIGZpbGUgdGV4dCBjb250ZW50IHNpbXVsYXRpb24=" in url) or \
                 ("U2ltdWxhdGVkIGZpbGUgZGF0YSBvbiBBZ2VudE9wcw==" in url)
                 
    content_bytes = b""
    content_mime = "application/octet-stream"
    final_file_name = doc["fileName"]
    
    if is_preseed:
        if low_name.endswith(".pdf"):
            content_mime = "application/pdf"
            content_bytes = generate_mock_pdf_server(doc["fileName"], doc["type"], doc["id"])
        elif any(low_name.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".gif"]):
            content_mime = "image/svg+xml"
            final_file_name = ".".join(final_file_name.split(".")[:-1]) + ".svg"
            content_bytes = generate_mock_svg_server(doc["fileName"], doc["type"], doc["id"])
        else:
            content_mime = "text/plain"
            content_bytes = f"AGENTOPS CERTIFICATION INVENTORY\n{doc['type'].upper()}: {doc['fileName']}\nVerified: Approved.".encode("utf-8")
    else:
        if url.startswith("data:"):
            try:
                parts = url.split(",")
                header = parts[0]
                content_mime = header.split(";")[0].split(":")[1]
                content_bytes = base64.b64decode(parts[1])
            except Exception:
                content_mime = "text/plain"
                content_bytes = url.encode("utf-8")
        else:
             content_mime = "text/plain"
             content_bytes = url.encode("utf-8")
             
    response.headers["Content-Type"] = content_mime
    response.headers["Content-Disposition"] = f"attachment; filename={final_file_name}"
    return Response(content=content_bytes, media_type=content_mime)

# Task Management REST Endpoints

@app.get("/api/tasks")
def list_tasks():
    return db_state.get("tasks", [])

@app.post("/api/tasks", status_code=201)
def create_task(req: Dict[str, Any]):
    title = req.get("title")
    description = req.get("description")
    assigned_to = req.get("assignedTo")  # "all" or specific employee ID
    files = req.get("files", [])  # list of dicts {name, size, url}
    
    if not title or not description or not assigned_to:
        raise HTTPException(status_code=400, detail="Missing required task parameters.")
        
    new_task_id = f"task-{int(datetime.now().timestamp() * 1000)}-{str(random.randint(10000, 99999))}"
    new_task = {
        "id": new_task_id,
        "title": title,
        "description": description,
        "assignedTo": assigned_to,
        "files": files,
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "status": "assigned"
    }
    
    if "tasks" not in db_state:
        db_state["tasks"] = []
    db_state["tasks"].append(new_task)
    
    # Send system notifications
    if assigned_to == "all":
        for u in db_state["users"]:
            if u.get("role") == "employee":
                send_system_notification(
                    u["id"], 
                    "New Task Assigned", 
                    f"A new task '{title}' has been assigned to all employees.", 
                    "info"
                )
    else:
        send_system_notification(
            assigned_to, 
            "New Task Assigned", 
            f"A new task '{title}' has been assigned to you.", 
            "info"
        )
        
    log_activity("admin-1", "Admin Olivia Vance", "Task Assigned", f"Assigned task '{title}' to {assigned_to.upper()}")
    save_database()
    return new_task

@app.get("/api/tasks/submissions")
def list_submissions():
    return db_state.get("taskSubmissions", [])

@app.post("/api/tasks/submissions", status_code=201)
def create_submission(req: Dict[str, Any]):
    task_id = req.get("taskId")
    emp_id = req.get("employeeId")
    emp_name = req.get("employeeName")
    submitted_text = req.get("submittedText", "")
    files = req.get("files", [])  # list of dicts {name, size, url}
    
    if not task_id or not emp_id or not emp_name:
        raise HTTPException(status_code=400, detail="Missing required submission parameters.")
        
    new_sub_id = f"sub-{int(datetime.now().timestamp() * 1000)}-{str(random.randint(10000, 99999))}"
    new_sub = {
        "id": new_sub_id,
        "taskId": task_id,
        "employeeId": emp_id,
        "employeeName": emp_name,
        "submittedText": submitted_text,
        "files": files,
        "status": "pending",
        "submittedAt": datetime.utcnow().isoformat() + "Z"
    }
    
    if "taskSubmissions" not in db_state:
        db_state["taskSubmissions"] = []
        
    # Remove any existing submission for this employee & task to prevent duplicates
    db_state["taskSubmissions"] = [
        s for s in db_state["taskSubmissions"] 
        if not (s["taskId"] == task_id and s["employeeId"] == emp_id)
    ]
    db_state["taskSubmissions"].append(new_sub)
    
    # Notify admin
    task = next((t for t in db_state.get("tasks", []) if t["id"] == task_id), None)
    task_title = task["title"] if task else "Task"
    send_system_notification(
        None, 
        "Task Submitted", 
        f"Task '{task_title}' submitted by {emp_name}. Review now.", 
        "info"
    )
    
    log_activity(emp_id, emp_name, "Task Submitted", f"Submitted solution for task: '{task_title}'")
    save_database()
    return new_sub

@app.put("/api/tasks/submissions/{sub_id}/status")
def update_submission_status(sub_id: str, req: Dict[str, Any]):
    status = req.get("status")  # "approved" or "rejected"
    remarks = req.get("remarks", "")
    
    if status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid submission status.")
        
    sub = next((s for s in db_state.get("taskSubmissions", []) if s["id"] == sub_id), None)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found.")
        
    sub["status"] = status
    sub["remarks"] = remarks
    sub["reviewedAt"] = datetime.utcnow().isoformat() + "Z"
    
    # Notify employee
    task = next((t for t in db_state.get("tasks", []) if t["id"] == sub["taskId"]), None)
    task_title = task["title"] if task else "Task"
    
    notif_title = "Task Approved" if status == "approved" else "Task Rejected"
    notif_msg = f"Your submission for task '{task_title}' has been {status.upper()} by Admin."
    if remarks:
        notif_msg += f" Remarks: {remarks}"
        
    send_system_notification(
        sub["employeeId"], 
        notif_title, 
        notif_msg, 
        "success" if status == "approved" else "alert",
        sync=False
    )
    
    log_activity(
        "admin-1", 
        "Admin Olivia Vance", 
        f"Task Submission {status.capitalize()}", 
        f"{status.capitalize()} task '{task_title}' for employee {sub['employeeName']}",
        sync=False
    )
    save_database()
    return sub

# Attendance Endpoints
@app.get("/api/attendance")
def list_attendance(employeeId: Optional[str] = None):
    records = db_state.get("attendance", [])
    if employeeId:
        records = [r for r in records if r["employeeId"] == employeeId]
    return records

@app.post("/api/attendance", status_code=201)
def create_attendance_request(req: Dict[str, Any]):
    emp_id = req.get("employeeId")
    emp_name = req.get("employeeName")
    date_val = req.get("date")  # YYYY-MM-DD
    
    if not emp_id or not emp_name or not date_val:
        raise HTTPException(status_code=400, detail="Missing required attendance parameters.")
        
    # Check if a request already exists for this date and employee
    existing = next((r for r in db_state.get("attendance", []) if r["employeeId"] == emp_id and r["date"] == date_val), None)
    if existing:
        if existing["status"] == "approved":
            raise HTTPException(status_code=400, detail="Attendance check-in for today has already been approved.")
        elif existing["status"] == "pending":
            raise HTTPException(status_code=400, detail="Attendance check-in for today is already pending approval.")
        # If rejected, allow resubmitting
        db_state["attendance"] = [r for r in db_state["attendance"] if r["id"] != existing["id"]]
        
    new_record = {
        "id": f"att-{int(datetime.now().timestamp() * 1000)}-{str(random.randint(10000, 99999))}",
        "employeeId": emp_id,
        "employeeName": emp_name,
        "date": date_val,
        "status": "pending",
        "submittedAt": datetime.utcnow().isoformat() + "Z"
    }
    
    if "attendance" not in db_state:
        db_state["attendance"] = []
    db_state["attendance"].insert(0, new_record)
    
    send_system_notification(
        None,
        "Attendance Approval Requested",
        f"Employee {emp_name} requested attendance approval for {date_val}.",
        "info",
        sync=False
    )
    
    log_activity(emp_id, emp_name, "Attendance Requested", f"Checked in for daily attendance on {date_val}.", sync=False)
    save_database(["attendance", "notifications", "activityLogs"])
    return new_record

@app.put("/api/attendance/{record_id}/status")
def update_attendance_status(record_id: str, req: Dict[str, Any]):
    with db_lock:
        status = req.get("status")  # "approved" or "rejected"
        remarks = req.get("remarks", "")
        
        if status not in ["approved", "rejected"]:
            raise HTTPException(status_code=400, detail="Invalid attendance status.")
            
        record = next((r for r in db_state.get("attendance", []) if r["id"] == record_id), None)
        if not record:
            raise HTTPException(status_code=404, detail="Attendance record not found.")
            
        record["status"] = status
        record["remarks"] = remarks
        record["approvedAt"] = datetime.utcnow().isoformat() + "Z"
        
        # Notify Employee
        notif_title = "Attendance Approved" if status == "approved" else "Attendance Rejected"
        notif_msg = f"Your daily check-in for {record['date']} has been {status.upper()} by Admin."
        if remarks:
            notif_msg += f" Remarks: {remarks}"
            
        send_system_notification(
            record["employeeId"],
            notif_title,
            notif_msg,
            "success" if status == "approved" else "alert",
            sync=False
        )
        
        log_activity(
            "admin-1",
            "Admin Olivia Vance",
            f"Attendance {status.capitalize()}",
            f"{status.capitalize()} attendance for employee {record['employeeName']} on {record['date']}.",
            sync=False
        )
        save_database(["attendance", "notifications", "activityLogs"])
        return record


# Leave Endpoints
@app.get("/api/leaves")
def list_leaves(employeeId: Optional[str] = None):
    requests = db_state.get("leaves", [])
    if employeeId:
        requests = [r for r in requests if r["employeeId"] == employeeId]
    return requests

@app.post("/api/leaves", status_code=201)
def create_leave_request(req: Dict[str, Any]):
    emp_id = req.get("employeeId")
    emp_name = req.get("employeeName")
    start_date = req.get("startDate")
    end_date = req.get("endDate")
    leave_type = req.get("leaveType") # "instant" | "oneday_before" | "oneweek_before"
    reason = req.get("reason", "")
    
    if not emp_id or not emp_name or not start_date or not end_date or not leave_type:
        raise HTTPException(status_code=400, detail="Missing required leave parameters.")
        
    new_request = {
        "id": f"leave-{int(datetime.now().timestamp() * 1000)}-{str(random.randint(10000, 99999))}",
        "employeeId": emp_id,
        "employeeName": emp_name,
        "startDate": start_date,
        "endDate": end_date,
        "leaveType": leave_type,
        "reason": reason,
        "status": "pending",
        "submittedAt": datetime.utcnow().isoformat() + "Z"
    }
    
    if "leaves" not in db_state:
        db_state["leaves"] = []
    db_state["leaves"].insert(0, new_request)
    
    send_system_notification(
        None,
        "Leave Request Submitted",
        f"Employee {emp_name} submitted a leave request ({leave_type.replace('_', ' ').title()}) from {start_date} to {end_date}.",
        "info",
        sync=False
    )
    
    log_activity(emp_id, emp_name, "Leave Requested", f"Applied for leave from {start_date} to {end_date} ({leave_type}).", sync=False)
    save_database(["leaves", "notifications", "activityLogs"])
    return new_request

@app.put("/api/leaves/{leave_id}/status")
def update_leave_status(leave_id: str, req: Dict[str, Any]):
    with db_lock:
        status = req.get("status")  # "approved" or "rejected"
        remarks = req.get("remarks", "")
        
        if status not in ["approved", "rejected"]:
            raise HTTPException(status_code=400, detail="Invalid leave status.")
            
        leave = next((l for l in db_state.get("leaves", []) if l["id"] == leave_id), None)
        if not leave:
            raise HTTPException(status_code=404, detail="Leave request not found.")
            
        leave["status"] = status
        leave["remarks"] = remarks
        leave["reviewedAt"] = datetime.utcnow().isoformat() + "Z"
        
        # Notify Employee
        notif_title = "Leave Approved" if status == "approved" else "Leave Rejected"
        notif_msg = f"Your leave request from {leave['startDate']} to {leave['endDate']} has been {status.upper()} by Admin."
        if remarks:
            notif_msg += f" Remarks: {remarks}"
            
        send_system_notification(
            leave["employeeId"],
            notif_title,
            notif_msg,
            "success" if status == "approved" else "alert",
            sync=False
        )
        
        log_activity(
            "admin-1",
            "Admin Olivia Vance",
            f"Leave {status.capitalize()}",
            f"{status.capitalize()} leave request for employee {leave['employeeName']} from {leave['startDate']} to {leave['endDate']}.",
            sync=False
        )
        save_database(["leaves", "notifications", "activityLogs"])
        return leave

if __name__ == "__main__":
    import uvicorn
    # FastAPI internally binds on port 8005. Node Express listens on port 3005 and proxies to local 8005!
    uvicorn.run(app, host="127.0.0.1", port=8005)
