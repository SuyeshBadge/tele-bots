-- Create lesson_requests table to track daily lesson requests
CREATE TABLE IF NOT EXISTS lesson_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES subscribers(id),
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on user_id and requested_at for efficient querying
CREATE INDEX IF NOT EXISTS idx_lesson_requests_user_date 
ON lesson_requests(user_id, requested_at);

-- Add RLS policies
ALTER TABLE lesson_requests ENABLE ROW LEVEL SECURITY;

-- Allow insert for authenticated users
CREATE POLICY "Users can insert their own lesson requests"
ON lesson_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow select for authenticated users
CREATE POLICY "Users can view their own lesson requests"
ON lesson_requests FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow delete for admins
CREATE POLICY "Admins can delete lesson requests"
ON lesson_requests FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM subscribers
        WHERE id = auth.uid()
        AND is_admin = true
    )
); 