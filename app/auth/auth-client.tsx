"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import styles from "./page.module.css";

type Mode = "signup" | "login" | "forgot";
type SignupAccountType = "owner" | "finance" | "insurance" | "dealer";
type SignupAccountSubtype =
  | "farmer"
  | "contractor"
  | "construction-company"
  | "asset-owner"
  | "bank"
  | "finance-house"
  | "accountant"
  | "short-term-insurer"
  | "machinery-dealer"
  | "auctioneer";
type SignupIntroducedByOption = "" | "kuyler" | "andre" | "direct" | "other";
type NoticeTone = "success" | "error" | "info";

type AuthNotice = {
  tone: NoticeTone;
  title: string;
  text: string;
} | null;

type SignupFormState = {
  accountType: SignupAccountType;
  accountSubtype: SignupAccountSubtype;
  introducedByOption: SignupIntroducedByOption;
  introducedByName: string;
  name: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
};

type LoginFormState = {
  email: string;
  password: string;
  rememberMe: boolean;
};

type ForgotFormState = {
  email: string;
};

const AUTH_BASE_PATH = "/api/auth";
const POST_LOGIN_REDIRECT = "/asset-register";
const ADMIN_EMAIL = "aim4price@gmail.com";

const SIGNUP_ACCOUNT_TYPE_OPTIONS: Array<{
  value: SignupAccountType;
  label: string;
}> = [
  { value: "owner", label: "Owner" },
  { value: "finance", label: "Finance" },
  { value: "insurance", label: "Insurer" },
  { value: "dealer", label: "Dealer" },
];

const SIGNUP_ACCOUNT_SUBTYPE_OPTIONS: Record<
  SignupAccountType,
  Array<{
    value: SignupAccountSubtype;
    label: string;
  }>
> = {
  owner: [
    { value: "farmer", label: "Farmer" },
    { value: "contractor", label: "Contractor" },
    { value: "construction-company", label: "Construction Company" },
    { value: "asset-owner", label: "Asset Owner" },
  ],
  finance: [
    { value: "bank", label: "Bank" },
    { value: "finance-house", label: "Finance House" },
    { value: "accountant", label: "Accountant" },
  ],
  insurance: [{ value: "short-term-insurer", label: "Short-Term Insurer" }],
  dealer: [
    { value: "machinery-dealer", label: "Machinery Dealer" },
    { value: "auctioneer", label: "Auctioneer" },
  ],
};

const INTRODUCED_BY_OPTIONS: Array<{
  value: Exclude<SignupIntroducedByOption, "">;
  label: string;
}> = [
  { value: "kuyler", label: "Kuyler" },
  { value: "andre", label: "Andre" },
  { value: "direct", label: "No one / direct signup" },
  { value: "other", label: "Other" },
];

function getDefaultSubtype(
  accountType: SignupAccountType,
): SignupAccountSubtype {
  return SIGNUP_ACCOUNT_SUBTYPE_OPTIONS[accountType][0].value;
}

const initialSignupState: SignupFormState = {
  accountType: "owner",
  accountSubtype: "farmer",
  introducedByOption: "",
  introducedByName: "",
  name: "",
  phone: "",
  email: "",
  password: "",
  confirmPassword: "",
  acceptTerms: false,
};

const initialLoginState: LoginFormState = {
  email: "",
  password: "",
  rememberMe: true,
};

const initialForgotState: ForgotFormState = {
  email: "",
};

function getModeFromHash(hash: string): Mode {
  const normalized = hash.replace("#", "").toLowerCase();

  if (normalized === "login" || normalized === "forgot") {
    return normalized;
  }

  return "signup";
}

function getNestedRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

async function readResponsePayload(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");
  return text.trim() ? { message: text } : null;
}

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  const record = getNestedRecord(payload);

  if (!record) {
    return null;
  }

  const errorRecord = getNestedRecord(record.error);
  const dataRecord = getNestedRecord(record.data);

  const candidates = [
    record.message,
    record.error,
    record.reason,
    errorRecord?.message,
    errorRecord?.error,
    dataRecord?.message,
    dataRecord?.error,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return null;
}

function extractRedirectUrl(payload: unknown): string | null {
  const record = getNestedRecord(payload);

  if (!record) {
    return null;
  }

  const dataRecord = getNestedRecord(record.data);
  const candidates = [
    record.url,
    record.redirectTo,
    record.redirectURL,
    record.location,
    dataRecord?.url,
    dataRecord?.redirectTo,
    dataRecord?.redirectURL,
    dataRecord?.location,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return null;
}

function getAbsoluteUrl(pathname: string) {
  if (typeof window === "undefined") {
    return pathname;
  }

  return new URL(pathname, window.location.origin).toString();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getCallbackUrl(email?: string) {
  return getAbsoluteUrl(
    email && normalizeEmail(email) === ADMIN_EMAIL ? "/admin" : POST_LOGIN_REDIRECT,
  );
}

function getResetPasswordUrl() {
  return getAbsoluteUrl("/reset-password");
}

async function postAuth(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${AUTH_BASE_PATH}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const payload = await readResponsePayload(response);

  if (response.status === 404) {
    throw new Error(
      "Authentication backend not connected yet. Mount Better Auth at /api/auth and this page is ready.",
    );
  }

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(payload) ??
        "Authentication request failed. Please try again.",
    );
  }

  return payload;
}

