# UI/UX Bot UML Diagrams

This document provides UML diagrams that represent the key workflows and architecture of the UI/UX Lesson Bot system. These diagrams help understand how the bot processes scheduled lessons, handles user commands, and integrates with external services.

## Available UML Diagrams

The diagrams are available in the `images/` directory as PlantUML files (.puml):

1. **Bot Startup Flow** (`images/bot_startup_flow.puml`)
2. **Scheduled Lesson Flow** (`images/scheduled_lesson_flow.puml`)
3. **Manual Lesson Request Flow** (`images/manual_lesson_request_flow.puml`)
4. **Quiz Answer Flow** (`images/quiz_answer_flow.puml`)
5. **Lesson Generation Flow** (`images/lesson_generation_flow.puml`)
6. **Class Diagram** (`images/class_diagram.puml`)

## Entry Points & Key Workflows

### 1. Bot Startup

**Entry Point:** `src/main.ts`

The bot startup flow begins in the main.ts file, which handles:
- Environment validation
- Configuration loading
- Database initialization
- Bot instance creation
- Health server startup
- Signal handling for graceful shutdown

Key components:
- `main()` function in main.ts
- `UIUXLessonBot` class in bot.ts
- `setupGlobalErrorHandlers()` in main.ts
- `startHealthServer()` in main.ts

### 2. Scheduled Lesson Generation

**Entry Point:** `src/app/bot/scheduler.ts` → `sendScheduledLesson()`

When the scheduler triggers a scheduled lesson:
1. The bot retrieves all active subscribers
2. Fetches recent themes and quizzes to avoid repetition
3. Generates a new lesson using Claude API
4. Obtains an image for the lesson
5. Saves the lesson to the database
6. Sends the lesson to each subscriber
7. Generates and sends a quiz about the lesson

Key components:
- `Scheduler` class in scheduler.ts
- `sendScheduledLesson()` method in bot.ts
- `claudeClient.generateLesson()` in claude-client.ts
- `getImageForLesson()` in image-manager.ts

### 3. User-Requested Lesson

**Entry Point:** `/lesson` command → `lessonCommand()` in utility-handlers.ts

When a user requests a lesson via command:
1. The bot validates the user's subscription status
2. Sends a waiting message
3. Retrieves recent themes for the user
4. Generates a custom lesson
5. Obtains an appropriate image
6. Delivers the lesson and a follow-up quiz

Key components:
- `lessonCommand()` in utility-handlers.ts
- `sendLesson()` in lesson-utils.ts
- `generateLesson()` in claude-client.ts

### 4. Quiz Answer Processing

**Entry Point:** Telegram poll answer → `onPollAnswer()` in quiz-handlers.ts

When a user answers a quiz:
1. The bot retrieves the quiz data including correct answers
2. Validates the user's answer
3. Saves the quiz result to the user's progress
4. Generates appropriate feedback based on correctness
5. Sends detailed explanation

Key components:
- `onPollAnswer()` in quiz-handlers.ts
- `saveQuizResult()` in progress-repository
- `incrementQuizCount()` in persistence.ts

### 5. Claude API Integration

**Entry Point:** `claudeClient.generateLesson()` in claude-client.ts

The lesson generation process:
1. Checks cache for existing content
2. Formats appropriate prompt with exclusion lists
3. Makes API call to Claude
4. Parses and validates the JSON response
5. Handles retry logic for failures
6. Formats the response as LessonSections

Key components:
- `generateLessonContent()` in claude-client.ts
- `generateLesson()` in claude-client.ts
- `LessonSections` interface in claude-client.ts

## System Architecture

The class diagram illustrates the relationships between the main components:

- `UIUXLessonBot`: Core bot class that orchestrates all activities
- `Scheduler`: Handles timing of automatic lesson delivery
- `CommandHandlers`: Processes user commands
- `QuizHandlers`: Manages quiz delivery and answer processing
- `ClaudeClient`: Integrates with Anthropic's Claude API for content generation
- `ImageManager`: Generates or retrieves images for lessons
- `LessonRepository` & `QuizRepository`: Store and retrieve lesson and quiz data
- `Persistence`: Manages database interactions

## Viewing the Diagrams

You can view these PlantUML diagrams using:
- The [PlantUML Online Server](https://www.plantuml.com/plantuml/uml/)
- PlantUML extensions for VS Code, IntelliJ, or other IDEs
- PlantUML CLI tool (see `images/README.md` for instructions) 