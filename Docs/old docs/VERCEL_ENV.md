# Vercel Environment Variable Setup (commands you can run locally)

These commands assume you have the `vercel` CLI installed and are logged in (`vercel login`). They will prompt you for values.

Replace placeholder values with production secrets when prompted.

# Add DATABASE_URL
vercel env add DATABASE_URL production
vercel env add DATABASE_URL preview
vercel env add DATABASE_URL development

# Add REDIS_URL
vercel env add REDIS_URL production
vercel env add REDIS_URL preview
vercel env add REDIS_URL development

# Add NEXTAUTH_SECRET
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_SECRET preview
vercel env add NEXTAUTH_SECRET development

# Add OPENAI API Key (if required)
vercel env add OPENAI_API_KEY production
vercel env add OPENAI_API_KEY preview
vercel env add OPENAI_API_KEY development

# Notes
- Use `vercel env ls` to list environment variables for the current project.
- Use `vercel env pull .env.local` to pull preview/prod env into a local file (careful — secrets will be written to disk).
- For scripting with CI, use `VERCEL_TOKEN` in CI and `vercel env add --token $VERCEL_TOKEN ...`.
