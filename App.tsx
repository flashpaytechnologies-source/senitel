import React, { useState } from 'react';
import DynamicQR from './components/DynamicQR';
import LiveScanner from './components/LiveScanner';
import { ShieldCheck, User, QrCode, ArrowRight, GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';

enum View {
  LANDING = 'LANDING',
  LECTURER = 'LECTURER',
  STUDENT = 'STUDENT'
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.LANDING);

  const goBack = () => setCurrentView(View.LANDING);

  const renderContent = () => {
    switch (currentView) {
      case View.LECTURER:
        return <DynamicQR onBack={goBack} />;
      case View.STUDENT:
        return <LiveScanner onBack={goBack} />;
      default:
        return (
          <div className="min-h-[100dvh] relative flex flex-col items-center justify-center p-6 overflow-hidden">
            
            {/* Animated Background Blobs */}
            <div className="absolute top-0 -left-4 w-72 h-72 bg-brand-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
            <div className="absolute top-0 -right-4 w-72 h-72 bg-accent-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob [animation-delay:2s]" />
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob [animation-delay:4s]" />

            <div className="z-10 w-full max-w-md flex flex-col items-center">
              
              {/* Header */}
              <div className="mb-10 text-center relative">
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", bounce: 0.5 }}
                  className="inline-flex items-center justify-center p-4 bg-gradient-to-tr from-brand-500 to-accent-500 rounded-2xl mb-6 shadow-lg shadow-brand-500/30"
                >
                  <ShieldCheck className="w-10 h-10 text-white" />
                </motion.div>
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <h1 className="text-4xl font-extrabold tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                    Omniattend
                  </h1>
                  <p className="text-slate-400 font-medium text-lg">Class attendance, simplified.</p>
                </motion.div>
              </div>

              {/* Actions */}
              <div className="w-full space-y-4">
                <motion.button 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  onClick={() => setCurrentView(View.LECTURER)}
                  className="w-full glass-panel hover:bg-white/5 p-1 rounded-3xl transition-all duration-300 group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative p-6 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="p-3.5 bg-brand-500/20 rounded-2xl text-brand-400 group-hover:text-brand-300 group-hover:scale-110 transition-all duration-300">
                        <GraduationCap className="w-7 h-7" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-bold text-xl text-white">Lecturer</h3>
                        <p className="text-sm text-slate-400 font-medium">Create session</p>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-slate-500 group-hover:text-white group-hover:border-brand-500/50 transition-all">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </motion.button>

                <motion.button 
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  onClick={() => setCurrentView(View.STUDENT)}
                  className="w-full glass-panel hover:bg-white/5 p-1 rounded-3xl transition-all duration-300 group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-accent-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative p-6 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="p-3.5 bg-accent-500/20 rounded-2xl text-accent-400 group-hover:text-accent-300 group-hover:scale-110 transition-all duration-300">
                        <QrCode className="w-7 h-7" />
                      </div>
                      <div className="text-left">
                        <h3 className="font-bold text-xl text-white">Student</h3>
                        <p className="text-sm text-slate-400 font-medium">Join class</p>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-slate-500 group-hover:text-white group-hover:border-accent-500/50 transition-all">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </motion.button>
              </div>

              <motion.footer 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-12 text-center"
              >
                <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-500 font-medium backdrop-blur-sm">
                  Powered by Secure AES-256
                </div>
              </motion.footer>

            </div>
          </div>
        );
    }
  };

  return (
    <div className="bg-dark-bg min-h-[100dvh] font-sans">
      {renderContent()}
    </div>
  );
};

export default App;