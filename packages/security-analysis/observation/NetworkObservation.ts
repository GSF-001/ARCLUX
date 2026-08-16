import type { ObservationRecord } from "./ObservationRecord"; export interface NetworkObservation extends ObservationRecord { host: string; method?: string; }
