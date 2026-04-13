-- Check existence of LearningStyle enum and the User.learningStyle column
SELECT 'type_exists' as item, (SELECT count(*) FROM pg_type WHERE typname = 'learningstyle') as cnt;

SELECT table_schema, table_name, column_name, udt_name, data_type
FROM information_schema.columns
WHERE column_name IN ('learningstyle','learningStyle')
ORDER BY table_schema, table_name, column_name;
