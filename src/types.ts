export interface Song {
  title: string;
  artist: string;
  youtubeId: string;
  year?: string;
  album?: string;
  description?: string;
}

export interface Favorite {
  id: string;
  userId: string;
  title: string;
  artist: string;
  youtubeId: string;
  thumbnail?: string;
  addedAt: any; // Can be firestore Timestamp or Date string
  year?: string;
  album?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}
