#!/usr/bin/env python3
"""
Employee Migration Script
Migrates Employee data from sam.fraijanes.gt to erp.fraijanes.gob.gt

This script:
1. Fetches Employee records from source server via REST API
2. Identifies and migrates related/doctype dependencies first
3. Migrates Employee records
4. Handles errors gracefully and logs results
"""

import requests
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from urllib.parse import quote

# Configuration
SOURCE_SERVER = "https://sam.fraijanes.gt"
DEST_SERVER = "https://erp.fraijanes.gob.gt"

SOURCE_API_KEY = "80b184e9c7966b9"
SOURCE_API_SECRET = "bcefb562ba8c071"

DEST_API_KEY = "fd2ac68aac489e3"
DEST_API_SECRET = "6e34487de7d4866"

# Company suffix used in destination (Frappe appends this to names)
DEST_COMPANY_SUFFIX = " - MDF"

# Limit employees for testing (set to None for all)
EMPLOYEE_LIMIT = None  # Set to None to migrate all employees

# Master data doctypes that need to be migrated first (in order of dependency)
MASTER_DOCTYPES = [
    "Department",
    "Designation", 
    "Branch",
    "Employment Type",
    "Shift Type",
    "Shift",
    "Grade",
    "Company",
]

# Log file path
LOG_FILE = "migrate_employees.log"


class FrappeAPIClient:
    """Frappe REST API Client with Bearer token authentication"""
    
    def __init__(self, server_url: str, api_key: str, api_secret: str):
        self.server_url = server_url.rstrip('/')
        self.api_key = api_key
        self.api_secret = api_secret
        self.session = requests.Session()
        # Set timeout for all requests
        self.session.timeout = 30  # 30 second timeout
        self.token = None
        self._authenticate()
    
    def _authenticate(self):
        """Get Bearer token from Frappe API - use token auth directly"""
        # Use API key/secret as token auth - this is the recommended approach for Frappe REST API
        self.token = f"{self.api_key}:{self.api_secret}"
        logger.info(f"Using token authentication for {self.server_url}")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers with Bearer token"""
        return {
            "Authorization": f"token {self.token}",
            "Content-Type": "application/json"
        }
    
    def get_all_docs(self, doctype: str, fields: List[str] = None) -> List[Dict]:
        """Get all documents of a doctype"""
        try:
            import time
            start_time = time.time()
            
            params = {
                "limit_page_length": 1000
            }
            if fields:
                params["fields"] = json.dumps(fields)
            
            url = f"{self.server_url}/api/resource/{doctype}"
            logger.info(f"HTTP Request: GET {url}")
            logger.info(f"HTTP Params: {params}")
            
            response = self.session.get(
                url,
                headers=self._get_headers(),
                params=params,
                timeout=30
            )
            
            elapsed = time.time() - start_time
            logger.info(f"HTTP Response: {response.status_code} (time: {elapsed:.2f}s)")
            
            if response.status_code == 200:
                data = response.json()
                return data.get("data", [])
            else:
                logger.error(f"Error fetching {doctype}: {response.status_code} - {response.text[:300]}")
                return []
        except Exception as e:
            logger.error(f"Exception fetching {doctype}: {e}")
            return []
    
    def get_doc(self, doctype: str, docname: str) -> Optional[Dict]:
        """Get a single document by name"""
        import time
        try:
            start_time = time.time()
            
            url = f"{self.server_url}/api/resource/{doctype}/{quote(docname)}"
            logger.info(f"HTTP Request: GET {url}")
            
            response = self.session.get(
                url,
                headers=self._get_headers(),
                timeout=30
            )
            
            elapsed = time.time() - start_time
            logger.info(f"HTTP Response: {response.status_code} (time: {elapsed:.2f}s)")
            
            if response.status_code == 200:
                data = response.json()
                return data.get("data", None)
            else:
                logger.warning(f"Error fetching {doctype}/{docname}: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"Exception fetching {doctype}/{docname}: {e}")
            return None
    
    def create_doc(self, doctype: str, data: Dict) -> Optional[Dict]:
        """Create a new document"""
        import time
        try:
            start_time = time.time()
            
            url = f"{self.server_url}/api/resource/{doctype}"
            logger.info(f"HTTP Request: POST {url}")
            logger.info(f"HTTP Payload (first 500 chars): {str(data)[:500]}")
            
            response = self.session.post(
                url,
                headers=self._get_headers(),
                json=data,
                timeout=30
            )
            
            elapsed = time.time() - start_time
            logger.info(f"HTTP Response: {response.status_code} (time: {elapsed:.2f}s)")
            
            if response.status_code in [200, 201]:
                result = response.json()
                doc_name = result.get('data', {}).get('name', 'unknown')
                logger.info(f"Created {doctype}: {doc_name}")
                return result.get("data", None)
            elif response.status_code == 409:  # Already exists (duplicate)
                doc_name = data.get('name') or data.get('department_name') or data.get('employee_name') or 'unknown'
                logger.warning(f"{doctype} already exists: {doc_name}")
                return {"exists": True, "name": doc_name}
            elif response.status_code == 417:  # Expectation failed - validation error
                logger.error(f"Error creating {doctype}: 417 - {response.text[:500]}")
                return None
            else:
                logger.error(f"Error creating {doctype}: {response.status_code} - {response.text[:300]}")
                return None
        except Exception as e:
            logger.error(f"Exception creating {doctype}: {e}")
            return None
    
    def update_doc(self, doctype: str, docname: str, data: Dict) -> bool:
        """Update an existing document"""
        try:
            response = self.session.put(
                f"{self.server_url}/api/resource/{doctype}/{docname}",
                headers=self._get_headers(),
                json=data
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"Updated {doctype}: {docname}")
                return True
            else:
                logger.error(f"Error updating {doctype}/{docname}: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            logger.error(f"Exception updating {doctype}/{docname}: {e}")
            return False
    
    def exists(self, doctype: str, docname: str) -> bool:
        """Check if a document exists"""
        return self.get_doc(doctype, docname) is not None


def setup_logging():
    """Configure logging to file and console"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(LOG_FILE),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger(__name__)


