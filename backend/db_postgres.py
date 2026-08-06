import os
import json
import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger("PostgresDB")

try:
    import psycopg2
    from psycopg2 import sql
    from psycopg2.extras import RealDictCursor, Json
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False
    logger.warning("psycopg2-binary package not installed. PostgreSQL integration disabled.")

def get_postgres_connection_string() -> str:
    """Resolve PostgreSQL/Supabase connection string from environment variables."""
    db_url = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
    if db_url:
        return db_url

    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = os.environ.get("POSTGRES_PORT", "5432")
    db_name = os.environ.get("POSTGRES_DB", "agentops_db")
    user = os.environ.get("POSTGRES_USER", "postgres")
    password = os.environ.get("POSTGRES_PASSWORD", "postgres")

    return f"postgresql://{user}:{password}@{host}:{port}/{db_name}"

def get_db_connection():
    """Get a raw psycopg2 connection to PostgreSQL."""
    if not HAS_PSYCOPG2:
        return None
    try:
        conn_str = get_postgres_connection_string()
        conn = psycopg2.connect(conn_str, connect_timeout=5)
        conn.autocommit = True
        return conn
    except Exception as e:
        logger.error(f"Failed to connect to PostgreSQL: {e}")
        return None

def is_postgres_available() -> bool:
    """Test if PostgreSQL database is reachable."""
    if not HAS_PSYCOPG2:
        return False
    conn = get_db_connection()
    if conn:
        try:
            conn.close()
            return True
        except Exception:
            pass
    return False

def init_db():
    """Initialize PostgreSQL database tables if reachable."""
    conn = get_db_connection()
    if not conn:
        print("[PostgreSQL] Connection unavailable. Operating with local database cache.")
        return False

    try:
        with conn.cursor() as cur:
            # Users table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(255) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    mobile VARCHAR(255) DEFAULT '',
                    role VARCHAR(50) NOT NULL,
                    status VARCHAR(50) NOT NULL,
                    created_at VARCHAR(255) DEFAULT '',
                    dob VARCHAR(255) DEFAULT '',
                    data_json JSONB DEFAULT '{}'::jsonb
                );
            """)

            # Applications table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS applications (
                    employee_id VARCHAR(255) PRIMARY KEY,
                    full_name VARCHAR(255) DEFAULT '',
                    email VARCHAR(255) DEFAULT '',
                    mobile VARCHAR(255) DEFAULT '',
                    gender VARCHAR(50) DEFAULT '',
                    status VARCHAR(50) DEFAULT 'draft',
                    created_at VARCHAR(255) DEFAULT '',
                    updated_at VARCHAR(255) DEFAULT '',
                    data_json JSONB DEFAULT '{}'::jsonb
                );
            """)

            # Documents table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                    id VARCHAR(255) PRIMARY KEY,
                    employee_id VARCHAR(255) NOT NULL,
                    type VARCHAR(100) NOT NULL,
                    file_name VARCHAR(255) NOT NULL,
                    status VARCHAR(50) DEFAULT 'pending',
                    uploaded_at VARCHAR(255) DEFAULT '',
                    data_json JSONB DEFAULT '{}'::jsonb
                );
            """)

            # Tests table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS tests (
                    id VARCHAR(255) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    duration INT DEFAULT 15,
                    passing_marks INT DEFAULT 70,
                    is_published BOOLEAN DEFAULT TRUE,
                    created_at VARCHAR(255) DEFAULT '',
                    data_json JSONB DEFAULT '{}'::jsonb
                );
            """)

            # Assigned Tests table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS assigned_tests (
                    id VARCHAR(255) PRIMARY KEY,
                    test_id VARCHAR(255) NOT NULL,
                    employee_id VARCHAR(255) NOT NULL,
                    test_name VARCHAR(255) DEFAULT '',
                    status VARCHAR(50) DEFAULT 'not_started',
                    score INT,
                    passed BOOLEAN,
                    data_json JSONB DEFAULT '{}'::jsonb
                );
            """)

            # Checklists table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS checklists (
                    id VARCHAR(255) PRIMARY KEY,
                    employee_id VARCHAR(255) NOT NULL,
                    category VARCHAR(100) DEFAULT '',
                    text TEXT DEFAULT '',
                    is_completed BOOLEAN DEFAULT FALSE,
                    updated_at VARCHAR(255) DEFAULT '',
                    data_json JSONB DEFAULT '{}'::jsonb
                );
            """)

            # Activity Logs table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS activity_logs (
                    id VARCHAR(255) PRIMARY KEY,
                    employee_id VARCHAR(255) NOT NULL,
                    employee_name VARCHAR(255) DEFAULT '',
                    action VARCHAR(255) DEFAULT '',
                    timestamp VARCHAR(255) DEFAULT '',
                    data_json JSONB DEFAULT '{}'::jsonb
                );
            """)

            # Notifications table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS system_notifications (
                    id VARCHAR(255) PRIMARY KEY,
                    employee_id VARCHAR(255),
                    title VARCHAR(255) DEFAULT '',
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at VARCHAR(255) DEFAULT '',
                    data_json JSONB DEFAULT '{}'::jsonb
                );
            """)

            # Key-Value store for all remaining collections
            cur.execute("""
                CREATE TABLE IF NOT EXISTS kv_store (
                    collection_name VARCHAR(255) PRIMARY KEY,
                    data_json JSONB DEFAULT '{}'::jsonb
                );
            """)

        conn.close()
        print("[PostgreSQL] Schemas successfully verified & created.")
        return True
    except Exception as e:
        print(f"[PostgreSQL] Failed to initialize schemas: {e}")
        if conn:
            conn.close()
        return False

