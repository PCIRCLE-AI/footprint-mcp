export interface SourceRef {
  type: "message" | "event" | "artifact";
  id: string;
}

export interface IngestionSummary {
  artifactsCreated: number;
  narrativesCreated: number;
  decisionsCreated: number;
}
