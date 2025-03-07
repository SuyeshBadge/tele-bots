# Manual Supabase Setup Guide

Since we're unable to create tables programmatically through the API, you'll need to create them manually through the Supabase dashboard.

## Step 1: Log in to Supabase

Go to [https://app.supabase.com/](https://app.supabase.com/) and log in to your account.

## Step 2: Navigate to the SQL Editor

1. Select your project from the dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"

## Step 3: Create the Tables

Copy and paste the following SQL into the editor:

```sql
-- Create subscribers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.subscribers (
    id SERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lessons table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.lessons (
    id SERIAL PRIMARY KEY,
    theme TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    quiz_question TEXT,
    quiz_options JSONB,
    correct_option_index INTEGER,
    explanation TEXT,
    option_explanations JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user history table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_history (
    id SERIAL PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    recent_themes JSONB DEFAULT '[]'::jsonb,
    recent_lessons JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create health status table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.health_status (
    id SERIAL PRIMARY KEY,
    start_time BIGINT NOT NULL,
    last_activity BIGINT NOT NULL,
    lessons_sent INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Click the "Run" button to execute the SQL.

## Step 4: Verify Table Creation

1. Click on "Table Editor" in the left sidebar
2. You should see the following tables listed:
   - `subscribers`
   - `lessons`
   - `user_history`
   - `health_status`

## Step 5: Enable Row-Level Security (Optional but Recommended)

For each table:

1. Click on the table name in the Table Editor
2. Click on "Authentication" in the top tabs
3. Enable Row Level Security (RLS)
4. Create appropriate policies based on your security requirements

## Step 6: Run the Migration Script

After creating the tables, run the migration script to transfer your existing data:

```bash
cd /path/to/bots/uiux_bot
python3 database/direct_migration.py
```

## Troubleshooting

If you encounter issues:

1. Check that all tables were created correctly
2. Verify that your Supabase URL and API key are correctly set in your `.env` file
3. Make sure `ENABLE_SUPABASE=True` is set in your `.env` file
4. Check the logs from the migration script for specific errors 