def seed_postgres_from_json(json_data: Dict[str, Any]):
    """Seed PostgreSQL with baseline JSON dataset if tables are empty."""
    conn = get_db_connection()
    if not conn:
        return False

    try:
        with conn.cursor() as cur:
            # Seed users
            for u in json_data.get("users", []):
                uid = u.get("id")
                if uid:
                    cur.execute("""
                        INSERT INTO users (id, name, email, mobile, role, status, created_at, dob, data_json)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET data_json = EXCLUDED.data_json;
                    """, (
                        uid,
                        u.get("name", ""),
                        u.get("email", ""),
                        u.get("mobile", ""),
                        u.get("role", "employee"),
                        u.get("status", "active"),
                        u.get("createdAt", ""),
                        u.get("dob", ""),
                        Json(u)
                    ))

            # Seed applications
            for app in json_data.get("applications", []):
                emp_id = app.get("employeeId")
                if emp_id:
                    cur.execute("""
                        INSERT INTO applications (employee_id, full_name, email, mobile, gender, status, created_at, updated_at, data_json)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (employee_id) DO UPDATE SET data_json = EXCLUDED.data_json, status = EXCLUDED.status;
                    """, (
                        emp_id,
                        app.get("fullName", ""),
                        app.get("email", ""),
                        app.get("mobile", ""),
                        app.get("gender", ""),
                        app.get("status", "draft"),
                        app.get("createdAt", ""),
                        app.get("updatedAt", ""),
                        Json(app)
                    ))

            # Seed documents
            for doc in json_data.get("documents", []):
                doc_id = doc.get("id")
                if doc_id:
                    cur.execute("""
                        INSERT INTO documents (id, employee_id, type, file_name, status, uploaded_at, data_json)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET data_json = EXCLUDED.data_json;
                    """, (
                        doc_id,
                        doc.get("employeeId", ""),
                        doc.get("type", ""),
                        doc.get("fileName", ""),
                        doc.get("status", "pending"),
                        doc.get("uploadedAt", ""),
                        Json(doc)
                    ))

            # Seed tests
            for test in json_data.get("tests", []):
                tid = test.get("id")
                if tid:
                    cur.execute("""
                        INSERT INTO tests (id, name, duration, passing_marks, is_published, created_at, data_json)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET data_json = EXCLUDED.data_json;
                    """, (
                        tid,
                        test.get("name", ""),
                        test.get("duration", 15),
                        test.get("passingMarks", 70),
                        test.get("isPublished", True),
                        test.get("createdAt", ""),
                        Json(test)
                    ))

            # Seed assigned_tests
            for at in json_data.get("assignedTests", []):
                at_id = at.get("id")
                if at_id:
                    cur.execute("""
                        INSERT INTO assigned_tests (id, test_id, employee_id, test_name, status, score, passed, data_json)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET data_json = EXCLUDED.data_json, status = EXCLUDED.status;
                    """, (
                        at_id,
                        at.get("testId", ""),
                        at.get("employeeId", ""),
                        at.get("testName", ""),
                        at.get("status", "not_started"),
                        at.get("score"),
                        at.get("passed"),
                        Json(at)
                    ))

            # Seed checklists
            for chk in json_data.get("checklists", []):
                cid = chk.get("id")
                if cid:
                    cur.execute("""
                        INSERT INTO checklists (id, employee_id, category, text, is_completed, updated_at, data_json)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET data_json = EXCLUDED.data_json;
                    """, (
                        cid,
                        chk.get("employeeId", ""),
                        chk.get("category", ""),
                        chk.get("text", ""),
                        chk.get("isCompleted", False),
                        chk.get("updatedAt", ""),
                        Json(chk)
                    ))

            # Seed KV collections for remaining fields
            for key in ["passwords", "emails", "notifications", "activityLogs", "annotations", "messages", "tasks", "taskSubmissions", "attendance", "leaves", "settings"]:
                if key in json_data:
                    cur.execute("""
                        INSERT INTO kv_store (collection_name, data_json)
                        VALUES (%s, %s)
                        ON CONFLICT (collection_name) DO UPDATE SET data_json = EXCLUDED.data_json;
                    """, (key, Json(json_data[key])))

        conn.close()
        print("[PostgreSQL] Successfully seeded baseline database records.")
        return True
    except Exception as e:
        print(f"[PostgreSQL] Failed to seed dataset: {e}")
        if conn:
            conn.close()
        return False

