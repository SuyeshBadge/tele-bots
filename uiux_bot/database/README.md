# Supabase Integration for UI/UX Bot

This directory contains scripts and instructions for integrating Supabase as the database backend for the UI/UX Bot.

## Files in this Directory

- `SETUP_INSTRUCTIONS.md` - Comprehensive guide for setting up Supabase integration
- `create_tables.sql` - SQL script to create the necessary tables in Supabase
- `direct_migration.py` - Script to migrate data from local JSON files to Supabase
- `MANUAL_SETUP.md` - Alternative manual setup instructions

## Quick Start

1. Create the required tables in Supabase using the SQL in `create_tables.sql`
2. Run `direct_migration.py` to migrate your existing data
3. Set `ENABLE_SUPABASE=True` in your `.env` file

## What We've Done

- Created SQL scripts to set up the necessary tables in Supabase
- Developed a migration script to transfer data from local JSON files to Supabase
- Added checks to verify table existence before attempting migration
- Provided comprehensive documentation for setup and troubleshooting

## Next Steps

1. Follow the instructions in `SETUP_INSTRUCTIONS.md` to create the tables in Supabase
2. Run the migration script to transfer your data
3. Test the bot with Supabase enabled

## Troubleshooting

If you encounter issues, refer to the troubleshooting section in `SETUP_INSTRUCTIONS.md` or check the logs from the migration script for specific error messages. 