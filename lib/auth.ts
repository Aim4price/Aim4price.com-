import { betterAuth } from "better-auth";
import {
  buildAim4priceResetPasswordUrl,
  sendAim4priceResetPasswordEmail,
} from "./email";
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

function normalizeTrustedOrigin(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, "");

  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("*")) {
    return trimmed;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

function readTrustedOrigins(): string[] {
  const configuredOrigins = [
    process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.BETTER_AUTH_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN,
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(","))
    .map(normalizeTrustedOrigin)
    .filter((value): value is string => Boolean(value));

  return Array.from(
    new Set([
      ...configuredOrigins,
      "https://aim4price.com",
      "https://www.aim4price.com",
      "http://localhost:3000",
      "http://localhost:3001",
    ]),
  );
}

export const auth = betterAuth({
  database: getDb(),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: readTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url, token }) => {
      const resetUrl = buildAim4priceResetPasswordUrl(token, url);

      void sendAim4priceResetPasswordEmail({
        to: user.email,
        name: user.name,
        resetUrl,
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
