import { QRPayload, ScanError } from '../types';

// Maximum allowed age of a QR code in milliseconds (7 seconds)
const MAX_QR_AGE_MS = 7000;

export const generateNonce = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const validateAttendance = async (payload: QRPayload): Promise<{ success: boolean; error?: ScanError }> => {
  // Simulate network latency for dramatic effect
  await new Promise(resolve => setTimeout(resolve, 600));

  const now = Date.now();
  const diff = now - payload.timestamp;

  console.log(`[SENTINEL SECURITY] QR Age: ${diff}ms (Limit: ${MAX_QR_AGE_MS}ms)`);

  if (diff > MAX_QR_AGE_MS) {
    return {
      success: false,
      error: {
        code: 'EXPIRED',
        message: 'QR EXPIRED - REFRESH REQUIRED'
      }
    };
  }

  // Basic structure check
  if (!payload.classId || !payload.nonce) {
    return {
      success: false,
      error: {
        code: 'INVALID',
        message: 'MALFORMED PAYLOAD DETECTED'
      }
    };
  }

  return { success: true };
};

export const useSecurityWatchdog = (onViolation: () => void) => {
  // Only runs on client side logic
  if (typeof document === 'undefined') return;

  const handleVisibilityChange = () => {
    if (document.hidden) {
      console.warn('[SENTINEL SECURITY] Backgrounding detected. Terminating session.');
      onViolation();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
};