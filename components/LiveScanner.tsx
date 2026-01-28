import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { AccessState, QRPayload } from '../types';
import { validateAttendance, useSecurityWatchdog } from '../services/securityService';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, XCircle, Scan, Aperture, ArrowLeft } from 'lucide-react';
import BiometricGate from './BiometricGate';

interface LiveScannerProps {
  onBack: () => void;
}

const LiveScanner: React.FC<LiveScannerProps> = ({ onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [accessState, setAccessState] = useState<AccessState>(AccessState.LOCKED);
  const [statusMessage, setStatusMessage] = useState<string>('INITIALIZING...');
  
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Anti-Cheat: Reset if tab is switched
  useEffect(() => {
    return useSecurityWatchdog(() => {
      if (accessState !== AccessState.LOCKED) {
         setAccessState(AccessState.DENIED);
         setStatusMessage("SECURITY VIOLATION: APP BACKGROUNDED");
      }
    });
  }, [accessState]);

  const stopStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const startScanning = useCallback(async () => {
    if (accessState === AccessState.GRANTED || accessState === AccessState.DENIED) return;

    try {
      // Use "ideal" constraints for better mobile support
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Required for iOS/Android to play without user interaction
        videoRef.current.setAttribute("playsinline", "true"); 
        videoRef.current.play();
        requestAnimationFrame(tick);
      }
    } catch (err) {
      setStatusMessage("CAMERA ACCESS DENIED");
      console.error(err);
    }
  }, [accessState]);

  const tick = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      if (accessState === AccessState.GRANTED || accessState === AccessState.DENIED) return;

      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (canvas) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        const ctx = canvas.getContext("2d");
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // Use jsQR to analyze frame
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code) {
             handleScanSuccess(code.data);
             return; // Stop loop
          }
        }
      }
    }
    requestAnimationFrame(tick);
  };

  const handleScanSuccess = async (data: string) => {
    setAccessState(AccessState.VALIDATING);
    setStatusMessage("DECRYPTING PAYLOAD...");
    stopStream(); // Stop camera immediately to prevent battery drain and duplicate scans

    try {
      const payload: QRPayload = JSON.parse(data);
      const result = await validateAttendance(payload);

      if (result.success) {
        setAccessState(AccessState.GRANTED);
        setStatusMessage(`ATTENDANCE LOGGED: ${payload.classId}`);
      } else {
        setAccessState(AccessState.DENIED);
        setStatusMessage(result.error?.message || "ACCESS DENIED");
      }
    } catch (e) {
      setAccessState(AccessState.DENIED);
      setStatusMessage("INVALID DATA FORMAT");
    }
  };

  const handleBiometricUnlock = () => {
    setAccessState(AccessState.SCANNING);
    setPermissionGranted(true);
  };

  useEffect(() => {
    if (permissionGranted && accessState === AccessState.SCANNING) {
      startScanning();
    }
    return () => stopStream();
  }, [permissionGranted, accessState, startScanning]);


  // RENDER LOGIC
  
  if (accessState === AccessState.LOCKED) {
    return <BiometricGate onUnlock={handleBiometricUnlock} />;
  }

  return (
    // Fixed inset-0 ensures full coverage on mobile browsers without scrolling issues
    <div className="fixed inset-0 w-full h-full bg-black overflow-hidden touch-none">
      
      {/* Scanner Overlay UI */}
      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 safe-area-inset">
        {/* Top Bar */}
        <div className="flex justify-between items-start pointer-events-auto">
          <div className="flex items-start gap-3">
             <button 
               onClick={onBack}
               className="mt-1 p-2 bg-black/50 backdrop-blur rounded-full border border-cyber-green/30 text-cyber-green active:bg-cyber-green/20 transition-colors"
             >
               <ArrowLeft className="w-5 h-5" />
             </button>
             <div>
               <h1 className="text-cyber-green font-display font-bold text-lg tracking-widest leading-none">SENTINEL</h1>
               <p className="text-[10px] text-cyber-green/60 font-mono mt-1">LIVE_FEED :: SECURE_LAYER</p>
             </div>
          </div>
          <Aperture className={`w-6 h-6 text-cyber-green ${accessState === AccessState.SCANNING ? 'animate-spin-slow' : ''}`} />
        </div>

        {/* Reticle Area */}
        <div className="flex-1 flex items-center justify-center relative pointer-events-none">
           {/* The Target Box */}
           <div className="w-64 h-64 relative">
              {/* Corners */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyber-green rounded-tl-sm shadow-[0_0_10px_#00ff9d]" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cyber-green rounded-tr-sm shadow-[0_0_10px_#00ff9d]" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cyber-green rounded-bl-sm shadow-[0_0_10px_#00ff9d]" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cyber-green rounded-br-sm shadow-[0_0_10px_#00ff9d]" />
              
              {/* Central Crosshair */}
              <div className="absolute inset-0 flex items-center justify-center opacity-30">
                 <div className="w-4 h-0.5 bg-cyber-green" />
                 <div className="h-4 w-0.5 bg-cyber-green absolute" />
              </div>

              {/* Scanning Animation Line */}
              {accessState === AccessState.SCANNING && (
                <motion.div 
                   className="absolute left-0 right-0 h-0.5 bg-cyber-green shadow-[0_0_15px_#00ff9d]"
                   animate={{ top: ['0%', '100%', '0%'] }}
                   transition={{ duration: 3, ease: "linear", repeat: Infinity }}
                />
              )}
           </div>
        </div>

        {/* Status Bar */}
        <div className="border border-gray-800 bg-black/80 backdrop-blur p-4 rounded-sm pointer-events-auto mx-2 mb-4">
           <div className="font-mono text-xs text-gray-400 mb-1">SYSTEM_STATUS</div>
           <div className={`font-mono font-bold text-sm truncate ${
             accessState === AccessState.GRANTED ? 'text-cyber-green' : 
             accessState === AccessState.DENIED ? 'text-cyber-red' : 'text-white'
           }`}>
             {statusMessage}
           </div>
        </div>
      </div>

      {/* Result Overlays */}
      {accessState === AccessState.GRANTED && (
         <div className="absolute inset-0 z-30 bg-cyber-green/10 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-300 pointer-events-auto p-6">
            <div className="text-center w-full max-w-sm">
              <CheckCircle className="w-24 h-24 text-cyber-green mx-auto mb-4 drop-shadow-[0_0_15px_rgba(0,255,157,0.8)]" />
              <h2 className="text-2xl font-display font-bold text-white mb-2">VERIFIED</h2>
              <button 
                onClick={onBack}
                className="mt-8 w-full px-6 py-4 border border-cyber-green text-cyber-green hover:bg-cyber-green hover:text-black font-mono text-sm font-bold transition-colors"
              >
                RETURN_TO_BASE
              </button>
            </div>
         </div>
      )}

      {accessState === AccessState.DENIED && (
         <div className="absolute inset-0 z-30 bg-cyber-red/10 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-300 pointer-events-auto p-6">
            <div className="text-center w-full max-w-sm">
              <XCircle className="w-24 h-24 text-cyber-red mx-auto mb-4 drop-shadow-[0_0_15px_rgba(255,0,60,0.8)]" />
              <h2 className="text-2xl font-display font-bold text-white mb-2">REJECTED</h2>
              <p className="text-cyber-red font-mono text-xs mb-8">{statusMessage}</p>
              <div className="flex flex-col gap-4">
                <button 
                    onClick={() => {
                        setAccessState(AccessState.SCANNING);
                        setStatusMessage("RESCANNING...");
                        startScanning();
                    }}
                    className="w-full px-6 py-4 border border-cyber-red text-cyber-red hover:bg-cyber-red hover:text-black font-mono text-sm font-bold transition-colors"
                >
                    RETRY
                </button>
                <button 
                    onClick={onBack}
                    className="w-full px-6 py-4 border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white font-mono text-sm font-bold transition-colors"
                >
                    EXIT
                </button>
              </div>
            </div>
         </div>
      )}

      {/* The Actual Video Feed (Hidden from layout flow but visible in background) */}
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover opacity-60 grayscale brightness-75 contrast-125" muted />
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Grid Overlay for Cyberpunk feel */}
      <div className="absolute inset-0 z-10 grid-bg pointer-events-none opacity-20" />
    </div>
  );
};

export default LiveScanner;