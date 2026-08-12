"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { refreshCachedHeaderSession } from "../../lib/header-session-cache";
import styles from "./page.module.css";

type Mode = "signup" | "login" | "forgot";
type SignupAccountType = "owner" | "finance" | "insurance" | "dealer" | "licensing";
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
  | "motor-dealer"
  | "auctioneer"
  | "licence-renewal-expert"
  | "fleet-licensing-service";
type SignupIntroducedByOption = "" | "kuyler" | "andre" | "direct" | "other";
type SignupProvince =
  | ""
  | "Eastern Cape"
  | "Free State"
  | "Gauteng"
  | "KwaZulu-Natal"
  | "Limpopo"
  | "Mpumalanga"
  | "Northern Cape"
  | "North West"
  | "Western Cape";
type NoticeTone = "success" | "error" | "info";

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

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
  province: SignupProvince;
  townCity: string;
  directoryParticipation: boolean;
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

const SIGNUP_ACCOUNT_TYPE_OPTIONS: Array<SelectOption<SignupAccountType>> = [
  { value: "owner", label: "Asset owner" },
  { value: "finance", label: "Finance, accounting and banking" },
  { value: "insurance", label: "Insurance provider" },
  { value: "dealer", label: "Dealer / auctioneer" },
  { value: "licensing", label: "Licence renewal expert" },
];

const SIGNUP_ACCOUNT_SUBTYPE_OPTIONS: Record<
  SignupAccountType,
  Array<SelectOption<SignupAccountSubtype>>
> = {
  owner: [
    { value: "farmer", label: "Farmer / farm owner" },
    { value: "contractor", label: "Contractor / operator" },
    { value: "construction-company", label: "Construction company" },
    { value: "asset-owner", label: "Private / fleet asset owner" },
  ],
  finance: [
    { value: "bank", label: "Bank / finance institution" },
    { value: "finance-house", label: "Equipment finance house" },
    { value: "accountant", label: "Accountant / asset adviser" },
  ],
  insurance: [
    { value: "short-term-insurer", label: "Short-term insurance provider" },
  ],
  dealer: [
    { value: "machinery-dealer", label: "Machinery dealer" },
    { value: "motor-dealer", label: "Motor dealer" },
    { value: "auctioneer", label: "Auctioneer / broker" },
  ],
  licensing: [
    { value: "licence-renewal-expert", label: "Licence renewal expert" },
    { value: "fleet-licensing-service", label: "Fleet licensing service" },
  ],
};

const INTRODUCED_BY_OPTIONS: Array<SelectOption<SignupIntroducedByOption>> = [
  { value: "kuyler", label: "Kuyler Geldenhuys" },
  { value: "andre", label: "Andre Van Rooyen" },
  { value: "direct", label: "No one / direct signup" },
  { value: "other", label: "Other person or source" },
];

const PROVINCE_OPTIONS: Array<SelectOption<Exclude<SignupProvince, "">>> = [
  { value: "Eastern Cape", label: "Eastern Cape" },
  { value: "Free State", label: "Free State" },
  { value: "Gauteng", label: "Gauteng" },
  { value: "KwaZulu-Natal", label: "KwaZulu-Natal" },
  { value: "Limpopo", label: "Limpopo" },
  { value: "Mpumalanga", label: "Mpumalanga" },
  { value: "Northern Cape", label: "Northern Cape" },
  { value: "North West", label: "North West" },
  { value: "Western Cape", label: "Western Cape" },
];

