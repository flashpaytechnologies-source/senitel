import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { QRPayload } from '../types';
import { generateNonce } from '../services/securityService';
import { supabase } from '../services/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, User, BookOpen, Clock, ShieldCheck, Lock, PlayCircle, Users, Calendar, FileText, Type, QrCode, Fingerprint, History, BarChart3, Radio, LogOut } from 'lucide-react';

const REFRESH_INTERVAL_MS = 60000; // 60 Seconds

const AVAILABLE_COURSES = [
  { id: 'CS-404', name: 'Network Security', desc: 'Protocol Analysis', totalStudents: 42 },
  { id: 'CS-302', name: 'Algorithms II', desc: 'Data Structures', totalStudents: 128 },
  { id: 'ETH-101', name: 'Cyber Ethics', desc: 'Legal Frameworks', totalStudents: 35 },
  { id: 'SYS-500', name: 'Kernel Arch', desc: 'System Design', totalStudents: 18 },
];

enum LecturerStep {
  AUTH = 'AUTH',
  SELECT = 'SELECT',
  COURSE_DASHBOARD = 'COURSE_DASHBOARD',
  HISTORY = 'HISTORY',
  CREATE_SESSION = 'CREATE_SESSION',
  MODE_SELECT = 'MODE_SELECT',
  BROADCAST = 'BROADCAST',
  BIO_SCANNER = 'BIO_SCANNER'
}

interface DynamicQRProps {
  onBack: () => void;
}

