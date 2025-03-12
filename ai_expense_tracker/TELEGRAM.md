# Telegram Bot Implementation Guide

This application provides two different Telegram bot implementations:

1. **Original Implementation** - Using `node-telegram-bot-api`
2. **GramIO Implementation** - Using the modern `gramio` library

## Choosing Between Implementations

You can easily switch between implementations by setting the `USE_GRAMIO` environment variable.

### Using the Original Implementation (default)

```
# In your .env file
USE_GRAMIO=false
```

### Using the GramIO Implementation

```
# In your .env file
USE_GRAMIO=true
```

## Benefits of Each Implementation

### Original Implementation (node-telegram-bot-api)

- Mature and widely used library
- Extensive documentation and community support
- Full compatibility with existing codebase

### GramIO Implementation

- Modern API design with better TypeScript support
- Improved message formatting capabilities
- More intuitive context-based API design
- Better error handling

## Troubleshooting

### "Conflict: terminated by other getUpdates request" Error

This error occurs when multiple bot instances try to connect to the Telegram API using the same token simultaneously. Ensure you have only one of the implementations enabled at a time by setting the `USE_GRAMIO` environment variable appropriately.

### Formatting Issues

If you're experiencing issues with bold text or other formatting not being displayed correctly in Telegram:

1. Try switching to the GramIO implementation which handles formatting more reliably
2. Ensure you're using the correct parse mode ('Markdown' or 'HTML')
3. Make sure special characters are properly escaped in Markdown mode

## Testing the GramIO Implementation Separately

You can also test the GramIO implementation separately without affecting the main application:

```bash
# Run the standalone test script
npx ts-node src/telegram/run-gramio-service.ts
```

This script creates a basic bot with the essential functionality for testing purposes. 