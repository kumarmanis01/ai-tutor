# AI Coding Agent Instructions for Spinzy Academy

Welcome to the Spinzy Academy codebase! This document provides essential guidelines for AI coding agents to be productive and aligned with the project's architecture, workflows, and conventions.

## Project Overview

Spinzy Academy is a multilingual, accessibility-focused educational platform built with Next.js. Key features include:

- Multilingual chat (English/Hindi)
- Speech capabilities (Text-to-Speech and microphone input)
- Integration with OpenAI APIs for AI-driven features
- Modular and scalable architecture

The project is structured as a monorepo with clear separation of concerns:

- **Frontend**: Located in the `app/` directory, built with Next.js.
- **Backend APIs**: Defined in the `app/api/` directory, following RESTful conventions.
- **Shared Components**: Reusable UI components in `components/`.
- **Utilities and Libraries**: Helper functions in `lib/`.
- **Database**: Prisma ORM with schema in `prisma/schema.prisma`.

## Developer Workflows

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) to view the app.

### Testing

- End-to-end tests are located in `tests/e2e/`.
- Run tests with:
  ```bash
  npm test
  ```

### Database Migrations

- Prisma is used for database management.
- Apply migrations with:
  ```bash
  npx prisma migrate dev
  ```

## Project-Specific Conventions

### Component Structure

- Components are colocated with their styles and tests.
- Use TypeScript for type safety.
- Follow the folder structure in `components/` for organization.

### API Design

- APIs are defined in `app/api/`.
- Use RESTful principles and ensure proper error handling.

### State Management

- Context API is used for global state management (e.g., `context/AuthProvider.tsx`).

### Styling

- Tailwind CSS is used for styling. Configuration is in `tailwind.config.js`.

## Integration Points

### OpenAI API

- Requires `OPENAI_API_KEY` in `.env.local`.
- Used for AI-driven features in `lib/aiContext.ts`.

### Database

- Prisma ORM is configured in `prisma/`.
- Database connection settings are in `.env.local`.

### External Libraries

- `next-auth` for authentication.
- `razorpay` for payment integration.
- `i18n` for internationalization.

## Examples

### Adding a New API Endpoint

1. Create a new folder in `app/api/` (e.g., `app/api/new-feature/`).
2. Define the endpoint in `route.ts`.
3. Use `lib/db.ts` for database interactions.

### Creating a New Component

1. Add the component in `components/`.
2. Include styles in the same folder.
3. Export the component for reuse.

---

For further questions, refer to the `README.md` or ask a team member.