def save_collection_to_postgres(collection_name: str, data: Any) -> bool:
    """Sync a modified data collection directly to PostgreSQL."""
    conn = get_db_connection()
    if not conn:
        return False

    try:
        with conn.cursor() as cur:
            if collection_name == "users" and isinstance(data, list):
                cur.execute("TRUNCATE TABLE users;")
                for u in data:
                    cur.execute("""
                        INSERT INTO users (id, name, email, mobile, role, status, created_at, dob, data_json)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
                    """, (
                        u.get("id"),
                        u.get("name", ""),
                        u.get("email", ""),
                        u.get("mobile", ""),
                        u.get("role", "employee"),
                        u.get("status", "active"),
                        u.get("createdAt", ""),
                        u.get("dob", ""),
                        Json(u)
                    ))
            elif collection_name == "applications" and isinstance(data, list):
                cur.execute("TRUNCATE TABLE applications;")
                for app in data:
                    cur.execute("""
                        INSERT INTO applications (employee_id, full_name, email, mobile, gender, status, created_at, updated_at, data_json)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
                    """, (
                        app.get("employeeId"),
                        app.get("fullName", ""),
                        app.get("email", ""),
                        app.get("mobile", ""),
                        app.get("gender", ""),
                        app.get("status", "draft"),
                        app.get("createdAt", ""),
                        app.get("updatedAt", ""),
                        Json(app)
                    ))
            elif collection_name == "documents" and isinstance(data, list):
                cur.execute("TRUNCATE TABLE documents;")
                for doc in data:
                    cur.execute("""
                        INSERT INTO documents (id, employee_id, type, file_name, status, uploaded_at, data_json)
                        VALUES (%s, %s, %s, %s, %s, %s, %s);
                    """, (
                        doc.get("id"),
                        doc.get("employeeId", ""),
                        doc.get("type", ""),
                        doc.get("fileName", ""),
                        doc.get("status", "pending"),
                        doc.get("uploadedAt", ""),
                        Json(doc)
                    ))
            elif collection_name == "tests" and isinstance(data, list):
                cur.execute("TRUNCATE TABLE tests;")
                for test in data:
                    cur.execute("""
                        INSERT INTO tests (id, name, duration, passing_marks, is_published, created_at, data_json)
                        VALUES (%s, %s, %s, %s, %s, %s, %s);
                    """, (
                        test.get("id"),
                        test.get("name", ""),
                        test.get("duration", 15),
                        test.get("passingMarks", 70),
                        test.get("isPublished", True),
                        test.get("createdAt", ""),
                        Json(test)
                    ))
            elif collection_name == "assignedTests" and isinstance(data, list):
                cur.execute("TRUNCATE TABLE assigned_tests;")
                for at in data:
                    cur.execute("""
                        INSERT INTO assigned_tests (id, test_id, employee_id, test_name, status, score, passed, data_json)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                    """, (
                        at.get("id"),
                        at.get("testId", ""),
                        at.get("employeeId", ""),
                        at.get("testName", ""),
                        at.get("status", "not_started"),
                        at.get("score"),
                        at.get("passed"),
                        Json(at)
                    ))
            elif collection_name == "checklists" and isinstance(data, list):
                cur.execute("TRUNCATE TABLE checklists;")
                for chk in data:
                    cur.execute("""
                        INSERT INTO checklists (id, employee_id, category, text, is_completed, updated_at, data_json)
                        VALUES (%s, %s, %s, %s, %s, %s, %s);
                    """, (
                        chk.get("id"),
                        chk.get("employeeId", ""),
                        chk.get("category", ""),
                        chk.get("text", ""),
                        chk.get("isCompleted", False),
                        chk.get("updatedAt", ""),
                        Json(chk)
                    ))
            else:
                # Save to kv_store
                cur.execute("""
                    INSERT INTO kv_store (collection_name, data_json)
                    VALUES (%s, %s)
                    ON CONFLICT (collection_name) DO UPDATE SET data_json = EXCLUDED.data_json;
                """, (collection_name, Json(data)))

        conn.close()
        return True
    except Exception as e:
        print(f"[PostgreSQL] Failed to sync collection '{collection_name}': {e}")
        if conn:
            conn.close()
        return False

