export interface CredentialAssessment { credentialCapability: "modeled-only"; secretValue: null; }

export function assessCredentials(): CredentialAssessment {
  return { credentialCapability: "modeled-only", secretValue: null };
}
