/*
  # Lost and Found Items Table

  ## Summary
  Creates the core items table for the Lost and Found application.

  ## New Tables
  - `items`
    - `id` (uuid, primary key) - Unique identifier
    - `title` (text) - Short title for the item
    - `description` (text) - Detailed description
    - `category` (text) - Item category (Electronics, Clothing, Accessories, etc.)
    - `status` (text) - Either 'lost' or 'found'
    - `location` (text) - Where the item was lost or found
    - `date_occurred` (date) - Date the item was lost or found
    - `image_url` (text, nullable) - Optional image URL
    - `contact_email` (text) - Contact email for the reporter
    - `contact_phone` (text, nullable) - Optional contact phone
    - `is_resolved` (boolean) - Whether the item has been returned/claimed
    - `user_id` (uuid) - References auth.users
    - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  - RLS enabled on `items` table
  - Authenticated users can read all items (public listing)
  - Users can only insert their own items
  - Users can only update/delete their own items
*/

CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Other',
  status text NOT NULL DEFAULT 'lost' CHECK (status IN ('lost', 'found')),
  location text NOT NULL DEFAULT '',
  date_occurred date NOT NULL DEFAULT CURRENT_DATE,
  image_url text,
  contact_email text NOT NULL DEFAULT '',
  contact_phone text,
  is_resolved boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all items"
  ON items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own items"
  ON items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own items"
  ON items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own items"
  ON items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS items_user_id_idx ON items(user_id);
CREATE INDEX IF NOT EXISTS items_status_idx ON items(status);
CREATE INDEX IF NOT EXISTS items_created_at_idx ON items(created_at DESC);
