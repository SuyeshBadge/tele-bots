-- Create a function to safely execute migrations
CREATE OR REPLACE FUNCTION pg_execute_migration(sql_migration TEXT, migration_name TEXT) 
RETURNS VOID AS $$
BEGIN
  -- Log the migration start
  RAISE NOTICE 'Starting migration: %', migration_name;
  
  -- Execute the migration
  EXECUTE sql_migration;
  
  -- Log the migration completion
  RAISE NOTICE 'Completed migration: %', migration_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 