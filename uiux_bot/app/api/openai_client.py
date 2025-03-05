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
                f"Create a visually compelling, professional UI/UX design lesson about {theme}. "
                f"As a world-class UI/UX expert, your goal is to share immediately applicable insights that truly grab attention.\n\n"

                f"Include:\n"
                f"1) A compelling, specific title that clearly communicates the value (e.g., '7 Proven Color Theory Techniques for Higher Conversion Rates' rather than just 'Color Theory')\n"
                f"2) 3-4 well-structured paragraphs of educational content with these elements:\n"
                f"   - Start with a brief, engaging introduction explaining why this topic matters\n"
                f"   - Include specific, actionable techniques and industry best practices\n"
                f"   - Incorporate real-world examples or case studies where possible\n"
                f"   - End with practical takeaways designers can implement immediately\n"
                f"3) A thoughtful multiple-choice quiz question that truly tests understanding, with 4 plausible options and a detailed explanation for the correct answer.\n\n"
                
                f"The tone should be professional, authoritative yet approachable - like an expert mentor speaking directly to the reader.\n\n"
                
                f"Format the content using ONLY these Telegram-compatible HTML tags:\n"
                f"- Use <i>text</i> for italic emphasis\n"
                f"- Use <b>text</b> for bold important terms\n"
                f"- Use simple bullet points with hyphens or standard bullet symbol •\n"
                f"- Use numbered lists where appropriate (1. 2. etc)\n"
                f"- Add relevant emojis at the beginning of paragraphs or key points\n"
                f"- Use regular line breaks (\\n) for paragraphs, NOT HTML <br> tags\n"
                f"- Include at least one short, impactful pullout quote or tip formatted with emojis and bold text\n\n"
                
                f"Format the response as JSON with fields: title, content, quiz_question, quiz_options (array), correct_option_index (0-based), and explanation."
            )


            response = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert UI/UX design instructor creating highly engaging, visually appealing educational content."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],

                temperature=0.7,
                timeout=settings.REQUEST_TIMEOUT,
            )
            
            content = response.choices[0].message.content
            logger.info(f"OpenAI response: {content}")
            # Parse the JSON from the response
            try:
                # Remove any markdown code blocks or formatting if present
                if "```json" in content:
                    content = content.replace("```json", "").replace("```", "")
                elif "```" in content:
                    content = content.replace("```", "")
                
                # Clean the content for JSON parsing
                content = content.strip()
                
                lesson_data = json.loads(content)
                # Ensure all required fields are present
                required_fields = ['title', 'content', 'quiz_question', 'quiz_options', 
                                'correct_option_index', 'explanation']
                for field in required_fields:
                    if field not in lesson_data:
                        raise ValueError(f"Missing required field: {field}")
                
                # Ensure quiz_options is a list
                if not isinstance(lesson_data['quiz_options'], list):
                    raise ValueError("quiz_options must be a list")
                
                # Ensure correct_option_index is an integer
                if not isinstance(lesson_data['correct_option_index'], int):
                    try:
                        lesson_data['correct_option_index'] = int(lesson_data['correct_option_index'])
                    except (ValueError, TypeError):
                        raise ValueError("correct_option_index must be a valid integer")
                
                return lesson_data
            except json.JSONDecodeError:
                # If JSON parsing fails, try to extract data using regex or other means
                logger.error(f"Failed to parse JSON from OpenAI response: {content[:100]}...")
                
                # Try to extract the content more aggressively with a custom parser
                try:
                    import re
                    
                    # Extract title
                    title_match = re.search(r'"title":\s*"([^"]+)"', content)
                    title = title_match.group(1) if title_match else f"Guide to {theme}"
                    
                    # Extract content
                    content_match = re.search(r'"content":\s*"([^"]+)"', content)
                    if not content_match:
                        content_match = re.search(r'"content":\s*\[(.*?)\]', content, re.DOTALL)
                    lesson_content = content_match.group(1) if content_match else f"Learn about {theme} in UI/UX design."
                    
                    # Extract quiz question
                    quiz_match = re.search(r'"quiz_question":\s*"([^"]+)"', content)
                    quiz_question = quiz_match.group(1) if quiz_match else f"What is important about {theme}?"
                    
                    # Extract quiz options
                    options_match = re.search(r'"quiz_options":\s*\[(.*?)\]', content, re.DOTALL)
                    if options_match:
                        options_str = options_match.group(1)
                        options = re.findall(r'"([^"]+)"', options_str)
                        if not options or len(options) < 2:
                            options = ["Option A", "Option B", "Option C", "Option D"]
                    else:
                        options = ["Option A", "Option B", "Option C", "Option D"]
                    
                    # Extract correct index
                    index_match = re.search(r'"correct_option_index":\s*(\d+)', content)
                    correct_index = int(index_match.group(1)) if index_match else 0
                    if correct_index >= len(options):
                        correct_index = 0
                    
                    # Extract explanation
                    explanation_match = re.search(r'"explanation":\s*"([^"]+)"', content)
                    explanation = explanation_match.group(1) if explanation_match else f"This is the correct answer because it best represents {theme}."
                    
                    # Build the lesson data
                    lesson_data = {
                        "title": title,
                        "content": lesson_content,
                        "quiz_question": quiz_question,
                        "quiz_options": options,
                        "correct_option_index": correct_index,
                        "explanation": explanation
                    }
                    
                    logger.info("Successfully extracted lesson data using regex parser")
                    return lesson_data
                except Exception as e:
                    logger.error(f"Regex extraction failed: {e}")
                
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