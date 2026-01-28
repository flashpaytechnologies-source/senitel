export interface QRPayload {
  classId: string;
  timestamp: number;
  nonce: string;
}

export enum AccessState {
  LOCKED = 'LOCKED',
  SCANNING = 'SCANNING',
  VALIDATING = 'VALIDATING',
  GRANTED = 'GRANTED',
  DENIED = 'DENIED',
}

export interface ScanError {
  message: string;
  code: 'EXPIRED' | 'INVALID' | 'SECURITY_VIOLATION' | 'CAMERA_ERROR';
}
