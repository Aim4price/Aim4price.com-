import { betterAuth } from 'better-auth';
import { deleteUserWorkspaceData } from './account-deletion';
import { createInitialAccountProfile } from './account-profile';
import { getDb } from './db';

function readSignupAccountType(context: unknown): unknown {
  if (!context || typeof context !== 'object') {
    return null;
  }

  const body = (context as { body?: unknown }).body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  return (body as Record<string, unknown>).accountType;
}

export const auth = betterAuth({
  database: getDb(),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user, context) => {
          try {
            await createInitialAccountProfile(
              {
                id: user.id,
                name: typeof user.name === 'string' ? user.name : null,
                email: typeof user.email === 'string' ? user.email : null,
              },
              { accountType: readSignupAccountType(context) },
            );
          } catch (error) {
            console.error('Failed to create initial Aim4price account profile', error);
          }
        },
      },
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        await deleteUserWorkspaceData(user.id);
      },
    },
  },
});
