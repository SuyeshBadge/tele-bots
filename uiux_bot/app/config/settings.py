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

# Configure logger
logger = logging.getLogger(__name__)

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
# Flag to enable admin commands
ENABLE_ADMIN_COMMANDS = os.getenv("ENABLE_ADMIN_COMMANDS", "True").lower() in ("true", "1", "yes")

# OpenAI configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")  # Faster model by default
DISABLE_OPENAI = os.getenv("DISABLE_OPENAI", "false").lower() == "true"

# Image source configuration
ENABLE_DALLE_IMAGES = os.getenv("ENABLE_DALLE_IMAGES", "False").lower() in ("true", "1", "yes")
DALLE_MODEL = os.getenv("DALLE_MODEL", "dall-e-2")  # 'dall-e-2' or 'dall-e-3'
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")  # For Pexels stock photos
IMAGE_PREFERENCE = os.getenv("IMAGE_PREFERENCE", "dalle,unsplash,pexels,local").lower()  # Comma-separated list of preferred sources

# User limits
MAX_DAILY_LESSONS = os.getenv("MAX_DAILY_LESSONS", "5")  # Maximum on-demand lessons per day

# Unsplash configuration
UNSPLASH_API_KEY = os.getenv("UNSPLASH_API_KEY", "")  # For Unsplash images

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
ENABLE_SUPABASE = os.getenv("ENABLE_SUPABASE", "False").lower() in ("true", "1", "yes")

# API request settings
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "15"))  # 15 seconds timeout instead of 30

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
    # Fundamentals
    "Color Theory and Psychology",
    "Color Schemes and Palettes",
    "Typography Fundamentals",
    "Font Pairing and Hierarchy",
    "Visual Hierarchy Principles",
    "Gestalt Principles in UI Design",
    "Grid Systems and Layouts",
    "White Space and Negative Space",
    "Contrast and Visual Emphasis",
    "Design Patterns and Conventions",
    "Iconography and Visual Language",
    "Composition and Balance",
    
    # Research & Strategy
    "User Research Methods",
    "Qualitative vs Quantitative Research",
    "User Personas Development",
    "Empathy Mapping",
    "User Journey Mapping",
    "Customer Experience Mapping",
    "Competitive Analysis Techniques",
    "Heuristic Evaluation Methods",
    "A/B Testing Strategies",
    "Multivariate Testing",
    "Analytics Integration and Metrics",
    "Behavioral Psychology in UX",
    "Mental Models and User Expectations",
    "Jobs-to-be-Done Framework",
    
    # Design Process
    "Wireframing Techniques",
    "Low-fidelity Prototyping",
    "High-fidelity Prototyping",
    "Interactive Prototyping",
    "Mockup Creation and Refinement",
    "Design Thinking Methodology",
    "Double Diamond Process",
    "Agile UX Implementation",
    "Lean UX Principles",
    "Design Sprints Facilitation",
    "Iterative Design Process",
    "Collaborative Design Workshops",
    "Design Critiques and Reviews",
    "Design Documentation",
    
    # Interaction & Experience
    "Interaction Design Principles",
    "Microinteractions and Animations",
    "UI Animation Principles",
    "Motion Design in Interfaces",
    "Gesture-based Interface Design",
    "Touch Target Sizing and Placement",
    "Voice User Interface Design",
    "Conversational UI Patterns",
    "Haptic Feedback Implementation",
    "Emotional Design Strategies",
    "Gamification Elements and Techniques",
    "Immersive Experience Design",
    "Augmented Reality UI Design",
    "Virtual Reality Interface Design",
    
    # Technical Implementation
    "Responsive Design Techniques",
    "Mobile-First Design Approach",
    "Adaptive vs Responsive Design",
    "Mobile UX Best Practices",
    "Cross-platform Design Considerations",
    "Design Systems Architecture",
    "Design Tokens Implementation",
    "Component Libraries Management",
    "Atomic Design Methodology",
    "Design-to-Code Workflows",
    "Design Handoff Best Practices",
    "Developer-Designer Collaboration",
    "CSS Architecture for Designers",
    "Performance-Focused Design",
    
    # Specialized Areas
    "Accessibility Standards (WCAG)",
    "Designing for Screen Readers",
    "Color Accessibility and Contrast",
    "Inclusive Design Principles",
    "Information Architecture Fundamentals",
    "Card Sorting and Tree Testing",
    "Navigation Patterns and Systems",
    "Form Design and Validation",
    "Data Visualization Principles",
    "Chart and Graph Design",
    "Dashboard Design Patterns",
    "E-commerce UX Optimization",
    "Checkout Flow Design",
    "Search Experience Design",
    
    # Content & Communication
    "UX Writing Fundamentals",
    "Content Strategy for Interfaces",
    "Microcopy Crafting",
    "Error Message Design",
    "Empty State Design",
    "Onboarding Copy and Flows",
    "Localization and Internationalization",
    "Visual Storytelling in Interfaces",
    "Brand Experience Integration",
    "Tone and Voice in UX Writing",
    "Content Hierarchy and Structure",
    "Readability and Legibility",
    "Instructional Design in UX",
    "Help Documentation Design",
    
    # Evaluation & Improvement
    "Usability Testing Methods",
    "Remote vs In-person Testing",
    "User Feedback Collection Systems",
    "UX Audits and Assessments",
    "Performance Optimization Techniques",
    "Conversion Rate Optimization",
    "User Retention Strategies",
    "Customer Satisfaction Metrics",
    "System Usability Scale (SUS)",
    "Net Promoter Score (NPS)",
    "ROI of UX Measurement",
    "UX Maturity Assessment",
    "Continuous Improvement Processes",
    "Post-launch Evaluation",
    
    # Ethics & Best Practices
    "Dark Patterns Identification",
    "Ethical Design Frameworks",
    "Privacy by Design Principles",
    "GDPR Compliance in Design",
    "Sustainable UX Practices",
    "Cognitive Load Management",
    "Attention Economy Considerations",
    "Digital Wellbeing Design",
    "Future of UX/UI Trends",
    "Designing for Trust and Transparency",
    "Bias in Design and AI Interfaces",
    "Accessibility as an Ethical Imperative",
    "Cross-cultural Design Considerations",
    "Designing for Diverse Audiences",
    
    # User Engagement
    "User Onboarding Optimization",
    "First-time User Experience Design",
    "Progressive Disclosure Techniques",
    "Personalization Strategies",
    "User Engagement Loop Design",
    "Habit-forming Design Principles",
    "Notification Design Best Practices",
    "Feedback Mechanisms Design",
    "Social Proof Integration",
    "Reward Systems and Incentives",
    "User Retention Hooks",
    "Re-engagement Strategies",
    "Push Notification Strategy",
    "Email Design for Engagement",
]

