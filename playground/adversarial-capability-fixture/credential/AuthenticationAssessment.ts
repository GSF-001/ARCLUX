export interface AuthenticationAssessment { authenticationObserved: false; credentialSource: null; }

export function assessAuthentication(): AuthenticationAssessment {
  return { authenticationObserved: false, credentialSource: null };
}