async function saveSignupProfileFallback(
  accountType: SignupAccountType,
  accountSubtype: SignupAccountSubtype,
  displayName: string,
  phone: string,
) {
  await fetch("/api/account-profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      accountType,
      accountSubtype,
      displayName,
      phone,
    }),
  }).catch(() => null);
}

export default function AuthClient() {
  const [mode, setMode] = useState<Mode>("signup");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [signupForm, setSignupForm] =
    useState<SignupFormState>(initialSignupState);
  const [loginForm, setLoginForm] = useState<LoginFormState>(initialLoginState);
  const [forgotForm, setForgotForm] =
    useState<ForgotFormState>(initialForgotState);
  const [notice, setNotice] = useState<AuthNotice>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncModeFromHash = () => {
      setMode(getModeFromHash(window.location.hash));
      setNotice(null);
    };

    syncModeFromHash();
    window.addEventListener("hashchange", syncModeFromHash);

    return () => window.removeEventListener("hashchange", syncModeFromHash);
  }, []);

  const copy = useMemo(() => {
    if (mode === "signup") {
      return {
        title: "Create your account",
        text: "Create an Aim4price account. Access stays pending until payment/admin approval is completed.",
        action: "Create account",
        footer: "Already have an account?",
        footerAction: "Log in",
      };
    }

    if (mode === "forgot") {
      return {
        title: "Reset your password",
        text: "Enter your account email and Aim4price will send a reset link if the account exists.",
        action: "Send reset email",
        footer: "Remembered your password?",
        footerAction: "Back to login",
      };
    }

    return {
      title: "Welcome back",
      text: "Log in to manage your valuations and machinery records.",
      action: "Log in",
      footer: "Need an account?",
      footerAction: "Create one",
    };
  }, [mode]);

  const updateHashAndMode = (nextMode: Mode) => {
    if (isSubmitting) {
      return;
    }

    setMode(nextMode);
    setNotice(null);

    if (typeof window !== "undefined") {
      const nextHash = `#${nextMode}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, "", nextHash);
      }
    }
  };

  const handleSignupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);

    const name = signupForm.name.trim();
    const phone = signupForm.phone.trim();
    const email = signupForm.email.trim();
    const introducedByName = signupForm.introducedByName.trim();

    if (
      !name ||
      !phone ||
      !email ||
      !signupForm.password ||
      !signupForm.confirmPassword
    ) {
      setNotice({
        tone: "error",
        title: "Missing information",
        text: "Complete your name, contact number, email and password before creating your account.",
      });
      return;
    }

    if (!signupForm.introducedByOption) {
      setNotice({
        tone: "error",
        title: "Introduced by required",
        text: "Select who introduced you to Aim4price before continuing.",
      });
      return;
    }

    if (signupForm.introducedByOption === "other" && !introducedByName) {
      setNotice({
        tone: "error",
        title: "Introduced by name required",
        text: "Enter the name or source that introduced you to Aim4price.",
      });
      return;
    }

    if (signupForm.password.length < 8) {
      setNotice({
        tone: "error",
        title: "Password too short",
        text: "Use at least 8 characters before continuing.",
      });
      return;
    }

    if (signupForm.password !== signupForm.confirmPassword) {
      setNotice({
        tone: "error",
        title: "Passwords do not match",
        text: "Confirm the same password in both password fields.",
      });
      return;
    }

    if (!signupForm.acceptTerms) {
      setNotice({
        tone: "error",
        title: "Terms required",
        text: "Accept the terms and privacy policy before continuing.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = await postAuth("/sign-up/email", {
        name,
        email,
        password: signupForm.password,
        phone,
        accountType: signupForm.accountType,
        accountSubtype: signupForm.accountSubtype,
        introducedByOption: signupForm.introducedByOption,
        introducedByName:
          signupForm.introducedByOption === "other" ? introducedByName : "",
        callbackURL: getCallbackUrl(email),
      });

      const redirectUrl = extractRedirectUrl(payload);

      await saveSignupProfileFallback(
        signupForm.accountType,
        signupForm.accountSubtype,
        name,
        phone,
      );

      setSignupForm(initialSignupState);
      setNotice({
        tone: "success",
        title: "Account created",
        text: "Your account has been created and is awaiting payment/admin approval. You will not be able to use protected pages until Aim4price activates the account.",
      });

      if (redirectUrl && typeof window !== "undefined") {
        window.setTimeout(() => {
          window.location.assign(redirectUrl);
        }, 350);
        return;
      }

      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          updateHashAndMode("login");
        }, 900);
      }
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Unable to create account",
        text:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);

    const email = loginForm.email.trim();

    if (!email || !loginForm.password) {
      setNotice({
        tone: "error",
        title: "Missing information",
        text: "Enter both your email and password before logging in.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = await postAuth("/sign-in/email", {
        email,
        password: loginForm.password,
        rememberMe: loginForm.rememberMe,
        callbackURL: getCallbackUrl(email),
      });

      const redirectUrl = extractRedirectUrl(payload) ?? POST_LOGIN_REDIRECT;

      setNotice({
        tone: "success",
        title: "Login successful",
        text: "Redirecting to your account area.",
      });

      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          window.location.assign(redirectUrl);
        }, 250);
      }
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Unable to log in",
        text:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);

    const email = forgotForm.email.trim();

    if (!email) {
      setNotice({
        tone: "error",
        title: "Email required",
        text: "Enter the email address linked to the Aim4price account.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await postAuth("/request-password-reset", {
        email,
        redirectTo: getResetPasswordUrl(),
      });

      setForgotForm(initialForgotState);
      setNotice({
        tone: "success",
        title: "Reset email sent",
        text: "If the account exists, Aim4price has sent a password reset link to that email address.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Unable to send reset email",
        text:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topBar}>
          <Link href="/" className={styles.homeLink}>
            Back to home
          </Link>
        </div>

        <section className={styles.frame}>
          <section
            className={styles.authCard}
            aria-labelledby="auth-heading"
            aria-busy={isSubmitting}
          >
            <div className={styles.modeRail} aria-label="Authentication mode">
              <button
                type="button"
                onClick={() => updateHashAndMode("signup")}
                className={`${styles.modeButton} ${mode === "signup" ? styles.modeButtonActive : ""}`}
                aria-pressed={mode === "signup"}
              >
                Sign up
              </button>

              <button
                type="button"
                onClick={() => updateHashAndMode("login")}
                className={`${styles.modeButton} ${mode === "login" ? styles.modeButtonActive : ""}`}
                aria-pressed={mode === "login"}
              >
                Login
              </button>
            </div>

            <div className={styles.authHeader}>
              <h1 id="auth-heading" className={styles.authTitle}>
                {copy.title}
              </h1>
              <p className={styles.authText}>{copy.text}</p>
            </div>

            {notice ? (
              <div
                className={`${styles.notice} ${
                  notice.tone === "success"
                    ? styles.noticeSuccess
                    : notice.tone === "info"
                      ? styles.noticeInfo
                      : styles.noticeError
                }`}
                role={notice.tone === "error" ? "alert" : "status"}
                aria-live="polite"
              >
                <strong className={styles.noticeTitle}>{notice.title}</strong>
                <span className={styles.noticeText}>{notice.text}</span>
              </div>
            ) : null}

            {mode === "signup" ? (
              <form
                className={styles.form}
                onSubmit={handleSignupSubmit}
                noValidate
              >
                <div className={styles.signupTypeRow}>
                  <label className={styles.field}>
                    <span className={styles.label}>Choose account type</span>
                    <select
                      name="accountType"
                      className={styles.select}
                      value={signupForm.accountType}
                      onChange={(event) => {
                        const nextAccountType = event.target
                          .value as SignupAccountType;
                        setSignupForm((current) => ({
                          ...current,
                          accountType: nextAccountType,
                          accountSubtype: getDefaultSubtype(nextAccountType),
                        }));
                      }}
                    >
                      {SIGNUP_ACCOUNT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span className={styles.label}>
                      Which best describes you?
                    </span>
                    <select
                      name="accountSubtype"
                      className={styles.select}
                      value={signupForm.accountSubtype}
                      onChange={(event) =>
                        setSignupForm((current) => ({
                          ...current,
                          accountSubtype: event.target
                            .value as SignupAccountSubtype,
                        }))
                      }
                    >
                      {SIGNUP_ACCOUNT_SUBTYPE_OPTIONS[
                        signupForm.accountType
                      ].map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className={styles.field}>
                  <span className={styles.label}>
                    Who introduced you to Aim4price?
                  </span>
                  <select
                    name="introducedByOption"
                    className={styles.select}
                    value={signupForm.introducedByOption}
                    onChange={(event) => {
                      const value = event.target
                        .value as SignupIntroducedByOption;
                      setSignupForm((current) => ({
                        ...current,
                        introducedByOption: value,
                        introducedByName:
                          value === "other" ? current.introducedByName : "",
                      }));
                    }}
                    required
                  >
                    <option value="">Select introduced by</option>
                    {INTRODUCED_BY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {signupForm.introducedByOption === "other" ? (
                  <label className={styles.field}>
                    <span className={styles.label}>
                      Introduced by name/source
                    </span>
                    <input
                      type="text"
                      name="introducedByName"
                      autoComplete="off"
                      placeholder="Name, business, event, advert, or source"
                      className={styles.input}
                      value={signupForm.introducedByName}
                      onChange={(event) =>
                        setSignupForm((current) => ({
                          ...current,
                          introducedByName: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                ) : null}

                <label className={styles.field}>
                  <span className={styles.label}>Full name</span>
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    placeholder="Kuyler Geldenhuys"
                    className={styles.input}
                    value={signupForm.name}
                    onChange={(event) =>
                      setSignupForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Contact number</span>
                  <input
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="Phone or WhatsApp number"
                    className={styles.input}
                    value={signupForm.phone}
                    onChange={(event) =>
                      setSignupForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Email address</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="name@example.com"
                    className={styles.input}
                    value={signupForm.email}
                    onChange={(event) =>
                      setSignupForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className={styles.field}>
                  <div className={styles.labelRow}>
                    <span className={styles.label}>Password</span>
                    <span className={styles.helperText}>
                      Minimum 8 characters
                    </span>
                  </div>

                  <div className={styles.passwordWrap}>
                    <input
                      type={showSignupPassword ? "text" : "password"}
                      name="password"
                      autoComplete="new-password"
                      minLength={8}
                      placeholder="Create a secure password"
                      className={`${styles.input} ${styles.passwordInput}`}
                      value={signupForm.password}
                      onChange={(event) =>
                        setSignupForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowSignupPassword((current) => !current)
                      }
                      className={styles.passwordToggle}
                      aria-label={
                        showSignupPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showSignupPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Confirm password</span>
                  <input
                    type={showSignupPassword ? "text" : "password"}
                    name="confirmPassword"
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Repeat your password"
                    className={styles.input}
                    value={signupForm.confirmPassword}
                    onChange={(event) =>
                      setSignupForm((current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={signupForm.acceptTerms}
                    onChange={(event) =>
                      setSignupForm((current) => ({
                        ...current,
                        acceptTerms: event.target.checked,
                      }))
                    }
                  />
                  <span>I agree to the terms and privacy policy.</span>
                </label>

                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating account..." : copy.action}
                </button>
              </form>
            ) : null}

            {mode === "login" ? (
              <form
                className={styles.form}
                onSubmit={handleLoginSubmit}
                noValidate
              >
                <label className={styles.field}>
                  <span className={styles.label}>Email address</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="name@example.com"
                    className={styles.input}
                    value={loginForm.email}
                    onChange={(event) =>
                      setLoginForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className={styles.field}>
                  <div className={styles.labelRow}>
                    <span className={styles.label}>Password</span>
                    <button
                      type="button"
                      className={styles.inlineTextButton}
                      onClick={() => updateHashAndMode("forgot")}
                    >
                      Forgot password?
                    </button>
                  </div>

                  <div className={styles.passwordWrap}>
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      name="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className={`${styles.input} ${styles.passwordInput}`}
                      value={loginForm.password}
                      onChange={(event) =>
                        setLoginForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowLoginPassword((current) => !current)
                      }
                      className={styles.passwordToggle}
                      aria-label={
                        showLoginPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showLoginPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>

                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={loginForm.rememberMe}
                    onChange={(event) =>
                      setLoginForm((current) => ({
                        ...current,
                        rememberMe: event.target.checked,
                      }))
                    }
                  />
                  <span>Keep me signed in on this device.</span>
                </label>

                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Logging in..." : copy.action}
                </button>
              </form>
            ) : null}

            {mode === "forgot" ? (
              <form
                className={styles.form}
                onSubmit={handleForgotSubmit}
                noValidate
              >
                <label className={styles.field}>
                  <span className={styles.label}>Email address</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="name@example.com"
                    className={styles.input}
                    value={forgotForm.email}
                    onChange={(event) =>
                      setForgotForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </label>

                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Sending reset email..." : copy.action}
                </button>
              </form>
            ) : null}

            <p className={styles.footerText}>
              {copy.footer}{" "}
              <button
                type="button"
                className={styles.footerButton}
                onClick={() =>
                  updateHashAndMode(
                    mode === "signup"
                      ? "login"
                      : mode === "forgot"
                        ? "login"
                        : "signup",
                  )
                }
              >
                {copy.footerAction}
              </button>
            </p>
          </section>
        </section>
      </div>
    </main>
  );
}
