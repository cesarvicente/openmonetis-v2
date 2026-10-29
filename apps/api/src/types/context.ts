export type ApiVariables = {
  userId: string;
  userRole: "member" | "admin";
  deviceTokenId: string;
  deviceTokenName: string;
  deviceTokenExpiresAt: Date;
};
