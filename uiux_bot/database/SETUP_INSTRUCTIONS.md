# Supabase Integration Setup Guide

This guide will walk you through setting up Supabase as the database backend for your UI/UX Bot.

## Step 1: Create Tables in Supabase

The tables need to be created manually in the Supabase SQL Editor:

1. Log in to your Supabase dashboard at [https://app.supabase.com/](https://app.supabase.com/)
2. Select your project
3. Click on "SQL Editor" in the left sidebar
4. Click "New query"
5. Copy and paste the following SQL:

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

6. Click "Run" to execute the SQL

## Step 2: Verify Table Creation

1. Click on "Table Editor" in the left sidebar
2. You should see the following tables listed:
   - `subscribers`
   - `lessons`
   - `user_history`
   - `health_status`

## Step 3: Migrate Existing Data

Run the migration script to transfer your existing data to Supabase:

```bash
cd /path/to/bots/uiux_bot
python3 database/direct_migration.py
```

The script will:
- Check if the tables exist
- Load data from your local JSON files
- Insert the data into the corresponding Supabase tables
- Log the results of the migration

## Step 4: Verify Data Migration

1. In the Supabase dashboard, go to "Table Editor"
2. Click on each table to verify that your data was migrated successfully
3. You should see:
   - User IDs in the `subscribers` table
   - User history data in the `user_history` table
   - Health status information in the `health_status` table

## Step 5: Enable Supabase in Your Bot

Make sure your `.env` file has the following settings:

```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
ENABLE_SUPABASE=True
```

## Troubleshooting

### Tables Not Created Properly

If you encounter issues with table creation:
- Make sure you're logged in as the owner of the Supabase project
- Check for any error messages in the SQL Editor
- Try running each CREATE TABLE statement separately

### Migration Failures

If data migration fails:
- Check the logs for specific error messages
- Verify that your tables were created with the correct structure
- Make sure your Supabase URL and API key are correct
- Try running the migration script again

### API Access Issues

If you encounter permission issues:
- Check your Supabase API key permissions
- Make sure Row Level Security (RLS) is configured correctly
- Try regenerating your API key in the Supabase dashboard

## Next Steps

After successful migration:
1. Test your bot with Supabase enabled
2. Monitor for any database-related errors
3. Consider setting up regular backups of your Supabase data 