function CustomSelect<T extends string>({
  name,
  value,
  options,
  onChange,
  placeholder = "Select an option",
}: {
  name: string;
  value: T;
  options: Array<SelectOption<T>>;
  onChange: (value: T) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedOption = options.find((option) => option.value === value);
  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );
  const buttonId = `${name}-dropdown-button`;
  const listboxId = `${name}-dropdown-listbox`;

  const focusOption = (index: number) => {
    if (!options.length) {
      return;
    }

    const nextIndex = (index + options.length) % options.length;
    optionRefs.current[nextIndex]?.focus();
  };

  const openMenu = (focusIndex = selectedIndex) => {
    setIsOpen(true);
    window.requestAnimationFrame(() => focusOption(focusIndex));
  };

  const closeMenu = (restoreButtonFocus = false) => {
    setIsOpen(false);

    if (restoreButtonFocus) {
      window.requestAnimationFrame(() => buttonRef.current?.focus());
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;

      if (
        target instanceof Node &&
        rootRef.current &&
        !rootRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu(true);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleDocumentKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [isOpen]);

  const commitChange = (nextValue: T) => {
    onChange(nextValue);
    closeMenu(true);
  };

  const handleButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(selectedIndex);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(selectedOption ? selectedIndex : options.length - 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      if (isOpen) {
        closeMenu();
      } else {
        openMenu(selectedIndex);
      }
    }
  };

  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    nextValue: T,
    optionIndex: number,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commitChange(nextValue);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(optionIndex + 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(optionIndex - 1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusOption(options.length - 1);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    }

    if (event.key === "Tab") {
      closeMenu();
    }
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.customSelect} ${isOpen ? styles.customSelectOpen : ""}`}
    >
      <input type="hidden" name={name} value={value} />
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        className={`${styles.customSelectButton} ${!selectedOption ? styles.customSelectPlaceholder : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        onClick={() => {
          if (isOpen) {
            closeMenu();
          } else {
            openMenu(selectedIndex);
          }
        }}
        onKeyDown={handleButtonKeyDown}
      >
        <span className={styles.customSelectButtonCopy}>
          {selectedOption?.label ?? placeholder}
        </span>
        <span className={styles.customSelectChevron} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          id={listboxId}
          className={styles.customSelectMenu}
          role="listbox"
          aria-labelledby={buttonId}
        >
          {options.map((option, optionIndex) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                ref={(element) => {
                  optionRefs.current[optionIndex] = element;
                }}
                type="button"
                role="option"
                tabIndex={
                  isSelected || (!selectedOption && optionIndex === 0) ? 0 : -1
                }
                aria-selected={isSelected}
                className={`${styles.customSelectOption} ${
                  isSelected ? styles.customSelectOptionSelected : ""
                }`}
                onClick={() => commitChange(option.value)}
                onKeyDown={(event) =>
                  handleOptionKeyDown(event, option.value, optionIndex)
                }
              >
                <span>{option.label}</span>
                {isSelected ? (
                  <span className={styles.customSelectCheck} aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}


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
  province: "",
  townCity: "",
  directoryParticipation: false,
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

function getSafeReturnTo(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("returnTo");
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

function getCallbackUrl(email?: string) {
  return getAbsoluteUrl(
    email && normalizeEmail(email) === ADMIN_EMAIL ? "/admin" : (getSafeReturnTo() ?? POST_LOGIN_REDIRECT),
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
        text: "Tell us how you plan to use Aim4price so we can set up the right workspace for you. Access remains pending until payment or admin approval is complete.",
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
      text: "Log in to access your Aim4price account and workspace.",
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
    const province = signupForm.province;
    const townCity = signupForm.townCity.trim();

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

    if (!province) {
      setNotice({
        tone: "error",
        title: "Province required",
        text: "Select your province before creating your Aim4price account.",
      });
      return;
    }

    if (!townCity) {
      setNotice({
        tone: "error",
        title: "Town or city required",
        text: "Add your town or city so Aim4price can provide relevant local tools and results.",
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
        province,
        townCity,
        partnerDirectoryEnabled:
          signupForm.accountType !== "owner" &&
          signupForm.directoryParticipation,
        introducedByOption: signupForm.introducedByOption,
        introducedByName:
          signupForm.introducedByOption === "other" ? introducedByName : "",
        callbackURL: getCallbackUrl(email),
      });

      const redirectUrl = extractRedirectUrl(payload);

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

      const authRedirectUrl = extractRedirectUrl(payload) ?? POST_LOGIN_REDIRECT;
      const authenticatedSession = await refreshCachedHeaderSession().catch(() => null);
      const partnerWorkspaceUrl = authenticatedSession?.accountType === "licensing"
        ? getAbsoluteUrl("/licensing")
        : getAbsoluteUrl("/leads");
      const redirectUrl =
        !getSafeReturnTo() &&
        normalizeEmail(email) !== ADMIN_EMAIL &&
        (authenticatedSession?.accountType === "dealer" ||
          authenticatedSession?.accountType === "licensing")
          ? partnerWorkspaceUrl
          : authRedirectUrl;

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
                  <div className={styles.field}>
                    <span className={styles.label}>Choose account type</span>
                    <CustomSelect
                      name="accountType"
                      value={signupForm.accountType}
                      options={SIGNUP_ACCOUNT_TYPE_OPTIONS}
                      onChange={(nextAccountType) => {
                        setSignupForm((current) => ({
                          ...current,
                          accountType: nextAccountType,
                          accountSubtype: getDefaultSubtype(nextAccountType),
                          directoryParticipation: nextAccountType !== "owner",
                        }));
                      }}
                    />
                  </div>

                  <div className={styles.field}>
                    <span className={styles.label}>
                      Which best describes you?
                    </span>
                    <CustomSelect
                      name="accountSubtype"
                      value={signupForm.accountSubtype}
                      options={
                        SIGNUP_ACCOUNT_SUBTYPE_OPTIONS[signupForm.accountType]
                      }
                      onChange={(nextAccountSubtype) =>
                        setSignupForm((current) => ({
                          ...current,
                          accountSubtype: nextAccountSubtype,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <span className={styles.label}>
                    Who introduced you to Aim4price?
                  </span>
                  <CustomSelect
                    name="introducedByOption"
                    value={signupForm.introducedByOption}
                    options={INTRODUCED_BY_OPTIONS}
                    placeholder="Choose one"
                    onChange={(value) => {
                      setSignupForm((current) => ({
                        ...current,
                        introducedByOption: value,
                        introducedByName:
                          value === "other" ? current.introducedByName : "",
                      }));
                    }}
                  />
                </div>

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

                <div className={styles.field}>
                  <span className={styles.label}>Province</span>
                  <CustomSelect
                    name="province"
                    value={signupForm.province}
                    options={PROVINCE_OPTIONS}
                    placeholder="Choose province"
                    onChange={(province) => {
                      setSignupForm((current) => ({
                        ...current,
                        province,
                      }));
                    }}
                  />
                </div>

                <label className={styles.field}>
                  <span className={styles.label}>Town / city</span>
                  <input
                    type="text"
                    name="townCity"
                    autoComplete="address-level2"
                    placeholder="Example: Oudtshoorn"
                    className={styles.input}
                    value={signupForm.townCity}
                    onChange={(event) =>
                      setSignupForm((current) => ({
                        ...current,
                        townCity: event.target.value,
                      }))
                    }
                  />
                </label>

                {signupForm.accountType !== "owner" ? (
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={signupForm.directoryParticipation}
                      onChange={(event) =>
                        setSignupForm((current) => ({
                          ...current,
                          directoryParticipation: event.target.checked,
                        }))
                      }
                    />
                    <span>List my business in the Aim4price partner directory so owners can find me by location. I can refine or disable this later.</span>
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
