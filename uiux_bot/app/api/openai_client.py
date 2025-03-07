"""
OpenAI API client for generating UI/UX lesson content.
"""

import json
import logging
import asyncio
from typing import Dict, Any, Optional
import re
import time
import functools
from functools import lru_cache
import os
import ast

from openai import AsyncOpenAI
import httpx

from app.config import settings

# Configure loggers
logger = logging.getLogger(__name__)

# Create a separate logger for OpenAI responses
openai_logger = logging.getLogger("openai_responses")
openai_logger.setLevel(logging.INFO)

# Ensure data directory exists
os.makedirs("data", exist_ok=True)

# Create file handler for OpenAI responses
openai_handler = logging.FileHandler("data/openai_responses.log")
openai_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
openai_logger.addHandler(openai_handler)

# Set up logger based on settings
if not settings.DETAILED_OPENAI_LOGGING:
    openai_logger.setLevel(logging.WARNING)  # Only log warnings and errors

# Create httpx client with proper SSL verification settings first
http_client = httpx.AsyncClient(
    verify=not settings.DISABLE_SSL_VERIFICATION,
    timeout=httpx.Timeout(connect=5.0, read=30.0, write=30.0, pool=30.0)
)

# Initialize OpenAI client with the custom httpx client
client = AsyncOpenAI(
    api_key=settings.OPENAI_API_KEY,
    http_client=http_client
)

# Simple in-memory cache for lesson content
# Structure: {theme: (timestamp, content)}
_lesson_cache = {}
_cache_ttl = 3600 * 24  # Cache for 24 hours

# Cache for explanation responses
_explanation_cache = {}
_explanation_cache_ttl = 3600 * 24  # Cache for 24 hours