def get_employee_dependencies() -> List[str]:
    """Get list of doctypes that Employee depends on"""
    return MASTER_DOCTYPES.copy()


def migrate_master_data(source: FrappeAPIClient, dest: FrappeAPIClient) -> Dict[str, int]:
    """Migrate master data from source to destination"""
    results = {}
    
    logger.info("=" * 50)
    logger.info("Starting master data migration")
    logger.info("=" * 50)
    
    for doctype in MASTER_DOCTYPES:
        logger.info(f"Migrating {doctype}...")
        
        # Get all records from source
        source_docs = source.get_all_docs(doctype)
        
        if not source_docs:
            logger.warning(f"No {doctype} records found in source")
            results[doctype] = 0
            continue
        
        logger.info(f"Found {len(source_docs)} {doctype} records in source")
        
        created_count = 0
        skipped_count = 0
        error_count = 0
        
        for doc in source_docs:
            try:
                doc_name = doc.get("name")
                if not doc_name:
                    continue
                
                # Fetch full document details from source
                full_doc = source.get_doc(doctype, doc_name)
                if not full_doc:
                    logger.warning(f"Could not fetch full details for {doctype}/{doc_name}")
                    continue
                
                # Prepare data for creation (remove system fields)
                create_data = prepare_doc_for_create(full_doc, doctype)
                
                # Remove name field to let destination generate it automatically
                # This handles cases where destination appends company suffix to names
                if "name" in create_data:
                    del create_data["name"]
                
                # Try to create in destination (ignore if already exists)
                result = dest.create_doc(doctype, create_data)
                if result:
                    # Check if it's a new record or already existed
                    if result.get('exists'):
                        skipped_count += 1
                    else:
                        created_count += 1
                        logger.info(f"Created {doctype}: {result.get('name', 'unknown')}")
                else:
                    skipped_count += 1
                    
            except Exception as e:
                logger.error(f"Error migrating {doctype} record: {e}")
                error_count += 1
                continue
        
        results[doctype] = created_count
        logger.info(f"Created {created_count}/{len(source_docs)} {doctype} records (skipped: {skipped_count}, errors: {error_count})")
    
    return results


