#!/usr/bin/env python3
"""
Script to directly migrate data to Supabase.
"""

import os
import sys
import json
import time
import logging
from datetime import datetime
from typing import Dict, Any, List

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add the parent directory to the path to import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import settings to get Supabase credentials
from app.config import settings
from supabase import create_client, Client

# Data files
SUBSCRIBERS_FILE = os.path.join(settings.DATA_DIR, "subscribers.json")
USER_HISTORY_FILE = os.path.join(settings.DATA_DIR, "user_history.json")
HEALTH_FILE = os.path.join(settings.DATA_DIR, "health.json")

def load_data():
    """Load all data from files."""
    # Load subscribers
    subscribers = []
    try:
        if os.path.exists(SUBSCRIBERS_FILE):
            with open(SUBSCRIBERS_FILE, "r") as f:
                subscribers = json.load(f)
                logger.info(f"Loaded {len(subscribers)} subscribers from file")
        else:
            logger.warning(f"Subscribers file not found: {SUBSCRIBERS_FILE}")
    except Exception as e:
        logger.error(f"Error loading subscribers: {e}")
    
    # Load user history
    user_history = {}
    try:
        if os.path.exists(USER_HISTORY_FILE):
            with open(USER_HISTORY_FILE, "r") as f:
                user_history = json.load(f)
                logger.info(f"Loaded user history for {len(user_history)} users")
        else:
            logger.warning(f"User history file not found: {USER_HISTORY_FILE}")
    except Exception as e:
        logger.error(f"Error loading user history: {e}")
    
    # Load health status
    health_status = {
        "start_time": int(datetime.now().timestamp()),
        "last_activity": int(datetime.now().timestamp()),
        "lessons_sent": 0,
        "errors": 0
    }
    try:
        if os.path.exists(HEALTH_FILE):
            with open(HEALTH_FILE, "r") as f:
                health_status = json.load(f)
                logger.info(f"Loaded health status: {health_status}")
        else:
            logger.warning(f"Health status file not found: {HEALTH_FILE}")
    except Exception as e:
        logger.error(f"Error loading health status: {e}")
    
    return subscribers, user_history, health_status

def check_table_exists(client, table_name):
    """Check if a table exists by attempting to query it."""
    try:
        client.table(table_name).select('count').limit(1).execute()
        return True
    except Exception as e:
        if "'code': '42P01'" in str(e) or "relation" in str(e) and "does not exist" in str(e):
            return False
        # If it's some other error, assume the table exists but there's a different issue
        logger.warning(f"Error checking {table_name} table, assuming it exists: {e}")
        return True

def migrate_data():
    """Migrate data to Supabase."""
    logger.info("Starting direct migration to Supabase...")
    
    # Initialize Supabase client
    try:
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        logger.info("Connected to Supabase")
    except Exception as e:
        logger.error(f"Failed to connect to Supabase: {e}")
        return False
    
    # Load data from files
    subscribers, user_history, health_status = load_data()
    
    # Check if tables exist
    subscribers_exists = check_table_exists(client, 'subscribers')
    user_history_exists = check_table_exists(client, 'user_history')
    health_status_exists = check_table_exists(client, 'health_status')
    
    logger.info(f"Table status: subscribers={subscribers_exists}, user_history={user_history_exists}, health_status={health_status_exists}")
    
    # Migrate subscribers
    subscribers_success = True
    if subscribers_exists:
        for user_id in subscribers:
            try:
                # Check if subscriber already exists
                response = client.table('subscribers').select('*').eq('user_id', user_id).execute()
                
                if not response.data:
                    # Insert new subscriber
                    client.table('subscribers').insert({
                        'user_id': user_id,
                        'joined_at': datetime.now().isoformat(),
                        'last_active': datetime.now().isoformat()
                    }).execute()
                    logger.info(f"Migrated subscriber: {user_id}")
                else:
                    logger.info(f"Subscriber {user_id} already exists, skipping")
            except Exception as e:
                logger.error(f"Error migrating subscriber {user_id}: {e}")
                subscribers_success = False
    else:
        logger.error("Subscribers table does not exist. Please create it first using the SQL in create_tables.sql")
        subscribers_success = False
    
    # Migrate user history
    history_success = True
    if user_history_exists:
        for user_id, history in user_history.items():
            try:
                # Check if history already exists
                response = client.table('user_history').select('*').eq('user_id', str(user_id)).execute()
                
                if not response.data:
                    # Insert history
                    client.table('user_history').insert({
                        'user_id': str(user_id),
                        'recent_themes': json.dumps(history.get('recent_themes', [])),
                        'recent_lessons': json.dumps(history.get('recent_lessons', []))
                    }).execute()
                    logger.info(f"Migrated history for user: {user_id}")
                else:
                    logger.info(f"History for user {user_id} already exists, skipping")
            except Exception as e:
                logger.error(f"Error migrating history for user {user_id}: {e}")
                history_success = False
    else:
        logger.error("User history table does not exist. Please create it first using the SQL in create_tables.sql")
        history_success = False
    
    # Migrate health status
    health_success = True
    if health_status_exists:
        try:
            # Insert or update health status
            response = client.table('health_status').select('*').limit(1).execute()
            
            if response.data:
                # Update health status
                client.table('health_status').update({
                    'start_time': health_status.get('start_time', int(time.time())),
                    'last_activity': health_status.get('last_activity', int(time.time())),
                    'lessons_sent': health_status.get('lessons_sent', 0),
                    'errors': health_status.get('errors', 0)
                }).eq('id', response.data[0].get('id', 1)).execute()
                logger.info("Updated health status")
            else:
                # Insert health status
                client.table('health_status').insert({
                    'id': 1,
                    'start_time': health_status.get('start_time', int(time.time())),
                    'last_activity': health_status.get('last_activity', int(time.time())),
                    'lessons_sent': health_status.get('lessons_sent', 0),
                    'errors': health_status.get('errors', 0)
                }).execute()
                logger.info("Inserted health status")
        except Exception as e:
            logger.error(f"Error migrating health status: {e}")
            health_success = False
    else:
        logger.error("Health status table does not exist. Please create it first using the SQL in create_tables.sql")
        health_success = False
    
    # Report results
    logger.info("Migration completed with the following results:")
    logger.info(f"Subscribers: {'SUCCESS' if subscribers_success else 'PARTIAL/FAILED'}")
    logger.info(f"User History: {'SUCCESS' if history_success else 'PARTIAL/FAILED'}")
    logger.info(f"Health Status: {'SUCCESS' if health_success else 'FAILED'}")
    
    if subscribers_success and history_success and health_success:
        logger.info("All data migrated successfully!")
        logger.info("Supabase integration is now ready to use.")
        return True
    else:
        logger.warning("Some data failed to migrate. Check the logs for details.")
        return False

if __name__ == "__main__":
    migrate_data() 