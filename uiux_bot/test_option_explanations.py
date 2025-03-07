import asyncio
import sys
import os
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add bot directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from app.api import openai_client

async def test_option_explanations():
    """Test that lesson content includes explanations for all options"""
    theme = "UI Animation"
    
    # Generate lesson content
    logger.info(f"Generating lesson content for theme: {theme}")
    lesson_data = await openai_client.generate_lesson_content(theme)
    
    # Check if we have explanations for all options
    if 'option_explanations' in lesson_data:
        logger.info(f"Found option_explanations field with {len(lesson_data['option_explanations'])} explanations")
        for i, explanation in enumerate(lesson_data['option_explanations']):
            logger.info(f"Option {i+1} explanation: {explanation[:100]}...")
        
        # Check if we have the right number of explanations
        if len(lesson_data['option_explanations']) == len(lesson_data['quiz_options']):
            logger.info("PASS: Number of explanations matches number of options")
        else:
            logger.error(f"FAIL: Number of explanations ({len(lesson_data['option_explanations'])}) doesn't match number of options ({len(lesson_data['quiz_options'])})")
    else:
        logger.error("FAIL: option_explanations field not found in lesson data")
    
    # Pretty print the entire lesson data structure
    logger.info("Full lesson data structure:")
    print(json.dumps(lesson_data, indent=2))

if __name__ == "__main__":
    asyncio.run(test_option_explanations()) 