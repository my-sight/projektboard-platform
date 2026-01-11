-- Function to delete old sessions for the user
CREATE OR REPLACE FUNCTION auth.enforce_single_session()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all sessions for this user EXCEPT the one just created
  DELETE FROM auth.sessions
  WHERE user_id = NEW.user_id 
  AND id <> NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove existing trigger if exists
DROP TRIGGER IF EXISTS tr_enforce_single_session ON auth.sessions;

-- Create the trigger
CREATE TRIGGER tr_enforce_single_session
AFTER INSERT ON auth.sessions
FOR EACH ROW EXECUTE PROCEDURE auth.enforce_single_session();

-- Also clean up refresh_tokens just in case (legacy support or if used internally)
-- Modern GoTrue uses sessions table which cascades to refresh_tokens usually.
