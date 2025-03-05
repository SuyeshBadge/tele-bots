"""
OpenAI API client for generating UI/UX lesson content.
"""

import json
import logging
import asyncio
from typing import Dict, Any, Optional

from openai import AsyncOpenAI

from app.config import settings

# Configure logger
logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def generate_lesson_content(theme: str) -> Dict[str, Any]:
    """Generate lesson content using OpenAI API"""
    # If OpenAI is disabled, return fallback lesson immediately
    if settings.DISABLE_OPENAI:
        logger.info("OpenAI API disabled, using fallback lesson")
        return get_fallback_lesson(theme)
        
    retry_count = 0
    max_retries = 3
    
    while retry_count < max_retries:
        try:
            prompt = (
                f"Create a professional, concise UI/UX design lesson about {theme}. "
                f"Include: 1) A compelling title, 2) 3-4 paragraphs of educational content with practical, industry-standard tips and best practices, "
                f"3) A thoughtful multiple-choice quiz question with 4 options and a detailed explanation for the correct answer. "
                f"The tone should be professional, authoritative yet approachable. "
                f"Format the response as JSON with fields: title, content, quiz_question, quiz_options (array), "
                f"correct_option_index (0-based), and explanation."
            )
            
            response = await client.chat.completions.create(
                model="gpt-3.5-turbo",  # Explicitly using gpt-3.5-turbo instead of settings.OPENAI_MODEL
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
        "title": f"Professional Guide to {theme} in UI/UX Design",
        "content": (
            f"Today we're examining {theme} as a critical element in modern UI/UX design practice.\n\n"
            f"This fundamental concept enables designers to create more effective, intuitive interfaces that meet both user and business objectives. "
            f"When implementing {theme} in your projects, consider contextual user needs, accessibility requirements, and overall product strategy.\n\n"
            f"Industry best practices include conducting thorough user testing, implementing evidence-based iterations, and maintaining alignment with "
            f"current design standards while balancing innovation and familiarity."
        ),
        "quiz_question": f"What is the primary strategic benefit of proper {theme} implementation?",
        "quiz_options": [
            "Simplifying the designer's workflow",
            "Enhancing user experience and driving engagement metrics",
            "Reducing overall development resource requirements",
            "Improving technical performance metrics"
        ],
        "correct_option_index": 1,
        "explanation": f"Strategic implementation of {theme} primarily elevates the user experience and increases engagement metrics, which directly contributes to improved user retention, product adoption, and ultimately business success."
    } 