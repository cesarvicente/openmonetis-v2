export type ApiVariables = {
  userId: string;
  userRole: "member" | "admin";
  authMethod: "session" | "apiKey";
  apiKeyId: string;
  deviceTokenId: string;
  deviceTokenName: string;
  deviceTokenExpiresAt: Date;
};
