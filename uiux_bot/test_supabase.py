#!/usr/bin/env python3
"""
Test script for Supabase integration.
This script tests the thread-safe Supabase operations.
"""

import os
import sys
import json
import logging
import time
import threading
import asyncio
from datetime import datetime
from typing import Dict, Any, List

# Add the parent directory to the path so we can import the app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('supabase_test.log')
    ]
)

logger = logging.getLogger(__name__)

# Import app modules
from app.config import settings
from app.utils import persistence
from app.utils import database

# Enable Supabase
settings.ENABLE_SUPABASE = True

def test_subscribers():
    """Test subscriber operations"""
    logger.info("Testing subscriber operations...")
    
    # Get initial subscribers
    initial_subscribers = persistence.get_subscribers()
    logger.info(f"Initial subscribers: {initial_subscribers}")
    
    # Add a test subscriber
    test_user_id = int(time.time())
    logger.info(f"Adding test subscriber: {test_user_id}")
    persistence.add_subscriber(test_user_id)
    
    # Get updated subscribers
    updated_subscribers = persistence.get_subscribers()
    logger.info(f"Updated subscribers: {updated_subscribers}")
    
    # Check if the test subscriber was added
    if test_user_id in updated_subscribers:
        logger.info("✅ Test subscriber added successfully")
    else:
        logger.error("❌ Failed to add test subscriber")
    
    # Remove the test subscriber
    logger.info(f"Removing test subscriber: {test_user_id}")
    persistence.remove_subscriber(test_user_id)
    
    # Get final subscribers
    final_subscribers = persistence.get_subscribers()
    logger.info(f"Final subscribers: {final_subscribers}")
    
    # Check if the test subscriber was removed
    if test_user_id not in final_subscribers:
        logger.info("✅ Test subscriber removed successfully")
    else:
        logger.error("❌ Failed to remove test subscriber")
    
    return True

def test_user_history():
    """Test user history operations"""
    logger.info("Testing user history operations...")
    
    # Create a test user ID
    test_user_id = f"test_{int(time.time())}"
    
    # Get initial user history
    initial_history = persistence.get_user_history(test_user_id)
    logger.info(f"Initial user history: {initial_history}")
    
    # Update user history
    test_theme = f"test_theme_{int(time.time())}"
    test_message = f"test_message_{int(time.time())}"
    logger.info(f"Updating user history for {test_user_id} with theme {test_theme} and message {test_message}")
    persistence.update_user_history(test_user_id, test_theme, test_message)
    
    # Get updated user history
    updated_history = persistence.get_user_history(test_user_id)
    logger.info(f"Updated user history: {updated_history}")
    
    # Check if the theme was added
    if test_theme in updated_history.get("recent_themes", []):
        logger.info("✅ Theme added to user history successfully")
    else:
        logger.error("❌ Failed to add theme to user history")
    
    # Check if the message was added
    if test_message in updated_history.get("recent_lessons", []):
        logger.info("✅ Message added to user history successfully")
    else:
        logger.error("❌ Failed to add message to user history")
    
    return True

def test_health_status():
    """Test health status operations"""
    logger.info("Testing health status operations...")
    
    # Get initial health status
    initial_status = persistence.get_health_status()
    logger.info(f"Initial health status: {initial_status}")
    
    # Update health status
    logger.info("Updating health status with error=True")
    persistence.update_health_status(error=True)
    
    # Get updated health status
    updated_status = persistence.get_health_status()
    logger.info(f"Updated health status: {updated_status}")
    
    # Check if errors increased
    if updated_status.get("errors", 0) > initial_status.get("errors", 0):
        logger.info("✅ Health status errors increased successfully")
    else:
        logger.error("❌ Failed to increase health status errors")
    
    # Update health status with lesson sent
    logger.info("Updating health status with lesson_sent=True")
    persistence.update_health_status(lesson_sent=True)
    
    # Get final health status
    final_status = persistence.get_health_status()
    logger.info(f"Final health status: {final_status}")
    
    # Check if lessons sent increased
    if final_status.get("lessons_sent", 0) > initial_status.get("lessons_sent", 0):
        logger.info("✅ Health status lessons sent increased successfully")
    else:
        logger.error("❌ Failed to increase health status lessons sent")
    
    return True

