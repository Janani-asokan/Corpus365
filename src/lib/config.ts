/** Runtime configuration, read once. Keep secrets out of this file. */
export const config = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  isProduction: process.env.NODE_ENV === "production",
  supportEmail: "partners@corpus365.example",
  supportPhone: "+91 00000 00000",
} as const;

export const COOKIE = {
  session: "c365_session",
  referral: "c365_ref",
  cart: "c365_cart",
} as const;
