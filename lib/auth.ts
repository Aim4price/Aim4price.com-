import { betterAuth } from "better-auth";
import { sendAim4priceResetPasswordEmail } from "./email";
import { deleteUserWorkspaceData } from "./account-deletion";
import { createInitialAccountProfile } from "./account-profile";
import { getDb } from "./db";

function readSignupField(context: unknown, fieldName: string): unknown {
  if (!context || typeof context !== "object") {
    return null;
  }

  const body = (context as { body?: unknown }).body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  return (body as Record<string, unknown>)[fieldName];
}

export const auth = betterAuth({
  database: getDb(),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      void sendAim4priceResetPasswordEmail({
        to: user.email,
        name: user.name,
        resetUrl: url,
      }).catch((error) => {
        console.error("Failed to send Aim4price reset password email", error);
      });
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user, context) => {
          try {
            await createInitialAccountProfile(
              {
                id: user.id,
                name: typeof user.name === "string" ? user.name : null,
                email: typeof user.email === "string" ? user.email : null,
              },
              {
                accountType: readSignupField(context, "accountType"),
                accountSubtype: readSignupField(context, "accountSubtype"),
                introducedByOption: readSignupField(
                  context,
                  "introducedByOption",
                ),
                introducedByName: readSignupField(context, "introducedByName"),
              },
            );
          } catch (error) {
            console.error(
              "Failed to create initial Aim4price account profile",
              error,
            );
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
