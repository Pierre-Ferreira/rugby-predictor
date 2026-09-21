export interface PlayerProfileTestOwnership {
  readonly ownerRunId: string;
}

export interface PlayerProfileDocument {
  readonly _id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly rugbyRoosterTest?: PlayerProfileTestOwnership;
}

export interface PublicPlayerIdentity {
  readonly displayName: string | null;
}

export interface UpdateMyPlayerProfileInput {
  readonly displayName: unknown;
}
