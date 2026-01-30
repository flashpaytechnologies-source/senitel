import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, CheckCircle2, ArrowLeft } from 'lucide-react';

interface BiometricGateProps {
  onUnlock: () => void;
  onBack: () => void;
}

const BiometricGate: React.FC<BiometricGateProps> = ({ onUnlock, onBack }) => {
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleScan = () => {
    if (scanning || success) return;
    setScanning(true);

    setTimeout(() => {
      setSuccess(true);
      setTimeout(() => {
        onUnlock();
      }, 800);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-dark-bg/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center">
      
      <button 
        onClick={onBack}
        className="absolute top-6 left-6 p-3 rounded-full glass-button text-slate-300 hover:text-white z-20 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="w-full max-w-xs flex flex-col items-center relative z-10">
        
        <div className="mb-10">
          <h2 className="text-white text-3xl font-extrabold mb-2">Identity Check</h2>
          <p className="text-slate-400 font-medium">Please verify to continue</p>
        </div>

        <button 
          onClick={handleScan}
          className="relative w-32 h-32 flex items-center justify-center outline-none group"
        >
           {/* Ripple effect */}
           {scanning && !success && (
             <>
               <motion.div 
                 className="absolute inset-0 rounded-full border border-brand-500/50"
                 animate={{ scale: [1, 2], opacity: [1, 0] }}
                 transition={{ duration: 1.5, repeat: Infinity }}
               />
               <motion.div 
                 className="absolute inset-0 rounded-full border border-brand-500/30"
                 animate={{ scale: [1, 1.5], opacity: [1, 0] }}
                 transition={{ duration: 1.5, delay: 0.5, repeat: Infinity }}
               />
             </>
           )}

           {/* Icon Container */}
           <div className={`
             relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500
             ${success 
               ? 'bg-gradient-to-tr from-green-500 to-emerald-400 shadow-[0_0_40px_rgba(34,197,94,0.4)] scale-110' 
               : scanning 
                  ? 'bg-dark-surface border-2 border-brand-500 text-brand-500 shadow-[0_0_30px_rgba(99,102,241,0.3)]' 
                  : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20 hover:scale-105'
             }
           `}>
             {success ? (
               <CheckCircle2 className="w-12 h-12 text-white" />
             ) : (
               <Fingerprint className={`w-12 h-12 ${scanning ? 'animate-pulse' : ''}`} />
             )}
           </div>
        </button>

        <div className="h-10 mt-10">
          {scanning && !success && (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500/10 text-brand-400 text-sm font-semibold border border-brand-500/20">
               Scanning...
            </span>
          )}
          {success && (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-400 text-sm font-semibold border border-green-500/20">
               Verified
            </span>
          )}
          {!scanning && !success && (
            <span className="text-slate-500 text-sm font-medium animate-pulse">
              Tap icon to scan
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default BiometricGate;