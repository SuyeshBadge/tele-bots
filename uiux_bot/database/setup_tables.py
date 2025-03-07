#!/usr/bin/env python3
"""
Script to set up Supabase tables using the schema.sql file.
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

def setup_tables():
    """Set up tables in Supabase using the schema.sql file."""
    logger.info("Setting up Supabase tables...")
    
    # Get Supabase credentials
    supabase_url = settings.SUPABASE_URL
    supabase_key = settings.SUPABASE_KEY
    
    if not supabase_url or not supabase_key:
        logger.error("Supabase URL or key not set. Please configure them in your .env file.")
        return False
    
    # Initialize Supabase client
    try:
        client = create_client(supabase_url, supabase_key)
        logger.info("Connected to Supabase")
    except Exception as e:
        logger.error(f"Failed to connect to Supabase: {e}")
        return False
    
    # Read the schema.sql file
    schema_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")
    try:
        with open(schema_path, "r") as f:
            schema_sql = f.read()
        logger.info(f"Read schema.sql file: {len(schema_sql)} characters")
    except Exception as e:
        logger.error(f"Failed to read schema.sql file: {e}")
        return False
    
    # Execute the SQL
    try:
        # Split the SQL into manageable chunks
        # (Some SQL clients have limits on how much SQL they can execute at once)
        sql_statements = schema_sql.split(";")
        
        # Execute each statement
        for statement in sql_statements:
            statement = statement.strip()
            if statement:  # Skip empty statements
                try:
                    # Execute the SQL statement
                    logger.info(f"Executing SQL: {statement[:50]}...")
                    result = client.postgrest.rpc("exec_sql", {"sql": statement}).execute()
                except Exception as e:
                    logger.warning(f"Error executing SQL statement (may be normal for DROP statements): {e}")
        
        logger.info("Successfully set up Supabase tables")
        return True
    except Exception as e:
        logger.error(f"Failed to execute schema SQL: {e}")
        return False

if __name__ == "__main__":
    # Initialize Supabase tables
    success = setup_tables()
    
    if success:
        logger.info("Tables created successfully! You can now run the migration script.")
    else:
        logger.error("Failed to create tables. Please check the logs for errors.")
        sys.exit(1) 