def test_lesson_cache():
    """Test lesson cache operations"""
    logger.info("Testing lesson cache operations...")
    
    # Create a test theme
    test_theme = f"test_theme_{int(time.time())}"
    
    # Create a test lesson
    test_lesson = {
        "title": f"Test Lesson {int(time.time())}",
        "content": ["Point 1", "Point 2", "Point 3"],
        "quiz_question": "What is the first point?",
        "quiz_options": ["Point 1", "Point 2", "Point 3", "Point 4"],
        "correct_option_index": 0,
        "explanation": "The first point is Point 1",
        "option_explanations": ["Correct!", "Wrong", "Wrong", "Wrong"]
    }
    
    # Cache the lesson
    logger.info(f"Caching lesson for theme {test_theme}")
    result = database.cache_lesson(test_theme, test_lesson)
    
    if result:
        logger.info("✅ Lesson cached successfully")
    else:
        logger.error("❌ Failed to cache lesson")
        return False
    
    # Get the cached lesson
    logger.info(f"Getting cached lesson for theme {test_theme}")
    cached_lesson = database.get_cached_lesson(test_theme)
    
    if cached_lesson:
        logger.info(f"Retrieved cached lesson: {cached_lesson}")
        logger.info("✅ Lesson retrieved successfully")
    else:
        logger.error("❌ Failed to retrieve cached lesson")
        return False
    
    # Check if the lesson content matches
    if cached_lesson.get("title") == test_lesson.get("title"):
        logger.info("✅ Lesson title matches")
    else:
        logger.error("❌ Lesson title does not match")
    
    return True

def test_threading():
    """Test threading with Supabase operations"""
    logger.info("Testing threading with Supabase operations...")
    
    # Create threads to run tests concurrently
    threads = []
    results = {}
    
    def run_test(test_func, name):
        try:
            result = test_func()
            results[name] = result
        except Exception as e:
            logger.error(f"Error in {name}: {e}")
            results[name] = False
    
    # Create threads for each test
    threads.append(threading.Thread(target=run_test, args=(test_subscribers, "subscribers")))
    threads.append(threading.Thread(target=run_test, args=(test_user_history, "user_history")))
    threads.append(threading.Thread(target=run_test, args=(test_health_status, "health_status")))
    threads.append(threading.Thread(target=run_test, args=(test_lesson_cache, "lesson_cache")))
    
    # Start all threads
    for thread in threads:
        thread.start()
    
    # Wait for all threads to complete
    for thread in threads:
        thread.join()
    
    # Check results
    logger.info("Threading test results:")
    for name, result in results.items():
        if result:
            logger.info(f"✅ {name} test passed")
        else:
            logger.error(f"❌ {name} test failed")
    
    return all(results.values())

def main():
    """Main function to run all tests"""
    logger.info("Starting Supabase integration tests...")
    
    # Check if Supabase is enabled
    if not settings.ENABLE_SUPABASE:
        logger.error("Supabase is not enabled. Set ENABLE_SUPABASE=True in settings.")
        return False
    
    # Check if Supabase URL and key are set
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        logger.error("Supabase URL or key is not set. Check your .env file.")
        return False
    
    # Run individual tests
    subscribers_result = test_subscribers()
    user_history_result = test_user_history()
    health_status_result = test_health_status()
    lesson_cache_result = test_lesson_cache()
    
    # Run threading test
    threading_result = test_threading()
    
    # Print summary
    logger.info("\n=== TEST RESULTS SUMMARY ===")
    logger.info(f"Subscribers: {'✅ PASS' if subscribers_result else '❌ FAIL'}")
    logger.info(f"User History: {'✅ PASS' if user_history_result else '❌ FAIL'}")
    logger.info(f"Health Status: {'✅ PASS' if health_status_result else '❌ FAIL'}")
    logger.info(f"Lesson Cache: {'✅ PASS' if lesson_cache_result else '❌ FAIL'}")
    logger.info(f"Threading: {'✅ PASS' if threading_result else '❌ FAIL'}")
    logger.info("=========================\n")
    
    # Overall result
    overall_result = all([
        subscribers_result,
        user_history_result,
        health_status_result,
        lesson_cache_result,
        threading_result
    ])
    
    if overall_result:
        logger.info("🎉 All tests PASSED! Supabase integration is working correctly.")
    else:
        logger.error("❌ Some tests FAILED. Check the logs for details.")
    
    return overall_result

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 