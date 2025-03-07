#!/usr/bin/env python3
"""
Test script for handlers.py with different content types.
"""

import json
import logging
import asyncio
import sys

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import handlers module
sys.path.append(".")  # Add current directory to path
from app.bot.handlers import sanitize_html_for_telegram
from app.api import openai_client

async def test_content_types():
    """Test handler with different content types."""
    logger.info("Testing content formatting with different content types...")
    
    # Test with a list of bullet points
    lesson_data_list = {
        'title': "Test Lesson Title with *asterisks*",
        'content': [
            "🎨 First bullet point with emoji",
            "💡 Second bullet point with emoji",
            "🚀 Third bullet point with emoji"
        ],
        'quiz_question': "Sample quiz question?",
        'quiz_options': ["Option A", "Option B", "Option C", "Option D"],
        'correct_option_index': 0,
        'explanation': "Sample explanation",
        'option_explanations': [
            "Explanation for A",
            "Explanation for B",
            "Explanation for C", 
            "Explanation for D"
        ]
    }
    
    # Test with a string content
    lesson_data_string = {
        'title': "Test Lesson Title with *asterisks*",
        'content': "This is a sample string content without bullet points.",
        'quiz_question': "Sample quiz question?",
        'quiz_options': ["Option A", "Option B", "Option C", "Option D"],
        'correct_option_index': 0,
        'explanation': "Sample explanation",
        'option_explanations': [
            "Explanation for A",
            "Explanation for B",
            "Explanation for C", 
            "Explanation for D"
        ]
    }
    
    # Process list content
    logger.info("Processing lesson data with list content...")
    process_content_summary(lesson_data_list)
    
    # Process string content
    logger.info("Processing lesson data with string content...")
    process_content_summary(lesson_data_string)
    
    # Get actual content from OpenAI
    logger.info("Getting content from OpenAI...")
    result = await openai_client.generate_lesson_content("UI Animation")
    logger.info(f"OpenAI content type: {type(result['content'])}")
    
    if isinstance(result['content'], list):
        logger.info(f"OpenAI content is a list with {len(result['content'])} items")
        logger.info(f"First item: {result['content'][0]}")
    else:
        logger.info(f"OpenAI content is not a list: {type(result['content'])}")
    
    # Process OpenAI content
    logger.info("Processing OpenAI content...")
    process_content_summary(result)

def process_content_summary(lesson_data):
    """Process content for summary."""
    message_summary = {
        "title": lesson_data['title'],
        "theme": "Test Theme",
        "timestamp": 1234567890,
        "quiz_question": lesson_data['quiz_question']
    }
    
    # Handle content_summary based on type
    if isinstance(lesson_data['content'], list) and lesson_data['content']:
        # For list content, use the first item
        content_sample = lesson_data['content'][0]
        message_summary["content_summary"] = f"{content_sample[:100]}..." if len(content_sample) > 100 else content_sample
    elif isinstance(lesson_data['content'], str):
        # For string content, use the first 100 characters
        message_summary["content_summary"] = f"{lesson_data['content'][:100]}..." if len(lesson_data['content']) > 100 else lesson_data['content']
    else:
        # Fallback for unexpected content type
        message_summary["content_summary"] = "Lesson content available"
    
    logger.info(f"Content type: {type(lesson_data['content'])}")
    logger.info(f"Content summary: {message_summary['content_summary']}")
    
    # Test cleaning up title
    clean_title = lesson_data['title'].replace('*', '')
    logger.info(f"Original title: {lesson_data['title']}")
    logger.info(f"Cleaned title: {clean_title}")
    
    # Format content for display
    if isinstance(lesson_data['content'], list):
        # Join bullet points with newlines
        joined_content = ""
        for i, bullet in enumerate(lesson_data['content']):
            if i > 0:
                joined_content += "\n\n"
            joined_content += bullet
        formatted_content = joined_content
        logger.info(f"Converted list to string with {len(lesson_data['content'])} bullet points")
    else:
        formatted_content = lesson_data['content']
        logger.info("Used content string directly")
    
    # Log the first 100 characters of the formatted content
    logger.info(f"Formatted content (first 100 chars): {formatted_content[:100]}...")

if __name__ == "__main__":
    asyncio.run(test_content_types()) 