async def generate_lesson_content(theme: str) -> Dict[str, Any]:
    """Generate lesson content using OpenAI API with caching"""
    # Check cache first
    theme_lower = theme.lower().strip()
    if theme_lower in _lesson_cache:
        timestamp, content = _lesson_cache[theme_lower]
        if time.time() - timestamp < _cache_ttl:
            logger.info(f"Using cached lesson for theme: {theme}")
            return content
    
    # If OpenAI is disabled, return fallback lesson immediately
    if settings.DISABLE_OPENAI:
        logger.info("OpenAI API disabled, using fallback lesson")
        return get_fallback_lesson(theme)
        
    retry_count = 0
    max_retries = 2  # Reduced from 3 to 2
    
    while retry_count < max_retries:
        try:
            # Generate the prompt for the API call - simplified to reduce tokens
            prompt = (
                f"Create a short, simple UI/UX design lesson about {theme} for complete beginners, with content formatted as an array of short, engaging pointers. Include:\n"
                f"1) A clear, catchy title about {theme} for beginners\n"
                f"2) Instead of paragraphs, provide 5-7 short, powerful bullet points that:\n"
                f"   - Each start with a relevant emoji\n"
                f"   - Use a conversational, friendly tone (as if talking to a friend)\n"
                f"   - Focus on one key insight or tip per bullet\n"
                f"   - Are immediately actionable for beginners\n"
                f"   - Avoid technical jargon completely\n"
                f"3) A simple quiz question with 4 options\n"
                f"4) An explanation for EACH option (why it's correct or incorrect)\n\n"
                f"Format as JSON with: title, content (containing the bullet points with emojis), quiz_question, quiz_options (array), correct_option_index (0-based), explanation (for the correct answer), and option_explanations (array of explanations for each option)."
            )

            # Make the API call with reduced tokens
            logger.info(f"Sending OpenAI request for lesson on theme: '{theme}' with model: {settings.OPENAI_MODEL}")
            
            # Record the prompt for logging
            system_message = "You are a UI/UX teacher for beginners. Present information as short, engaging bullet points. Each point should start with a relevant emoji. Use a friendly, conversational tone. Format output as valid JSON with explanations for all quiz options."
            if settings.LOG_OPENAI_REQUESTS:
                openai_logger.info(f"LESSON SYSTEM PROMPT: {system_message}")
                openai_logger.info(f"LESSON USER PROMPT: {prompt}")
            
            response = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": system_message
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.5,  # Reduced from 0.7 to 0.5 for more consistency
                timeout=settings.REQUEST_TIMEOUT,
                max_tokens=1000,  # Increased from 800 to accommodate explanations for all options
            )
            
            # Extract and parse the content
            content = response.choices[0].message.content
            
            # Enhanced logging
            finish_reason = response.choices[0].finish_reason
            prompt_tokens = response.usage.prompt_tokens
            completion_tokens = response.usage.completion_tokens
            total_tokens = response.usage.total_tokens
            
            logger.info(f"OpenAI response received - Finish reason: {finish_reason}, Tokens: {prompt_tokens}/{completion_tokens}/{total_tokens}")
            if settings.LOG_OPENAI_RESPONSES:
                openai_logger.info(f"LESSON REQUEST - Theme: '{theme}', Model: {settings.OPENAI_MODEL}, Tokens: {total_tokens}")
                openai_logger.info(f"LESSON RESPONSE - Raw: {content}")
            
            content = content.strip()
            
            # Clean markdown formatting
            if "```" in content:
                content = re.sub(r'```(?:json)?', '', content).strip()
            
            # Try direct JSON parsing
            try:
                lesson_data = json.loads(content)
                
                # Validate required fields
                required_fields = ['title', 'content', 'quiz_question', 'quiz_options', 
                                'correct_option_index', 'explanation']
                for field in required_fields:
                    if field not in lesson_data:
                        raise ValueError(f"Missing required field: {field}")
                
                # Validate quiz_options is a list
                if not isinstance(lesson_data['quiz_options'], list):
                    raise ValueError("quiz_options must be a list")
                
                # Validate correct_option_index is an integer
                if not isinstance(lesson_data['correct_option_index'], int):
                    lesson_data['correct_option_index'] = int(lesson_data['correct_option_index'])
                
                # Check for option_explanations field
                if 'option_explanations' not in lesson_data:
                    # If not provided, create a list with the correct answer explanation and placeholders for others
                    num_options = len(lesson_data['quiz_options'])
                    option_explanations = [""] * num_options
                    correct_index = lesson_data['correct_option_index']
                    
                    # Set the explanation for the correct answer
                    if 0 <= correct_index < num_options:
                        option_explanations[correct_index] = lesson_data['explanation']
                    
                    # Generate basic explanations for incorrect options
                    for i in range(num_options):
                        if i != correct_index and not option_explanations[i]:
                            option_explanations[i] = f"This isn't the best answer for {theme}."
                    
                    lesson_data['option_explanations'] = option_explanations
                    logger.info("Created basic option_explanations array")
                
                # Ensure content is properly formatted
                # If content is a list (array of bullet points), keep it as a list
                # If it's a string that represents a list, try to parse it
                if not isinstance(lesson_data['content'], list) and isinstance(lesson_data['content'], str) and lesson_data['content'].startswith('[') and lesson_data['content'].endswith(']'):
                    try:
                        content_array = ast.literal_eval(lesson_data['content'])
                        if isinstance(content_array, list):
                            lesson_data['content'] = content_array
                            logger.info("Parsed content string as list")
                    except Exception as e:
                        logger.warning(f"Could not parse content string as list: {e}")
                
                # Cache the result
                _lesson_cache[theme_lower] = (time.time(), lesson_data)
                
                logger.info("Successfully parsed lesson data from JSON")
                return lesson_data
                
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"Standard JSON parsing failed: {e}")
                
                # Simplified regex extraction as fallback
                try:
                    # Extract with regex - optimized pattern matching
                    title = re.search(r'"title":\s*"([^"]+)"', content)
                    title = title.group(1) if title else f"Guide to {theme}"
                    
                    content_match = re.search(r'"content":\s*"([^"]+)"', content)
                    lesson_content = content_match.group(1) if content_match else f"Learn about {theme} in UI/UX design."
                    
                    quiz = re.search(r'"quiz_question":\s*"([^"]+)"', content)
                    quiz_question = quiz.group(1) if quiz else f"What's important about {theme}?"
                    
                    options_match = re.search(r'"quiz_options":\s*\[(.*?)\]', content, re.DOTALL)
                    options = []
                    if options_match:
                        options = re.findall(r'"([^"]+)"', options_match.group(1))
                    
                    if not options or len(options) < 2:
                        options = ["Option A", "Option B", "Option C", "Option D"]
                    
                    index_match = re.search(r'"correct_option_index":\s*(\d+)', content)
                    correct_index = int(index_match.group(1)) if index_match else 0
                    if correct_index >= len(options):
                        correct_index = 0
                    
                    explanation = re.search(r'"explanation":\s*"([^"]+)"', content)
                    explanation = explanation.group(1) if explanation else f"This is the right answer for {theme}."
                    
                    # Try to extract option_explanations
                    option_explanations = []
                    option_explanations_match = re.search(r'"option_explanations":\s*\[(.*?)\]', content, re.DOTALL)
                    if option_explanations_match:
                        option_explanations = re.findall(r'"([^"]+)"', option_explanations_match.group(1))
                    
                    # If we don't have enough explanations, create basic ones
                    if len(option_explanations) < len(options):
                        option_explanations = [""] * len(options)
                        option_explanations[correct_index] = explanation
                        
                        # Generate basic explanations for other options
                        for i in range(len(options)):
                            if i != correct_index and not option_explanations[i]:
                                option_explanations[i] = f"This isn't the best answer for {theme}."
                    
                    # Create lesson data
                    lesson_data = {
                        "title": title,
                        "content": lesson_content,
                        "quiz_question": quiz_question,
                        "quiz_options": options,
                        "correct_option_index": correct_index,
                        "explanation": explanation,
                        "option_explanations": option_explanations
                    }
                    
                    # Try to parse content as an array if it looks like one
                    if isinstance(lesson_content, str) and lesson_content.startswith('[') and lesson_content.endswith(']'):
                        try:
                            content_array = ast.literal_eval(lesson_content)
                            if isinstance(content_array, list):
                                lesson_data['content'] = content_array
                                logger.info("Parsed content string as list in regex parser")
                        except Exception as e:
                            logger.warning(f"Could not parse content string as list in regex parser: {e}")
                    
                    # Cache the result
                    _lesson_cache[theme_lower] = (time.time(), lesson_data)
                    
                    logger.info("Successfully extracted lesson data using regex")
                    return lesson_data
                    
                except Exception as regex_e:
                    logger.error(f"Regex extraction failed: {regex_e}")
                
        except Exception as outer_e:
            logger.error(f"API request error (attempt {retry_count+1}/{max_retries}): {outer_e}")
        
        # Increment retry counter
        retry_count += 1
        
        # If we've exhausted retries, return fallback
        if retry_count >= max_retries:
            logger.warning(f"Exhausted {max_retries} retries, returning fallback lesson")
            fallback = get_fallback_lesson(theme)
            # Still cache the fallback to avoid repeated failures
            _lesson_cache[theme_lower] = (time.time(), fallback)
            return fallback
            
        # Wait before retrying - reduced wait time
        await asyncio.sleep(0.5)  # Reduced from 1 second to 0.5 seconds
    
    # Fallback
    fallback = get_fallback_lesson(theme)
    _lesson_cache[theme_lower] = (time.time(), fallback)
    return fallback