def prepare_doc_for_create(doc: Dict, doctype: str) -> Dict:
    """Prepare document data for creation (remove system fields, handle links)"""
    # Fields to exclude when creating
    exclude_fields = [
        "name", "owner", "creation", "modified", "modified_by",
        "docstatus", "idx", "_user_tags", "_comments", "_assign",
        "_workflow_state", "workflow_state", "flags", "lft", "rgt"
    ]
    
    # Create a clean copy
    clean_doc = {}
    for key, value in doc.items():
        if key not in exclude_fields and not key.startswith("_"):
            clean_doc[key] = value
    
    # Handle special cases based on doctype
    if doctype == "Department":
        # Set the name field from department_name
        if "department_name" in clean_doc:
            clean_doc["name"] = clean_doc["department_name"]
        
        # Handle parent_department - append suffix if not root
        if "parent_department" in clean_doc and clean_doc["parent_department"]:
            parent = clean_doc["parent_department"]
            # Only append suffix if it doesn't already have it
            if DEST_COMPANY_SUFFIX not in parent:
                clean_doc["parent_department"] = parent + DEST_COMPANY_SUFFIX
        
        # Clear company field - let destination set it
        if "company" in clean_doc:
            del clean_doc["company"]
    
    elif doctype == "Designation":
        if "designation_name" in clean_doc:
            clean_doc["name"] = clean_doc["designation_name"]
    
    elif doctype == "Branch":
        if "branch_name" in clean_doc:
            clean_doc["name"] = clean_doc["branch_name"]
        # Clear company field
        if "company" in clean_doc:
            del clean_doc["company"]
    
    elif doctype == "Employee":
        # For employees, clear or handle link fields that might not exist in destination
        # These fields reference other doctypes that may not be migrated
        # Clear all custom fields to avoid validation errors
        custom_fields = [k for k in clean_doc.keys() if k.startswith('custom_')]
        for field in custom_fields:
            del clean_doc[field]
        
        # Also clear these specific fields that cause issues
        fields_to_clear = [
            "default_shift",  # Shift may not exist
            "user_id",  # User may not exist
            "attendance_device_id",  # Unique ID conflict
            "holiday_list",  # May not exist in destination
            "shift_request_approver",  # May not exist
            "reports_to",  # Employee may not exist yet - handled separately
            "custom_renglon",  # Custom field - Budget Line (try to keep if it's a data field)
        ]
        for field in fields_to_clear:
            if field in clean_doc:
                del clean_doc[field]
        
        # Handle department link - append suffix
        if "department" in clean_doc and clean_doc["department"]:
            dept = clean_doc["department"]
            if DEST_COMPANY_SUFFIX not in dept:
                clean_doc["department"] = dept + DEST_COMPANY_SUFFIX
        
        # Clear image field (file reference may not work across systems)
        if "image" in clean_doc:
            del clean_doc["image"]
        
        # PRESERVE the employee number as the name/ID in destination
        # This is critical - the employee ID must be the same in both systems
        if "employee_number" in clean_doc and clean_doc["employee_number"]:
            clean_doc["name"] = clean_doc["employee_number"]
        elif "employee" in clean_doc and clean_doc["employee"]:
            # Fall back to employee field if employee_number is not set
            clean_doc["name"] = clean_doc["employee"]
    
    return clean_doc


def migrate_employees(source: FrappeAPIClient, dest: FrappeAPIClient) -> Dict[str, Any]:
    """Migrate Employee records from source to destination"""
    logger.info("=" * 50)
    logger.info("Starting Employee migration")
    logger.info("=" * 50)
    
    results = {
        "total": 0,
        "created": 0,
        "skipped": 0,
        "errors": 0,
        "details": []
    }
    
    # Get list of employee names from source (API returns only name by default)
    logger.info("=" * 60)
    logger.info("STAGE: Fetching employee list from source server")
    logger.info(f"Endpoint: {SOURCE_SERVER}/api/resource/Employee")
    logger.info("Method: GET")
    
    employee_names = source.get_all_docs("Employee")
    
    if not employee_names:
        logger.warning("No Employee records found in source")
        return results
    
    # Apply limit if set
    if EMPLOYEE_LIMIT:
        employee_names = employee_names[:EMPLOYEE_LIMIT]
    
    results["total"] = len(employee_names)
    logger.info(f"Found {len(employee_names)} employees in source (limit: {EMPLOYEE_LIMIT})")
    
    logger.info("=" * 60)
    logger.info("STAGE: Migrating employees to destination server")
    logger.info(f"Destination endpoint: {DEST_SERVER}/api/resource/Employee")
    logger.info("Method: POST")
    
    for idx, emp_name_entry in enumerate(employee_names):
        try:
            emp_name = emp_name_entry.get("name")
            if not emp_name:
                continue
            
            # Progress logging
            progress_pct = ((idx + 1) / len(employee_names)) * 100
            logger.info(f"\n--- Progress: {idx + 1}/{len(employee_names)} ({progress_pct:.1f}%) ---")
            logger.info(f"Processing employee: {emp_name}")
            
            # Fetch full employee details
            emp = source.get_doc("Employee", emp_name)
            if not emp:
                logger.warning(f"Could not fetch details for {emp_name}")
                results["errors"] += 1
                continue
            
            emp_number = emp.get("employee_number", "N/A")
            
            # Check if already exists in destination (by employee_number)
            if emp.get("employee_number"):
                existing = dest.get_all_docs("Employee")
                for e in existing:
                    if e.get("employee_number") == emp.get("employee_number"):
                        logger.info(f"Employee with number {emp.get('employee_number')} already exists, skipping")
                        results["skipped"] += 1
                        results["details"].append({
                            "name": emp_name,
                            "number": emp_number,
                            "status": "skipped_already_exists"
                        })
                        break
            else:
                # Prepare employee data
                emp_data = prepare_doc_for_create(emp, "Employee")
                
                # The name is now set in prepare_doc_for_create using employee_number
                # DO NOT delete it - we want to preserve the employee ID from source
                
                # Create in destination
                result = dest.create_doc("Employee", emp_data)
                
                if result:
                    results["created"] += 1
                    results["details"].append({
                        "name": emp_name,
                        "number": emp_number,
                        "status": "created"
                    })
                    logger.info(f"Created employee: {emp_name}")
                else:
                    results["errors"] += 1
                    results["details"].append({
                        "name": emp_name,
                        "number": emp_number,
                        "status": "error_creation_failed"
                    })
                    logger.error(f"Failed to create employee: {emp_name}")
                    
        except Exception as e:
            results["errors"] += 1
            logger.error(f"Error processing employee {emp_name_entry.get('name', 'unknown')}: {e}")
            results["details"].append({
                "name": emp_name_entry.get("name", "unknown"),
                "number": "N/A",
                "status": f"error: {str(e)}"
            })
            continue
    
    logger.info(f"Employee migration complete: {results['created']} created, {results['skipped']} skipped, {results['errors']} errors")
    return results


