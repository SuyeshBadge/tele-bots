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