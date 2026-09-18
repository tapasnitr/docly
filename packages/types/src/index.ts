// User types
export interface User {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  createdAt: Date;
  updatedAt: Date;
}

// Organization types
export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

// Document types
export interface Document {
  id: string;
  organizationId: string;
  uploadedBy: string;
  title: string;
  filename: string;
  size: number;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  s3Key: string;
  createdAt: Date;
  updatedAt: Date;
}

// Document chunk for RAG
export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  embedding?: number[];
  createdAt: Date;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  timestamp: string;
}

// Job types
export interface ProcessingJob {
  id: string;
  documentId: string;
  jobType: 'extract' | 'embed' | 'index';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retries: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// JWT payload
export interface JwtPayload {
  userId: string;
  organizationId: string;
  role: string;
  iat: number;
  exp: number;
}
