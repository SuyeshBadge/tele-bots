#!/usr/bin/env python3
"""
Migration script to transfer data from file-based storage to Supabase.
"""

import os
import sys
import json
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('migration.log')
    ]
)
logger = logging.getLogger(__name__)

# Add the parent directory to the path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import after path setup - don't import persistence or database modules yet
from app.config import settings

# Force enable Supabase for migration
settings.ENABLE_SUPABASE = True

# Import the direct modules we need without loading the persistence module
from supabase import create_client, Client

# Initialize Supabase client
supabase_client = None
if settings.SUPABASE_URL and settings.SUPABASE_KEY:
    try:
        supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        logger.info("Supabase client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")

# Data files
SUBSCRIBERS_FILE = os.path.join(settings.DATA_DIR, "subscribers.json")
USER_HISTORY_FILE = os.path.join(settings.DATA_DIR, "user_history.json")
HEALTH_FILE = os.path.join(settings.DATA_DIR, "health.json")

def load_subscribers():
    """Load subscribers from file."""
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
    return subscribers

def load_user_history():
    """Load user history from file."""
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
    return user_history

def load_health_status():
    """Load health status from file."""
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
    return health_status

def migrate_subscribers():
    """Migrate subscribers from files to Supabase."""
    logger.info("Starting migration of subscribers...")
    
    # Check if Supabase client is available
    if not supabase_client:
        logger.error("Supabase client not initialized. Cannot migrate subscribers.")
        return False
    
    # Get all subscribers from file
    subscribers = load_subscribers()
    logger.info(f"Found {len(subscribers)} subscribers in local storage")
    
    # Insert subscribers into Supabase
    success_count = 0
    
    for user_id in subscribers:
        try:
            # Check if subscriber already exists
            response = supabase_client.table('subscribers').select('*').eq('user_id', user_id).execute()
            
            if response.data:
                logger.info(f"Subscriber {user_id} already exists in Supabase, skipping")
                success_count += 1
                continue
            
            # Insert new subscriber
            supabase_client.table('subscribers').insert({
                'user_id': user_id,
                'joined_at': datetime.now().isoformat(),
                'last_active': datetime.now().isoformat()
            }).execute()
            
            logger.info(f"Migrated subscriber: {user_id}")
            success_count += 1
            
        except Exception as e:
            logger.error(f"Error migrating subscriber {user_id}: {e}")
    
    logger.info(f"Successfully migrated {success_count}/{len(subscribers)} subscribers")
    return success_count == len(subscribers)

def migrate_user_history():
    """Migrate user history from files to Supabase."""
    logger.info("Starting migration of user history...")
    
    # Check if Supabase client is available
    if not supabase_client:
        logger.error("Supabase client not initialized. Cannot migrate user history.")
        return False
    
    # Get user history from file
    file_history = load_user_history()
    logger.info(f"Found history for {len(file_history)} users")
    
    # Migrate history for each user
    success_count = 0
    
    for user_id, history in file_history.items():
        try:
            if not history or (not history.get('recent_themes') and not history.get('recent_lessons', [])):
                logger.info(f"No history found for user {user_id}, skipping")
                success_count += 1
                continue
            
            # Check if history already exists in Supabase
            response = supabase_client.table('user_history').select('*').eq('user_id', str(user_id)).execute()
            
            if response.data:
                logger.info(f"History for user {user_id} already exists in Supabase, updating")
                
                # Update history
                supabase_client.table('user_history').update({
                    'recent_themes': json.dumps(history.get('recent_themes', [])),
                    'recent_lessons': json.dumps(history.get('recent_lessons', [])),
                    'updated_at': datetime.now().isoformat()
                }).eq('user_id', str(user_id)).execute()
            else:
                # Insert new history
                supabase_client.table('user_history').insert({
                    'user_id': str(user_id),
                    'recent_themes': json.dumps(history.get('recent_themes', [])),
                    'recent_lessons': json.dumps(history.get('recent_lessons', [])),
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }).execute()
            
            logger.info(f"Migrated history for user: {user_id}")
            success_count += 1
            
        except Exception as e:
            logger.error(f"Error migrating history for user {user_id}: {e}")
    
    logger.info(f"Successfully migrated {success_count}/{len(file_history)} user histories")
    return success_count == len(file_history)

def migrate_health_status():
    """Migrate health status from files to Supabase."""
    logger.info("Starting migration of health status...")
    
    # Check if Supabase client is available
    if not supabase_client:
        logger.error("Supabase client not initialized. Cannot migrate health status.")
        return False
    
    try:
        # Get health status from file
        health = load_health_status()
        
        # Check if health status already exists in Supabase
        response = supabase_client.table('health_status').select('*').limit(1).execute()
        
        if response.data:
            logger.info(f"Health status already exists in Supabase, updating")
            
            # Update health status
            supabase_client.table('health_status').update({
                'start_time': health.get('start_time', int(datetime.now().timestamp())),
                'last_activity': health.get('last_activity', int(datetime.now().timestamp())),
                'lessons_sent': health.get('lessons_sent', 0),
                'errors': health.get('errors', 0),
                'updated_at': datetime.now().isoformat()
            }).eq('id', response.data[0].get('id')).execute()
        else:
            # Insert new health status
            supabase_client.table('health_status').insert({
                'id': 1,  # Enforce singleton
                'start_time': health.get('start_time', int(datetime.now().timestamp())),
                'last_activity': health.get('last_activity', int(datetime.now().timestamp())),
                'lessons_sent': health.get('lessons_sent', 0),
                'errors': health.get('errors', 0),
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }).execute()
        
        logger.info("Migrated health status successfully")
        return True
        
    except Exception as e:
        logger.error(f"Error migrating health status: {e}")
        return False

def main():
    """Main migration function."""
    logger.info("Starting migration to Supabase...")
    
    # Check Supabase credentials
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        logger.error("Supabase URL or key not set. Please configure them in your .env file.")
        return
    
    # Migrate data
    subscribers_success = migrate_subscribers()
    history_success = migrate_user_history()
    health_success = migrate_health_status()
    
    # Report results
    logger.info("Migration completed with the following results:")
    logger.info(f"Subscribers: {'SUCCESS' if subscribers_success else 'PARTIAL/FAILED'}")
    logger.info(f"User History: {'SUCCESS' if history_success else 'PARTIAL/FAILED'}")
    logger.info(f"Health Status: {'SUCCESS' if health_success else 'FAILED'}")
    
    if subscribers_success and history_success and health_success:
        logger.info("All data migrated successfully!")
        logger.info("Supabase integration is now ready to use.")
    else:
        logger.warning("Some data failed to migrate. Check the logs for details.")

if __name__ == "__main__":
    main() 