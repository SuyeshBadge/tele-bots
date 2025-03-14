# Telegram OAuth Integration

This guide explains how to integrate Telegram OAuth in your application for seamless user authentication using Telegram accounts.

## Prerequisites

Before you begin, make sure you have:

1. A Telegram bot created through [@BotFather](https://t.me/BotFather)
2. The bot token and username
3. Added the `/domain` command to your bot to verify your domain ownership

## Backend Configuration

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_BOT_USERNAME=your_bot_username_without_at_symbol
TELEGRAM_OAUTH_REDIRECT_URL=https://your-api.com/api/auth/telegram/callback
FRONTEND_URL=https://your-frontend.com
API_URL=https://your-api.com
```

### 2. Endpoints

The Telegram OAuth implementation exposes three main endpoints:

- **GET /api/auth/telegram/login**: Redirects users to the Telegram OAuth page
- **GET /api/auth/telegram/callback**: Handles the OAuth callback from Telegram
- **POST /api/auth/telegram/validate**: Validates Telegram authentication data sent directly from the widget

## Frontend Integration

### Using the Redirect Method

Add a login button that redirects users to your backend login endpoint:

```html
<a href="https://your-api.com/api/auth/telegram/login" class="telegram-login-button">
  Login with Telegram
</a>
```

### Using the Telegram Login Widget (Recommended)

Add the Telegram Login widget to your website:

```html
<script async src="https://telegram.org/js/telegram-widget.js?22" 
        data-telegram-login="YOUR_BOT_NAME" 
        data-size="large" 
        data-auth-url="https://your-api.com/api/auth/telegram/validate" 
        data-request-access="write"></script>
```

For a better UX, use JavaScript callbacks:

```html
<script async src="https://telegram.org/js/telegram-widget.js?22" 
        data-telegram-login="YOUR_BOT_NAME" 
        data-size="large" 
        data-onauth="onTelegramAuth(user)" 
        data-request-access="write"></script>

<script type="text/javascript">
  function onTelegramAuth(user) {
    // Send the received data to your backend for validation
    fetch('https://your-api.com/api/auth/telegram/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(user)
    })
    .then(response => response.json())
    .then(data => {
      // Store the received token
      localStorage.setItem('auth_token', data.accessToken);
      // Redirect or update UI
      window.location.href = '/dashboard';
    })
    .catch(error => {
      console.error('Authentication Error:', error);
    });
  }
</script>
```

## Domain Validation

Before your Telegram login widget can function properly:

1. The domain where it's hosted must be verified with BotFather
2. Contact [@BotFather](https://t.me/BotFather) on Telegram
3. Send the `/domain` command
4. Follow the instructions to add your domain

## Additional Options for the Widget

The Telegram widget supports several configuration options:

- `data-size`: `large`, `medium`, or `small` (button size)
- `data-radius`: Button corner radius in pixels
- `data-userpic`: Whether to show the user's profile picture (`true` or `false`)
- `data-onauth`: JavaScript callback function that receives user data
- and more (see [official documentation](https://core.telegram.org/widgets/login))

## Security Considerations

1. Always validate authentication data on your server using the bot token
2. Do not rely solely on front-end validation
3. Check that the auth_date is recent (within 24 hours)
4. Verify the hash signature matches
5. Use HTTPS for all API endpoints
6. Do not expose sensitive information in the callback URLs
7. Apply rate limiting to prevent abuse

## Example Success Flow

1. User clicks the "Login with Telegram" button
2. Telegram displays the authorization dialog
3. User confirms the authorization
4. Authentication data is sent to your backend
5. Backend validates the data and generates a JWT token
6. Token is returned to the frontend
7. Frontend stores the token and redirects to the protected area

## Troubleshooting

- **Widget Not Showing**: Ensure the bot username is correct and the domain is verified
- **Authorization Failed**: Check that the bot token used for validation is correct
- **Invalid Hash**: Ensure the HMAC-SHA256 validation is implemented correctly
- **Callback URL Not Working**: Verify that the redirect URL is correctly configured and accessible

For more details, refer to the [Telegram Login Widget documentation](https://core.telegram.org/widgets/login). 