# Using lru_cache for the fallback lesson to make it very fast
@lru_cache(maxsize=50)
def get_fallback_lesson(theme: str) -> Dict[str, Any]:
    """Return a simple, beginner-friendly fallback lesson if OpenAI fails"""
    theme_title = theme.title()
    return {
        "title": f"Quick Tips for {theme_title} 🚀",
        "content": [
            f"🔍 <b>Understanding {theme_title}</b> is all about making designs that are easy and enjoyable to use.",
            f"⭐ Think of {theme_title} like a friendly guide that helps people find what they need quickly.",
            f"🎯 Focus on what your users actually need, not just what looks pretty.",
            f"🧩 Keep it simple! Less is often more when it comes to good design.",
            f"👀 Watch real people use your design to see where they get confused.",
            f"✏️ Start with rough sketches before jumping into detailed designs.",
            f"🔄 Remember to test and improve your designs based on feedback!"
        ],
        "quiz_question": f"What's the most important goal when designing with {theme} in mind?",
        "quiz_options": [
            f"Making it look impressive with lots of features",
            f"Making it easy for people to use",
            f"Using the latest design trends",
            f"Using as many colors as possible"
        ],
        "correct_option_index": 1,
        "explanation": f"Making it easy for people to use is the main goal of {theme}. When designing, always think about the people who will use your design and how to make things simpler for them. The best designs often feel invisible because they work so well!",
        "option_explanations": [
            f"While aesthetics matter, prioritizing features over usability can make designs confusing and difficult to use. {theme} design should focus on solving user problems rather than showing off features.",
            f"Correct! Making it easy for people to use is the main goal of {theme}. When designing, always think about the people who will use your design and how to make things simpler for them. The best designs often feel invisible because they work so well!",
            f"Following trends without considering usability can lead to designs that look current but aren't effective. Good {theme} design starts with user needs rather than trends.",
            f"Using many colors without purpose can make interfaces overwhelming and hard to navigate. In {theme} design, colors should be chosen thoughtfully to guide users and improve usability."
        ]
    }


async def generate_custom_explanation(
    theme: str, 
    quiz_question: str, 
    options: list, 
    correct_index: int, 
    user_choice_index: int
) -> str:
    """
    DEPRECATED: This function is maintained for backward compatibility but is no longer needed.
    Explanations for all options are now generated in the initial call.
    
    Args:
        theme: The lesson theme
        quiz_question: The quiz question that was asked
        options: List of answer options
        correct_index: Index of the correct answer
        user_choice_index: Index of the user's selected answer
        
    Returns:
        A simple, beginner-friendly explanation tailored to the user's answer
    """
    logger.warning("DEPRECATED: generate_custom_explanation is no longer needed as explanations are pre-generated")
    
    # Create a cache key
    cache_key = f"{theme}_{correct_index}_{user_choice_index}"
    
    # Check cache first
    if cache_key in _explanation_cache:
        timestamp, explanation = _explanation_cache[cache_key]
        if time.time() - timestamp < _explanation_cache_ttl:
            logger.info(f"Using cached explanation for: {cache_key}")
            return explanation
    
    # For backward compatibility, generate a simple explanation
    if user_choice_index == correct_index:
        explanation = f"That's correct! '{options[correct_index]}' is the right answer because it helps make designs easier to use."
    else:
        explanation = f"The correct answer is '{options[correct_index]}'. This is a better choice because it makes designs more user-friendly. The option you selected might work in some cases, but isn't usually the best approach for beginners."
    
    # Cache the result
    _explanation_cache[cache_key] = (time.time(), explanation)
    return explanation 