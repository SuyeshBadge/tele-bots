#!/usr/bin/env python3
"""
Script to check data in Supabase tables.
This is useful for verifying the tables exist and contain the expected data.
"""

import os
import sys
import logging
import json

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add the parent directory to the path to import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import settings to get Supabase credentials
from app.config import settings
from supabase import create_client, Client

def check_tables():
    """
    Check tables in Supabase for data.
    """
    logger.info("Connecting to Supabase...")
    
    try:
        # Initialize Supabase client
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        logger.info("Connected to Supabase")
    except Exception as e:
        logger.error(f"Failed to connect to Supabase: {e}")
        return False
    
    try:
        # Check subscribers table
        logger.info("Checking subscribers table...")
        try:
            response = client.table('subscribers').select('*').execute()
            logger.info(f"Found {len(response.data)} subscribers")
            if response.data:
                logger.info(f"Sample subscriber: {response.data[0]}")
        except Exception as e:
            logger.error(f"Error checking subscribers table: {e}")
        
        # Check user_history table
        logger.info("Checking user_history table...")
        try:
            response = client.table('user_history').select('*').execute()
            logger.info(f"Found {len(response.data)} user history records")
            if response.data:
                logger.info(f"Sample user history: {response.data[0]}")
        except Exception as e:
            logger.error(f"Error checking user_history table: {e}")
        
        # Check health_status table
        logger.info("Checking health_status table...")
        try:
            response = client.table('health_status').select('*').execute()
            logger.info(f"Found {len(response.data)} health status records")
            if response.data:
                logger.info(f"Health status: {response.data[0]}")
        except Exception as e:
            logger.error(f"Error checking health_status table: {e}")
        
        # Check lessons table
        logger.info("Checking lessons table...")
        try:
            response = client.table('lessons').select('*').execute()
            logger.info(f"Found {len(response.data)} lesson records")
            if response.data:
                logger.info(f"Sample lesson: theme={response.data[0]['theme']}, title={response.data[0]['title']}")
        except Exception as e:
            logger.error(f"Error checking lessons table: {e}")
        
        logger.info("Table check complete")
        return True
    except Exception as e:
        logger.error(f"Error checking tables: {e}")
        return False

if __name__ == "__main__":
    if check_tables():
        logger.info("Successfully checked tables in Supabase")
    else:
        logger.error("Failed to check tables in Supabase")
        sys.exit(1) 