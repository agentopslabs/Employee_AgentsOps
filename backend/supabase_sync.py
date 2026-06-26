import os
import json
import requests
from concurrent.futures import ThreadPoolExecutor

# Load config
config_path = os.path.join(os.getcwd(), "supabase-config.json")
supabase_config = {}
if os.path.exists(config_path):
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            supabase_config = json.load(f)
    except Exception as e:
        print(f"[Supabase Sync] Error loading supabase-config.json: {e}")

SUPABASE_URL = os.environ.get("SUPABASE_URL", supabase_config.get("supabaseUrl"))
if SUPABASE_URL:
    SUPABASE_URL = SUPABASE_URL.strip().rstrip("/")
    if "/rest/v1" in SUPABASE_URL:
        SUPABASE_URL = SUPABASE_URL.replace("/rest/v1", "").strip().rstrip("/")

SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", supabase_config.get("supabaseServiceRoleKey"))

collections_info = [
    {"name": "users", "key": "users", "type": "array"},
    {"name": "passwords", "key": "passwords", "type": "map"},
    {"name": "applications", "key": "applications", "type": "array"},
    {"name": "documents", "key": "documents", "type": "array"},
    {"name": "tests", "key": "tests", "type": "array"},
    {"name": "assignedTests", "key": "assignedTests", "type": "array"},
    {"name": "checklists", "key": "checklists", "type": "array"},
    {"name": "activityLogs", "key": "activityLogs", "type": "array"},
    {"name": "emails", "key": "emails", "type": "array"},
    {"name": "notifications", "key": "notifications", "type": "array"},
    {"name": "annotations", "key": "annotations", "type": "array"},
    {"name": "messages", "key": "messages", "type": "array"},
    {"name": "tasks", "key": "tasks", "type": "array"},
    {"name": "taskSubmissions", "key": "taskSubmissions", "type": "array"},
    {"name": "attendance", "key": "attendance", "type": "array"},
    {"name": "leaves", "key": "leaves", "type": "array"}
]

def get_item_id(item, col_name):
    if col_name == "applications":
        return item.get("employeeId")
    return item.get("id")

def load_single_collection_from_supabase(col_key):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL == "YOUR_SUPABASE_URL":
        return None, False
        
    col = next((c for c in collections_info if c["key"] == col_key), None)
    if not col:
        return None, False
        
    col_name = col["name"]
    col_type = col["type"]
    url = f"{SUPABASE_URL}/rest/v1/{col_name.lower()}?select=id,data"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
    }
    try:
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            rows = res.json()
            if col_type == "array":
                parsed_docs = [r["data"] for r in rows if "data" in r]
            else:
                parsed_docs = {}
                for r in rows:
                    if "data" in r:
                        parsed_docs[r["id"]] = r["data"].get("password", "")
            return parsed_docs, True
        else:
            print(f"[Supabase Sync] Failed to load table {col_name}: {res.status_code} - {res.text}")
    except Exception as e:
        print(f"[Supabase Sync] Failed to load collection {col_name}: {e}")
    return None, False

def load_from_supabase(db_state):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL == "YOUR_SUPABASE_URL":
        print("[Supabase Sync] Supabase credentials missing or placeholder, bypassing load.")
        return False

    print("[Supabase Sync] Downloading database from Supabase in parallel...")
    
    def load_collection(col):
        col_key = col["key"]
        data, success = load_single_collection_from_supabase(col_key)
        return col_key, data, success

    loaded_any = False
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = executor.map(load_collection, collections_info)

    for col_key, parsed_data, success in results:
        if success and parsed_data is not None:
            db_state[col_key] = parsed_data
            loaded_any = True

    return loaded_any

