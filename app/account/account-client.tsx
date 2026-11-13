"use client";
import { PageHelpHeading } from '../../components/PageHelp';

import QuickActionIcon from "./QuickActionIcon";
import AccountModalScroller from "./account-modal-scroller";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import SettingsDetailIcon from "../../components/SettingsDetailIcon";
import DesktopNotificationSettings from "./notifications/notification-settings-client";
import AccountInvoices from "./account-invoices";
import AppHeader from "../../components/AppHeader";
import { isMiddlemanAccountSubtype } from "../../lib/middleman-account";
import styles from "./page.module.css";
import notificationStyles from "./notifications/page.module.css";

type NoticeTone = "success" | "error";
type AccountNotice = {
  tone: NoticeTone;
  message: string;
};
type BusinessDetailsStep = 1 | 2 | 3;
type PartnerDirectoryStep = 1 | 2 | 3 | 4;
type AccountActionModal =
  | "invoices"
  | "notifications"
  | "business"
  | "scanPin"
  | "marketplace"
  | "discovery"
  | "partnerDirectory"
  | "password"
  | "email";

type AccountProfile = {
  userId: string;
  name: string;
  displayName: string;
  email: string;
  logoUrl: string;
  websiteUrl: string;
  extraPhotoUrls: string[];
  businessName: string;
  phone: string;
  accountType: string;
  accountSubtype: string;
  vatNumber: string;
  province: string;
  townCity: string;
  addressLine1: string;
  addressLine2: string;
  notes: string;
  marketplaceSellerName: string;
  marketplacePhone: string;
  marketplaceEmail: string;
  marketplaceLocation: string;
  discoveryParticipationEnabled: boolean;
  partnerDirectoryEnabled: boolean;
  partnerDirectoryStatus: string;
  partnerDescription: string;
  partnerLatitude: number | null;
  partnerLongitude: number | null;
  partnerServiceRadiusKm: number | null;
  partnerBrandFocus: string;
  partnerServices: string;
  createdAtIso: string | null;
  updatedAtIso: string | null;
};

type AccountScanPinStatus = {
  enabled: boolean;
  hasPin: boolean;
  updatedAtIso: string | null;
};

type ProfileApiResponse = {
  ok: boolean;
  profile?: AccountProfile;
  error?: string;
};

type ScanPinApiResponse = {
  ok: boolean;
  scanPin?: AccountScanPinStatus;
  error?: string;
};

type AccountClientProps = {
  canManageDesktopUsers?: boolean;
  sharedAccount?: boolean;
  sharedSettings?: ReactNode;
  initialProfile?: AccountProfile | null;
  initialScanPinStatus?: AccountScanPinStatus | null;
};

type ProfileDraft = {
  displayName: string;
  logoUrl: string;
  websiteUrl: string;
  extraPhotoUrls: string[];
  businessName: string;
  phone: string;
  accountType: string;
  vatNumber: string;
  province: string;
  townCity: string;
  addressLine1: string;
  addressLine2: string;
  notes: string;
  marketplaceSellerName: string;
  marketplacePhone: string;
  marketplaceEmail: string;
  marketplaceLocation: string;
  discoveryParticipationEnabled: boolean;
  partnerDirectoryEnabled: boolean;
  partnerDirectoryStatus: string;
  partnerDescription: string;
  partnerLatitude: string;
  partnerLongitude: string;
  partnerServiceRadiusKm: string;
  partnerBrandFocus: string;
  partnerServices: string;
};

const initialProfileDraft: ProfileDraft = {
  displayName: "",
  logoUrl: "",
  websiteUrl: "",
  extraPhotoUrls: [],
  businessName: "",
  phone: "",
  accountType: "owner",
  vatNumber: "",
  province: "",
  townCity: "",
  addressLine1: "",
  addressLine2: "",
  notes: "",
  marketplaceSellerName: "",
  marketplacePhone: "",
  marketplaceEmail: "",
  marketplaceLocation: "",
  discoveryParticipationEnabled: false,
  partnerDirectoryEnabled: false,
  partnerDirectoryStatus: "approved",
  partnerDescription: "",
  partnerLatitude: "",
  partnerLongitude: "",
  partnerServiceRadiusKm: "",
  partnerBrandFocus: "",
  partnerServices: "",
};

const emptyScanPinStatus: AccountScanPinStatus = {
  enabled: false,
  hasPin: false,
  updatedAtIso: null,
};

const PROFILE_COMPLETION_TOTAL = 7;
const MAX_LOGO_UPLOAD_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  owner: "Owner",
  dealer: "Dealer",
  business: "Business",
  middleman: "Middleman",
  finance: "Finance — accountants, financiers and banks",
  insurance: "Insurance",
  broker: "Insurance",
  insurer: "Insurance",
  bank: "Finance",
};

const ACCOUNT_DIALOG_FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getAccountDialogFocusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(ACCOUNT_DIALOG_FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      element.getAttribute("aria-hidden") !== "true" &&
      element.getClientRects().length > 0,
  );
}

