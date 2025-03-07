"""
OpenAI API client for generating UI/UX lesson content.
"""

import json
import logging
import asyncio
from typing import Dict, Any, Optional
import re

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
            # Generate the prompt for the API call
            prompt = (
                f"Create a beginner-friendly, easy-to-understand UI/UX design lesson about {theme}. "
                f"Your goal is to share simple, practical insights that newcomers to UI/UX design can easily grasp and apply.\n\n"

                f"Include:\n"
                f"1) A friendly, clear title that explains what beginners will learn (e.g., 'Getting Started with Color Theory: 5 Simple Tips for Beginners' rather than just 'Color Theory')\n"
                f"2) A single 'content' field containing 3-4 well-structured paragraphs of educational content with these elements:\n"
                f"   - Start with a simple introduction explaining why this topic matters to beginners\n"
                f"   - Include basic concepts and straightforward techniques anyone can understand\n"
                f"   - Use everyday examples that make sense to newcomers\n"
                f"   - End with easy first steps beginners can take right away\n"
                f"3) A simple multiple-choice quiz question that checks basic understanding, with 4 options and a friendly explanation for the correct answer.\n\n"
                
                f"The tone should be warm, encouraging, and conversational - like a helpful friend guiding someone through their first steps.\n\n"
                
                f"Format the content using ONLY these Telegram-compatible HTML tags:\n"
                f"- Use <i>text</i> for italic emphasis\n"
                f"- Use <b>text</b> for bold important terms\n"
                f"- Use simple bullet points with hyphens or standard bullet symbol •\n"
                f"- Use numbered lists where appropriate (1. 2. etc)\n"
                f"- Add relevant emojis at the beginning of paragraphs or key points\n"
                f"- Use regular line breaks (\\n) for paragraphs, NOT HTML <br> tags\n"
                f"- Include at least one short, friendly tip formatted with emojis and bold text\n\n"
                
                f"Format the response as a SINGLE JSON object with these fields: title, content (containing all paragraphs), quiz_question, quiz_options (array), correct_option_index (0-based), explanation."
            )

            # Make the API call
            response = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert UI/UX design instructor creating highly engaging, visually appealing educational content. Always format your responses as valid JSON with a SINGLE content field that contains all paragraphs of your lesson. Never repeat the 'content' key multiple times in your JSON."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                timeout=settings.REQUEST_TIMEOUT,
            )
            
            # Extract the content
            content = response.choices[0].message.content
            logger.info(f"OpenAI response received")
            
            # Clean the content for JSON parsing
            content = content.strip()
            
            # Remove any markdown code blocks
            if "```json" in content:
                content = content.replace("```json", "").replace("```", "")
            elif "```" in content:
                content = content.replace("```", "")
            
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
                
                logger.info("Successfully parsed lesson data from JSON")
                return lesson_data
                
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"Standard JSON parsing failed: {e}")
                
                # Try to handle multiple content fields
                try:
                    # Find all content fields
                    content_pattern = r'"content"\s*:\s*"(.*?)(?<!\\)"(?=,|\s*})'
                    content_matches = re.findall(content_pattern, content, re.DOTALL)
                    
                    if len(content_matches) > 1:
                        logger.info(f"Found multiple content fields ({len(content_matches)}), combining them")
                        # Combine content fields
                        combined_content = "\n\n".join([m.replace('"', '\\"') for m in content_matches])
                        
                        # Extract other fields
                        title_match = re.search(r'"title":\s*"([^"]+)"', content)
                        title = title_match.group(1) if title_match else f"Guide to {theme}"
                        
                        quiz_match = re.search(r'"quiz_question":\s*"([^"]+)"', content)
                        quiz_question = quiz_match.group(1) if quiz_match else f"What is important about {theme}?"
                        
                        options_match = re.search(r'"quiz_options":\s*\[(.*?)\]', content, re.DOTALL)
                        options_str = options_match.group(1) if options_match else '"Option A", "Option B", "Option C", "Option D"'
                        
                        index_match = re.search(r'"correct_option_index":\s*(\d+)', content)
                        correct_index = index_match.group(1) if index_match else "0"
                        
                        explanation_match = re.search(r'"explanation":\s*"([^"]+)"', content)
                        explanation = explanation_match.group(1) if explanation_match else f"This is the correct answer because it best represents {theme}."
                        
                        # Create a new JSON string
                        fixed_json = f'''{{
                            "title": "{title}",
                            "content": "{combined_content}",
                            "quiz_question": "{quiz_question}",
                            "quiz_options": [{options_str}],
                            "correct_option_index": {correct_index},
                            "explanation": "{explanation}"
                        }}'''
                        
                        # Parse the fixed JSON
                        lesson_data = json.loads(fixed_json)
                        logger.info("Successfully fixed and parsed multiple content fields")
                        return lesson_data
                    else:
                        # If not multiple content fields, fall through to regex extraction
                        raise ValueError("No multiple content fields found, trying regex extraction")
                        
                except Exception as inner_e:
                    logger.warning(f"Failed to fix multiple content fields: {inner_e}")
                    
                    # Last resort: extract data using regex
                    try:
                        # Extract basic fields with regex
                        title_match = re.search(r'"title":\s*"([^"]+)"', content)
                        title = title_match.group(1) if title_match else f"Guide to {theme}"
                        
                        content_match = re.search(r'"content":\s*"([^"]+)"', content)
                        lesson_content = content_match.group(1) if content_match else f"Learn about {theme} in UI/UX design."
                        
                        quiz_match = re.search(r'"quiz_question":\s*"([^"]+)"', content)
                        quiz_question = quiz_match.group(1) if quiz_match else f"What is important about {theme}?"
                        
                        options_match = re.search(r'"quiz_options":\s*\[(.*?)\]', content, re.DOTALL)
                        options = []
                        if options_match:
                            options_str = options_match.group(1)
                            options = re.findall(r'"([^"]+)"', options_str)
                        
                        if not options or len(options) < 2:
                            options = ["Option A", "Option B", "Option C", "Option D"]
                        
                        index_match = re.search(r'"correct_option_index":\s*(\d+)', content)
                        correct_index = int(index_match.group(1)) if index_match else 0
                        if correct_index >= len(options):
                            correct_index = 0
                        
                        explanation_match = re.search(r'"explanation":\s*"([^"]+)"', content)
                        explanation = explanation_match.group(1) if explanation_match else f"This is the correct answer because it best represents {theme}."
                        
                        # Create lesson data dictionary
                        lesson_data = {
                            "title": title,
                            "content": lesson_content,
                            "quiz_question": quiz_question,
                            "quiz_options": options,
                            "correct_option_index": correct_index,
                            "explanation": explanation,
                        }
                        
                        logger.info("Successfully extracted lesson data using regex")
                        return lesson_data
                        
                    except Exception as regex_e:
                        logger.error(f"Regex extraction failed: {regex_e}")
                        # Continue with retry
                        
        except Exception as outer_e:
            logger.error(f"Error in API request (attempt {retry_count+1}/{max_retries}): {outer_e}")
        
        # Increment retry counter
        retry_count += 1
        
        # If we've exhausted retries, return fallback
        if retry_count >= max_retries:
            logger.warning(f"Exhausted {max_retries} retries, returning fallback lesson")
            return get_fallback_lesson(theme)
            
        # Wait before retrying
        logger.info(f"Waiting before retry {retry_count}/{max_retries}")
        await asyncio.sleep(1)
    
    # Fallback (should never reach here due to the return in the retry check)
    return get_fallback_lesson(theme)