def sync_to_supabase(db_state, target_collection=None, failed_collections=None):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL == "YOUR_SUPABASE_URL":
        print("[Supabase Sync] Supabase credentials missing or placeholder, bypassing sync.")
        return ["Supabase credentials missing or placeholder"]

    print(f"[Supabase Sync] Syncing database to Supabase in parallel (target={target_collection or 'all'})...")
    
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    collections_to_sync = collections_info
    if target_collection:
        if isinstance(target_collection, (list, set)):
            collections_to_sync = [c for c in collections_info if c["name"] in target_collection or c["key"] in target_collection]
        else:
            collections_to_sync = [c for c in collections_info if c["name"] == target_collection or c["key"] == target_collection]

    errors = []

    def sync_collection(col):
        col_name = col["name"]
        col_key = col["key"]
        col_type = col["type"]

        skip_deletes = False
        if failed_collections and col_key in failed_collections:
            skip_deletes = True
            print(f"[Supabase Sync] Skipping delete phase for {col_name} because it failed to load from Supabase during this request.")

        # Fetch existing IDs in Supabase to determine deletes (skip if deleting is disabled)
        existing_ids = set()
        if not skip_deletes:
            scan_url = f"{SUPABASE_URL}/rest/v1/{col_name.lower()}?select=id"
            try:
                res = requests.get(scan_url, headers={
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
                }, timeout=5)
                if res.status_code == 200:
                    existing_ids = {r["id"] for r in res.json()}
                else:
                    err_msg = f"Failed to scan existing IDs for {col_name}: {res.status_code} - {res.text}"
                    print(f"[Supabase Sync] {err_msg}")
                    errors.append(err_msg)
            except Exception as e:
                err_msg = f"Failed to scan existing IDs for {col_name}: {e}"
                print(f"[Supabase Sync] {err_msg}")
                errors.append(err_msg)

        # Sync items
        try:
            if col_type == "array":
                items = db_state.get(col_key) or []
                present_ids = set()

                upsert_payloads = []
                for item in items:
                    doc_id = get_item_id(item, col_name)
                    if doc_id:
                        present_ids.add(doc_id)
                        upsert_payloads.append({
                            "id": doc_id,
                            "data": item
                        })

                if upsert_payloads:
                    url = f"{SUPABASE_URL}/rest/v1/{col_name.lower()}?on_conflict=id"
                    res = requests.post(url, headers=headers, json=upsert_payloads, timeout=5)
                    if res.status_code not in (200, 201):
                        err_msg = f"Bulk upsert to {col_name} failed: {res.status_code} - {res.text}"
                        print(f"[Supabase Sync] {err_msg}")
                        errors.append(err_msg)

                # Delete removed items
                if not skip_deletes:
                    for ext_id in existing_ids:
                        if ext_id not in present_ids:
                            delete_url = f"{SUPABASE_URL}/rest/v1/{col_name.lower()}?id=eq.{ext_id}"
                            res = requests.delete(delete_url, headers={
                                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
                            }, timeout=5)
                            if res.status_code not in (200, 204):
                                err_msg = f"Delete from {col_name} (id={ext_id}) failed: {res.status_code} - {res.text}"
                                print(f"[Supabase Sync] {err_msg}")
                                errors.append(err_msg)
            else:
                # Passwords mapping
                passwords = db_state.get(col_key) or {}
                present_ids = set(passwords.keys())

                upsert_payloads = []
                for user_id, pwd in passwords.items():
                    upsert_payloads.append({
                        "id": user_id,
                        "data": {"id": user_id, "password": pwd}
                    })

                if upsert_payloads:
                    url = f"{SUPABASE_URL}/rest/v1/{col_name.lower()}?on_conflict=id"
                    res = requests.post(url, headers=headers, json=upsert_payloads, timeout=5)
                    if res.status_code not in (200, 201):
                        err_msg = f"Bulk upsert passwords failed: {res.status_code} - {res.text}"
                        print(f"[Supabase Sync] {err_msg}")
                        errors.append(err_msg)

                # Delete removed passwords
                if not skip_deletes:
                    for ext_id in existing_ids:
                        if ext_id not in present_ids:
                            delete_url = f"{SUPABASE_URL}/rest/v1/{col_name.lower()}?id=eq.{ext_id}"
                            res = requests.delete(delete_url, headers={
                                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
                            }, timeout=5)
                            if res.status_code not in (200, 204):
                                err_msg = f"Delete password (id={ext_id}) failed: {res.status_code} - {res.text}"
                                print(f"[Supabase Sync] {err_msg}")
                                errors.append(err_msg)
        except Exception as e:
            err_msg = f"Failed to sync collection {col_name}: {e}"
            print(f"[Supabase Sync] {err_msg}")
            errors.append(err_msg)

    with ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(sync_collection, collections_to_sync))

    print("[Supabase Sync] Sync completed.")
    return errors