function keepFocusInsideAccountDialog(
  event: KeyboardEvent,
  dialog: HTMLElement,
) {
  if (event.key !== "Tab") {
    return;
  }

  const focusableElements = getAccountDialogFocusableElements(dialog);

  if (!focusableElements.length) {
    event.preventDefault();
    dialog.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (!dialog.contains(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? lastElement : firstElement).focus();
    return;
  }

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function buildProfileLocation(profile: AccountProfile): string {
  return [profile.addressLine1, profile.townCity, profile.province]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function buildProfileDraft(profile: AccountProfile | null): ProfileDraft {
  if (!profile) {
    return initialProfileDraft;
  }

  const displayName = profile.displayName || profile.name;
  const fallbackLocation = buildProfileLocation(profile);

  return {
    displayName,
    logoUrl: profile.logoUrl,
    websiteUrl: profile.websiteUrl,
    extraPhotoUrls: [],
    businessName: profile.businessName,
    phone: profile.phone,
    accountType: profile.accountType || "owner",
    vatNumber: profile.vatNumber,
    province: profile.province,
    townCity: profile.townCity,
    addressLine1: profile.addressLine1,
    addressLine2: profile.addressLine2,
    notes: profile.notes,
    marketplaceSellerName:
      profile.marketplaceSellerName || profile.businessName || displayName,
    marketplacePhone: profile.marketplacePhone || profile.phone,
    marketplaceEmail: profile.marketplaceEmail,
    marketplaceLocation: profile.marketplaceLocation || fallbackLocation,
    discoveryParticipationEnabled: Boolean(
      profile.discoveryParticipationEnabled,
    ),
    partnerDirectoryEnabled: Boolean(profile.partnerDirectoryEnabled),
    partnerDirectoryStatus: profile.partnerDirectoryStatus || "approved",
    partnerDescription: profile.partnerDescription,
    partnerLatitude:
      profile.partnerLatitude === null ? "" : String(profile.partnerLatitude),
    partnerLongitude:
      profile.partnerLongitude === null ? "" : String(profile.partnerLongitude),
    partnerServiceRadiusKm:
      profile.partnerServiceRadiusKm === null
        ? ""
        : String(profile.partnerServiceRadiusKm),
    partnerBrandFocus: profile.partnerBrandFocus,
    partnerServices: profile.partnerServices,
  };
}

function formatMemberSince(value?: string | null): string {
  if (!value) return "Member since —";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Member since —";

  return `Member since ${new Intl.DateTimeFormat("en-ZA", {
    month: "long",
    year: "numeric",
  }).format(parsed)}`;
}

function formatUploadSize(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function countCompletedFields(profile: ProfileDraft): number {
  return [
    profile.displayName,
    profile.businessName,
    profile.phone,
    profile.marketplaceEmail,
    profile.province,
    profile.townCity,
    profile.addressLine1,
  ].filter((value) => String(value ?? "").trim()).length;
}

function buildAddressLines(profile: ProfileDraft): string[] {
  return [profile.addressLine1, profile.townCity, profile.province]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

function normalizePinInput(value: string): string {
  return value.replace(/\D+/g, "").slice(0, 8);
}

function formatAccountTypeLabel(value: string, subtype = ''): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  const normalizedSubtype = String(subtype ?? "").trim().toLowerCase();

  if (!normalized) {
    return "Owner";
  }

  if (isMiddlemanAccountSubtype(normalizedSubtype)) return 'Middleman';
  if (normalized === 'finance' && normalizedSubtype === 'accountant') return 'Accountant';
  return ACCOUNT_TYPE_LABELS[normalized] ?? normalized;
}

function buildInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (!parts.length) {
    return "A4";
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      result
        ? resolve(result)
        : reject(new Error("Failed to read image file."));
    };

    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => "");
  return text.trim() ? { message: text } : null;
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const errorRecord =
    typeof record.error === "object" && record.error !== null
      ? (record.error as Record<string, unknown>)
      : null;
  const dataRecord =
    typeof record.data === "object" && record.data !== null
      ? (record.data as Record<string, unknown>)
      : null;

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

  return fallback;
}

function getResetPasswordUrl(): string {
  if (typeof window === "undefined") {
    return "/reset-password";
  }

  return new URL("/reset-password", window.location.origin).toString();
}

function ModalStepProgress({
  currentStep,
  labels,
}: {
  currentStep: number;
  labels: readonly string[];
}) {
  return (
    <ol className={styles.modalStepProgress} aria-label="Setup progress">
      {labels.map((label, index) => {
        const step = index + 1;
        const isCurrent = currentStep === step;
        const isComplete = currentStep > step;

        return (
          <li
            key={label}
            className={`${styles.modalStep} ${isCurrent ? styles.modalStepCurrent : ""} ${isComplete ? styles.modalStepComplete : ""}`}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span>{isComplete ? "✓" : step}</span>
            <strong>{label}</strong>
          </li>
        );
      })}
    </ol>
  );
}

function ModalInlineNotice({ notice }: { notice: AccountNotice | null }) {
  if (!notice) {
    return null;
  }

  return (
    <div
      className={`${styles.modalInlineNotice} ${notice.tone === "error" ? styles.modalInlineNoticeError : styles.modalInlineNoticeSuccess}`}
      role={notice.tone === "error" ? "alert" : "status"}
      aria-live={notice.tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {notice.message}
    </div>
  );
}

export default function AccountClient({
  canManageDesktopUsers = false,
  sharedAccount = false,
  sharedSettings,
  initialProfile = null,
  initialScanPinStatus = null,
}: AccountClientProps) {
  const [profile, setProfile] =
    useState<AccountProfile | null>(initialProfile);
  useEffect(() => { if (sharedAccount && initialProfile) { setProfile(initialProfile); setProfileDraft(buildProfileDraft(initialProfile)); } }, [sharedAccount, initialProfile]);
  const [profileDraft, setProfileDraft] =
    useState<ProfileDraft>(() =>
      initialProfile ? buildProfileDraft(initialProfile) : initialProfileDraft,
    );
  const [scanPinStatus, setScanPinStatus] =
    useState<AccountScanPinStatus>(
      initialScanPinStatus ?? emptyScanPinStatus,
    );
  const [scanPinDraft, setScanPinDraft] = useState("");
  const [scanPinConfirmDraft, setScanPinConfirmDraft] = useState("");
  const [notice, setNotice] = useState<AccountNotice | null>(null);
  const [actionModalNotice, setActionModalNotice] =
    useState<AccountNotice | null>(null);
  const [isLoading, setIsLoading] = useState(!initialProfile);
  const [isLoadingScanPin, setIsLoadingScanPin] = useState(
    !sharedAccount && !initialScanPinStatus,
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingScanPin, setIsSavingScanPin] = useState(false);
  const [isDisablingScanPin, setIsDisablingScanPin] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newAccountEmail, setNewAccountEmail] = useState("");
  const [emailConfirmation, setEmailConfirmation] = useState("");
  const [emailChangeSent, setEmailChangeSent] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [billingEmails, setBillingEmails] = useState<boolean | null>(null);
  const [billingDestination, setBillingDestination] = useState("");
  const [savedBillingBusinessEmail, setSavedBillingBusinessEmail] = useState("");
  const [isSavingBillingEmails, setIsSavingBillingEmails] = useState(false);
  const [billingEmailNotice, setBillingEmailNotice] = useState<AccountNotice | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordModalNotice, setPasswordModalNotice] =
    useState<AccountNotice | null>(null);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [isReadingLogo, setIsReadingLogo] = useState(false);
  const [activeAccountModal, setActiveAccountModal] =
    useState<AccountActionModal | null>(null);
  const [businessDetailsStep, setBusinessDetailsStep] =
    useState<BusinessDetailsStep>(1);
  const [partnerDirectoryStep, setPartnerDirectoryStep] =
    useState<PartnerDirectoryStep>(1);
  const activeDialogRef = useRef<HTMLElement | null>(null);
  const deleteDialogRef = useRef<HTMLElement | null>(null);
  const activeDialogTriggerRef = useRef<HTMLElement | null>(null);
  const deleteDialogTriggerRef = useRef<HTMLElement | null>(null);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const activeActionModalBusyRef = useRef(false);
  const deleteDialogBusyRef = useRef(false);

  activeActionModalBusyRef.current = isChangingEmail || isSavingBillingEmails || isSavingNotifications ||
    isSavingProfile ||
    isReadingLogo ||
    isSavingScanPin ||
    isDisablingScanPin ||
    isChangingPassword;
  deleteDialogBusyRef.current = isDeletingAccount;

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      setIsLoading(true);

      try {
        const response = await fetch("/api/account-profile", {
          cache: "no-store",
          credentials: "include",
        });

        const data = (await response.json()) as ProfileApiResponse;

        if (!response.ok || !data.ok || !data.profile) {
          throw new Error(data.error ?? "Failed to load account profile.");
        }

        if (!mounted) {
          return;
        }

        setProfile(data.profile);
        setProfileDraft(buildProfileDraft(data.profile));
      } catch (error) {
        if (!mounted) {
          return;
        }

        setNotice({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load account profile.",
        });
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    async function loadScanPin() {
      setIsLoadingScanPin(true);

      try {
        const response = await fetch("/api/account-profile/scan-pin", {
          cache: "no-store",
          credentials: "include",
        });

        const data = (await response.json()) as ScanPinApiResponse;

        if (!response.ok || !data.ok || !data.scanPin) {
          throw new Error(data.error ?? "Failed to load scan PIN settings.");
        }

        if (!mounted) {
          return;
        }

        setScanPinStatus(data.scanPin);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setNotice({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to load scan PIN settings.",
        });
      } finally {
        if (mounted) {
          setIsLoadingScanPin(false);
        }
      }
    }

    if (!initialProfile) {
      void loadProfile();
    }

    if (!sharedAccount && !initialScanPinStatus) {
      void loadScanPin();
    }

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notice || notice.tone === "error") return undefined;

    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!isDeleteDialogOpen) {
      return undefined;
    }

    const dialog = deleteDialogRef.current;
    const returnFocusTarget = deleteDialogTriggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      const initialFocusTarget =
        dialog?.querySelector<HTMLElement>("[autofocus]") ??
        (dialog ? getAccountDialogFocusableElements(dialog)[0] : null) ??
        dialog;
      initialFocusTarget?.focus();
    });

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (dialog) {
        keepFocusInsideAccountDialog(event, dialog);
      }

      if (event.key === "Escape" && !deleteDialogBusyRef.current) {
        closeDeleteDialog();
      }
    };

    document.addEventListener("keydown", handleDialogKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleDialogKeyDown);
      window.requestAnimationFrame(() => {
        if (returnFocusTarget?.isConnected) {
          returnFocusTarget.focus();
        }
      });
    };
  }, [isDeleteDialogOpen]);

  useEffect(() => {
    if (!activeAccountModal) {
      return undefined;
    }

    const dialog = activeDialogRef.current;
    const returnFocusTarget = activeDialogTriggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      const initialFocusTarget =
        dialog?.querySelector<HTMLElement>("[autofocus]") ??
        (dialog ? getAccountDialogFocusableElements(dialog)[0] : null) ??
        dialog;
      initialFocusTarget?.focus();
    });

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      // The native invoice preview owns focus and Escape while it is open.
      if (dialog?.querySelector("dialog[open]")) return;
      if (dialog) {
        keepFocusInsideAccountDialog(event, dialog);
      }

      if (event.key === "Escape" && !activeActionModalBusyRef.current) {
        closeActionModal();
      }
    };

    document.addEventListener("keydown", handleDialogKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleDialogKeyDown);
      window.requestAnimationFrame(() => {
        if (returnFocusTarget?.isConnected) {
          returnFocusTarget.focus();
        }
      });
    };
  }, [activeAccountModal, businessDetailsStep, partnerDirectoryStep]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('notifications') === 'open') {
      openActionModal('notifications');
      url.searchParams.delete('notifications');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
  }, []);

  const completedFields = useMemo(
    () => sharedAccount ? [profileDraft.businessName, profileDraft.phone].filter(value => value.trim()).length : countCompletedFields(profileDraft),
    [profileDraft, sharedAccount],
  );
  const completionPercentage = Math.round(
    (completedFields / (sharedAccount ? 2 : PROFILE_COMPLETION_TOTAL)) * 100,
  );
  const addressLines = useMemo(
    () => buildAddressLines(profileDraft),
    [profileDraft],
  );
  const accountTypeLabel = useMemo(
    () => formatAccountTypeLabel(profileDraft.accountType, profile?.accountSubtype),
    [profile?.accountSubtype, profileDraft.accountType],
  );
  const normalizedAccountType = String(
    profile?.accountType || profileDraft.accountType || "owner",
  )
    .trim()
    .toLowerCase();
  const isOwnerAccount = !sharedAccount && normalizedAccountType === "owner";
  const isDealerAccount = !sharedAccount && normalizedAccountType === "dealer";
  const isMiddlemanAccount =
    isDealerAccount && isMiddlemanAccountSubtype(profile?.accountSubtype);
  const isAssetRegisterAccount = isOwnerAccount || (isDealerAccount && !isMiddlemanAccount);
  const isPartnerAccount = !sharedAccount && !isOwnerAccount && !isMiddlemanAccount;
  const showScanPinControls = !isLoading && isOwnerAccount;
  const showPartnerDirectory = !isLoading && isPartnerAccount;
  const showMarketplaceContact = isLoading || isOwnerAccount || isDealerAccount;
  const accountDisplayName =
    profileDraft.displayName.trim() || profile?.name || "Aim4price user";
  const profileInitials = useMemo(
    () =>
      buildInitials(
        accountDisplayName || profileDraft.businessName || "Aim4price",
      ),
    [accountDisplayName, profileDraft.businessName],
  );
  const scanPinStatusLabel = scanPinStatus.enabled ? "Active" : "Disabled";
  const logoUrl = profileDraft.logoUrl.trim();
  const marketplaceSellerName =
    profileDraft.marketplaceSellerName.trim() ||
    profileDraft.businessName.trim() ||
    accountDisplayName;
  const marketplacePhone =
    profileDraft.marketplacePhone.trim() ||
    profileDraft.phone.trim() ||
    "No contact details saved yet";
  const marketplaceEmail =
    profileDraft.marketplaceEmail.trim() || "No business email saved yet";
  const marketplaceLocation =
    profileDraft.marketplaceLocation.trim() ||
    (addressLines.length ? addressLines.join(", ") : "No location saved yet");
  const memberSinceLabel = formatMemberSince(profile?.createdAtIso);
  const directoryStatusLabel = profileDraft.partnerDirectoryEnabled
    ? "Visible"
    : "Hidden";
  const passwordsMatch =
    !confirmNewPassword || newPassword === confirmNewPassword;
  const canSubmitPasswordChange = Boolean(
    currentPassword &&
      newPassword.length >= 8 &&
      confirmNewPassword &&
      passwordsMatch &&
      !isChangingPassword,
  );
  const scanPinDisplayLabel = isLoadingScanPin
    ? "Loading"
    : scanPinStatus.hasPin
      ? scanPinStatusLabel
      : "Not set";



  async function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      return;
    }

    const fileType = String(file.type ?? "")
      .trim()
      .toLowerCase();

    if (!ALLOWED_LOGO_TYPES.has(fileType)) {
      setActionModalNotice({
        tone: "error",
        message: "Upload a JPG, PNG or WEBP logo.",
      });
      return;
    }

    if (file.size > MAX_LOGO_UPLOAD_BYTES) {
      setActionModalNotice({
        tone: "error",
        message: `Logo must be ${formatUploadSize(MAX_LOGO_UPLOAD_BYTES)} or smaller.`,
      });
      return;
    }

    setIsReadingLogo(true);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setProfileDraft((current) => ({ ...current, logoUrl: dataUrl }));
      setActionModalNotice({
        tone: "success",
        message: "Logo ready. Save the business details to apply it.",
      });
    } catch (error) {
      setActionModalNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to read image file.",
      });
    } finally {
      setIsReadingLogo(false);
    }
  }

  function handleRemoveLogo() {
    setProfileDraft((current) => ({ ...current, logoUrl: "" }));
    setActionModalNotice({
      tone: "success",
      message: "Logo removed from the draft. Save to apply the change.",
    });
  }

  async function saveProfileDraft(
    nextDraft: ProfileDraft,
    successMessage = "Account details saved.",
    options?: { syncPrimaryLogoToRegister?: boolean },
  ): Promise<boolean> {
    setIsSavingProfile(true);
    setActionModalNotice(null);

    const nextLogoUrl = nextDraft.logoUrl.trim();
    const currentLogoUrl = (profile?.logoUrl ?? "").trim();
    const shouldSyncPrimaryLogo = Boolean(
      options?.syncPrimaryLogoToRegister || nextLogoUrl !== currentLogoUrl,
    );

    try {
      const response = await fetch("/api/account-profile", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...nextDraft,
          discoveryParticipationEnabled: isOwnerAccount
            ? nextDraft.discoveryParticipationEnabled
            : undefined,
          extraPhotoUrls: [],
          syncPrimaryLogoToRegister: shouldSyncPrimaryLogo,
        }),
      });

      const data = (await response.json()) as ProfileApiResponse;

      if (!response.ok || !data.ok || !data.profile) {
        throw new Error(data.error ?? "Failed to save account details.");
      }

      setProfile(data.profile);
      setProfileDraft(buildProfileDraft(data.profile));
      setNotice({ tone: "success", message: successMessage });
      return true;
    } catch (error) {
      setActionModalNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save account details.",
      });
      return false;
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const didSave = await saveProfileDraft(profileDraft);

    if (didSave) {
      setActiveAccountModal(null);
    }
  }

  function handleBusinessDetailsSubmit(event: FormEvent<HTMLFormElement>) {
    if (businessDetailsStep < 3) {
      event.preventDefault();
      setBusinessDetailsStep(
        (businessDetailsStep + 1) as BusinessDetailsStep,
      );
      return;
    }

    void handleProfileSubmit(event);
  }

  function handlePartnerDirectorySubmit(event: FormEvent<HTMLFormElement>) {
    if (profileDraft.partnerDirectoryEnabled && partnerDirectoryStep < 4) {
      event.preventDefault();
      goToPartnerDirectoryStep(
        (partnerDirectoryStep + 1) as PartnerDirectoryStep,
      );
      return;
    }

    void handleProfileSubmit(event);
  }

  async function handleScanPinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionModalNotice(null);

    const normalizedPin = normalizePinInput(scanPinDraft);
    const normalizedConfirmPin = normalizePinInput(scanPinConfirmDraft);

    if (!normalizedPin) {
      setActionModalNotice({ tone: "error", message: "Enter a scan PIN." });
      return;
    }

    if (normalizedPin.length < 4 || normalizedPin.length > 8) {
      setActionModalNotice({
        tone: "error",
        message: "Scan PIN must be 4 to 8 digits.",
      });
      return;
    }

    if (normalizedPin !== normalizedConfirmPin) {
      setActionModalNotice({
        tone: "error",
        message: "Scan PINs do not match.",
      });
      return;
    }

    setIsSavingScanPin(true);

    try {
      const response = await fetch("/api/account-profile/scan-pin", {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pin: normalizedPin,
          confirmPin: normalizedConfirmPin,
        }),
      });

      const payload = await readResponsePayload(response);
      const data = (payload ?? null) as ScanPinApiResponse | null;

      if (!response.ok || !data?.ok || !data.scanPin) {
        throw new Error(
          extractErrorMessage(payload, "Failed to save scan PIN."),
        );
      }

      setScanPinStatus(data.scanPin);
      setScanPinDraft("");
      setScanPinConfirmDraft("");
      setActiveAccountModal(null);
      setNotice({
        tone: "success",
        message: "Scan PIN saved. QR scan access is now active.",
      });
    } catch (error) {
      setActionModalNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to save scan PIN.",
      });
    } finally {
      setIsSavingScanPin(false);
    }
  }

  async function handleDisableScanPin() {
    setIsDisablingScanPin(true);
    setActionModalNotice(null);

    try {
      const response = await fetch("/api/account-profile/scan-pin", {
        method: "DELETE",
        credentials: "include",
      });

      const payload = await readResponsePayload(response);
      const data = (payload ?? null) as ScanPinApiResponse | null;

      if (!response.ok || !data?.ok || !data.scanPin) {
        throw new Error(
          extractErrorMessage(payload, "Failed to disable scan PIN."),
        );
      }

      setScanPinStatus(data.scanPin);
      setScanPinDraft("");
      setScanPinConfirmDraft("");
      setActiveAccountModal(null);
      setNotice({ tone: "success", message: "Scan PIN disabled." });
    } catch (error) {
      setActionModalNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to disable scan PIN.",
      });
    } finally {
      setIsDisablingScanPin(false);
    }
  }

  function closeDeleteDialog() {
    if (deleteDialogBusyRef.current) {
      return;
    }

    setIsDeleteDialogOpen(false);
    setDeletePassword("");
    setDeleteConfirmText("");
    setDeleteModalError(null);
  }

  function openDeleteDialog() {
    activeDialogTriggerRef.current = null;
    deleteDialogTriggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setDeleteModalError(null);
    setIsDeleteDialogOpen(true);
  }

  function closeActionModal() {
    if (activeActionModalBusyRef.current) {
      return;
    }


    if (profile) {
      setProfileDraft(buildProfileDraft(profile));
    }

    setScanPinDraft("");
    setScanPinConfirmDraft("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setPasswordModalNotice(null);
    setActionModalNotice(null);
    setBusinessDetailsStep(1);
    setPartnerDirectoryStep(1);
    setActiveAccountModal(null);
  }

  function openActionModal(modal: AccountActionModal) {
    setActionModalNotice(null);

    activeDialogTriggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    if (profile) {
      setProfileDraft(buildProfileDraft(profile));
    }

    if (modal === "scanPin") {
      setScanPinDraft("");
      setScanPinConfirmDraft("");
    }

    if (modal === "business") {
      setBusinessDetailsStep(1);
    }

    if (modal === "password") {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordModalNotice(null);
    }

    if (modal === "partnerDirectory") {
      setPartnerDirectoryStep(1);
    }

    setActiveAccountModal(modal);
  }

  function goToPartnerDirectoryStep(step: PartnerDirectoryStep) {
    setPartnerDirectoryStep(step);
  }

  function openBusinessEditor() {
    openActionModal("business");
  }

  function openOverviewDetails(progress = false) {
    if (sharedAccount) {
      const section = document.getElementById('account-details');
      if (section instanceof HTMLDetailsElement) section.open = true;
      const target = section || document.getElementById('directory-listing-title');
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = section?.querySelector<HTMLInputElement>(progress && profile?.businessName?.trim() ? 'input[name="phone"]' : progress ? 'input[name="businessName"]' : 'input[name="phone"]');
      input?.focus({ preventScroll: true });
      return;
    }
    openActionModal('business');
    const saved = profile ? buildProfileDraft(profile) : profileDraft;
    if (progress && [saved.displayName, saved.businessName, saved.phone, saved.marketplaceEmail].every(value => value.trim()) && [saved.province, saved.townCity, saved.addressLine1].some(value => !value.trim())) setBusinessDetailsStep(2);
    else setBusinessDetailsStep(1);
  }

  function openOverviewAccess() {
    if (sharedAccount) { window.location.assign('/pricing'); return; }
    if (isOwnerAccount) openScanPinEditor();
    else if (showPartnerDirectory) openPartnerDirectory();
    else openBusinessEditor();
  }

  function openAssetRegistersPage() {
    window.location.assign("/asset-registers");
  }

  function openAssetTransfersPage() {
    window.location.assign("/account/asset-transfers");
  }

  function openMarketplaceEditor() {
    openActionModal("marketplace");
  }

  function openDiscoveryEditor() {
    openActionModal("discovery");
  }

  function openScanPinEditor() {
    openActionModal("scanPin");
  }


  function openDealerAppAccessPage() {
    window.location.assign("/account/dealer-app");
  }

  function openOwnerAppAccessPage() {
    window.location.assign("/account/owner-app");
  }

  function openPartnerDirectory() {
    openActionModal("partnerDirectory");
  }

  function openPasswordEditor() {
    openActionModal("password");
  }

  useEffect(() => {
    if (sharedAccount || activeAccountModal !== "business") return;
    let mounted = true;
    setBillingEmails(null);
    fetch("/api/account-profile/billing-preferences", { cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || typeof data.useBusinessEmail !== "boolean") throw new Error("Billing email settings could not load.");
        if (mounted) { setBillingEmails(data.useBusinessEmail); setBillingDestination(data.billingEmail); setSavedBillingBusinessEmail(data.businessEmail); }
      }).catch(error => { if (mounted) setBillingEmailNotice({ tone: "error", message: error.message }); });
    return () => { mounted = false; };
  }, [activeAccountModal, sharedAccount]);

  async function toggleBillingEmails() {
    if (billingEmails === null || isSavingBillingEmails) return;
    setIsSavingBillingEmails(true);
    setBillingEmailNotice(null);
    try {
      const response = await fetch("/api/account-profile/billing-preferences", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useBusinessEmail: !billingEmails }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.useBusinessEmail !== "boolean") throw new Error(data.error || "Could not save billing preference.");
      setBillingEmails(data.useBusinessEmail);
      setBillingDestination(data.billingEmail);
      setSavedBillingBusinessEmail(data.businessEmail);
      setBillingEmailNotice({ tone: "success", message: "Billing email destination saved." });
    } catch (error) {
      setBillingEmailNotice({ tone: "error", message: error instanceof Error ? error.message : "Could not save billing preference." });
    } finally { setIsSavingBillingEmails(false); }
  }

  async function handleEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emailConfirmation !== "CHANGE EMAIL" || isChangingEmail || sharedAccount) return;
    setIsChangingEmail(true);
    setActionModalNotice(null);
    try {
      const response = await fetch("/api/auth/change-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: newAccountEmail.trim(), confirmation: emailConfirmation, callbackURL: "/account" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not request the email change. Try signing in again.");
      setEmailChangeSent(true);
    } catch (error) {
      setActionModalNotice({ tone: "error", message: error instanceof Error ? error.message : "Could not change email." });
    } finally { setIsChangingEmail(false); }
  }

  async function handlePasswordChangeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordModalNotice(null);

    if (!currentPassword.trim()) {
      setPasswordModalNotice({
        tone: "error",
        message: "Enter your current password.",
      });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordModalNotice({
        tone: "error",
        message: "New password must be at least 8 characters.",
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordModalNotice({
        tone: "error",
        message: "New passwords do not match.",
      });
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        }),
      });

      const payload = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(
          extractErrorMessage(payload, "Failed to change password."),
        );
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordModalNotice(null);
      setActiveAccountModal(null);
      setNotice({ tone: "success", message: "Password changed successfully." });
    } catch (error) {
      setPasswordModalNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to change password.",
      });
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleSendSelfResetEmail() {
    const email = profile?.email.trim();

    if (!email) {
      setNotice({
        tone: "error",
        message: "Account email is not available yet.",
      });
      return;
    }

    setIsSendingResetEmail(true);

    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          redirectTo: getResetPasswordUrl(),
        }),
      });

      const payload = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(
          extractErrorMessage(payload, "Failed to send reset password email."),
        );
      }

      setNotice({
        tone: "success",
        message:
          "Reset password email sent. Check your inbox for the secure link.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to send reset password email.",
      });
    } finally {
      setIsSendingResetEmail(false);
    }
  }

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleteModalError(null);

    if (!deletePassword.trim()) {
      setDeleteModalError("Enter your password to delete this account.");
      return;
    }

    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") {
      setDeleteModalError("Type DELETE to confirm account removal.");
      return;
    }

    setIsDeletingAccount(true);

    try {
      const response = await fetch("/api/auth/delete-user", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: deletePassword,
          callbackURL: "/",
        }),
      });

      const payload = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(
          extractErrorMessage(payload, "Failed to delete account."),
        );
      }

      setNotice({
        tone: "success",
        message:
          "Your account and saved workspace data were deleted. Redirecting…",
      });
      setIsDeleteDialogOpen(false);
      setDeletePassword("");
      setDeleteConfirmText("");
      setDeleteModalError(null);

      window.setTimeout(() => {
        window.location.assign("/");
      }, 700);
    } catch (error) {
      setDeleteModalError(
        error instanceof Error ? error.message : "Failed to delete account.",
      );
    } finally {
      setIsDeletingAccount(false);
    }
  }

  return (
    <main className={styles.page}>
      <AppHeader active="none" />

      <section className={styles.shell}>
        <section className={styles.accountHero}>
          <div className={styles.heroIdentityGroup}>
            <div className={styles.heroAvatarControl}>
              <label
                className={`${styles.heroAvatar} ${logoUrl ? styles.heroAvatarWithLogo : ""}`}
                data-tooltip={sharedAccount ? "Your account logo." : "Upload or replace your account logo."}
                data-tooltip-style="description"
                aria-label={sharedAccount ? "Account logo" : "Upload account logo"}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleLogoFileChange}
                  disabled={sharedAccount || isReadingLogo || isSavingProfile}
                />
                {logoUrl ? (
                  <img src={logoUrl} alt="Business logo" />
                ) : (
                  <span>{profileInitials}</span>
                )}
              </label>
              {!sharedAccount && <span className={styles.heroAvatarEditBadge} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M8 7.25 9.2 5.5h5.6L16 7.25h2.25A1.75 1.75 0 0 1 20 9v8.25A1.75 1.75 0 0 1 18.25 19H5.75A1.75 1.75 0 0 1 4 17.25V9a1.75 1.75 0 0 1 1.75-1.75H8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="3.15" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              </span>}
            </div>

            <div className={styles.heroCopy}>
              <PageHelpHeading topic="account"><h1>{accountDisplayName}</h1></PageHelpHeading>
              <p>{profile?.email || "Loading email"}</p>
              <small>
                {accountTypeLabel} account&nbsp; • &nbsp;{memberSinceLabel}
              </small>
            </div>
          </div>

          <div className={styles.heroStatusGroup}>
            <span className={styles.statusBadge}>Active</span>
            {isDealerAccount && !isMiddlemanAccount ? (
              <span className={`${styles.statusBadge} ${styles.directoryHeroBadge}`}>
                Directory {directoryStatusLabel.toLowerCase()}
              </span>
            ) : null}
          </div>
        </section>

        {notice ? (
          <div
            className={`${styles.notice} ${notice.tone === "success" ? styles.noticeSuccess : styles.noticeError}`}
            role={notice.tone === "error" ? "alert" : "status"}
            aria-live={notice.tone === "error" ? "assertive" : "polite"}
            aria-atomic="true"
          >
            <span>{notice.message}</span>
            {notice.tone === "error" ? (
              <button
                type="button"
                className={styles.noticeDismissButton}
                onClick={() => setNotice(null)}
                aria-label="Dismiss account message"
              >
                ×
              </button>
            ) : null}
          </div>
        ) : null}

        <section className={styles.accountDashboard}>
          <section className={`${styles.card} ${styles.overviewCard}`}>
            <div className={styles.compactCardHeader}>
              <h2>Account overview</h2>
              <p>Your account at a glance</p>
            </div>

            <div className={styles.metricGrid}>
              <div className={styles.metricTile}>
                <span>Account type</span>
                <strong>{accountTypeLabel}</strong>
              </div>

              <button type="button" className={`${styles.metricTile} ${styles.metricTileButton}`} onClick={() => openOverviewDetails()} aria-label="Edit contact number" data-tooltip="Update the contact number saved on your profile." data-tooltip-style="description">
                <span>Contact number</span>
                <strong>{profileDraft.phone.trim() || "Not saved"}</strong>
              </button>

              <button type="button" className={`${styles.metricTile} ${styles.metricTileButton}`} onClick={() => openOverviewDetails(true)} aria-label="Complete missing profile details" data-tooltip="Review your profile and fill in any missing details." data-tooltip-style="description">
                <span>Profile progress</span>
                <strong>
                  {completedFields}/{sharedAccount ? 2 : PROFILE_COMPLETION_TOTAL}
                </strong>
                <small>{completionPercentage}% complete</small>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-label="Profile completion"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={completionPercentage}
                  aria-valuetext={`${completionPercentage}% complete`}
                >
                  <span style={{ width: `${completionPercentage}%` }} />
                </div>
              </button>

              <button type="button" className={`${styles.metricTile} ${styles.metricTileButton}`} onClick={openOverviewAccess} data-tooltip={sharedAccount ? "Explore desktop plans for more account features." : isOwnerAccount ? "Manage the PIN used for QR access to your assets." : showPartnerDirectory ? "Manage how your business appears in the partner directory." : "Review and update your business details."} data-tooltip-style="description">
                <span>
                  {sharedAccount ? "Account access" : isOwnerAccount ? "QR PIN status" : "Directory status"}
                </span>
                <strong>
                  {sharedAccount ? "Free sharing account" : isOwnerAccount ? scanPinDisplayLabel : directoryStatusLabel}
                </strong>
              </button>
            </div>
          </section>

          <section className={`${styles.card} ${styles.quickActionsCard}`}>
            <div className={styles.compactCardHeader}>
              <h2>Quick actions</h2>
              <p>Everyday tasks first, account settings last.</p>
            </div>

            <div className={styles.quickActionGroups}>
              {/* Task order is shared by every account: daily work, access, visibility, then administration. */}
              {isOwnerAccount || isDealerAccount ? (
                <section
                  className={styles.quickActionGroup}
                  aria-labelledby="assets-activity-actions-title"
                >
                  <div className={styles.quickActionGroupHeader}>
                    <h3 id="assets-activity-actions-title">Assets &amp; activity</h3>
                  </div>
                  <div className={styles.quickActionList}>
                    {isAssetRegisterAccount ? (
                      <button
                        type="button"
                        className={styles.quickActionButton}
                        onClick={openAssetRegistersPage} data-tooltip="Organise your asset registers and choose which one to work with." data-tooltip-style="description"
                      >
                        <QuickActionIcon name="registers" />
                        <strong>Manage asset registers</strong>
                      </button>
                    ) : null}

                    {isAssetRegisterAccount ? (
                      <button
                        type="button"
                        className={styles.quickActionButton}
                        onClick={openAssetTransfersPage} data-tooltip="Claim an asset or send it to another account." data-tooltip-style="description"
                      >
                        <QuickActionIcon name="claim" />
                        <strong>Claim or send an asset</strong>
                      </button>
                    ) : null}

                    {isOwnerAccount || isDealerAccount ? <button type="button" className={styles.quickActionButton} onClick={() => openActionModal("notifications")} data-tooltip="Choose which account and asset updates you receive." data-tooltip-style="description">
                      <QuickActionIcon name="notifications" />
                      <strong>Notifications</strong>
                    </button> : null}
                  </div>
                </section>
              ) : null}

                <section
                  className={styles.quickActionGroup}
                  aria-labelledby="apps-connections-actions-title"
                >
                  <div className={styles.quickActionGroupHeader}>
                    <h3 id="apps-connections-actions-title">Apps &amp; connections</h3>
                  </div>
                  <div className={styles.quickActionList}>
                    {!(isOwnerAccount || isDealerAccount) && <Link className={styles.quickActionButton} href="/team/access" data-tooltip="View the workspaces and assets shared with you." data-tooltip-style="description"><QuickActionIcon name="connections" /><strong>My access</strong></Link>}
                    {canManageDesktopUsers && !isMiddlemanAccount && <Link className={styles.quickActionButton} href="/account/team-access" data-tooltip="Manage who can use your desktop workspace and what they can access." data-tooltip-style="description"><QuickActionIcon name="connections" /><strong>Desktop users</strong></Link>}

                    {isOwnerAccount ? (
                      <button
                        type="button"
                        className={styles.quickActionButton}
                        onClick={openOwnerAppAccessPage} data-tooltip="Manage staff access and permissions for the Manager App." data-tooltip-style="description"
                        aria-label="Manage Manager App access"
                      >
                        <QuickActionIcon name="ownerApp" />
                        <strong>Manager App access</strong>
                      </button>
                    ) : null}



                    {isDealerAccount ? (
                      <button
                        type="button"
                        className={styles.quickActionButton}
                        onClick={openDealerAppAccessPage}
                        data-tooltip={isMiddlemanAccount ? "Manage staff access and permissions for the Middleman App." : "Manage staff access and permissions for the Dealer App."}
                        data-tooltip-style="description"
                      >
                        <QuickActionIcon name="dealer" />
                        <strong>{isMiddlemanAccount ? "Middleman app access" : "Manage Dealer App staff"}</strong>
                      </button>
                    ) : null}

                    {(isOwnerAccount || (isDealerAccount && !isMiddlemanAccount) || normalizedAccountType === "business") ? <Link className={styles.quickActionButton} href="/account/ai-connect" data-tooltip="Connect an AI assistant to read the Aim4price data you allow." data-tooltip-style="description"><QuickActionIcon name="connections" /><strong>AI connections</strong></Link> : null}
                  </div>
                </section>

              {isOwnerAccount || showMarketplaceContact || sharedAccount || showPartnerDirectory ? (
                <section
                  className={styles.quickActionGroup}
                  aria-labelledby="marketplace-visibility-actions-title"
                >
                  <div className={styles.quickActionGroupHeader}>
                    <h3 id="marketplace-visibility-actions-title">Marketplace &amp; visibility</h3>
                  </div>
                  <div className={styles.quickActionList}>
                    {isOwnerAccount ? (
                      <Link href="/my-showroom" data-tooltip="Manage the business showroom customers see in the marketplace." data-tooltip-style="description" className={styles.quickActionButton}>
                        <QuickActionIcon name="showroom" />
                        <strong>Manage my showroom</strong>
                      </Link>
                    ) : null}

                    {showMarketplaceContact ? (
                      <button
                        type="button"
                        className={styles.quickActionButton}
                        onClick={openMarketplaceEditor} data-tooltip="Choose the contact details customers see on your marketplace listings." data-tooltip-style="description"
                        aria-label="Marketplace contact details"
                      >
                        <QuickActionIcon name="marketplace" />
                        <strong>Marketplace contact</strong>
                      </button>
                    ) : null}

                    {isOwnerAccount ? (
                      <button
                        type="button"
                        className={styles.quickActionButton}
                        onClick={openDiscoveryEditor}
                       data-tooltip="Choose whether your eligible assets appear in Discovery." data-tooltip-style="description">
                        <QuickActionIcon name="discovery" />
                        <strong>Discovery settings</strong>
                      </button>
                    ) : null}

                    {sharedAccount ? <Link href="#directory-listing-title" data-tooltip="View and update your business directory listing." data-tooltip-style="description" className={styles.quickActionButton}><QuickActionIcon name="directory" /><strong>Directory listing</strong></Link> : null}
                    {showPartnerDirectory ? (
                      <button
                        type="button"
                        className={styles.quickActionButton}
                        onClick={openPartnerDirectory} data-tooltip="Choose your directory visibility and update your services and contact details." data-tooltip-style="description"
                      >
                        <QuickActionIcon name="directory" />
                        <strong>Partner directory</strong>
                      </button>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <section
                className={styles.quickActionGroup}
                aria-labelledby="account-billing-actions-title"
              >
                <div className={styles.quickActionGroupHeader}>
                  <h3 id="account-billing-actions-title">Account &amp; billing</h3>
                </div>
                <div className={styles.quickActionList}>
                  {sharedAccount ? <Link className={styles.quickActionButton} href="#account-details" data-tooltip="View and update your business details." data-tooltip-style="description"><QuickActionIcon name="business"/><strong>Business details</strong></Link> : <button
                    type="button"
                    className={styles.quickActionButton}
                    onClick={openBusinessEditor} data-tooltip="Update your business name, contact details, address and logo." data-tooltip-style="description"
                  >
                    <QuickActionIcon name="business" />
                    <strong>Edit business details</strong>
                  </button>}

                  <button type="button" className={styles.quickActionButton} onClick={() => openActionModal("invoices")} data-tooltip="View and download your Aim4price invoices." data-tooltip-style="description">
                    <QuickActionIcon name="invoices" />
                    <strong>Aim4price invoices</strong>
                  </button>
                  {sharedAccount ? <Link href="/pricing" data-tooltip="Compare desktop plans and the features they include." data-tooltip-style="description" className={styles.quickActionButton}><QuickActionIcon name="registers" /><strong>Explore Desktop plans</strong></Link> : null}
                </div>
              </section>
            </div>
          </section>

          {sharedSettings && <div className={styles.sharedAccountSettings}>{sharedSettings}</div>}

          <section
            className={`${styles.card} ${styles.securityCard}`}
            aria-labelledby="password-security-title"
          >
            <div className={styles.compactCardHeader}>
              <h2 id="password-security-title">Password & security</h2>
              <p>Secure your sign-in and recovery options.</p>
            </div>

            <div className={styles.securityActionsGrid}>
              <button
                type="button"
                className={styles.securityActionCard}
                onClick={openPasswordEditor} data-tooltip="Change the password you use to sign in." data-tooltip-style="description"
              >
                <QuickActionIcon name="security" />
                <span className={styles.securityActionCopy}>
                  <strong>Change password</strong>
                </span>
              </button>

              <button
                type="button"
                className={styles.securityActionCard}
                onClick={handleSendSelfResetEmail} data-tooltip="Send a password reset link to your account email." data-tooltip-style="description"
                disabled={isSendingResetEmail || !profile?.email}
              >
                <QuickActionIcon name="reset" />
                <span className={styles.securityActionCopy}>
                  <strong>
                    {isSendingResetEmail ? "Sending reset link..." : "Email a reset link"}
                  </strong>
                </span>
              </button>
              {showScanPinControls ? (
                <button
                  type="button"
                  className={styles.securityActionCard}
                  onClick={openScanPinEditor} data-tooltip="Change the PIN used to access your assets through QR codes." data-tooltip-style="description"
                >
                  <QuickActionIcon name="pin" />
                  <span className={styles.securityActionCopy}>
                    <strong>Update QR PIN</strong>
                  </span>
                </button>
              ) : null}
            </div>
          </section>
        </section>

        <section
          className={`${styles.card} ${styles.accountDeleteCard} ${styles.dangerZone}`}
          aria-labelledby="danger-zone-title"
        >
          <div className={styles.dangerZoneCopy}>
            <h2 id="danger-zone-title">Delete account</h2>
            <p>
              Permanently delete your account and saved workspace.
            </p>
          </div>

          <button
            type="button"
            className={`${styles.dangerButton} ${styles.dangerZoneButton}`}
            onClick={openDeleteDialog} data-tooltip="Review the confirmation steps for permanently deleting your account." data-tooltip-style="description"
          >
            <span className={styles.dangerZoneButtonIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5.5 7.5h13" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                <path d="M9.25 7.5V5.25h5.5V7.5" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
                <path d="m7.2 7.5.7 11.25h8.2l.7-11.25" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
                <path d="M10.1 11v4.3M13.9 11v4.3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            </span>
            <span>Delete account</span>
          </button>
        </section>
      </section>

      {activeAccountModal === "invoices" ? (
        <div className={styles.modalBackdrop} data-website-overlay onClick={closeActionModal}>
          <section ref={activeDialogRef}
            className={`${styles.modalCard} ${styles.accountActionModalCardNarrow} ${styles.accountScrollableModalCard} ${styles.passwordModalCard} ${styles.billingModal}`}
            role="dialog" aria-modal="true" aria-labelledby="invoices-modal-title"
            aria-describedby="invoices-modal-description" tabIndex={-1}
            onClick={(event) => event.stopPropagation()}>
            
              <div className={styles.modalHeader}>
                <h2 id="invoices-modal-title">Your invoices</h2>
                <p id="invoices-modal-description">View your invoices and recorded payments.</p>
                <button type="button" className={styles.modalCloseButton} onClick={closeActionModal} aria-label="Close invoices" data-modal-close="true">×</button>
              </div>
              <div className={styles.billingScrollBody}><AccountInvoices /></div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.ghostButton} onClick={closeActionModal}>Close</button>
              </div>
            
          </section>
        </div>
      ) : null}

      {activeAccountModal === "password" ? (
        <div className={styles.modalBackdrop} data-website-overlay onClick={closeActionModal}>
          <section
            ref={activeDialogRef}
            className={`${styles.modalCard} ${styles.accountActionModalCardNarrow} ${styles.accountScrollableModalCard} ${styles.passwordModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-modal-title"
            aria-describedby="change-password-modal-description"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <AccountModalScroller>
              <div className={styles.modalHeader}>
                <h2 id="change-password-modal-title">Change password</h2>
                <p id="change-password-modal-description">
                  Use your current password to protect your Aim4price account.
                </p>
                <button
                  type="button"
                  className={styles.modalCloseButton}
                  onClick={closeActionModal}
                  aria-label="Close password editor"
                  disabled={isChangingPassword}
                  data-modal-close="true"
                >
                  ×
                </button>
              </div>

              <div className={styles.passwordModalIntro}>
                <QuickActionIcon name="security" />
                <div>
                  <strong>Secure every signed-in device</strong>
                  <p>Updating your password signs out your other active sessions.</p>
                </div>
              </div>

              {passwordModalNotice ? (
                <div
                  className={`${styles.modalInlineNotice} ${passwordModalNotice.tone === "error" ? styles.modalInlineNoticeError : styles.modalInlineNoticeSuccess}`}
                  role={passwordModalNotice.tone === "error" ? "alert" : "status"}
                  aria-live={passwordModalNotice.tone === "error" ? "assertive" : "polite"}
                  aria-atomic="true"
                >
                  {passwordModalNotice.message}
                </div>
              ) : null}

              <form
                className={`${styles.modalForm} ${styles.passwordModalForm}`}
                onSubmit={handlePasswordChangeSubmit}
                noValidate
              >
                <label className={styles.modalField}>
                  <span>Current password</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    autoFocus
                    value={currentPassword}
                    onChange={(event) => {
                      setCurrentPassword(event.target.value);
                      setPasswordModalNotice(null);
                    }}
                    placeholder="Enter current password"
                  />
                </label>

                <label className={styles.modalField}>
                  <span>New password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      setPasswordModalNotice(null);
                    }}
                    placeholder="Minimum 8 characters"
                    aria-describedby="password-requirements"
                  />
                  <small id="password-requirements" className={styles.securityFieldHint}>
                    Use at least 8 characters and avoid reusing an old password.
                  </small>
                </label>

                <label className={styles.modalField}>
                  <span>Confirm new password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={confirmNewPassword}
                    onChange={(event) => {
                      setConfirmNewPassword(event.target.value);
                      setPasswordModalNotice(null);
                    }}
                    placeholder="Repeat new password"
                    aria-invalid={!passwordsMatch}
                    aria-describedby={!passwordsMatch ? "password-match-error" : undefined}
                  />
                  {!passwordsMatch ? (
                    <small
                      id="password-match-error"
                      className={styles.securityFieldError}
                      role="alert"
                    >
                      The new passwords do not match.
                    </small>
                  ) : null}
                </label>

                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={closeActionModal}
                    disabled={isChangingPassword}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={!canSubmitPasswordChange}
                  >
                    {isChangingPassword ? "Updating password..." : "Update password"}
                  </button>
                </div>
              </form>
            </AccountModalScroller>
          </section>
        </div>
      ) : null}

      {activeAccountModal === "email" && !sharedAccount ? (
        <div className={styles.modalBackdrop} data-website-overlay onClick={closeActionModal}>
          <section ref={activeDialogRef} className={`${styles.modalCard} ${styles.accountActionModalCardNarrow} ${styles.accountScrollableModalCard} ${styles.polishedSettingsModal}`} role="dialog" aria-modal="true" aria-labelledby="change-account-email-title" tabIndex={-1} onClick={event => event.stopPropagation()}>
            <AccountModalScroller>
              <div className={styles.modalHeader}>
                <h2 id="change-account-email-title">Change account email</h2>
                <p>{emailChangeSent ? "Check your email to continue." : "Are you sure you want to change your login email?"}</p>
                <button type="button" className={styles.modalCloseButton} aria-label="Close email change" data-modal-close="true" onClick={closeActionModal}>×</button>
              </div>
              <ModalInlineNotice notice={actionModalNotice} />
              {emailChangeSent ? <div className={styles.emailChangeSuccess}>
                <p>Check your current and new inboxes for the confirmation steps. Your login email stays unchanged until verification is complete.</p>
                <p>If no email arrives, check spam or try another address.</p>
                <button type="button" className={styles.primaryButton} onClick={() => { setActionModalNotice(null); setActiveAccountModal("business"); }}>Back to business details</button>
              </div> : <form className={`${styles.form} ${styles.emailChangeForm}`} onSubmit={handleEmailChange}>
                <label className={styles.field}><span>Current email</span><input value={profile?.email ?? ""} disabled /></label>
                <label className={styles.field}><span>New account email</span><input type="email" autoComplete="email" required maxLength={254} value={newAccountEmail} onChange={event => setNewAccountEmail(event.target.value)} /></label>
                <label className={styles.field}><span>Type CHANGE EMAIL to confirm</span><input autoComplete="off" spellCheck={false} value={emailConfirmation} onChange={event => setEmailConfirmation(event.target.value)} /></label>
                <p className={styles.fieldHint}>Your business contact email will not change.</p>
                <div className={styles.actionsRow}>
                  <button type="button" className={styles.ghostButton} disabled={isChangingEmail} onClick={() => { setActionModalNotice(null); setActiveAccountModal("business"); }}>Cancel</button>
                  <button type="submit" className={styles.primaryButton} disabled={isChangingEmail || emailConfirmation !== "CHANGE EMAIL" || !newAccountEmail.trim() || newAccountEmail.trim().toLowerCase() === profile?.email.toLowerCase()}>{isChangingEmail ? "Sending..." : "Send verification"}</button>
                </div>
              </form>}
            </AccountModalScroller>
          </section>
        </div>
      ) : null}

      {activeAccountModal === "business" ? (
        <div className={styles.modalBackdrop} data-website-overlay onClick={closeActionModal}>
          <section
            ref={activeDialogRef}
            className={`${styles.modalCard} ${styles.accountActionModalCard} ${styles.accountScrollableModalCard} ${styles.businessDetailsModalCard} ${styles.polishedSettingsModal}`}
            role="dialog"
            aria-modal="true"
            data-business-step={businessDetailsStep}
            aria-labelledby="business-details-modal-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <AccountModalScroller>
              <div className={styles.modalHeader}>
                <h2 id="business-details-modal-title">Business details</h2>
                <p>
                  Your changes are saved together on the final step.
                </p>
                <button type="button" className={styles.modalCloseButton} onClick={closeActionModal} aria-label="Close business details" data-modal-close="true">×</button>
              </div>

              <ModalInlineNotice notice={actionModalNotice} />

              <ModalStepProgress
                currentStep={businessDetailsStep}
                labels={["Contact info", "Business address", "Business logo"]}
              />

              {isLoading ? (
                <p className={styles.loading}>Loading account details...</p>
              ) : (
                <form
                  id="business-details-form"
                  className={`${styles.form} ${styles.compactEditForm} ${styles.wizardForm}`}
                  onSubmit={handleBusinessDetailsSubmit}
                >
                  {businessDetailsStep === 1 ? (
                    <section className={`${styles.wizardStepPanel} ${styles.fullWidth}`}>
                      <div className={styles.modalSectionHeading}>
                        <strong><SettingsDetailIcon name="person" />Contact information</strong>
                        <p>How Aim4price and customers identify and contact this business.</p>
                      </div>

                      <div className={styles.wizardFieldGrid}>
                        <label className={styles.field}>
                          <span>Full name</span>
                          <span className={styles.settingsInput}>
                            <SettingsDetailIcon name="person" />
                            <input value={profileDraft.displayName} onChange={(event) => setProfileDraft((current) => ({ ...current, displayName: event.target.value }))} placeholder="Full name" autoFocus />
                          </span>
                        </label>

                        <label className={styles.field}>
                          <span>Business name</span>
                          <span className={styles.settingsInput}>
                            <SettingsDetailIcon name="business" />
                            <input value={profileDraft.businessName} onChange={(event) => setProfileDraft((current) => ({ ...current, businessName: event.target.value }))} placeholder="Business name" />
                          </span>
                        </label>
                        <label className={styles.field}>
                          <span>Business email</span>
                          <span className={styles.settingsInput}>
                            <SettingsDetailIcon name="email" />
                            <input type="email" value={profileDraft.marketplaceEmail} onChange={(event) => setProfileDraft((current) => ({ ...current, marketplaceEmail: event.target.value }))} placeholder="business@email.co.za" />
                          </span>
                        </label>
                        <label className={styles.field}>
                          <span>Contact details</span>
                          <span className={styles.settingsInput}>
                            <SettingsDetailIcon name="phone" />
                            <input value={profileDraft.phone} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone, WhatsApp or office number" />
                          </span>
                        </label>
                        {isPartnerAccount ? (
                          <label className={styles.field}>
                            <span>Website link</span>
                            <span className={styles.settingsInput}>
                            <SettingsDetailIcon name="globe" />
                            <input inputMode="url" value={profileDraft.websiteUrl} onChange={(event) => setProfileDraft((current) => ({ ...current, websiteUrl: event.target.value }))} placeholder="https://your-business.co.za" />
                          </span>
                          </label>
                        ) : null}
                      </div>
                        <div className={styles.accountEmailRow}>
                        <div className={styles.field}>
                          <span>Account email</span>
                          <span className={styles.settingsInput}>
                            <SettingsDetailIcon name="lock" />
                            <input value={profile?.email ?? ""} disabled />
                          </span>
                          <small className={styles.fieldHint}>Used to sign in.</small>
                        </div>
                          {!sharedAccount ? <button type="button" className={styles.accountEmailChangeButton} onClick={() => {
                            setNewAccountEmail(""); setEmailConfirmation(""); setEmailChangeSent(false); setActionModalNotice(null); setActiveAccountModal("email");
                          }}><SettingsDetailIcon name="lock" />Change account details</button> : null}
                        </div>
                      {!sharedAccount ? <>
                        <div className={styles.billingEmailRow}>
                          <span className={styles.billingEmailIcon}><SettingsDetailIcon name="email" /></span>
                          <div><strong>Use business email for billing</strong><p>{billingEmails === null ? "Loading billing email…" : `Billing goes to: ${billingDestination}`}</p><p>{billingEmails ? "On · Business email" : "Off · Account email"} · Saves immediately.</p>{profileDraft.marketplaceEmail.trim() !== savedBillingBusinessEmail ? <p>Save business details to update the business email.</p> : null}</div>
                          <button type="button" role="switch" aria-label="Use business email for billing" aria-checked={billingEmails === true} className={styles.billingEmailSwitch} disabled={billingEmails === null || isSavingBillingEmails} onClick={() => void toggleBillingEmails()}><span /></button>
                        </div>
                        <ModalInlineNotice notice={billingEmailNotice} />
                      </> : null}

                    </section>
                  ) : null}

                  {businessDetailsStep === 2 ? (
                    <section className={`${styles.wizardStepPanel} ${styles.fullWidth}`}>
                      <div className={styles.modalSectionHeading}>
                        <strong><SettingsDetailIcon name="location" />Business address</strong>
                        <p>Your main business address and the location shown in the partner directory.</p>
                      </div>

                      <div className={styles.wizardFieldGrid}>
                        
                        <label className={styles.field}>
                          <span>Province</span>
                          <span className={styles.settingsInput}>
                            <SettingsDetailIcon name="location" />
                            <input value={profileDraft.province} onChange={(event) => setProfileDraft((current) => ({ ...current, province: event.target.value }))} placeholder="Province" autoFocus />
                          </span>
                        </label>
                        <label className={styles.field}>
                          <span>Town / city</span>
                          <span className={styles.settingsInput}>
                            <SettingsDetailIcon name="location" />
                            <input value={profileDraft.townCity} onChange={(event) => setProfileDraft((current) => ({ ...current, townCity: event.target.value }))} placeholder="Town or city" />
                          </span>
                        </label>
                        <label className={styles.field}>
                          <span>Address line 1</span>
                          <span className={styles.settingsInput}>
                            <SettingsDetailIcon name="location" />
                            <input value={profileDraft.addressLine1} onChange={(event) => setProfileDraft((current) => ({ ...current, addressLine1: event.target.value }))} placeholder="Street address" />
                          </span>
                        </label>
                        <label className={styles.field}>
                          <span>Address line 2</span>
                          <span className={styles.settingsInput}>
                            <SettingsDetailIcon name="location" />
                            <input value={profileDraft.addressLine2} onChange={(event) => setProfileDraft((current) => ({ ...current, addressLine2: event.target.value }))} placeholder="Building, unit or area (optional)" />
                          </span>
                        </label>
                      </div>
                    </section>
                  ) : null}

                  {businessDetailsStep === 3 ? (
                    <section className={`${styles.wizardStepPanel} ${styles.fullWidth}`}>
                      <div className={styles.modalSectionHeading}>
                        <strong><SettingsDetailIcon name="image" />Business logo</strong>
                        <p>Add one clear logo, or keep the initials shown as your fallback.</p>
                      </div>

                      <div className={styles.mediaUploadField}>
                        <div className={styles.businessMediaEditorGrid}>
                          <section className={styles.businessLogoPanel}>
                            <div className={styles.businessLogoPreview}>
                              {logoUrl ? <img src={logoUrl} alt="Business logo preview" /> : <span>{profileInitials}</span>}
                            </div>
                            <div className={styles.businessLogoCopy}>
                              <strong>{logoUrl ? "Logo ready to save" : "No logo uploaded yet"}</strong>
                              <p>JPG, PNG or WEBP. Maximum {formatUploadSize(MAX_LOGO_UPLOAD_BYTES)}.</p>
                              <div className={styles.businessMediaControls}>
                                <label className={styles.uploadButton}>
                                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoFileChange} disabled={sharedAccount || isReadingLogo || isSavingProfile} />
                                  {isReadingLogo ? "Reading logo..." : logoUrl ? "Replace logo" : "Upload logo"}
                                </label>
                                {logoUrl ? <button type="button" className={styles.ghostButton} onClick={handleRemoveLogo} disabled={isSavingProfile || isReadingLogo}>Remove logo</button> : null}
                              </div>
                            </div>
                          </section>
                        </div>
                      </div>
                    </section>
                  ) : null}

                </form>
              )}
            </AccountModalScroller>
              {!isLoading ? (
                  <div className={`${styles.actionsRow} ${styles.wizardActions}`}>
                    <button
                      type="button"
                      className={styles.ghostButton}
                      onClick={closeActionModal}
                      disabled={isSavingProfile || isReadingLogo}
                    >
                      Cancel
                    </button>
                    {businessDetailsStep > 1 ? (
                      <button type="button" className={styles.secondaryButton} onClick={() => setBusinessDetailsStep((businessDetailsStep - 1) as BusinessDetailsStep)} disabled={isSavingProfile || isReadingLogo}>Back</button>
                    ) : null}
                    <button type="submit" form="business-details-form" className={styles.primaryButton} disabled={isSavingProfile || isReadingLogo}>
                      {businessDetailsStep === 3 ? (isSavingProfile ? "Saving..." : "Save business details") : "Next"}
                    </button>
                  </div>
              ) : null}

          </section>
        </div>
      ) : null}

      {activeAccountModal === "scanPin" ? (
        <div className={styles.modalBackdrop} data-website-overlay onClick={closeActionModal}>
          <section
            ref={activeDialogRef}
            className={`${styles.modalCard} ${styles.accountActionModalCard} ${styles.accountActionModalCardNarrow} ${styles.accountScrollableModalCard} ${styles.scanPinModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-pin-modal-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <AccountModalScroller>
              <div className={styles.modalHeader}>
                <h2 id="scan-pin-modal-title">Update QR PIN</h2>
                <p>
                  Create or update the 4 to 8 digit PIN used for QR scan updates.
                </p>
                <button type="button" className={styles.modalCloseButton} onClick={closeActionModal} aria-label="Close QR PIN editor" data-modal-close="true">×</button>
              </div>

              <ModalInlineNotice notice={actionModalNotice} />

            <div className={styles.pinModalStatus}>
              <span>Current PIN status</span>
              <strong>{scanPinDisplayLabel}</strong>
              <p>
                {scanPinStatus.hasPin
                  ? "A PIN is already saved for QR scan access."
                  : "No PIN is saved yet."}
              </p>
            </div>

              <form className={styles.modalForm} onSubmit={handleScanPinSubmit}>
              <div className={styles.pinGrid}>
                <label className={styles.field}>
                  <span>New scan PIN</span>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    value={scanPinDraft}
                    onChange={(event) =>
                      setScanPinDraft(normalizePinInput(event.target.value))
                    }
                    placeholder="4 to 8 digits"
                  />
                </label>

                <label className={styles.field}>
                  <span>Confirm scan PIN</span>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    value={scanPinConfirmDraft}
                    onChange={(event) =>
                      setScanPinConfirmDraft(
                        normalizePinInput(event.target.value),
                      )
                    }
                    placeholder="Repeat PIN"
                  />
                </label>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={closeActionModal}
                  disabled={isSavingScanPin || isDisablingScanPin}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleDisableScanPin}
                  disabled={
                    isDisablingScanPin ||
                    isSavingScanPin ||
                    isLoadingScanPin ||
                    !scanPinStatus.hasPin
                  }
                >
                  {isDisablingScanPin ? "Disabling..." : "Disable PIN"}
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={
                    isSavingScanPin || isDisablingScanPin || isLoadingScanPin
                  }
                >
                  {isSavingScanPin
                    ? "Saving..."
                    : scanPinStatus.hasPin
                      ? "Update PIN"
                      : "Save PIN"}
                </button>
              </div>
              </form>
            </AccountModalScroller>
          </section>
        </div>
      ) : null}

      {activeAccountModal === "notifications" ? (
        <div className={styles.modalBackdrop} data-website-overlay onClick={closeActionModal}>
          <section ref={activeDialogRef}
            className={`${styles.modalCard} ${styles.accountActionModalCard} ${styles.accountScrollableModalCard} ${styles.marketplaceModalCard} ${styles.notificationModalCard} ${styles.polishedSettingsModal}`}
            role="dialog" aria-modal="true" aria-labelledby="notifications-modal-title" tabIndex={-1}
            onClick={(event) => event.stopPropagation()}>
            <div className={styles.accountModalScrollContent}>
              <div className={styles.modalHeader}>
                <h2 id="notifications-modal-title">Notifications</h2>
                <p>Choose the phone alerts for your account.</p>
                <button type="button" className={styles.modalCloseButton} disabled={isSavingNotifications}
                  onClick={closeActionModal} aria-label="Close notification settings" data-modal-close="true">×</button>
              </div>
              <DesktopNotificationSettings onClose={closeActionModal}
                onBusyChange={(busy) => { activeActionModalBusyRef.current = busy; setIsSavingNotifications(busy); }}
                onSaved={() => { closeActionModal(); setNotice({tone:'success',message:'Notification settings saved.'}); }} />
            </div>
          </section>
        </div>
      ) : null}

      {activeAccountModal === "marketplace" ? (
        <div className={styles.modalBackdrop} data-website-overlay onClick={closeActionModal}>
          <section
            ref={activeDialogRef}
            className={`${styles.modalCard} ${styles.accountActionModalCard} ${styles.accountScrollableModalCard} ${styles.marketplaceModalCard} ${styles.polishedSettingsModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketplace-contact-modal-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <AccountModalScroller>
              <div className={styles.modalHeader}>
                <h2 id="marketplace-contact-modal-title">Marketplace contact</h2>
                <p>
                  These details are shown when customers contact you from the
                  marketplace.
                </p>
                <button type="button" className={styles.modalCloseButton} onClick={closeActionModal} aria-label="Close marketplace contact editor" data-modal-close="true">×</button>
              </div>

              <ModalInlineNotice notice={actionModalNotice} />

              {isLoading ? (
              <p className={styles.loading}>Loading marketplace contact...</p>
            ) : (
              <form
                className={`${styles.marketplaceFields} ${styles.compactEditForm}`}
                onSubmit={handleProfileSubmit}
              >
                <label className={styles.field}>
                  <span>Seller name</span>
                  <span className={styles.settingsInput}>
                            <SettingsDetailIcon name="person" />
                            <input
                    value={profileDraft.marketplaceSellerName}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        marketplaceSellerName: event.target.value,
                      }))
                    }
                    placeholder={marketplaceSellerName}
                  />
                          </span>
                </label>

                <label className={styles.field}>
                  <span>Contact details</span>
                  <span className={styles.settingsInput}>
                            <SettingsDetailIcon name="phone" />
                            <input
                    type="text"
                    value={profileDraft.marketplacePhone}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        marketplacePhone: event.target.value,
                      }))
                    }
                    placeholder={marketplacePhone}
                  />
                          </span>
                </label>

                <label className={styles.field}>
                  <span>Business email</span>
                  <span className={styles.settingsInput}>
                            <SettingsDetailIcon name="email" />
                            <input
                    type="email"
                    value={profileDraft.marketplaceEmail}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        marketplaceEmail: event.target.value,
                      }))
                    }
                    placeholder="business@email.co.za"
                  />
                          </span>
                </label>

                <label className={styles.field}>
                  <span>Location</span>
                  <span className={styles.settingsInput}>
                            <SettingsDetailIcon name="location" />
                            <input
                    value={profileDraft.marketplaceLocation}
                    onChange={(event) =>
                      setProfileDraft((current) => ({
                        ...current,
                        marketplaceLocation: event.target.value,
                      }))
                    }
                    placeholder={marketplaceLocation}
                  />
                          </span>
                </label>

                <div className={styles.marketplaceActions}>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={closeActionModal}
                    disabled={isSavingProfile || isReadingLogo}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={isSavingProfile || isReadingLogo}
                  >
                    {isSavingProfile ? "Saving..." : "Save marketplace"}
                  </button>
                </div>
              </form>
              )}
            </AccountModalScroller>
          </section>
        </div>
      ) : null}

      {activeAccountModal === "discovery" && isOwnerAccount ? (
        <div
          className={styles.modalBackdrop} data-website-overlay
          onClick={closeActionModal}
        >
          <section
            ref={activeDialogRef}
            className={`${styles.modalCard} ${styles.accountActionModalCard} ${styles.accountScrollableModalCard} ${styles.discoveryModalCard} ${styles.notificationModalCard} ${styles.polishedSettingsModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="discovery-participation-modal-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.accountModalScrollContent}>
              <div className={styles.modalHeader}>
                <h2 id="discovery-participation-modal-title">
                  Discovery participation
                </h2>
                <p>
                  Choose whether your eligible assets appear in Discovery.
                </p>
                <button
                  type="button"
                  className={styles.modalCloseButton}
                  onClick={closeActionModal}
                  disabled={isSavingProfile}
                  aria-label="Close Discovery participation"
                  data-modal-close="true"
                >
                  ×
                </button>
              </div>

              <form
                className={`${styles.compactEditForm} ${notificationStyles.form}`}
                aria-busy={isSavingProfile}
                onSubmit={handleProfileSubmit}
              >
                <div className={notificationStyles.options}>
                  <ModalInlineNotice notice={actionModalNotice} />
                  <button
                    type="button"
                    className={notificationStyles.row}
                    role="switch"
                    aria-checked={profileDraft.discoveryParticipationEnabled}
                    aria-labelledby="discovery-participation-label"
                    aria-describedby="discovery-participation-description"
                    disabled={isSavingProfile}
                    onClick={() =>
                      setProfileDraft((current) => ({
                        ...current,
                        discoveryParticipationEnabled: !current.discoveryParticipationEnabled,
                      }))
                    }
                  >
                    <span className={notificationStyles.optionLabel}>
                      <span className={notificationStyles.notificationIcon}>
                        <SettingsDetailIcon name="discovery" />
                      </span>
                      <span>
                        <span id="discovery-participation-label">Participate in Discovery</span>
                        <small id="discovery-participation-description">
                          All your eligible assets participate. Your own assets stay hidden from you.
                        </small>
                      </span>
                    </span>
                    <span
                      className={profileDraft.discoveryParticipationEnabled ? notificationStyles.on : notificationStyles.off}
                      aria-hidden="true"
                    >
                      {profileDraft.discoveryParticipationEnabled ? "On" : "Off"}
                    </span>
                  </button>

                  <div className={notificationStyles.categories}>
                    <div className={`${notificationStyles.row} ${styles.discoveryInfoRow}`}>
                      <span className={notificationStyles.optionLabel}>
                        <span className={notificationStyles.notificationIcon}>
                          <SettingsDetailIcon name="lock" />
                        </span>
                        <span>
                          Private information stays locked
                          <small>Photos and contact details are shared only after you approve an enquiry.</small>
                        </span>
                      </span>
                    </div>
                    <div className={`${notificationStyles.row} ${styles.discoveryInfoRow}`}>
                      <span className={notificationStyles.optionLabel}>
                        <span className={notificationStyles.notificationIcon}>
                          <SettingsDetailIcon name="discovery" />
                        </span>
                        <span>
                          When you turn it off
                          <small>Once saved, your assets are removed and Discovery-only access is revoked.</small>
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.marketplaceActions}>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={closeActionModal}
                    disabled={isSavingProfile}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? "Saving..." : "Save participation"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      ) : null}

      {activeAccountModal === "partnerDirectory" && showPartnerDirectory ? (
        <div className={styles.modalBackdrop} data-website-overlay onClick={closeActionModal}>
          <section
            ref={activeDialogRef}
            className={`${styles.modalCard} ${styles.accountActionModalCard} ${styles.accountScrollableModalCard} ${styles.partnerDirectoryModalCard} ${styles.polishedSettingsModal}`}
            data-directory-step={partnerDirectoryStep}
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-directory-modal-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <AccountModalScroller>
              <div className={styles.modalHeader}>
                <h2 id="partner-directory-modal-title">Partner directory</h2>
                <p>
                  Manage your public business listing.
                </p>
                <button type="button" className={styles.modalCloseButton} onClick={closeActionModal} aria-label="Close partner directory editor" data-modal-close="true">×</button>
              </div>

              <ModalInlineNotice notice={actionModalNotice} />

              <ModalStepProgress
                currentStep={partnerDirectoryStep}
                labels={["Visibility", "Address", "Details & services", "Preview"]}
              />

              <form
                id="partner-directory-form"
                className={`${styles.form} ${styles.directoryForm} ${styles.wizardForm}`}
                onSubmit={handlePartnerDirectorySubmit}
              >
                {partnerDirectoryStep === 1 ? (
                  <section className={`${styles.wizardStepPanel} ${styles.fullWidth}`}>
                    <div className={styles.modalSectionHeading}>
                      <strong><SettingsDetailIcon name="discovery" />Join the partner directory?</strong>
                      <p>You can change this anytime.</p>
                    </div>
                    <div className={styles.directoryChoices}>
                      {[{ enabled: true, icon: "discovery", title: "Yes, show my business", description: "Let owners find and contact you." }, { enabled: false, icon: "lock", title: "No, keep it private", description: "Keep your details saved but hidden." }].map((choice) => (
                        <button key={String(choice.enabled)} type="button" className={styles.directoryChoice} aria-pressed={profileDraft.partnerDirectoryEnabled === choice.enabled} onClick={() => setProfileDraft(current => ({ ...current, partnerDirectoryEnabled: choice.enabled }))}>
                          <span className={styles.directoryChoiceIcon} data-tone={choice.enabled ? "blue" : "amber"}><SettingsDetailIcon name={choice.icon as "discovery" | "lock"} /></span>
                          <span><strong>{choice.title}</strong><small>{choice.description}</small></span>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {partnerDirectoryStep === 2 ? (
                  <section className={`${styles.wizardStepPanel} ${styles.fullWidth}`}>
                    <div className={styles.modalSectionHeading}>
                      <strong><SettingsDetailIcon name="location" />Business address</strong>
                      <p>Street details are optional and publicly visible.</p>
                    </div>
                    <div className={styles.wizardFieldGrid}>
                      {([{ key: "province", label: "Province", placeholder: "Western Cape" }, { key: "townCity", label: "Town / city", placeholder: "George" }, { key: "addressLine1", label: "Street address (optional)", placeholder: "Street address" }, { key: "addressLine2", label: "Address line 2 (optional)", placeholder: "Building, unit or area" }] as const).map(field => (
                        <label className={styles.field} key={field.key}><span>{field.label}</span><span className={styles.settingsInput}><SettingsDetailIcon name="location" /><input value={profileDraft[field.key]} onChange={event => setProfileDraft(current => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} /></span></label>
                      ))}
                    </div>
                    <p className={styles.fieldHint}>Also updates your business address.</p>
                  </section>
                ) : null}

                {partnerDirectoryStep === 3 ? (
                  <section className={`${styles.wizardStepPanel} ${styles.fullWidth}`}>
                    <div className={styles.modalSectionHeading}>
                      <strong><SettingsDetailIcon name="business" />Business details</strong>
                      <p>Contact details and services shown to owners.</p>
                    </div>
                    <div className={styles.wizardFieldGrid}>
                      {([{ key: "businessName", label: "Business name", icon: "business", placeholder: "Your business name" }, { key: "phone", label: "Phone / WhatsApp", icon: "phone", placeholder: "Contact number" }, { key: "marketplaceEmail", label: "Business email", icon: "email", placeholder: "business@example.co.za" }, { key: "websiteUrl", label: "Website (optional)", icon: "globe", placeholder: "https://your-business.co.za" }, { key: "partnerBrandFocus", label: "Brands", icon: "listings", placeholder: "All brands, or specific brands" }, { key: "partnerServices", label: "Services", icon: "maintenance", placeholder: "Trade-ins, valuations, parts, repairs" }] as const).map(field => (
                        <label className={styles.field} key={field.key}><span>{field.label}</span><span className={styles.settingsInput}><SettingsDetailIcon name={field.icon} /><input value={profileDraft[field.key]} onChange={event => setProfileDraft(current => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} /></span></label>
                      ))}
                      <label className={`${styles.field} ${styles.fullWidth} ${styles.partnerDescriptionField}`}><span>About your business (optional)</span><textarea value={profileDraft.partnerDescription} onChange={event => setProfileDraft(current => ({ ...current, partnerDescription: event.target.value }))} placeholder="Your services and areas covered." /><small className={styles.partnerDescriptionCount}>{profileDraft.partnerDescription.trim().length} characters</small></label>
                    </div>
                    <p className={styles.fieldHint}>Also updates your business contact details.</p>
                  </section>
                ) : null}

                {partnerDirectoryStep === 4 ? (
                  <section className={`${styles.wizardStepPanel} ${styles.fullWidth}`}>
                    <div className={styles.modalSectionHeading}><strong><SettingsDetailIcon name="approvals" />Your listing</strong><p>Check your details, then save.</p></div>
                    <article className={styles.directoryListingPreview} aria-label="Directory listing preview">
                      <div className={styles.partnerPreviewIdentity}>
                        <div className={styles.partnerPreviewLogo}>{logoUrl ? <img src={logoUrl} alt="Business logo" /> : <strong>{profileInitials}</strong>}</div>
                        <div><strong>{profileDraft.businessName.trim() || profileDraft.displayName.trim() || "Your business"}</strong><small>{[profileDraft.townCity, profileDraft.province].filter(Boolean).join(", ") || "Location not added"}</small></div>
                      </div>
                      <div className={styles.directoryPreviewGrid}>
                        {([{ label: "Address", icon: "location", value: [profileDraft.addressLine1, profileDraft.addressLine2, profileDraft.townCity, profileDraft.province].filter(Boolean).join(", ") }, { label: "Services", icon: "maintenance", value: profileDraft.partnerServices }, { label: "Phone", icon: "phone", value: profileDraft.phone }, { label: "Email", icon: "email", value: profileDraft.marketplaceEmail }, { label: "Brands", icon: "listings", value: profileDraft.partnerBrandFocus }, { label: "Website", icon: "globe", value: profileDraft.websiteUrl }] as const).filter(detail => detail.value.trim()).map(detail => (
                          <div key={detail.label}><SettingsDetailIcon name={detail.icon} /><span><small>{detail.label}</small><strong>{detail.value}</strong></span></div>
                        ))}
                      </div>
                      {profileDraft.partnerDescription.trim() ? <p className={styles.directoryPreviewDescription}>{profileDraft.partnerDescription}</p> : null}
                    </article>
                  </section>
                ) : null}

              </form>
            </AccountModalScroller>
                <div className={`${styles.actionsRow} ${styles.wizardActions}`}>
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={closeActionModal}
                    disabled={isSavingProfile || isReadingLogo}
                  >
                    Cancel
                  </button>
                  {partnerDirectoryStep > 1 ? (
                    <button type="button" className={styles.secondaryButton} onClick={() => goToPartnerDirectoryStep((partnerDirectoryStep - 1) as PartnerDirectoryStep)} disabled={isSavingProfile}>Back</button>
                  ) : null}
                  <button type="submit" form="partner-directory-form" className={styles.primaryButton} disabled={isSavingProfile}>
                    {isSavingProfile ? "Saving..." : !profileDraft.partnerDirectoryEnabled ? "Save as hidden" : partnerDirectoryStep === 4 ? "Save directory" : "Next"}
                  </button>
                </div>

          </section>
        </div>
      ) : null}

      {isDeleteDialogOpen ? (
        <div className={styles.modalBackdrop} data-website-overlay onClick={closeDeleteDialog}>
          <section
            ref={deleteDialogRef}
            className={`${styles.modalCard} ${styles.accountActionModalCardNarrow} ${styles.accountScrollableModalCard} ${styles.deleteAccountModalCard}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-account-modal-title"
            aria-describedby="delete-account-modal-description"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <AccountModalScroller>
              <div className={styles.modalHeader}>
                <h2 id="delete-account-modal-title">Confirm permanent removal</h2>
                <p id="delete-account-modal-description">
                  This removes your full Aim4price workspace, including saved
                  valuations, asset register items and account details.
                </p>
                <button
                  type="button"
                  className={styles.modalCloseButton}
                  onClick={closeDeleteDialog}
                  aria-label="Close account deletion"
                  disabled={isDeletingAccount}
                  data-modal-close="true"
                >
                  ×
                </button>
              </div>

              {deleteModalError ? (
                <div
                  className={`${styles.modalInlineNotice} ${styles.modalInlineNoticeError}`}
                  role="alert"
                  aria-live="assertive"
                  aria-atomic="true"
                >
                  {deleteModalError}
                </div>
              ) : null}

              <form className={styles.modalForm} onSubmit={handleDeleteAccount}>
              <div className={styles.confirmBox}>
                <strong>This action cannot be undone.</strong>
                <p>Enter your password and type DELETE below to confirm.</p>
              </div>

              <label className={styles.modalField}>
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  disabled={isDeletingAccount}
                  onChange={(event) => {
                    setDeletePassword(event.target.value);
                    setDeleteModalError(null);
                  }}
                  placeholder="Enter your password"
                />
              </label>

              <label className={styles.modalField}>
                <span>Type DELETE to confirm</span>
                <input
                  value={deleteConfirmText}
                  disabled={isDeletingAccount}
                  onChange={(event) => {
                    setDeleteConfirmText(event.target.value);
                    setDeleteModalError(null);
                  }}
                  placeholder="DELETE"
                />
              </label>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={closeDeleteDialog}
                  disabled={isDeletingAccount}
                  autoFocus
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.dangerButton}
                  disabled={isDeletingAccount}
                >
                  {isDeletingAccount ? "Deleting account..." : "Delete account"}
                </button>
              </div>
              </form>
            </AccountModalScroller>
          </section>
        </div>
      ) : null}
    </main>
  );
}