def get_fallback_lesson(theme: str) -> Dict[str, Any]:
    """Return a fallback lesson if OpenAI fails"""
    return {
        "title": f"Essential UI/UX Guide: Understanding {theme.title()}",
        "content": f"<b>Introduction to {theme.title()}</b>\n\n"
                f"Understanding {theme} is essential for creating user-friendly interfaces. Good {theme} practices help users navigate your design intuitively and accomplish their goals efficiently.\n\n"
                f"<b>Key Principles</b>\n\n"
                f"• <b>User-Centered Approach</b>: Always consider the user's needs and expectations when implementing {theme}.\n"
                f"• <b>Consistency</b>: Maintain consistent {theme} throughout your interface to build user trust.\n"
                f"• <b>Simplicity</b>: Keep your {theme} simple and straightforward to reduce cognitive load.\n\n"
                f"<i>Pro Tip</i>: 💡 Regularly test your {theme} with real users to gather valuable feedback and improve the user experience.\n\n"
                f"Start by analyzing successful examples of {theme} in applications you admire, then apply those principles to your own designs.",
        "quiz_question": f"What is the primary strategic benefit of proper {theme} implementation?",
        "quiz_options": [
            f"Increasing developer productivity",
            f"Enhancing user experience and satisfaction",
            f"Reducing server load and bandwidth usage",
            f"Complying with programming language standards"
        ],
        "correct_option_index": 1,
        "explanation": f"Enhancing user experience is the primary benefit of {theme}. While other factors may be affected, the main purpose of UI/UX best practices is to create interfaces that users find intuitive, efficient, and enjoyable."
    }


