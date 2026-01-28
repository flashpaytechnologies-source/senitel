import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { QRPayload } from '../types';
import { generateNonce } from '../services/securityService';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, RefreshCw, Lock, ArrowLeft, UserCircle, ChevronRight, Hash, Terminal } from 'lucide-react';

const REFRESH_INTERVAL_MS = 5000;

// Mock Data for Courses
const AVAILABLE_COURSES = [
  { id: 'CS-404', name: 'NETWORK_SECURITY', desc: 'Protocol Analysis & Defense' },
  { id: 'CS-302', name: 'ALGORITHMS_II', desc: 'Advanced Data Structures' },
  { id: 'ETH-101', name: 'CYBER_ETHICS', desc: 'Legal Frameworks & Privacy' },
  { id: 'SYS-500', name: 'KERNEL_ARCH', desc: 'Low Level System Design' },
];

enum LecturerStep {
  AUTH = 'AUTH',
  SELECT = 'SELECT',
  BROADCAST = 'BROADCAST'
}

interface DynamicQRProps {
  onBack: () => void;
}

const DynamicQR: React.FC<DynamicQRProps> = ({ onBack }) => {
  const [step, setStep] = useState<LecturerStep>(LecturerStep.AUTH);
  const [lecturerId, setLecturerId] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<typeof AVAILABLE_COURSES[0] | null>(null);

  // QR State
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(REFRESH_INTERVAL_MS);
  const [nonce, setNonce] = useState<string>('');
  
  // Handlers
  const handleInternalBack = () => {
    if (step === LecturerStep.BROADCAST) {
      setStep(LecturerStep.SELECT);
    } else if (step === LecturerStep.SELECT) {
      setStep(LecturerStep.AUTH);
    } else {
      onBack();
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lecturerId.trim()) return;
    setStep(LecturerStep.SELECT);
  };

  const handleCourseSelect = (course: typeof AVAILABLE_COURSES[0]) => {
    setSelectedCourse(course);
    setStep(LecturerStep.BROADCAST);
  };

  // QR Generation Logic (Only active in BROADCAST mode)
  useEffect(() => {
    if (step !== LecturerStep.BROADCAST || !selectedCourse) return;

    const generateNewQR = async () => {
      const payload: QRPayload = {
        classId: selectedCourse.id,
        timestamp: Date.now(),
        nonce: generateNonce()
      };
      
      setNonce(payload.nonce);

      try {
        const url = await QRCode.toDataURL(JSON.stringify(payload), {
          width: 400,
          margin: 2,
          color: {
            dark: '#00ff9d',
            light: '#050505'
          },
          errorCorrectionLevel: 'H'
        });
        setQrDataUrl(url);
      } catch (err) {
        console.error(err);
      }
    };

    generateNewQR();
    setTimeLeft(REFRESH_INTERVAL_MS);

    const intervalId = setInterval(() => {
      generateNewQR();
      setTimeLeft(REFRESH_INTERVAL_MS);
    }, REFRESH_INTERVAL_MS);

    const timerId = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 100));
    }, 100);

    return () => {
      clearInterval(intervalId);
      clearInterval(timerId);
    };
  }, [step, selectedCourse]);

  // --- RENDER: AUTH SCREEN ---
  if (step === LecturerStep.AUTH) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 grid-bg text-cyber-green relative">
         <button onClick={onBack} className="absolute top-6 left-6 flex items-center gap-2 text-cyber-green/60 hover:text-cyber-green font-mono text-sm">
            <ArrowLeft className="w-4 h-4" /> ABORT
         </button>

         <div className="w-full max-w-md">
            <div className="mb-8 text-center">
              <ShieldAlert className="w-12 h-12 mx-auto mb-4 text-cyber-green animate-pulse" />
              <h2 className="text-3xl font-display font-bold text-white tracking-widest">IDENTITY_CHECK</h2>
              <p className="font-mono text-xs text-cyber-green/60 mt-2">SENTINEL ACCESS PROTOCOL v1.0</p>
            </div>

            <form onSubmit={handleLogin} className="bg-black/80 border border-cyber-green/30 p-6 sm:p-8 rounded-sm backdrop-blur-sm shadow-[0_0_20px_rgba(0,255,157,0.05)]">
               <div className="mb-6">
                 <label className="block font-mono text-xs text-cyber-green/80 mb-2">OPERATOR_ID</label>
                 <div className="relative">
                   <UserCircle className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                   <input 
                      type="text" 
                      value={lecturerId}
                      onChange={(e) => setLecturerId(e.target.value.toUpperCase())}
                      placeholder="ENTER ID..."
                      className="w-full bg-black border border-gray-700 focus:border-cyber-green text-white font-mono pl-10 pr-4 py-3 outline-none transition-all placeholder:text-gray-700"
                      autoFocus
                   />
                 </div>
               </div>
               
               <button 
                 type="submit"
                 disabled={!lecturerId.trim()}
                 className="w-full bg-cyber-green/10 border border-cyber-green hover:bg-cyber-green hover:text-black text-cyber-green font-display font-bold py-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
               >
                 <span className="flex items-center justify-center gap-2">
                   AUTHENTICATE <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform"/>
                 </span>
               </button>
            </form>
         </div>
      </div>
    );
  }

  // --- RENDER: COURSE SELECTION ---
  if (step === LecturerStep.SELECT) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 grid-bg text-cyber-green relative">
         <button onClick={handleInternalBack} className="absolute top-6 left-6 flex items-center gap-2 text-cyber-green/60 hover:text-cyber-green font-mono text-sm">
            <ArrowLeft className="w-4 h-4" /> BACK
         </button>

         <div className="w-full max-w-2xl mt-12 sm:mt-0">
            <div className="mb-8 flex items-end justify-between border-b border-cyber-green/20 pb-4">
              <div>
                <h2 className="text-2xl font-display font-bold text-white tracking-widest">SELECT_CHANNEL</h2>
                <p className="font-mono text-xs text-cyber-green/60 mt-1">OPERATOR: {lecturerId}</p>
              </div>
              <Terminal className="w-6 h-6 text-cyber-green/40" />
            </div>

            <div className="grid gap-4">
              {AVAILABLE_COURSES.map((course) => (
                <button
                  key={course.id}
                  onClick={() => handleCourseSelect(course)}
                  className="group flex items-center justify-between p-4 sm:p-6 border border-gray-800 bg-black/60 hover:border-cyber-green hover:bg-cyber-green/5 transition-all text-left"
                >
                   <div className="overflow-hidden">
                     <div className="flex items-center gap-2 mb-1">
                       <Hash className="w-4 h-4 text-cyber-green/50 flex-shrink-0" />
                       <span className="font-mono font-bold text-lg text-white group-hover:text-cyber-green transition-colors">{course.id}</span>
                     </div>
                     <div className="font-display text-lg sm:text-xl text-gray-400 group-hover:text-white transition-colors truncate">{course.name}</div>
                   </div>
                   <div className="flex flex-col items-end flex-shrink-0 ml-4">
                     <span className="text-[10px] font-mono text-gray-600 mb-1 hidden sm:block">{course.desc}</span>
                     <div className="w-8 h-8 rounded-full border border-gray-700 flex items-center justify-center group-hover:border-cyber-green group-hover:bg-cyber-green group-hover:text-black transition-all">
                        <ChevronRight className="w-4 h-4" />
                     </div>
                   </div>
                </button>
              ))}
            </div>
         </div>
      </div>
    );
  }

  // --- RENDER: QR BROADCAST (EXISTING LOGIC) ---
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 grid-bg text-cyber-green relative">
      <button 
        onClick={handleInternalBack}
        className="absolute top-6 left-6 flex items-center gap-2 text-cyber-green/60 hover:text-cyber-green transition-colors font-mono text-sm z-50 group"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        <span className="hidden sm:inline">TERMINATE_SESSION</span>
        <span className="sm:hidden">EXIT</span>
      </button>

      <div className="max-w-md w-full border border-cyber-green/30 bg-black/80 backdrop-blur-sm p-6 sm:p-8 rounded-sm shadow-[0_0_15px_rgba(0,255,157,0.1)] relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b border-cyber-green/20 pb-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-white">
              <ShieldAlert className="w-5 h-5 animate-pulse text-cyber-green" />
              <h1 className="text-lg font-display font-bold tracking-widest truncate max-w-[150px] sm:max-w-xs">{selectedCourse?.name}</h1>
            </div>
            <span className="text-xs font-mono text-cyber-green/60 pl-7">{selectedCourse?.id} :: BEACON_ACTIVE</span>
          </div>
          <div className="text-[10px] font-mono text-gray-500 text-right">
             <div>OP: {lecturerId}</div>
             <div>SECURE</div>
          </div>
        </div>

        {/* QR Display */}
        <div className="relative aspect-square w-full bg-cyber-black border-2 border-cyber-green/50 flex items-center justify-center p-2 mb-6 group">
            {/* Corner Markers */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyber-green" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyber-green" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyber-green" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyber-green" />
            
            <AnimatePresence mode="wait">
              {qrDataUrl && (
                <motion.img 
                  key={nonce}
                  initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
                  transition={{ duration: 0.2 }}
                  src={qrDataUrl} 
                  alt="Secure QR" 
                  className="w-full h-full object-contain mix-blend-screen"
                />
              )}
            </AnimatePresence>
            
            {/* Scan line effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyber-green/10 to-transparent h-[10%] w-full animate-scan-line pointer-events-none" />
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-gray-800 mb-6 relative overflow-hidden">
          <motion.div 
            className="h-full bg-cyber-green shadow-[0_0_10px_#00ff9d]"
            initial={{ width: '100%' }}
            animate={{ width: `${(timeLeft / REFRESH_INTERVAL_MS) * 100}%` }}
            transition={{ ease: "linear", duration: 0.1 }}
          />
        </div>

        {/* Info */}
        <div className="flex justify-between items-center font-mono text-xs">
           <div className="flex items-center gap-2 text-gray-400">
             <RefreshCw className="w-3 h-3" />
             <span className="hidden sm:inline">AUTO_ROTATION: 5000ms</span>
             <span className="sm:hidden">5000ms</span>
           </div>
           <div className="flex items-center gap-2 text-cyber-green">
             <Lock className="w-3 h-3" />
             <span>AES-256</span>
           </div>
        </div>
        
        {/* Footer Hash */}
        <div className="mt-8 text-[10px] text-gray-600 font-mono text-center break-all">
          SESSION_HASH: {nonce.toUpperCase()}
        </div>
      </div>
    </div>
  );
};

export default DynamicQR;