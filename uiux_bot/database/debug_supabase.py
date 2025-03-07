#!/usr/bin/env python3
"""
Comprehensive diagnostic tool for testing Supabase integration.
This script performs individual operations to identify specific issues.
"""

import os
import sys
import json
import logging
import asyncio
import time
from datetime import datetime
from typing import Dict, Any, List, Optional

# Configure logging with more detail
logging.basicConfig(
    level=logging.DEBUG,  # More detailed logging level
    format='%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('supabase_debug.log')
    ]
)
logger = logging.getLogger(__name__)

# Add the parent directory to the path to import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import settings to get Supabase credentials
from app.config import settings
from supabase import create_client, Client

def get_supabase_client() -> Optional[Client]:
    """Get a Supabase client with detailed connection logging."""
    logger.info(f"SUPABASE_URL: {settings.SUPABASE_URL[:15]}... (truncated)")
    logger.info(f"ENABLE_SUPABASE: {settings.ENABLE_SUPABASE}")
    
    try:
        # Initialize Supabase client
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        logger.info("Connected to Supabase successfully")
        return client
    except Exception as e:
        logger.error(f"Failed to connect to Supabase: {e}", exc_info=True)
        return None

async def test_subscribers_table(client: Client):
    """Test operations on the subscribers table."""
    logger.info("Testing subscribers table operations...")
    
    try:
        # Test reading from subscribers table
        logger.info("Reading subscribers...")
        response = client.table('subscribers').select('*').execute()
        logger.info(f"Found {len(response.data)} subscribers")
        
        # Test inserting a test subscriber
        test_user_id = int(time.time())  # Use timestamp as test user ID
        logger.info(f"Inserting test subscriber with ID {test_user_id}...")
        client.table('subscribers').insert({
            'user_id': test_user_id,
            'joined_at': datetime.now().isoformat(),
            'last_active': datetime.now().isoformat()
        }).execute()
        
        # Verify the subscriber was inserted
        response = client.table('subscribers').select('*').eq('user_id', test_user_id).execute()
        
        if response.data:
            logger.info(f"Test subscriber {test_user_id} was inserted successfully")
        else:
            logger.error(f"Failed to find test subscriber {test_user_id} after insertion")
        
        # Clean up - delete the test subscriber
        logger.info(f"Cleaning up - deleting test subscriber {test_user_id}...")
        client.table('subscribers').delete().eq('user_id', test_user_id).execute()
        logger.info("Subscribers table test completed")
        return True
    except Exception as e:
        logger.error(f"Error testing subscribers table: {e}", exc_info=True)
        return False

async def test_user_history_table(client: Client):
    """Test operations on the user_history table."""
    logger.info("Testing user_history table operations...")
    
    try:
        # Test reading from user_history table
        logger.info("Reading user history...")
        response = client.table('user_history').select('*').execute()
        logger.info(f"Found {len(response.data)} user history records")
        
        # Test inserting a test user history record
        test_user_id = f"test_{int(time.time())}"  # Use timestamp as test user ID
        logger.info(f"Inserting test user history for ID {test_user_id}...")
        
        # Prepare test data
        recent_themes = ["Test Theme 1", "Test Theme 2"]
        recent_lessons = ["Test Lesson 1", "Test Lesson 2"]
        
        client.table('user_history').insert({
            'user_id': test_user_id,
            'recent_themes': json.dumps(recent_themes),
            'recent_lessons': json.dumps(recent_lessons)
        }).execute()
        
        # Verify the record was inserted
        response = client.table('user_history').select('*').eq('user_id', test_user_id).execute()
        
        if response.data:
            logger.info(f"Test user history for {test_user_id} was inserted successfully")
            logger.info(f"Retrieved data: {response.data[0]}")
            
            # Test parsing the JSON data
            try:
                retrieved_themes = json.loads(response.data[0]['recent_themes'])
                retrieved_lessons = json.loads(response.data[0]['recent_lessons'])
                logger.info(f"Successfully parsed JSON data: themes={retrieved_themes}, lessons={retrieved_lessons}")
            except Exception as e:
                logger.error(f"Error parsing JSON data: {e}", exc_info=True)
        else:
            logger.error(f"Failed to find test user history for {test_user_id} after insertion")
        
        # Clean up - delete the test record
        logger.info(f"Cleaning up - deleting test user history for {test_user_id}...")
        client.table('user_history').delete().eq('user_id', test_user_id).execute()
        logger.info("User history table test completed")
        return True
    except Exception as e:
        logger.error(f"Error testing user_history table: {e}", exc_info=True)
        return False

