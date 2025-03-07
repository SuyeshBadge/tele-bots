#!/usr/bin/env python3
"""
Script to check if tables exist in Supabase.
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

def check_tables():
    """Check if tables exist in Supabase."""
    logger.info("Checking tables in Supabase...")
    
    # Initialize Supabase client
    try:
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        logger.info("Connected to Supabase")
    except Exception as e:
        logger.error(f"Failed to connect to Supabase: {e}")
        return False
    
    # Check if tables exist by running a direct SQL query
    try:
        # Query to get all tables in the public schema
        response = client.rpc('get_tables').execute()
        logger.info(f"Response from get_tables RPC: {response}")
        return True
    except Exception as e:
        logger.error(f"Error checking tables: {e}")
        
        # Try direct query
        try:
            # Prepare a query to list tables
            query = """
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            """
            
            # Execute the query to see the result
            logger.info("Attempting direct SQL query...")
            response = client.rpc('exec_sql', {'query': query}).execute()
            logger.info(f"Response from direct SQL query: {response}")
            return True
        except Exception as direct_e:
            logger.error(f"Error with direct query: {direct_e}")
            return False

if __name__ == "__main__":
    if check_tables():
        logger.info("Successfully checked tables.")
    else:
        logger.error("Failed to check tables.")
        sys.exit(1) 