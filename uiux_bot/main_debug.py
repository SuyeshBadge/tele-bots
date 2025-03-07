#!/usr/bin/env python3
"""
Debug script for OpenAI client initialization issues.
"""

import sys
import os
import logging
import httpx
from openai import AsyncOpenAI

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add the project to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings

def debug_openai_initialization():
    """Debug OpenAI client initialization."""
    logger.info("Starting OpenAI client initialization debug")
    
    # Check Python version
    logger.info(f"Python version: {sys.version}")
    
    # Check httpx version
    logger.info(f"httpx version: {httpx.__version__}")
    
    # Check OpenAI version
    import openai
    logger.info(f"OpenAI version: {openai.__version__}")
    
    # Check settings
    logger.info(f"DISABLE_SSL_VERIFICATION: {settings.DISABLE_SSL_VERIFICATION}")
    
    try:
        # Create custom httpx client
        logger.info("Creating httpx client...")
        http_client = httpx.AsyncClient(
            verify=not settings.DISABLE_SSL_VERIFICATION,
            timeout=httpx.Timeout(connect=5.0, read=30.0, write=30.0, pool=30.0)
        )
        logger.info("httpx client created successfully")
        
        # Initialize OpenAI client
        logger.info("Initializing OpenAI client...")
        client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            http_client=http_client
        )
        logger.info("OpenAI client initialized successfully")
        
        return True
    except Exception as e:
        logger.error(f"Error during initialization: {e}", exc_info=True)
        return False

def main():
    """Main function."""
    success = debug_openai_initialization()
    if success:
        logger.info("All tests passed successfully")
    else:
        logger.error("Tests failed")
        sys.exit(1)

if __name__ == "__main__":
    main() 