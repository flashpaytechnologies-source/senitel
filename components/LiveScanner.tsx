import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { AccessState, QRPayload } from '../types';
import { validateAttendance, useSecurityWatchdog } from '../services/securityService';
import { supabase } from '../services/supabaseClient';
import { motion } from 'framer-motion';
import { Check, X, ArrowLeft, User, Lock, ChevronRight, GraduationCap, BookOpen, Calendar, Clock, AlertCircle, RefreshCw, LogOut } from 'lucide-react';

const AVAILABLE_COURSES = [
  { id: 'CS-404', name: 'Network Security', desc: 'Protocol Analysis' },
  { id: 'CS-302', name: 'Algorithms II', desc: 'Data Structures' },
  { id: 'ETH-101', name: 'Cyber Ethics', desc: 'Legal Frameworks' },
  { id: 'SYS-500', name: 'Kernel Arch', desc: 'System Design' },
];

interface LiveScannerProps {
  onBack: () => void;
}

enum StudentStep {
  LOGIN = 'LOGIN',
  SELECT_COURSE = 'SELECT_COURSE',
  SELECT_SESSION = 'SELECT_SESSION',
  SCANNER = 'SCANNER'
}

const LiveScanner: React.FC<LiveScannerProps> = ({ onBack }) => {
  // Flow State
  const [step, setStep] = useState<StudentStep>(StudentStep.LOGIN);
  
  // Auth State
  const [matricNumber, setMatricNumber] = useState('');
  const [password, setPassword] = useState('');

  // Selection State
  const [selectedCourse, setSelectedCourse] = useState<typeof AVAILABLE_COURSES[0] | null>(null);
  const [availableSessions, setAvailableSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Scanner State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [accessState, setAccessState] = useState<AccessState>(AccessState.LOCKED);
  const [statusMessage, setStatusMessage] = useState<string>('Ready to scan');

  // Security Watchdog
  useEffect(() => {
    return useSecurityWatchdog(() => {
      if (step === StudentStep.SCANNER && accessState !== AccessState.LOCKED) {
         setAccessState(AccessState.DENIED);
         setStatusMessage("Security alert: App was backgrounded");
      }
    });
  }, [step, accessState]);

  // Fetch Sessions
  const fetchSessions = useCallback(async () => {
    if (!selectedCourse) return;
    setLoadingSessions(true);
    
    // Only fetch sessions created in the last 24 hours to ensure they are "active" or recent
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('course_id', selectedCourse.id)
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false });
    
    if (data) setAvailableSessions(data);
    setLoadingSessions(false);
  }, [selectedCourse]);

  // Trigger fetch on step entry
  useEffect(() => {
    if (step === StudentStep.SELECT_SESSION && selectedCourse) {
      fetchSessions();
    }
  }, [step, selectedCourse, fetchSessions]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matricNumber.trim()) return;
    
    // Store identity for securityService to pick up
    localStorage.setItem('omniattend_student_id', matricNumber.toUpperCase());
    
    setStep(StudentStep.SELECT_COURSE);
  };

  const handleInternalBack = () => {
    switch (step) {
      case StudentStep.SCANNER:
        setStep(StudentStep.SELECT_SESSION);
        setAccessState(AccessState.LOCKED);
        break;
      case StudentStep.SELECT_SESSION:
        setStep(StudentStep.SELECT_COURSE);
        break;
      case StudentStep.SELECT_COURSE:
        setStep(StudentStep.LOGIN);
        break;
      default:
        onBack();
    }
  };

  const handleLogout = () => {
    setMatricNumber('');
    setPassword('');
    setSelectedCourse(null);
    localStorage.removeItem('omniattend_student_id');
    setStep(StudentStep.LOGIN);
  };

  const stopStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const startScanning = useCallback(async () => {
    if (accessState === AccessState.GRANTED || accessState === AccessState.DENIED) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true"); 
        videoRef.current.play();
        requestAnimationFrame(tick);
      }
    } catch (err) {
      setStatusMessage("Could not access camera");
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
          
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code) {
             handleScanSuccess(code.data);
             return;
          }
        }
      }
    }
    requestAnimationFrame(tick);
  };

  const handleScanSuccess = async (data: string) => {
    setAccessState(AccessState.VALIDATING);
    setStatusMessage("Verifying...");
    stopStream();

    try {
      const payload: QRPayload = JSON.parse(data);

      // Verify Session Match
      if (selectedSession && payload.classId !== selectedSession.session_id) {
         setAccessState(AccessState.DENIED);
         setStatusMessage("Wrong Session QR Code");
         return;
      }

      const result = await validateAttendance(payload);

      if (result.success) {
        setAccessState(AccessState.GRANTED);
        setStatusMessage(selectedSession?.name || payload.classId);
      } else {
        setAccessState(AccessState.DENIED);
        setStatusMessage(result.error?.message || "Not Authorized");
      }
    } catch (e) {
      setAccessState(AccessState.DENIED);
      setStatusMessage("Invalid QR Code");
    }
  };

  useEffect(() => {
    if (step === StudentStep.SCANNER && accessState === AccessState.LOCKED) {
      setAccessState(AccessState.SCANNING);
      startScanning();
    }
    return () => stopStream();
  }, [step, accessState, startScanning]);

  // --- RENDER: LOGIN ---
  if (step === StudentStep.LOGIN) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 relative overflow-hidden bg-dark-bg">
         <div className="absolute top-1/4 -left-20 w-80 h-80 bg-accent-600 rounded-full mix-blend-multiply filter blur-[80px] opacity-20" />
         <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-brand-600 rounded-full mix-blend-multiply filter blur-[80px] opacity-20" />

         <button onClick={onBack} className="absolute top-6 left-6 p-3 rounded-full glass-button text-slate-300 hover:text-white z-20">
            <ArrowLeft className="w-5 h-5" />
         </button>

         <div className="w-full max-w-sm relative z-10">
            <motion.div 
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               className="mb-8"
            >
              <h2 className="text-3xl font-extrabold text-white mb-2">Student Portal</h2>
              <p className="text-slate-400 text-lg">Log in to mark attendance</p>
            </motion.div>

            <motion.form 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              onSubmit={handleLogin} 
              className="space-y-4"
            >
               <div className="space-y-2">
                 <label className="text-sm font-semibold text-slate-400 ml-1">Matriculation No.</label>
                 <div className="relative bg-dark-surface/80 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden flex items-center p-1">
                     <div className="p-3 text-slate-400"><GraduationCap className="w-5 h-5" /></div>
                     <input 
                        type="text" 
                        value={matricNumber}
                        onChange={(e) => setMatricNumber(e.target.value.toUpperCase())}
                        placeholder="e.g. U2024/CS/042"
                        className="w-full bg-transparent border-none text-white placeholder:text-slate-600 focus:ring-0 py-3 font-mono text-base"
                        autoFocus
                     />
                 </div>
               </div>

               <div className="space-y-2">
                 <label className="text-sm font-semibold text-slate-400 ml-1">Password</label>
                 <div className="relative bg-dark-surface/80 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden flex items-center p-1">
                     <div className="p-3 text-slate-400"><Lock className="w-5 h-5" /></div>
                     <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-transparent border-none text-white placeholder:text-slate-600 focus:ring-0 py-3 font-mono text-base"
                     />
                 </div>
               </div>
               
               <button 
                 type="submit"
                 disabled={!matricNumber.trim()}
                 className="w-full mt-6 bg-gradient-to-r from-accent-600 to-accent-500 hover:from-accent-500 hover:to-accent-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-accent-500/25 flex items-center justify-center gap-2"
               >
                 <span>Continue</span>
                 <ChevronRight className="w-5 h-5" />
               </button>
            </motion.form>
         </div>
      </div>
    );
  }

  // --- RENDER: SELECT COURSE ---
  if (step === StudentStep.SELECT_COURSE) {
    return (
      <div className="flex flex-col min-h-[100dvh] p-6 relative overflow-hidden bg-dark-bg">
         <div className="flex items-center justify-between mb-8 pt-2 z-10">
           <div className="flex items-center gap-4">
             <button onClick={handleInternalBack} className="p-3 rounded-full glass-button text-slate-300">
                <ArrowLeft className="w-5 h-5" />
             </button>
             <h2 className="text-2xl font-bold text-white">Select Course</h2>
           </div>
           <button onClick={handleLogout} className="p-3 rounded-full glass-button text-red-400 hover:bg-red-500/10 border-red-500/20">
              <LogOut className="w-5 h-5" />
           </button>
         </div>

         <div className="grid gap-4 max-w-lg mx-auto w-full z-10 pb-10">
            {AVAILABLE_COURSES.map((course, idx) => (
              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
                key={course.id}
                onClick={() => {
                    setSelectedCourse(course);
                    setStep(StudentStep.SELECT_SESSION);
                }}
                className="group flex items-center justify-between p-5 glass-panel rounded-3xl hover:bg-white/10 transition-all text-left relative overflow-hidden"
              >
                 <div className="flex items-center gap-5 relative z-10">
                   <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500/20 to-purple-500/20 flex items-center justify-center text-brand-400 group-hover:scale-110 transition-transform duration-300">
                      <BookOpen className="w-6 h-6" />
                   </div>
                   <div>
                     <h3 className="font-bold text-lg text-white mb-1">{course.name}</h3>
                     <p className="text-sm text-slate-400 font-mono">{course.id}</p>
                   </div>
                 </div>
                 <ChevronRight className="w-5 h-5 text-slate-500" />
              </motion.button>
            ))}
         </div>
      </div>
    );
  }

  // --- RENDER: SELECT SESSION ---
  if (step === StudentStep.SELECT_SESSION) {
    return (
      <div className="flex flex-col min-h-[100dvh] p-6 relative overflow-hidden bg-dark-bg">
         <div className="flex items-center gap-4 mb-8 pt-2 z-10">
           <button onClick={handleInternalBack} className="p-3 rounded-full glass-button text-slate-300">
              <ArrowLeft className="w-5 h-5" />
           </button>
           <div className="flex-1">
               <h2 className="text-2xl font-bold text-white leading-none">Select Session</h2>
               <span className="text-sm text-brand-400 font-medium">{selectedCourse?.name}</span>
           </div>
           <button onClick={fetchSessions} className="p-3 rounded-full glass-button text-brand-400 hover:text-brand-300 transition-colors">
              <RefreshCw className={`w-5 h-5 ${loadingSessions ? 'animate-spin' : ''}`} />
           </button>
         </div>

         <div className="flex flex-col gap-4 max-w-lg mx-auto w-full z-10 pb-10">
            {loadingSessions ? (
                <div className="text-center text-slate-500 py-10 animate-pulse">Loading sessions...</div>
            ) : availableSessions.length === 0 ? (
                <div className="glass-panel p-8 rounded-3xl text-center">
                    <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 mb-2">No active sessions found.</p>
                    <p className="text-xs text-slate-500">Only sessions created in the last 24h are shown. Ask your lecturer to start a new session.</p>
                </div>
            ) : (
                availableSessions.map((session, idx) => (
                    <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        key={session.id}
                        onClick={() => {
                            setSelectedSession(session);
                            setStep(StudentStep.SCANNER);
                        }}
                        className="glass-panel p-5 rounded-2xl text-left hover:bg-white/5 transition-all group border-l-4 border-l-transparent hover:border-l-brand-500"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-white text-lg">{session.name}</h3>
                            <span className="text-xs px-2 py-1 rounded bg-brand-500/20 text-brand-300 border border-brand-500/20">Active</span>
                        </div>
                        <p className="text-slate-400 text-sm mb-3 line-clamp-2">{session.description || "No description provided."}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {session.date}</span>
                            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {new Date(session.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                    </motion.button>
                ))
            )}
         </div>
      </div>
    );
  }

  // --- RENDER: SCANNER ---
  return (
    <div className="fixed inset-0 w-full h-full bg-dark-bg overflow-hidden">
      
      {/* UI Overlay */}
      <div className="absolute inset-0 z-20 flex flex-col justify-between p-6 pointer-events-none">
        
        {/* Top Bar */}
        <div className="flex justify-between items-start pointer-events-auto">
           <button 
             onClick={handleInternalBack}
             className="p-3 rounded-full bg-black/30 backdrop-blur-xl text-white border border-white/10 hover:bg-black/40 transition-colors"
           >
             <ArrowLeft className="w-6 h-6" />
           </button>
           
           <div className="flex flex-col items-end gap-2">
              <div className="px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-slate-300 text-xs font-mono">
                 {matricNumber}
              </div>
              {selectedSession && (
                  <div className="px-3 py-1.5 rounded-full bg-brand-500/20 backdrop-blur-md border border-brand-500/30 text-brand-200 text-xs font-bold shadow-lg">
                     Target: {selectedSession.name}
                  </div>
              )}
           </div>
        </div>

        {/* Center Reticle */}
        <div className="flex-1 flex items-center justify-center">
           <div className="w-72 h-72 relative rounded-[2rem] overflow-hidden shadow-2xl shadow-black/50">
              {/* Corner Strokes */}
              <div className="absolute inset-0 rounded-[2rem] border-[3px] border-white/30" />
              <div className="absolute inset-0 rounded-[2rem] border-[3px] border-brand-500/80 [mask-image:linear-gradient(to_bottom,black_20%,transparent_20%,transparent_80%,black_80%),linear-gradient(to_right,black_20%,transparent_20%,transparent_80%,black_80%)] [mask-composite:intersect]" />
              
              {accessState === AccessState.SCANNING && (
                <motion.div 
                   className="absolute left-0 right-0 h-32 bg-gradient-to-b from-brand-500/40 to-transparent"
                   animate={{ top: ['-100%', '100%'] }}
                   transition={{ duration: 1.5, ease: "linear", repeat: Infinity }}
                />
              )}
           </div>
        </div>

        {/* Bottom Status */}
        <div className="text-center pointer-events-auto pb-8">
           <div className="inline-block px-6 py-3 rounded-2xl bg-black/40 backdrop-blur-md border border-white/5">
              <p className="text-white font-medium">{statusMessage}</p>
           </div>
        </div>
      </div>

      {/* SUCCESS OVERLAY */}
      {accessState === AccessState.GRANTED && (
         <div className="absolute inset-0 z-30 bg-gradient-to-br from-brand-600 to-brand-800 flex flex-col items-center justify-center p-8 text-white animate-in zoom-in-95 duration-300">
            <motion.div 
              initial={{ scale: 0.8, rotate: -10 }} 
              animate={{ scale: 1, rotate: 0 }}
              className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-brand-900/50"
            >
              <Check className="w-16 h-16 text-brand-600 stroke-[3]" />
            </motion.div>
            
            <h2 className="text-4xl font-extrabold mb-3">You're in!</h2>
            <p className="text-brand-100 text-lg mb-12 text-center max-w-xs leading-relaxed">
              Successfully checked into <br/>
              <span className="font-bold text-white">{statusMessage}</span>
            </p>
            
            <button 
              onClick={() => onBack()}
              className="w-full max-w-xs bg-white text-brand-700 py-5 rounded-2xl font-bold text-lg hover:scale-105 transition-transform shadow-xl"
            >
              Return Home
            </button>
         </div>
      )}

      {/* ERROR OVERLAY */}
      {accessState === AccessState.DENIED && (
         <div className="absolute inset-0 z-30 bg-gradient-to-br from-red-600 to-red-800 flex flex-col items-center justify-center p-8 text-white animate-in zoom-in-95 duration-300">
            <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center mb-8 backdrop-blur-sm border border-white/20">
              <X className="w-16 h-16 text-white stroke-[3]" />
            </div>
            
            <h2 className="text-3xl font-bold mb-3">Check-in Failed</h2>
            <p className="text-red-100 text-lg mb-12 text-center max-w-xs">
              {statusMessage}
            </p>
            
            <div className="flex flex-col gap-4 w-full max-w-xs">
              <button 
                  onClick={() => {
                      setAccessState(AccessState.SCANNING);
                      setStatusMessage("Ready to scan");
                      startScanning();
                  }}
                  className="w-full bg-white text-red-600 py-4 rounded-2xl font-bold text-lg hover:bg-red-50 transition-colors"
              >
                  Try Again
              </button>
              <button 
                  onClick={handleInternalBack}
                  className="w-full bg-red-900/40 text-white py-4 rounded-2xl font-semibold border border-red-400/30 hover:bg-red-900/60 transition-colors"
              >
                  Select Session
              </button>
            </div>
         </div>
      )}

      {/* Video Element */}
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default LiveScanner;