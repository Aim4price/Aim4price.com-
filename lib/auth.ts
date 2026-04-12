import { betterAuth } from 'better-auth';
import { deleteUserWorkspaceData } from './account-deletion';
import { getDb } from './db';

export const auth = betterAuth({
  database: getDb(),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
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
