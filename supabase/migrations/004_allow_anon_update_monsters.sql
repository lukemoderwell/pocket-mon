-- Allow anon users to update monsters (needed for evolution)
CREATE POLICY "Allow anon update on monsters"
  ON monsters
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
