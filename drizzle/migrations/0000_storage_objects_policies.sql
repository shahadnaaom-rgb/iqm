DROP POLICY IF EXISTS "ads_no_public_access" ON storage.objects;
DROP POLICY IF EXISTS "articles_no_public_access" ON storage.objects;

CREATE POLICY "ads_no_public_access"
ON storage.objects
FOR ALL
TO anon, authenticated
USING (bucket_id <> 'ads')
WITH CHECK (bucket_id <> 'ads');

CREATE POLICY "articles_no_public_access"
ON storage.objects
FOR ALL
TO anon, authenticated
USING (bucket_id <> 'articles')
WITH CHECK (bucket_id <> 'articles');