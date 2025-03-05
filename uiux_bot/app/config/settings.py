"""
Configuration settings for the UI/UX Lesson Bot.
Loads environment variables and provides configuration values.
"""

import os
import logging
from typing import List
import pytz

# Environment variables
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Bot configuration
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")  # Optional: For channel posting mode
ADMIN_USER_IDS = [int(id) for id in os.getenv("ADMIN_USER_IDS", "").split(",") if id]

# OpenAI configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4")  # Allow configurable model

# Unsplash configuration
UNSPLASH_API_KEY = os.getenv("UNSPLASH_API_KEY", "")  # For Unsplash images

# API request settings
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))  # Timeout for external API requests

# Timezone settings
TZ = os.getenv("TZ", "Asia/Kolkata")
TIMEZONE = pytz.timezone(TZ)

# Logging configuration
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_FILE = os.getenv("LOG_FILE", "")
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

# File paths
DATA_DIR = os.getenv("DATA_DIR", ".")
SUBSCRIBERS_FILE = os.path.join(DATA_DIR, "subscribers.json")
HEALTH_FILE = os.path.join(DATA_DIR, "health.json")

# Image paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IMAGES_DIR = os.path.join(BASE_DIR, "images")
FALLBACK_IMAGES_DIR = os.path.join(IMAGES_DIR, "fallback")

# UI/UX Themes
UI_UX_THEMES = [
    "Color Theory",
    "Typography",
    "User Research",
    "Prototyping",
    "Usability Testing",
    "Information Architecture",
    "Interaction Design",
    "Visual Hierarchy",
    "Responsive Design",
    "Accessibility",
    "Mobile UX",
    "UI Animation",
    "Design Systems",
    "User Personas",
    "Wireframing",
    "Design Psychology",
    "UX Writing",
    "Microinteractions",
    "Dark Patterns",
    "User Onboarding",
]

# Validate required settings
def validate_settings():
    """Validate that required settings are configured"""
    if not TELEGRAM_BOT_TOKEN:
        raise ValueError("TELEGRAM_BOT_TOKEN environment variable is required")
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY environment variable is required")
    
    # Create necessary directories
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(FALLBACK_IMAGES_DIR, exist_ok=True) 