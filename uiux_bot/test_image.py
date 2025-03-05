#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Test script for UI/UX Image Generation.

This script tests the image generation functionality without running the full bot.
It's useful for verifying that your API keys and image sources are working correctly.

Usage:
    python test_image.py <theme>
    
Example:
    python test_image.py "color theory"
"""

import os
import sys
import asyncio
import logging
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup basic logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()]
)

logger = logging.getLogger("image_test")

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def test_image_generation(theme):
    """Test image generation for a given theme"""
    logger.info(f"Testing image generation for theme: {theme}")
    
    # Import here to ensure environment variables are loaded first
    from app.api import image_manager
    from app.config import settings
    
    # Log available strategies
    logger.info(f"Image preference order: {settings.IMAGE_PREFERENCE}")
    if hasattr(settings, "ENABLE_DALLE_IMAGES"):
        logger.info(f"DALL-E enabled: {settings.ENABLE_DALLE_IMAGES}")
    if hasattr(settings, "DALLE_MODEL"):
        logger.info(f"DALL-E model: {settings.DALLE_MODEL}")
    
    # Test each strategy individually
    strategies = {
        "dalle": image_manager.OpenAIDALLEStrategy(),
        "unsplash": image_manager.UnsplashStrategy(),
        "pexels": image_manager.PexelsStrategy(),
        "local": image_manager.LocalFallbackStrategy()
    }
    
    results = {}
    
    for name, strategy in strategies.items():
        try:
            logger.info(f"Testing {name} strategy...")
            start_time = datetime.now()
            image_data = await strategy.get_image(theme)
            duration = (datetime.now() - start_time).total_seconds()
            
            if image_data:
                logger.info(f"✅ {name} strategy SUCCESS in {duration:.2f}s")
                if "url" in image_data:
                    logger.info(f"   URL: {image_data['url'][:60]}...")
                elif "file" in image_data:
                    logger.info(f"   File: {image_data['file']}")
                if "attribution" in image_data:
                    logger.info(f"   Attribution: {image_data['attribution']}")
                results[name] = True
            else:
                logger.warning(f"❌ {name} strategy FAILED in {duration:.2f}s - No image returned")
                results[name] = False
        except Exception as e:
            logger.error(f"❌ {name} strategy ERROR: {e}")
            results[name] = False
    
    # Now test the complete image manager
    try:
        logger.info("\nTesting combined image manager...")
        start_time = datetime.now()
        image_data = await image_manager.get_image_for_lesson(theme)
        duration = (datetime.now() - start_time).total_seconds()
        
        if image_data:
            source = image_data.get("source", "unknown")
            logger.info(f"✅ Combined image manager SUCCESS in {duration:.2f}s using {source} strategy")
            if "url" in image_data:
                logger.info(f"   URL: {image_data['url'][:60]}...")
            elif "file" in image_data:
                logger.info(f"   File: {image_data['file']}")
            if "attribution" in image_data:
                logger.info(f"   Attribution: {image_data['attribution']}")
        else:
            logger.error(f"❌ Combined image manager FAILED in {duration:.2f}s - No image returned")
    except Exception as e:
        logger.error(f"❌ Combined image manager ERROR: {e}")
    
    # Summary
    logger.info("\nTest Summary:")
    for name, result in results.items():
        logger.info(f"  {name}: {'✅ SUCCESS' if result else '❌ FAILED'}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Please provide a theme to test.")
        print("Usage: python test_image.py \"theme to test\"")
        print("Example: python test_image.py \"color theory\"")
        sys.exit(1)
    
    theme = sys.argv[1]
    asyncio.run(test_image_generation(theme)) 