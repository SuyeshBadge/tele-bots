"""
OpenAI API client for generating UI/UX lesson content.
"""

import json
import logging
import asyncio
from typing import Dict, Any, Optional

import openai

from app.config import settings

# Configure logger
logger = logging.getLogger(__name__)

# Set OpenAI API key
openai.api_key = settings.OPENAI_API_KEY


async def generate_lesson_content(theme: str) -> Dict[str, Any]:
    """Generate lesson content using OpenAI API"""
    retry_count = 0
    max_retries = 3
    
    while retry_count < max_retries:
        try:
            prompt = (
                f"Create a short, educational UI/UX design lesson about {theme}. "
                f"Include: 1) A title, 2) 3-4 paragraphs of educational content with practical tips, "
                f"3) A multiple-choice quiz question with 4 options and explanation for the correct answer. "
                f"Format the response as JSON with fields: title, content, quiz_question, quiz_options (array), "
                f"correct_option_index (0-based), and explanation."
            )
            
            response = await openai.ChatCompletion.acreate(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": "You are a UI/UX design instructor creating educational content."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                timeout=settings.REQUEST_TIMEOUT,
            )
            
            content = response.choices[0].message.content
            # Parse the JSON from the response
            try:
                lesson_data = json.loads(content)
                # Ensure all required fields are present
                required_fields = ['title', 'content', 'quiz_question', 'quiz_options', 
                                'correct_option_index', 'explanation']
                for field in required_fields:
                    if field not in lesson_data:
                        raise ValueError(f"Missing required field: {field}")
                
                return lesson_data
            except json.JSONDecodeError:
                # If JSON parsing fails, try to extract data using regex or other means
                # For simplicity, we'll return a default lesson
                logger.error(f"Failed to parse JSON from OpenAI response: {content[:100]}...")
                retry_count += 1
                if retry_count >= max_retries:
                    return get_fallback_lesson(theme)
                continue
                
        except Exception as e:
            logger.error(f"Error generating lesson content (attempt {retry_count+1}/{max_retries}): {e}")
            retry_count += 1
            if retry_count >= max_retries:
                return get_fallback_lesson(theme)
            # Wait before retrying
            await asyncio.sleep(1)
    
    return get_fallback_lesson(theme)


def get_fallback_lesson(theme: str) -> Dict[str, Any]:
    """Get fallback lesson in case API fails"""
    return {
        "title": f"Understanding {theme} in UI/UX Design",
        "content": (
            f"Today we'll explore {theme} in UI/UX design.\n\n"
            f"This is a key concept that helps designers create more effective and user-friendly interfaces. "
            f"When implementing {theme}, remember to consider the user's needs and context.\n\n"
            f"Best practices include testing with real users, iterating based on feedback, and staying "
            f"up-to-date with industry standards."
        ),
        "quiz_question": f"What is a key benefit of proper {theme} implementation?",
        "quiz_options": [
            "Making the designer's job easier",
            "Improving user experience and satisfaction",
            "Reducing development costs",
            "Increasing website loading speed"
        ],
        "correct_option_index": 1,
        "explanation": f"Proper implementation of {theme} primarily aims to improve the user experience and satisfaction, which leads to better product adoption and user retention."
    } 