async def generate_custom_explanation(
    theme: str, 
    quiz_question: str, 
    options: list, 
    correct_index: int, 
    user_choice_index: int
) -> str:
    """
    Generate a custom explanation based on whether the user answered correctly or not.
    
    Args:
        theme: The lesson theme
        quiz_question: The quiz question that was asked
        options: List of answer options
        correct_index: Index of the correct answer
        user_choice_index: Index of the user's selected answer
        
    Returns:
        A detailed explanation tailored to the user's answer
    """
    # If OpenAI is disabled, return the default explanation
    if settings.DISABLE_OPENAI:
        logger.info("OpenAI API disabled, using generic explanation")
        if user_choice_index == correct_index:
            return f"That's correct! {options[correct_index]} is the right answer because it best represents {theme} principles."
        else:
            return f"The correct answer is {options[correct_index]}. This is because it aligns with {theme} best practices. The option you selected, {options[user_choice_index]}, isn't optimal in this context."
    
    retry_count = 0
    max_retries = 2
    
    # Determine if the answer was correct or incorrect
    is_correct = user_choice_index == correct_index
    
    while retry_count < max_retries:
        try:
            if is_correct:
                prompt = (
                    f"The user correctly answered a UI/UX quiz question about {theme}.\n\n"
                    f"Question: {quiz_question}\n"
                    f"Their answer: {options[user_choice_index]} (which is the correct answer)\n\n"
                    f"Write a detailed, encouraging explanation (2-3 sentences) explaining why this answer is correct. "
                    f"Include a UI/UX design best practice or tip related to this concept. "
                    f"Be conversational and positive, affirming their knowledge."
                )
            else:
                prompt = (
                    f"The user incorrectly answered a UI/UX quiz question about {theme}.\n\n"
                    f"Question: {quiz_question}\n"
                    f"Their answer: {options[user_choice_index]}\n"
                    f"The correct answer: {options[correct_index]}\n\n"
                    f"Write a supportive, educational explanation (3-4 sentences) that:\n"
                    f"1) Explains why their answer isn't optimal (without being negative)\n"
                    f"2) Clarifies why the correct answer is best\n"
                    f"3) Offers a specific tip they can remember for next time\n"
                    f"Be encouraging and focused on growth, not pointing out errors."
                )
                
            response = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a supportive UI/UX design educator who provides clear, encouraging, and educational feedback to learners."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=250,  # Limit token count for quick responses
                timeout=settings.REQUEST_TIMEOUT,
            )
            
            explanation = response.choices[0].message.content.strip()
            
            # Add emoji for visual enhancement
            if is_correct:
                explanation = "✅ " + explanation
            else:
                explanation = "💡 " + explanation
                
            return explanation
                
        except Exception as e:
            logger.error(f"Error generating custom explanation: {e}")
            retry_count += 1
            await asyncio.sleep(1)  # Brief delay before retry
    
    # Fallback explanation if OpenAI fails
    if is_correct:
        return f"✅ That's correct! {options[correct_index]} is the right answer. This follows UI/UX best practices for {theme}."
    else:
        return f"💡 The correct answer is {options[correct_index]}. In UI/UX design, this is considered a best practice for {theme}. The option you selected, {options[user_choice_index]}, isn't typically recommended in this context." 