const DynamicQR: React.FC<DynamicQRProps> = ({ onBack }) => {
  const [step, setStep] = useState<LecturerStep>(LecturerStep.AUTH);
  const [lecturerId, setLecturerId] = useState('');
  const [password, setPassword] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<typeof AVAILABLE_COURSES[0] | null>(null);

  // Session State
  const [sessionName, setSessionName] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionDesc, setSessionDesc] = useState('');
  const [activeSessionId, setActiveSessionId] = useState('');
  const [historySessions, setHistorySessions] = useState<any[]>([]);

  // Scanner Input State
  const [scannerInput, setScannerInput] = useState('');
  const scannerInputRef = useRef<HTMLInputElement>(null);
  const [lastScannedStudent, setLastScannedStudent] = useState<string | null>(null);

  // QR State
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(REFRESH_INTERVAL_MS);
  const [nonce, setNonce] = useState<string>('');
  
  // Realtime State
  const [liveAttendees, setLiveAttendees] = useState(0);

  const handleInternalBack = () => {
    switch (step) {
      case LecturerStep.BIO_SCANNER:
      case LecturerStep.BROADCAST:
        setStep(LecturerStep.MODE_SELECT);
        setLiveAttendees(0);
        break;
      case LecturerStep.MODE_SELECT:
        setStep(LecturerStep.CREATE_SESSION);
        break;
      case LecturerStep.CREATE_SESSION:
        setStep(LecturerStep.COURSE_DASHBOARD);
        break;
      case LecturerStep.HISTORY:
        setStep(LecturerStep.COURSE_DASHBOARD);
        break;
      case LecturerStep.COURSE_DASHBOARD:
        setStep(LecturerStep.SELECT);
        break;
      case LecturerStep.SELECT:
        setStep(LecturerStep.AUTH);
        break;
      default:
        onBack();
    }
  };

  const handleLogout = () => {
    setLecturerId('');
    setPassword('');
    setSelectedCourse(null);
    setStep(LecturerStep.AUTH);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lecturerId.trim() || !password.trim()) return;
    setStep(LecturerStep.SELECT);
  };

  const handleCourseSelect = (course: typeof AVAILABLE_COURSES[0]) => {
    setSelectedCourse(course);
    setStep(LecturerStep.COURSE_DASHBOARD);
  };

  const handleStartCreateSession = () => {
    if (!selectedCourse) return;
    setSessionName(`Lecture: ${selectedCourse.name}`);
    setSessionDate(new Date().toISOString().split('T')[0]);
    setSessionDesc('');
    setStep(LecturerStep.CREATE_SESSION);
  };

  const handleViewHistory = async () => {
    if (!selectedCourse) return;
    setStep(LecturerStep.HISTORY);
    // Fetch History
    const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('course_id', selectedCourse.id)
        .order('created_at', { ascending: false });
    
    if (data) setHistorySessions(data);
  };

  const handleCreateSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;

    const newSessionId = `${selectedCourse.id}-${Date.now().toString(36)}`;
    setActiveSessionId(newSessionId);

    // Attempt to persist session meta-data
    try {
        await supabase.from('sessions').insert({
            session_id: newSessionId,
            course_id: selectedCourse.id,
            name: sessionName,
            description: sessionDesc,
            date: sessionDate,
            created_at: new Date().toISOString()
        });
    } catch (err) {
        console.warn("Backend session sync skipped - local mode active");
    }

    setStep(LecturerStep.MODE_SELECT);
  };

  const enterBroadcastMode = () => {
    setLiveAttendees(0);
    setStep(LecturerStep.BROADCAST);
  };

  const enterScannerMode = () => {
    setLiveAttendees(0);
    setLastScannedStudent(null);
    setStep(LecturerStep.BIO_SCANNER);
    setTimeout(() => scannerInputRef.current?.focus(), 100);
  };

  const handleScannerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!scannerInput.trim()) return;

    const studentId = scannerInput.trim();
    
    // Record Attendance
    const { error } = await supabase
      .from('attendance_logs')
      .insert([
        {
          class_id: activeSessionId,
          nonce: 'MANUAL_BIO_ENTRY',
          student_id: studentId,
          timestamp: new Date().toISOString()
        }
      ]);

    if (!error) {
        setLiveAttendees(prev => prev + 1);
        setLastScannedStudent(studentId);
        setScannerInput('');
    } else {
        alert("Error logging attendance or already scanned.");
    }
  };

  // Realtime Attendance Subscription
  useEffect(() => {
    if ((step !== LecturerStep.BROADCAST && step !== LecturerStep.BIO_SCANNER) || !activeSessionId) return;

    const fetchInitialCount = async () => {
        const { count, error } = await supabase
            .from('attendance_logs')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', activeSessionId);
        
        if (!error && count !== null) {
            setLiveAttendees(count);
        }
    };
    fetchInitialCount();

    const subscription = supabase
      .channel(`session_${activeSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance_logs',
          filter: `class_id=eq.${activeSessionId}`,
        },
        (payload) => {
          // Only increment if it wasn't triggered by our own manual scanner (which updates state optimistically)
          if (payload.new.nonce !== 'MANUAL_BIO_ENTRY') {
             setLiveAttendees((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [step, activeSessionId]);

  // QR Rotation Logic
  useEffect(() => {
    if (step !== LecturerStep.BROADCAST || !activeSessionId) return;

    const generateNewQR = async () => {
      const payload: QRPayload = {
        classId: activeSessionId,
        timestamp: Date.now(),
        nonce: generateNonce()
      };
      setNonce(payload.nonce);
      try {
        const url = await QRCode.toDataURL(JSON.stringify(payload), {
          width: 400, margin: 1, color: { dark: '#1e293b', light: '#ffffff' }, errorCorrectionLevel: 'H'
        });
        setQrDataUrl(url);
      } catch (err) { console.error(err); }
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
  }, [step, activeSessionId]);

  // --- RENDER: AUTH SCREEN ---
  if (step === LecturerStep.AUTH) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 relative overflow-hidden">
         {/* Background Elements */}
         <div className="absolute top-1/4 -right-20 w-80 h-80 bg-brand-600 rounded-full mix-blend-multiply filter blur-[80px] opacity-20" />
         <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-accent-600 rounded-full mix-blend-multiply filter blur-[80px] opacity-20" />

         <button onClick={onBack} className="absolute top-6 left-6 p-3 rounded-full glass-button text-slate-300 hover:text-white z-20">
            <ArrowLeft className="w-5 h-5" />
         </button>

         <div className="w-full max-w-sm relative z-10">
            <motion.div 
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               className="mb-8"
            >
              <h2 className="text-3xl font-extrabold text-white mb-2">Lecturer Portal</h2>
              <p className="text-slate-400 text-lg">Sign in to start a session</p>
            </motion.div>

            <motion.form 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              onSubmit={handleLogin} 
              className="space-y-4"
            >
               {/* ID Input */}
               <div className="space-y-2">
                 <label className="text-sm font-semibold text-slate-400 ml-1">Staff ID</label>
                 <div className="relative group">
                   <div className="absolute inset-0 bg-gradient-to-r from-brand-500 to-accent-500 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity blur-sm -z-10" />
                   <div className="relative bg-dark-surface/80 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden flex items-center p-1">
                     <div className="p-3 text-slate-400">
                        <User className="w-5 h-5" />
                     </div>
                     <input 
                        type="text" 
                        value={lecturerId}
                        onChange={(e) => setLecturerId(e.target.value.toUpperCase())}
                        placeholder="e.g. LEC-882"
                        className="w-full bg-transparent border-none text-white placeholder:text-slate-600 focus:ring-0 py-3 font-mono text-base"
                        autoFocus
                     />
                   </div>
                 </div>
               </div>

               {/* Password Input */}
               <div className="space-y-2">
                 <label className="text-sm font-semibold text-slate-400 ml-1">Password</label>
                 <div className="relative group">
                   <div className="absolute inset-0 bg-gradient-to-r from-brand-500 to-accent-500 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity blur-sm -z-10" />
                   <div className="relative bg-dark-surface/80 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden flex items-center p-1">
                     <div className="p-3 text-slate-400">
                        <Lock className="w-5 h-5" />
                     </div>
                     <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-transparent border-none text-white placeholder:text-slate-600 focus:ring-0 py-3 font-mono text-base"
                     />
                   </div>
                 </div>
               </div>
               
               <button 
                 type="submit"
                 disabled={!lecturerId.trim() || !password.trim()}
                 className="w-full mt-6 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2"
               >
                 <span>Access Dashboard</span>
                 <ChevronRight className="w-5 h-5" />
               </button>
            </motion.form>
         </div>
      </div>
    );
  }

  // --- RENDER: COURSE SELECTION ---
  if (step === LecturerStep.SELECT) {
    return (
      <div className="flex flex-col min-h-[100dvh] p-6 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-full h-96 bg-gradient-to-b from-brand-900/20 to-transparent pointer-events-none" />

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
                onClick={() => handleCourseSelect(course)}
                className="group flex items-center justify-between p-5 glass-panel rounded-3xl hover:bg-white/10 transition-all text-left relative overflow-hidden"
              >
                 <div className="flex items-center gap-5 relative z-10">
                   <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500/20 to-purple-500/20 flex items-center justify-center text-brand-400 group-hover:scale-110 transition-transform duration-300">
                      <BookOpen className="w-6 h-6" />
                   </div>
                   <div>
                     <h3 className="font-bold text-lg text-white mb-1 group-hover:text-brand-300 transition-colors">{course.name}</h3>
                     <div className="flex flex-col gap-1">
                        <p className="text-sm text-slate-400 font-mono flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-xs">{course.id}</span>
                            {course.desc}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                           <Users className="w-3.5 h-3.5" />
                           <span>{course.totalStudents} Registered</span>
                        </div>
                     </div>
                   </div>
                 </div>
                 <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-slate-500 group-hover:bg-brand-500 group-hover:text-white group-hover:border-transparent transition-all z-10">
                    <PlayCircle className="w-5 h-5 fill-current" />
                 </div>
                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-brand-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.button>
            ))}
         </div>
      </div>
    );
  }

  // --- RENDER: COURSE DASHBOARD ---
  if (step === LecturerStep.COURSE_DASHBOARD) {
    return (
      <div className="flex flex-col items-center min-h-[100dvh] p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-96 bg-gradient-to-b from-brand-900/20 to-transparent pointer-events-none" />

        <div className="w-full max-w-md relative z-10 flex flex-col gap-6">
           <div className="flex items-center gap-4 pt-2">
             <button onClick={handleInternalBack} className="p-3 rounded-full glass-button text-slate-300">
                <ArrowLeft className="w-5 h-5" />
             </button>
             <div>
                <h2 className="text-2xl font-bold text-white leading-none">{selectedCourse?.id}</h2>
                <span className="text-sm text-brand-400 font-medium">Course Dashboard</span>
             </div>
           </div>

           <motion.button 
             onClick={handleStartCreateSession}
             initial={{ y: 20, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             className="w-full glass-panel hover:bg-white/5 p-1 rounded-3xl transition-all duration-300 group relative overflow-hidden"
           >
              <div className="relative p-6 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="p-3.5 bg-green-500/20 rounded-2xl text-green-400 group-hover:scale-110 transition-transform">
                    <Radio className="w-7 h-7" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-xl text-white">Start New Session</h3>
                    <p className="text-sm text-slate-400">Broadcast QR or Biometric</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500" />
              </div>
           </motion.button>

           <motion.button 
             onClick={handleViewHistory}
             initial={{ y: 20, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             transition={{ delay: 0.1 }}
             className="w-full glass-panel hover:bg-white/5 p-1 rounded-3xl transition-all duration-300 group relative overflow-hidden"
           >
              <div className="relative p-6 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="p-3.5 bg-blue-500/20 rounded-2xl text-blue-400 group-hover:scale-110 transition-transform">
                    <History className="w-7 h-7" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-xl text-white">View History</h3>
                    <p className="text-sm text-slate-400">Past sessions & data</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500" />
              </div>
           </motion.button>

        </div>
      </div>
    );
  }

  // --- RENDER: HISTORY VIEW ---
  if (step === LecturerStep.HISTORY) {
    return (
      <div className="flex flex-col min-h-[100dvh] p-6 relative overflow-hidden">
        <div className="flex items-center gap-4 mb-8 pt-2 z-10">
           <button onClick={handleInternalBack} className="p-3 rounded-full glass-button text-slate-300">
              <ArrowLeft className="w-5 h-5" />
           </button>
           <h2 className="text-2xl font-bold text-white">Past Sessions</h2>
        </div>

        <div className="space-y-3 max-w-lg mx-auto w-full z-10 pb-10">
            {historySessions.length === 0 && (
                <div className="text-center py-10 text-slate-500">No sessions recorded yet.</div>
            )}
            {historySessions.map((session, idx) => (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={session.id || idx}
                className="glass-panel p-4 rounded-2xl flex items-center justify-between"
              >
                  <div>
                      <h4 className="font-bold text-white">{session.name}</h4>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {session.date}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(session.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
                      <BarChart3 className="w-4 h-4 text-brand-400" />
                      <span className="text-sm font-mono text-white">View</span>
                  </div>
              </motion.div>
            ))}
        </div>
      </div>
    );
  }

  // --- RENDER: CREATE SESSION FORM ---
  if (step === LecturerStep.CREATE_SESSION) {
    return (
      <div className="flex flex-col items-center min-h-[100dvh] p-6 relative overflow-hidden">
         <div className="absolute bottom-0 left-0 w-full h-96 bg-gradient-to-t from-brand-900/20 to-transparent pointer-events-none" />

         <div className="w-full max-w-md relative z-10 flex flex-col h-full">
           <div className="flex items-center gap-4 mb-8 pt-2">
             <button onClick={handleInternalBack} className="p-3 rounded-full glass-button text-slate-300 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
             </button>
             <div>
                <h2 className="text-2xl font-bold text-white leading-none">Create Session</h2>
                <span className="text-sm text-brand-400 font-medium">{selectedCourse?.name}</span>
             </div>
           </div>

           <motion.form 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex-1 flex flex-col gap-5"
              onSubmit={handleCreateSessionSubmit}
           >
              {/* Session Name */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-400 ml-1">Session Name</label>
                <div className="relative bg-dark-surface/80 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden flex items-center p-1">
                  <div className="p-3 text-slate-400">
                    <Type className="w-5 h-5" />
                  </div>
                  <input 
                    type="text" 
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    className="w-full bg-transparent border-none text-white placeholder:text-slate-600 focus:ring-0 py-3 font-medium text-base"
                    required
                  />
                </div>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-400 ml-1">Date</label>
                <div className="relative bg-dark-surface/80 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden flex items-center p-1">
                  <div className="p-3 text-slate-400">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <input 
                    type="date" 
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="w-full bg-transparent border-none text-white placeholder:text-slate-600 focus:ring-0 py-3 font-mono text-base"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-400 ml-1">Description (Optional)</label>
                <div className="relative bg-dark-surface/80 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden flex items-start p-1 h-32">
                  <div className="p-3 text-slate-400 pt-3.5">
                    <FileText className="w-5 h-5" />
                  </div>
                  <textarea 
                    value={sessionDesc}
                    onChange={(e) => setSessionDesc(e.target.value)}
                    placeholder="Topics covered..."
                    className="w-full h-full bg-transparent border-none text-white placeholder:text-slate-600 focus:ring-0 py-3 resize-none text-base"
                  />
                </div>
              </div>

              <div className="flex-1" />

              <button 
                type="submit"
                className="w-full mb-6 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2"
              >
                <span>Continue</span>
                <ChevronRight className="w-5 h-5" />
              </button>
           </motion.form>
         </div>
      </div>
    );
  }

  // --- RENDER: MODE SELECTION ---
  if (step === LecturerStep.MODE_SELECT) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 relative">
         <button onClick={handleInternalBack} className="absolute top-6 left-6 p-3 rounded-full glass-button text-slate-300 hover:text-white z-20">
            <ArrowLeft className="w-5 h-5" />
         </button>

         <div className="w-full max-w-sm z-10">
            <h2 className="text-2xl font-bold text-white mb-2 text-center">Choose Attendance Mode</h2>
            <p className="text-slate-400 text-center mb-10">How will students check in?</p>

            <div className="space-y-4">
               <motion.button 
                 onClick={enterBroadcastMode}
                 initial={{ y: 20, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 className="w-full glass-panel hover:bg-brand-500/10 p-6 rounded-3xl transition-all group border-l-4 border-l-brand-500"
               >
                 <div className="flex items-center gap-4">
                   <div className="p-4 bg-brand-500/20 rounded-full text-brand-400">
                      <QrCode className="w-8 h-8" />
                   </div>
                   <div className="text-left">
                     <h3 className="font-bold text-lg text-white">Broadcast QR</h3>
                     <p className="text-sm text-slate-400">Students scan screen</p>
                   </div>
                 </div>
               </motion.button>

               <motion.button 
                 onClick={enterScannerMode}
                 initial={{ y: 20, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 transition={{ delay: 0.1 }}
                 className="w-full glass-panel hover:bg-accent-500/10 p-6 rounded-3xl transition-all group border-l-4 border-l-accent-500"
               >
                 <div className="flex items-center gap-4">
                   <div className="p-4 bg-accent-500/20 rounded-full text-accent-400">
                      <Fingerprint className="w-8 h-8" />
                   </div>
                   <div className="text-left">
                     <h3 className="font-bold text-lg text-white">Biometric System</h3>
                     <p className="text-sm text-slate-400">Attach hardware scanner</p>
                   </div>
                 </div>
               </motion.button>
            </div>
         </div>
      </div>
    );
  }

  // --- RENDER: BIOMETRIC SCANNER MODE ---
  if (step === LecturerStep.BIO_SCANNER) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 relative bg-black">
         <button onClick={handleInternalBack} className="absolute top-6 left-6 p-3 rounded-full glass-button text-slate-300 hover:text-white z-20">
            <ArrowLeft className="w-5 h-5" />
         </button>

         <div className="w-full max-w-md text-center">
            <div className="mb-10">
                <div className="w-24 h-24 rounded-full bg-accent-500/10 border-2 border-accent-500 flex items-center justify-center mx-auto mb-6 relative">
                    <Fingerprint className="w-10 h-10 text-accent-500 animate-pulse" />
                    <div className="absolute inset-0 rounded-full border border-accent-500/50 animate-ping" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">Scanner Active</h2>
                <p className="text-slate-400">Ready for biometric input...</p>
            </div>

            <div className="glass-panel p-6 rounded-2xl mb-8">
               <div className="flex justify-between items-center mb-4">
                 <span className="text-slate-400 text-sm font-bold uppercase">Session</span>
                 <span className="text-white font-mono">{activeSessionId.split('-')[0]}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-slate-400 text-sm font-bold uppercase">Attendees</span>
                 <span className="text-green-400 font-bold text-2xl">{liveAttendees}</span>
               </div>
            </div>

            {/* Hidden form to capture scanner input */}
            <form onSubmit={handleScannerSubmit} className="relative">
                <div className="absolute inset-0 bg-transparent z-10 cursor-text" onClick={() => scannerInputRef.current?.focus()}></div>
                <input 
                  ref={scannerInputRef}
                  type="text" 
                  value={scannerInput} 
                  onChange={(e) => setScannerInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-mono focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none transition-all text-base"
                  placeholder="Waiting for input..."
                  autoFocus
                  onBlur={() => setTimeout(() => scannerInputRef.current?.focus(), 100)} // Keep focus
                />
            </form>

            {lastScannedStudent && (
               <motion.div 
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center gap-3 text-green-400"
               >
                   <ShieldCheck className="w-5 h-5" />
                   <span className="font-bold">Verified: {lastScannedStudent}</span>
               </motion.div>
            )}
         </div>
      </div>
    );
  }

  // --- RENDER: QR BROADCAST (Existing) ---
  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-900/40 via-dark-bg to-dark-bg" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[100px] animate-pulse-soft" />

      <button 
        onClick={handleInternalBack}
        className="absolute top-6 left-6 p-3 rounded-full glass-button text-slate-300 z-20"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="w-full max-w-sm relative z-10">
        
        <div className="glass-panel p-1.5 rounded-[2.5rem] shadow-2xl shadow-black/50 ring-1 ring-white/10">
          <div className="bg-white rounded-[2rem] p-6 pb-8 overflow-hidden relative">
             
             {/* Ticket Header */}
             <div className="flex justify-between items-start mb-6 border-b border-dashed border-slate-200 pb-6 relative">
               <div className="absolute -bottom-[25px] -left-[30px] w-5 h-5 bg-dark-bg rounded-full" />
               <div className="absolute -bottom-[25px] -right-[30px] w-5 h-5 bg-dark-bg rounded-full" />
               
               <div className="flex-1 pr-4">
                  <h2 className="text-2xl font-extrabold text-slate-900 leading-tight mb-1">{sessionName}</h2>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-brand-600 font-bold text-sm">{selectedCourse?.id} - {selectedCourse?.name}</span>
                    <span className="text-slate-400 text-xs font-medium">{sessionDate}</span>
                  </div>
                  {sessionDesc && (
                      <p className="text-slate-500 text-xs mt-2 leading-relaxed line-clamp-2">{sessionDesc}</p>
                  )}
               </div>
               
               <div className="flex flex-col items-end gap-1">
                   <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 mb-1">
                      <ShieldCheck className="w-5 h-5" />
                   </div>
               </div>
             </div>

             {/* Live Counter Overlay (Absolute to QR container or Ticket) */}
             <div className="flex items-center justify-between mb-4 bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm">
                      <Users className="w-5 h-5" />
                   </div>
                   <div>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Attendance</p>
                      <p className="text-slate-900 font-bold text-lg leading-none">
                        {liveAttendees} <span className="text-slate-300 text-sm">/ {selectedCourse?.totalStudents}</span>
                      </p>
                   </div>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-green-100 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-green-700 uppercase">Live</span>
                </div>
             </div>

             {/* QR Section */}
             <div className="aspect-square w-full flex items-center justify-center bg-slate-900 rounded-2xl overflow-hidden mb-6 relative border border-slate-800 shadow-inner">
                <AnimatePresence mode="wait">
                 {qrDataUrl && (
                   <motion.img 
                     key={nonce}
                     initial={{ opacity: 0, scale: 0.95, filter: 'blur(8px)' }}
                     animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                     exit={{ opacity: 0 }}
                     transition={{ duration: 0.3 }}
                     src={qrDataUrl} 
                     alt="QR Code" 
                     className="w-full h-full object-contain p-4"
                   />
                 )}
               </AnimatePresence>
               
               {/* Scan Line Animation */}
               <motion.div 
                 className="absolute top-0 w-full h-1 bg-brand-500 shadow-lg shadow-brand-500/50"
                 animate={{ top: ['0%', '100%'] }}
                 transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
               />
             </div>

             {/* Timer Bar */}
             <div className="flex items-center gap-3 mb-1">
               <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-brand-500 to-accent-500"
                    initial={{ width: '100%' }}
                    animate={{ width: `${(timeLeft / REFRESH_INTERVAL_MS) * 100}%` }}
                    transition={{ ease: "linear", duration: 0.1 }}
                  />
               </div>
               <span className="text-xs font-mono font-bold text-slate-400 w-6">
                 {Math.ceil(timeLeft / 1000)}s
               </span>
             </div>
             
             <p className="text-center text-[10px] text-slate-400 uppercase tracking-widest mt-4 font-semibold">
                Auto-Rotating Secure Token
             </p>

          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 flex justify-center gap-6 text-sm text-slate-400">
           <div className="flex items-center gap-2">
             <Clock className="w-4 h-4 text-brand-500" />
             <span>Real-time</span>
           </div>
           <div className="flex items-center gap-2">
             <Lock className="w-4 h-4 text-brand-500" />
             <span>Encrypted</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DynamicQR;