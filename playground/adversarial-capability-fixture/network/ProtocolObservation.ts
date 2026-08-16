export interface ProtocolObservation { protocol: "mock"; responseDriven: true; }

export function observeProtocol(): ProtocolObservation {
  return { protocol: "mock", responseDriven: true };
}
