#!/usr/bin/env python3
"""
Script to create required tables in Supabase using the Supabase API.
"""

import os
import sys
import logging
from supabase import create_client, Client

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

def create_tables():
    """Create required tables in Supabase."""
    logger.info("Connecting to Supabase...")
    
    try:
        # Initialize Supabase client
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        logger.info("Connected to Supabase")
    except Exception as e:
        logger.error(f"Failed to connect to Supabase: {e}")
        return False
    
    # SQL to create subscribers table
    subscribers_sql = """
    CREATE TABLE IF NOT EXISTS public.subscribers (
        id SERIAL PRIMARY KEY,
        user_id BIGINT UNIQUE NOT NULL,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        preferences JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """
    
    # SQL to create lessons table
    lessons_sql = """
    CREATE TABLE IF NOT EXISTS public.lessons (
        id SERIAL PRIMARY KEY,
        theme TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        quiz_question TEXT,
        quiz_options JSONB,
        correct_option_index INTEGER,
        explanation TEXT,
        option_explanations JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """
    
    # SQL to create user_history table
    user_history_sql = """
    CREATE TABLE IF NOT EXISTS public.user_history (
        id SERIAL PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        recent_themes JSONB DEFAULT '[]'::jsonb,
        recent_lessons JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """
    
    # SQL to create health_status table
    health_status_sql = """
    CREATE TABLE IF NOT EXISTS public.health_status (
        id SERIAL PRIMARY KEY,
        start_time BIGINT NOT NULL,
        last_activity BIGINT NOT NULL,
        lessons_sent INTEGER DEFAULT 0,
        errors INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """
    
    # Try to execute the SQL using the Supabase REST API's rpc function
    try:
        # Create subscribers table
        logger.info("Creating subscribers table...")
        result = client.rpc('exec_sql', {'sql': subscribers_sql}).execute()
        logger.info("Subscribers table created successfully")
    except Exception as e:
        logger.error(f"Failed to create subscribers table: {e}")
    
    try:
        # Create lessons table
        logger.info("Creating lessons table...")
        result = client.rpc('exec_sql', {'sql': lessons_sql}).execute()
        logger.info("Lessons table created successfully")
    except Exception as e:
        logger.error(f"Failed to create lessons table: {e}")
    
    try:
        # Create user_history table
        logger.info("Creating user_history table...")
        result = client.rpc('exec_sql', {'sql': user_history_sql}).execute()
        logger.info("User history table created successfully")
    except Exception as e:
        logger.error(f"Failed to create user_history table: {e}")
    
    try:
        # Create health_status table
        logger.info("Creating health_status table...")
        result = client.rpc('exec_sql', {'sql': health_status_sql}).execute()
        logger.info("Health status table created successfully")
    except Exception as e:
        logger.error(f"Failed to create health_status table: {e}")
    
    logger.info("Table creation process completed.")
    return True

if __name__ == "__main__":
    create_tables() 