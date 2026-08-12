import { betterAuth } from "better-auth";
import {
  buildAim4priceResetPasswordUrl,
  sendAim4priceResetPasswordEmail,
} from "./email";
import { deleteUserWorkspaceData } from "./account-deletion";
import { createInitialAccountProfile } from "./account-profile";
import { recordAdminUsageEventSafely } from "./admin-usage-events";
import { getDb } from "./db";
import {
  readSignupWorkspaceField,
  type SignupWorkspaceField,
} from "./signup-workspace-context";

function readSignupField(
  context: unknown,
  fieldName: SignupWorkspaceField,
): unknown {
  if (!context || typeof context !== "object") {
    return readSignupWorkspaceField(fieldName);
  }

  const body = (context as { body?: unknown }).body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return readSignupWorkspaceField(fieldName);
  }

  const value = (body as Record<string, unknown>)[fieldName];

  return value ?? readSignupWorkspaceField(fieldName);
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

function readAuthBaseUrl(): string {
  const normalized = normalizeTrustedOrigin(
    process.env.BETTER_AUTH_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.RAILWAY_PUBLIC_DOMAIN ||
      "",
  );

  if (normalized) {
    return normalized;
  }

  return process.env.NODE_ENV === "production"
    ? "https://aim4price.com"
    : "http://localhost:3000";
}

function readTrustedOrigins(authBaseUrl: string): string[] {
  const configuredOrigins = [
    authBaseUrl,
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

const authBaseUrl = readAuthBaseUrl();

export const auth = betterAuth({
  database: getDb(),
  baseURL: authBaseUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: readTrustedOrigins(authBaseUrl),
  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url, token }) => {
      const resetUrl = buildAim4priceResetPasswordUrl(token, url);

      await sendAim4priceResetPasswordEmail({
        to: user.email,
        name: user.name,
        resetUrl,
      });

      await recordAdminUsageEventSafely({
        userId: typeof user.id === "string" ? user.id : null,
        eventType: "password_reset_clicked",
        eventSource: "auth-password-reset",
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
                province: readSignupField(context, "province"),
                townCity: readSignupField(context, "townCity"),
                partnerDirectoryEnabled: readSignupField(
                  context,
                  "partnerDirectoryEnabled",
                ),
                phone: readSignupField(context, "phone"),
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
