"""
Unsplash API client for fetching UI/UX related images.
"""

import os
import random
import logging
import ssl
import certifi
from typing import Dict, Optional, Any

import aiohttp

from app.config import settings

# Configure logger
logger = logging.getLogger(__name__)


async def get_image_for_lesson(theme: str) -> Optional[Dict[str, Any]]:
    """Get a relevant image for the lesson using Unsplash API with local fallback"""
    # First try Unsplash if API key is available
    if settings.UNSPLASH_API_KEY:
        try:
            logger.info(f"Fetching image from Unsplash for theme: {theme}")
            search_term = f"ui ux {theme} design"
            url = f"https://api.unsplash.com/search/photos"
            params = {
                "query": search_term,
                "per_page": 1,
                "orientation": "landscape",
            }
            headers = {"Authorization": f"Client-ID {settings.UNSPLASH_API_KEY}"}
            
            # Create SSL context with proper certificate verification
            ssl_context = ssl.create_default_context(cafile=certifi.where())
            
            # Set verify_ssl based on environment (can be made configurable in settings)
            verify_ssl = not getattr(settings, 'DISABLE_SSL_VERIFICATION', False)
            
            connector = aiohttp.TCPConnector(ssl=ssl_context if verify_ssl else False)
            async with aiohttp.ClientSession(connector=connector) as session:
                async with session.get(url, headers=headers, params=params, timeout=settings.REQUEST_TIMEOUT) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get("results") and len(data["results"]) > 0:
                            image_url = data["results"][0]["urls"]["regular"]
                            # Get photographer attribution
                            photographer = data["results"][0]["user"]["name"]
                            attribution = f"Photo by {photographer} on Unsplash"
                            return {"url": image_url, "attribution": attribution}
        except Exception as e:
            logger.error(f"Error fetching Unsplash image: {e}")
    
    # Fallback to local images
    return get_local_fallback_image()


def get_local_fallback_image() -> Optional[Dict[str, Any]]:
    """Get a local fallback image if available"""
    try:
        valid_extensions = ('.jpg', '.jpeg', '.png', '.gif')
        fallback_images = [f for f in os.listdir(settings.FALLBACK_IMAGES_DIR) 
                          if f.lower().endswith(valid_extensions)]
        
        if fallback_images:
            image_file = random.choice(fallback_images)
            image_path = os.path.join(settings.FALLBACK_IMAGES_DIR, image_file)
            logger.info(f"Using local fallback image: {image_path}")
            return {"file": image_path, "attribution": "Local image"}
        else:
            logger.warning("No fallback images available")
            return None
    except Exception as e:
        logger.error(f"Error with fallback images: {e}")
        return None


def ensure_fallback_images():
    """Ensure we have fallback images available"""
    # If no fallback images exist, create a text file explaining how to add them
    if not os.path.exists(settings.FALLBACK_IMAGES_DIR) or not os.listdir(settings.FALLBACK_IMAGES_DIR):
        os.makedirs(settings.FALLBACK_IMAGES_DIR, exist_ok=True)
        with open(os.path.join(settings.FALLBACK_IMAGES_DIR, "README.txt"), "w") as f:
            f.write(
                "Add UI/UX related images to this directory as fallbacks when the Unsplash API is unavailable.\n"
                "Recommended: Add at least 5-10 high-quality images related to UI/UX design.\n"
                "File formats: jpg, png, jpeg"
            )
        logger.info(f"Created fallback images README at {settings.FALLBACK_IMAGES_DIR}") 