# Performance settings
ENABLE_CACHING = os.getenv("ENABLE_CACHING", "true").lower() == "true"
CACHE_TTL = int(os.getenv("CACHE_TTL", "86400"))  # 24 hours in seconds
NEXT_LESSON_COOLDOWN = int(os.getenv("NEXTLESSON_COOLDOWN", "300"))  # 5 minutes in seconds
USE_PRECOMPUTED_RESPONSES = os.getenv("USE_PRECOMPUTED_RESPONSES", "true").lower() == "true"

# Logging settings
DETAILED_OPENAI_LOGGING = os.getenv("DETAILED_OPENAI_LOGGING", "true").lower() == "true"
LOG_OPENAI_REQUESTS = os.getenv("LOG_OPENAI_REQUESTS", "true").lower() == "true"
LOG_OPENAI_RESPONSES = os.getenv("LOG_OPENAI_RESPONSES", "true").lower() == "true"

# Validate required settings
def validate_settings():
    """Validate that required settings are configured"""
    # Declare globals upfront that might be modified in this function
    global DISABLE_OPENAI
    global ENABLE_DALLE_IMAGES
    global DALLE_MODEL
    global MAX_DAILY_LESSONS
    
    # Check required settings
    if not TELEGRAM_BOT_TOKEN:
        raise ValueError("TELEGRAM_BOT_TOKEN environment variable is required")
    
    # For OPENAI, only require API key if not using fallback
    if not OPENAI_API_KEY and not DISABLE_OPENAI:
        logger.warning("OPENAI_API_KEY not set but OpenAI is enabled. Disabling OpenAI features.")
        DISABLE_OPENAI = True
    
    # Validate DALLE_MODEL if DALL-E is enabled
    if ENABLE_DALLE_IMAGES:
        if not OPENAI_API_KEY:
            logger.warning("ENABLE_DALLE_IMAGES is set but OPENAI_API_KEY is missing. Disabling DALL-E image generation.")
            ENABLE_DALLE_IMAGES = False
        elif DALLE_MODEL not in ["dall-e-2", "dall-e-3"]:
            logger.warning(f"Invalid DALLE_MODEL '{DALLE_MODEL}'. Must be 'dall-e-2' or 'dall-e-3'. Defaulting to 'dall-e-2'.")
            DALLE_MODEL = "dall-e-2"
    
    # If no image sources are available, warn but continue (will use local fallbacks)
    if not UNSPLASH_API_KEY and not (ENABLE_DALLE_IMAGES and OPENAI_API_KEY) and not PEXELS_API_KEY:
        logger.warning("No external image APIs configured. Only local fallback images will be used.")
        
    # Ensure directories exist
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(FALLBACK_IMAGES_DIR, exist_ok=True)
    
    # Ensure MAX_DAILY_LESSONS is a reasonable value
    try:
        MAX_DAILY_LESSONS = int(MAX_DAILY_LESSONS)
        if MAX_DAILY_LESSONS <= 0:
            logger.warning("MAX_DAILY_LESSONS must be positive. Setting to default value of 5.")
            MAX_DAILY_LESSONS = 5
    except (ValueError, TypeError):
        logger.warning("Invalid MAX_DAILY_LESSONS value. Setting to default value of 5.")
        MAX_DAILY_LESSONS = 5 # A comment to trigger hot reload
