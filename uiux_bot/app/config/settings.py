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

# Deployment configuration
DEPLOYMENT_MODE = os.getenv("DEPLOYMENT_MODE", "prod").lower()
IS_DEV_MODE = DEPLOYMENT_MODE == "dev"
IS_PROD_MODE = DEPLOYMENT_MODE == "prod"

# Bot configuration
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")  # Optional: For channel posting mode

# Admin users configuration
# Note: This will be dynamically updated with current subscriber IDs
ADMIN_USER_IDS = [int(id) for id in os.getenv("ADMIN_USER_IDS", "").split(",") if id]
# Flag to auto-add subscribers as admins (for development purposes)
AUTO_ADMIN_SUBSCRIBERS = os.getenv("AUTO_ADMIN_SUBSCRIBERS", "False").lower() in ("true", "1", "yes")

# OpenAI configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4")  # Allow configurable model
DISABLE_OPENAI = os.getenv("DISABLE_OPENAI", "False").lower() in ("true", "1", "yes")

# Unsplash configuration
UNSPLASH_API_KEY = os.getenv("UNSPLASH_API_KEY", "")  # For Unsplash images

# API request settings
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))  # Timeout for external API requests

# SSL verification settings
DISABLE_SSL_VERIFICATION = os.getenv("DISABLE_SSL_VERIFICATION", "False").lower() in ("true", "1", "yes")
if IS_DEV_MODE and os.getenv("DISABLE_SSL_VERIFICATION") is None:
    # Default to disabled SSL verification in dev mode unless explicitly set
    DISABLE_SSL_VERIFICATION = True

# Feature configuration - Set defaults based on deployment mode
# Only override from env if explicitly set
if os.getenv("NEXTLESSON_COOLDOWN"):
    NEXTLESSON_COOLDOWN = int(os.getenv("NEXTLESSON_COOLDOWN"))
else:
    # 30 seconds for dev mode, 1 hour for prod mode
    NEXTLESSON_COOLDOWN = 30 if IS_DEV_MODE else 3600

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