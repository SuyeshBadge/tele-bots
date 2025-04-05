# UI/UX Bot UML Diagrams

This directory contains UML diagrams that document the main flows and components of the UI/UX Lesson Bot system.

## Diagram Files

1. **Bot Startup Flow** (`bot_startup_flow.puml`): 
   - Illustrates the sequence of operations during bot initialization and startup
   - Shows how environment validation, database initialization, and scheduler startup work together

2. **Scheduled Lesson Flow** (`scheduled_lesson_flow.puml`):
   - Documents how scheduled lessons are automatically generated and delivered
   - Shows the complete process from theme selection to lesson delivery and quiz generation

3. **Manual Lesson Request Flow** (`manual_lesson_request_flow.puml`):
   - Shows how a user-requested lesson (via `/lesson` command) is processed
   - Includes subscriber validation, lesson generation, and delivery

4. **Quiz Answer Flow** (`quiz_answer_flow.puml`):
   - Illustrates how the bot processes quiz answers from users
   - Shows the feedback generation and response process

5. **Lesson Generation Flow** (`lesson_generation_flow.puml`):
   - Provides a detailed view of the Claude API integration for lesson generation
   - Shows caching, error handling, and retry mechanisms 

6. **Class Diagram** (`class_diagram.puml`):
   - Shows the main classes in the system and their relationships
   - Provides an overview of the system architecture

## How to Generate Images

You can convert these PlantUML files to images using any of the following methods:

1. **PlantUML Online Server**:
   - Visit [PlantUML Online Server](https://www.plantuml.com/plantuml/uml/)
   - Paste the contents of the `.puml` file

2. **VS Code Extension**:
   - Install the PlantUML extension for VS Code
   - Open a `.puml` file and use the preview feature

3. **PlantUML CLI**:
   - Download PlantUML JAR from https://plantuml.com/download
   - Run: `java -jar plantuml.jar filename.puml`

## Diagram Descriptions

### Bot Startup Flow
This diagram shows the initialization process of the bot, starting from the main entry point. It illustrates how the bot handles development vs. production modes, sets up error handlers, initializes the database, and starts the scheduler.

### Scheduled Lesson Flow
This sequence diagram illustrates how the scheduler triggers the generation and delivery of lessons at scheduled intervals. It shows the complete flow from getting subscribers to generating and sending lessons with associated quizzes.

### Manual Lesson Request Flow
When a user sends the `/lesson` command, this flow is triggered. The diagram shows how the bot validates the user's subscription status, generates a new lesson, and delivers it with an associated quiz.

### Quiz Answer Flow
This diagram details how the bot processes a user's response to a quiz. It shows the validation of answers, generation of appropriate feedback, and the process of storing quiz results.

### Lesson Generation Flow
This detailed sequence diagram focuses on the Claude API integration for lesson generation. It shows the caching mechanism, retry logic, error handling, and JSON parsing process.

### Class Diagram
The class diagram provides a structural view of the system, showing the main classes, their properties and methods, and the relationships between them. This offers a high-level understanding of the system architecture. 