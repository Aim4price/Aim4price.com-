import { AsyncLocalStorage } from "node:async_hooks";

const SIGNUP_WORKSPACE_FIELDS = [
  "accountType",
  "accountSubtype",
  "introducedByOption",
  "introducedByName",
  "province",
  "townCity",
  "partnerDirectoryEnabled",
  "phone",
] as const;

export type SignupWorkspaceField = (typeof SIGNUP_WORKSPACE_FIELDS)[number];
type SignupWorkspaceInput = Partial<Record<SignupWorkspaceField, unknown>>;

const signupWorkspaceStorage = new AsyncLocalStorage<SignupWorkspaceInput>();

function sanitizeSignupWorkspaceInput(value: unknown): SignupWorkspaceInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const source = value as Record<string, unknown>;

  return Object.fromEntries(
    SIGNUP_WORKSPACE_FIELDS.map((field) => [field, source[field]]),
  ) as SignupWorkspaceInput;
}

export function withSignupWorkspaceInput<T>(
  value: unknown,
  operation: () => Promise<T>,
): Promise<T> {
  return signupWorkspaceStorage.run(
    sanitizeSignupWorkspaceInput(value),
    operation,
  );
}

export function readSignupWorkspaceField(
  field: SignupWorkspaceField,
): unknown {
  return signupWorkspaceStorage.getStore()?.[field] ?? null;
}
