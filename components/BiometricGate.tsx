import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, Lock, Unlock } from 'lucide-react';

interface BiometricGateProps {
  onUnlock: () => void;
}

const BiometricGate: React.FC<BiometricGateProps> = ({ onUnlock }) => {
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleScan = () => {
    if (scanning || success) return;
    setScanning(true);

    // Simulation delay
    setTimeout(() => {
      setSuccess(true);
      setTimeout(() => {
        onUnlock();
      }, 800);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="max-w-xs w-full">
        <h2 className="text-cyber-green font-display text-2xl font-bold tracking-widest mb-2">
          IDENTITY CHECK
        </h2>
        <p className="text-gray-500 font-mono text-xs mb-12">
          BIOMETRIC AUTHENTICATION REQUIRED
        </p>

        <div className="relative flex items-center justify-center mb-12">
          {/* Fingerprint Area */}
          <button 
            onClick={handleScan}
            className={`
              relative w-32 h-32 rounded-full border-2 flex items-center justify-center
              transition-all duration-300
              ${success ? 'border-cyber-green bg-cyber-green/10 shadow-[0_0_30px_#00ff9d]' : 
                scanning ? 'border-cyber-green/50 animate-pulse' : 'border-gray-700 hover:border-gray-500'}
            `}
          >
             {success ? (
               <Unlock className="w-12 h-12 text-cyber-green" />
             ) : (
               <Fingerprint className={`w-16 h-16 ${scanning ? 'text-cyber-green animate-pulse' : 'text-gray-600'}`} />
             )}
             
             {/* Scanning Ring */}
             {scanning && !success && (
               <motion.div 
                 className="absolute inset-0 rounded-full border-t-2 border-cyber-green"
                 animate={{ rotate: 360 }}
                 transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
               />
             )}
          </button>
        </div>

        <div className="h-8 font-mono text-sm">
          {scanning && !success && <span className="text-cyber-green animate-pulse">ANALYZING BIOMETRICS...</span>}
          {success && <span className="text-cyber-green font-bold">ACCESS GRANTED</span>}
          {!scanning && !success && <span className="text-gray-600">TAP SENSOR TO VERIFY</span>}
        </div>

        <div className="mt-12 pt-6 border-t border-gray-900 w-full flex justify-between text-[10px] text-gray-700 font-mono">
           <span>SECURE_ENCLAVE</span>
           <span className="flex items-center gap-1"><Lock size={10}/> ENCRYPTED</span>
        </div>
      </div>
    </div>
  );
};

export default BiometricGate;