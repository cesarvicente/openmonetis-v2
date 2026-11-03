import { type PaymentMethod, paymentMethods } from "./transactions";

export const applicationThemes = ["system", "light", "dark"] as const;
/** Color palettes; each one has a light and a dark variant, chosen by `theme`. */
export const applicationColorThemes = [
  "sepia",
  "graphite",
  "blue",
  "green",
  "violet",
  "rose",
  "nord",
  "catppuccin",
] as const;
export const defaultApplicationColorTheme = "sepia";
export const notificationDueSoonDayOptions = [1, 3, 5, 7] as const;
export const transactionPageSizeOptions = [20, 30, 50] as const;
export const mobileShortcutDestinations = [
  "accounts",
  "cards",
  "budgets",
  "goals",
  "people",
  "categories",
  "notes",
  "attachments",
  "inbox",
] as const;

export const defaultAutoSettleTime = "08:00";
export const autoSettleTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export type ApplicationTheme = (typeof applicationThemes)[number];
export type ApplicationColorTheme = (typeof applicationColorThemes)[number];
export type NotificationDueSoonDays = (typeof notificationDueSoonDayOptions)[number];
export type TransactionPageSize = (typeof transactionPageSizeOptions)[number];
export type MobileShortcutDestination = (typeof mobileShortcutDestinations)[number];

export type UserPreferences = {
  theme: ApplicationTheme;
  colorTheme: ApplicationColorTheme;
  hideValuesOnStart: boolean;
  defaultPaymentMethod: PaymentMethod;
  defaultAccountId: string | null;
  defaultCardId: string | null;
  notificationDueSoonDays: NotificationDueSoonDays;
  transactionsPageSize: TransactionPageSize;
  mobileShortcut: MobileShortcutDestination;
  autoSettleTime: string;
};

export type UserPreferencesRecord = {
  theme: string;
  colorTheme: string;
  hideValuesOnStart: boolean;
  defaultPaymentMethod: string;
  defaultAccountId: string | null;
  defaultCardId: string | null;
  notificationDueSoonDays: number;
  transactionsPageSize: number;
  mobileShortcut: string;
  autoSettleTime: string;
};

const applicationThemeSet = new Set<string>(applicationThemes);
const applicationColorThemeSet = new Set<string>(applicationColorThemes);
const notificationDueSoonDaySet = new Set<number>(notificationDueSoonDayOptions);
const paymentMethodSet = new Set<string>(paymentMethods);
const transactionPageSizeSet = new Set<number>(transactionPageSizeOptions);
const mobileShortcutDestinationSet = new Set<string>(mobileShortcutDestinations);

export function createDefaultUserPreferences(): UserPreferences {
  return {
    theme: "system",
    colorTheme: defaultApplicationColorTheme,
    hideValuesOnStart: false,
    defaultPaymentMethod: "credit_card",
    defaultAccountId: null,
    defaultCardId: null,
    notificationDueSoonDays: 5,
    transactionsPageSize: 30,
    mobileShortcut: "accounts",
    autoSettleTime: defaultAutoSettleTime,
  };
}

export function normalizeUserPreferences(
  preferences?: Partial<UserPreferencesRecord> | null,
): UserPreferences {
  const defaults = createDefaultUserPreferences();
  if (!preferences) return defaults;

  return {
    theme: applicationThemeSet.has(preferences.theme ?? "")
      ? (preferences.theme as ApplicationTheme)
      : defaults.theme,
    colorTheme: applicationColorThemeSet.has(preferences.colorTheme ?? "")
      ? (preferences.colorTheme as ApplicationColorTheme)
      : defaults.colorTheme,
    hideValuesOnStart:
      typeof preferences.hideValuesOnStart === "boolean"
        ? preferences.hideValuesOnStart
        : defaults.hideValuesOnStart,
    defaultPaymentMethod: paymentMethodSet.has(preferences.defaultPaymentMethod ?? "")
      ? (preferences.defaultPaymentMethod as PaymentMethod)
      : defaults.defaultPaymentMethod,
    defaultAccountId:
      typeof preferences.defaultAccountId === "string" ? preferences.defaultAccountId : null,
    defaultCardId: typeof preferences.defaultCardId === "string" ? preferences.defaultCardId : null,
    notificationDueSoonDays: notificationDueSoonDaySet.has(
      preferences.notificationDueSoonDays ?? Number.NaN,
    )
      ? (preferences.notificationDueSoonDays as NotificationDueSoonDays)
      : defaults.notificationDueSoonDays,
    transactionsPageSize: transactionPageSizeSet.has(preferences.transactionsPageSize ?? Number.NaN)
      ? (preferences.transactionsPageSize as TransactionPageSize)
      : defaults.transactionsPageSize,
    mobileShortcut: mobileShortcutDestinationSet.has(preferences.mobileShortcut ?? "")
      ? (preferences.mobileShortcut as MobileShortcutDestination)
      : defaults.mobileShortcut,
    autoSettleTime: autoSettleTimePattern.test(preferences.autoSettleTime ?? "")
      ? (preferences.autoSettleTime as string)
      : defaults.autoSettleTime,
  };
}
