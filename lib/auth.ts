// Import necessary libraries and providers for authentication
import { PrismaAdapter } from '@next-auth/prisma-adapter'; // Connects NextAuth to your database
import GoogleProvider from 'next-auth/providers/google'; // Enables Google login/signup
import EmailProvider from 'next-auth/providers/email'; // Enables email login/signup
import CredentialsProvider from 'next-auth/providers/credentials'; // Enables login with email & password
import type { NextAuthOptions } from 'next-auth';
import { prisma } from '@/lib/prisma'; // Your Prisma database client
import bcrypt from 'bcrypt'; // For password hashing
import { getEmailTransporter } from '@/lib/mailer';

// This function sends a welcome email to the user
async function sendWelcomeEmail(to: string, name?: string) {
  // Set up the email transporter using your SMTP credentials
  const transporter = getEmailTransporter();

  try {
    // Send the actual email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM_NOREPLY,
      to,
      subject: 'Welcome to Spinzy Academy!',
      html: `
        <div style="font-family: Arial, sans-serif; color: #222;">
          <h2 style="color:#2d6cdf;">Welcome to Spinzy Academy, ${name || to}!</h2>
          <p>
            We're absolutely delighted to have you join our learning family.<br>
            At Spinzy Academy, your curiosity and growth are at the heart of everything we do.
          </p>
          <p>
            <strong>What’s next?</strong><br>
            Explore our resources, ask questions, and connect with fellow learners. Your journey to mastering new skills starts now!
          </p>
          <p>
            If you ever need help or just want to say hello, reply to this email or reach out to our friendly support team. We’re here for you!
          </p>
          <br>
          <p>
            Wishing you an inspiring and successful learning adventure.<br>
            <span style="color:#2d6cdf;">Warm regards,</span><br>
            <strong>The Spinzy Academy Team</strong>
          </p>
        </div>
      `,
    });
    // Log success info to the server console
    console.log('Welcome email sent:', info);
  } catch (error) {
    // Log any errors to the server console
    console.error('Failed to send welcome email:', error);
  }
}

// Standalone method to check flag, send welcome email, and update flag
async function maybeSendWelcomeEmail(email: string, name?: string) {
  // Fetch user from DB
  const dbUser = await prisma.user.findUnique({ where: { email } });
  console.log('[maybeSendWelcomeEmail] Database user fetched:', dbUser);
  if (dbUser && !dbUser.welcomeEmailSent) {
    // Send welcome email
    await sendWelcomeEmail(email, name);
    // Update flag
    await prisma.user.update({
      where: { email },
      data: { welcomeEmailSent: true },
    });
    console.log('[maybeSendWelcomeEmail] Welcome email sent and flag updated for:', email);
  } else {
    console.log('[maybeSendWelcomeEmail] Welcome email already sent for:', email);
  }
}

// Main NextAuth configuration object
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma), // Connects NextAuth to your database
  providers: [
    // Enable Google login/signup
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // Enable email login/signup
    EmailProvider({
      // Use explicit SMTP object so NextAuth uses the same SMTP config
      // as `lib/mailer.ts` (host/port/user/password). This avoids relying
      // on a single `EMAIL_SERVER` URL and keeps configuration explicit.
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
        secure: true,
      },
      from:
        process.env.EMAIL_FROM_NOREPLY ||
        process.env.EMAIL_FROM ||
        `"Spinzy Academy" <${process.env.EMAIL_SERVER_USER}>`,
    }),
    // Enable login with email & password
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      // This function checks if the user's credentials are correct
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        // Find the user in the database
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user || !user.passwordHash) return null;
        // Compare the entered password with the stored hash
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;
        // Return user info for the session
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          parentEmail: user.parentEmail,
          grade: user.grade,
          country: user.country,
          language: user.language,
          createdAt: user.createdAt ? user.createdAt.toISOString() : null,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' }, // Use JWT for session management
  callbacks: {
    // This runs when a user signs in (login or signup)
    async signIn({ user }) {
      await maybeSendWelcomeEmail(user.email!, user.name ?? undefined).catch((err) =>
        console.error('Error in maybeSendWelcomeEmail:', err),
      );
      // console.log('signin callback activated with user:', user.email!);
      // // Best Practice: Use welcomeEmailSent flag to ensure email is sent only once
      // const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
      // console.log('Database user fetched:', dbUser);
      // if (dbUser && !dbUser.welcomeEmailSent) {
      //   // Send welcome email and set the flag
      //   await sendWelcomeEmail(user.email!, user.name ?? undefined);
      //   await prisma.user.update({
      //     where: { email: user.email! },
      //     data: { welcomeEmailSent: true },
      //   });
      //   console.log('Welcome email sent and flag updated for:', user.email);
      // } else {
      //   console.log('Welcome email already sent for:', user.email);
      // }
      return true;
    },
    // This shapes the JWT token with user info
    async jwt({ token, user }) {
      if (user) {
        console.log('JWT callback activated for user:', user.email!);
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.image = user.image;
        if ('role' in user) token.role = user.role;
        if ('parentEmail' in user) token.parentEmail = user.parentEmail;
        if ('grade' in user) token.grade = user.grade;
        if ('country' in user) token.country = user.country;
        if ('language' in user) token.language = user.language;
        if ('createdAt' in user) token.createdAt = user.createdAt;
      }
      return token;
    },
    // This shapes the session object sent to the client
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.image as string;
        session.user.role = token.role as string;
        session.user.parentEmail = token.parentEmail as string;
        session.user.grade = token.grade as string;
        session.user.country = token.country as string;
        session.user.language = token.language as string;
        session.user.createdAt = token.createdAt as string;

        console.log('JWT callback activated for user:', session.user.email!);
        // Call the standalone method to handle welcome email logic
        await maybeSendWelcomeEmail(session.user.email!, session.user.name ?? undefined);
      }
      return session;
    },
  },
};