async def test_health_status_table(client: Client):
    """Test operations on the health_status table."""
    logger.info("Testing health_status table operations...")
    
    try:
        # Test reading from health_status table
        logger.info("Reading health status...")
        response = client.table('health_status').select('*').execute()
        logger.info(f"Found {len(response.data)} health status records")
        
        # Test updating the health status
        if response.data:
            health_id = response.data[0]['id']
            current_time = int(time.time())
            
            logger.info(f"Updating health status record {health_id}...")
            client.table('health_status').update({
                'last_activity': current_time
            }).eq('id', health_id).execute()
            
            # Verify the update
            response = client.table('health_status').select('*').eq('id', health_id).execute()
            if response.data and response.data[0]['last_activity'] == current_time:
                logger.info("Health status was updated successfully")
            else:
                logger.error("Failed to update health status or verification failed")
        else:
            # Create a new health status record
            logger.info("No health status found, creating a new record...")
            current_time = int(time.time())
            
            client.table('health_status').insert({
                'start_time': current_time,
                'last_activity': current_time,
                'lessons_sent': 0,
                'errors': 0
            }).execute()
            
            # Verify the insertion
            response = client.table('health_status').select('*').execute()
            if response.data:
                logger.info("Health status was created successfully")
            else:
                logger.error("Failed to create health status or verification failed")
        
        logger.info("Health status table test completed")
        return True
    except Exception as e:
        logger.error(f"Error testing health_status table: {e}", exc_info=True)
        return False

async def test_lessons_table(client: Client):
    """Test operations on the lessons table."""
    logger.info("Testing lessons table operations...")
    
    try:
        # Test reading from lessons table
        logger.info("Reading lessons...")
        response = client.table('lessons').select('*').execute()
        logger.info(f"Found {len(response.data)} lesson records")
        
        # Test inserting a test lesson
        test_theme = f"test_theme_{int(time.time())}"
        test_title = f"Test Lesson {int(time.time())}"
        
        logger.info(f"Inserting test lesson with theme '{test_theme}'...")
        
        # Prepare test data
        test_content = ["Point 1", "Point 2", "Point 3"]
        test_options = ["Option A", "Option B", "Option C", "Option D"]
        test_explanations = ["Explanation A", "Explanation B", "Explanation C", "Explanation D"]
        
        client.table('lessons').insert({
            'theme': test_theme,
            'title': test_title,
            'content': json.dumps(test_content),
            'quiz_question': 'Test Question?',
            'quiz_options': json.dumps(test_options),
            'correct_option_index': 0,
            'explanation': 'Test Explanation',
            'option_explanations': json.dumps(test_explanations)
        }).execute()
        
        # Verify the lesson was inserted
        response = client.table('lessons').select('*').eq('theme', test_theme).execute()
        
        if response.data:
            logger.info(f"Test lesson with theme '{test_theme}' was inserted successfully")
            logger.info(f"Retrieved data: theme={response.data[0]['theme']}, title={response.data[0]['title']}")
            
            # Test parsing the JSON data
            try:
                retrieved_content = json.loads(response.data[0]['content'])
                retrieved_options = json.loads(response.data[0]['quiz_options'])
                retrieved_explanations = json.loads(response.data[0]['option_explanations'])
                logger.info(f"Successfully parsed JSON data: content={retrieved_content}, options={retrieved_options}")
            except Exception as e:
                logger.error(f"Error parsing JSON data: {e}", exc_info=True)
        else:
            logger.error(f"Failed to find test lesson with theme '{test_theme}' after insertion")
        
        # Clean up - delete the test lesson
        logger.info(f"Cleaning up - deleting test lesson with theme '{test_theme}'...")
        client.table('lessons').delete().eq('theme', test_theme).execute()
        logger.info("Lessons table test completed")
        return True
    except Exception as e:
        logger.error(f"Error testing lessons table: {e}", exc_info=True)
        return False

async def run_tests():
    """Run all Supabase diagnostic tests."""
    logger.info("Starting Supabase diagnostic tests...")
    
    client = get_supabase_client()
    if not client:
        logger.error("Failed to initialize Supabase client, aborting tests")
        return
    
    # Test all tables
    subscribers_result = await test_subscribers_table(client)
    user_history_result = await test_user_history_table(client)
    health_status_result = await test_health_status_table(client)
    lessons_result = await test_lessons_table(client)
    
    # Print summary
    logger.info("\n=== TEST RESULTS SUMMARY ===")
    logger.info(f"Subscribers Table: {'PASS' if subscribers_result else 'FAIL'}")
    logger.info(f"User History Table: {'PASS' if user_history_result else 'FAIL'}")
    logger.info(f"Health Status Table: {'PASS' if health_status_result else 'FAIL'}")
    logger.info(f"Lessons Table: {'PASS' if lessons_result else 'FAIL'}")
    logger.info("=========================\n")
    
    if subscribers_result and user_history_result and health_status_result and lessons_result:
        logger.info("All tests PASSED! Supabase integration looks good.")
    else:
        logger.error("Some tests FAILED. Check the logs for detailed error messages.")

if __name__ == "__main__":
    asyncio.run(run_tests()) 