def load_all_from_postgres() -> Optional[Dict[str, Any]]:
    """Load full database state snapshot from PostgreSQL."""
    conn = get_db_connection()
    if not conn:
        return None

    res = {}
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Users
            cur.execute("SELECT data_json FROM users;")
            res["users"] = [r["data_json"] for r in cur.fetchall()]

            # Applications
            cur.execute("SELECT data_json FROM applications;")
            res["applications"] = [r["data_json"] for r in cur.fetchall()]

            # Documents
            cur.execute("SELECT data_json FROM documents;")
            res["documents"] = [r["data_json"] for r in cur.fetchall()]

            # Tests
            cur.execute("SELECT data_json FROM tests;")
            res["tests"] = [r["data_json"] for r in cur.fetchall()]

            # Assigned Tests
            cur.execute("SELECT data_json FROM assigned_tests;")
            res["assignedTests"] = [r["data_json"] for r in cur.fetchall()]

            # Checklists
            cur.execute("SELECT data_json FROM checklists;")
            res["checklists"] = [r["data_json"] for r in cur.fetchall()]

            # KV Store
            cur.execute("SELECT collection_name, data_json FROM kv_store;")
            for r in cur.fetchall():
                res[r["collection_name"]] = r["data_json"]

        conn.close()
        return res
    except Exception as e:
        print(f"[PostgreSQL] Failed to load snapshot: {e}")
        if conn:
            conn.close()
        return None