def generate_summary_report(master_results: Dict[str, int], employee_results: Dict[str, Any]) -> str:
    """Generate a summary report of the migration"""
    report = []
    report.append("\n" + "=" * 60)
    report.append("MIGRATION SUMMARY REPORT")
    report.append("=" * 60)
    report.append(f"Timestamp: {datetime.now().isoformat()}")
    report.append("")
    
    report.append("MASTER DATA MIGRATION:")
    report.append("-" * 30)
    for doctype, count in master_results.items():
        report.append(f"  {doctype}: {count} records")
    report.append("")
    
    report.append("EMPLOYEE MIGRATION:")
    report.append("-" * 30)
    report.append(f"  Total employees in source: {employee_results.get('total', 0)}")
    report.append(f"  Created: {employee_results.get('created', 0)}")
    report.append(f"  Skipped (already exist): {employee_results.get('skipped', 0)}")
    report.append(f"  Errors: {employee_results.get('errors', 0)}")
    report.append("")
    
    if employee_results.get('details'):
        report.append("DETAILS:")
        report.append("-" * 30)
        for detail in employee_results['details']:
            status = detail.get('status', 'unknown')
            name = detail.get('name', 'unknown')
            number = detail.get('number', 'N/A')
            report.append(f"  {name} ({number}): {status}")
    
    report.append("=" * 60)
    return "\n".join(report)


def main():
    """Main migration function"""
    global logger
    logger = setup_logging()
    
    logger.info("=" * 60)
    logger.info("EMPLOYEE MIGRATION SCRIPT STARTED")
    logger.info(f"Source: {SOURCE_SERVER}")
    logger.info(f"Destination: {DEST_SERVER}")
    logger.info("=" * 60)
    
    try:
        # Initialize API clients
        logger.info("Initializing source client...")
        source_client = FrappeAPIClient(SOURCE_SERVER, SOURCE_API_KEY, SOURCE_API_SECRET)
        
        logger.info("Initializing destination client...")
        dest_client = FrappeAPIClient(DEST_SERVER, DEST_API_KEY, DEST_API_SECRET)
        
        # Migrate master data first
        master_results = migrate_master_data(source_client, dest_client)
        
        # Migrate employees
        employee_results = migrate_employees(source_client, dest_client)
        
        # Generate and log summary
        summary = generate_summary_report(master_results, employee_results)
        logger.info(summary)
        
        # Write summary to log file
        with open(LOG_FILE, 'a') as f:
            f.write(summary)
        
        logger.info("Migration completed successfully!")
        
    except Exception as e:
        logger.error(f"Migration failed with error: {e}")
        raise


if __name__ == "__main__":
    main()
