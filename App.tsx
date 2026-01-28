import React, { useState } from 'react';
import DynamicQR from './components/DynamicQR';
import LiveScanner from './components/LiveScanner';
import { Shield, ScanLine, Smartphone } from 'lucide-react';

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
          <div className="min-h-screen grid-bg bg-cyber-black text-gray-200 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
            
            {/* Ambient Background Elements */}
            <div className="absolute top-10 left-10 w-64 h-64 bg-cyber-green/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-64 h-64 bg-cyber-red/5 rounded-full blur-3xl pointer-events-none" />

            <div className="z-10 text-center mb-12 sm:mb-16">
              <div className="inline-flex items-center justify-center p-4 border-2 border-cyber-green rounded-full mb-6 shadow-[0_0_20px_rgba(0,255,157,0.2)]">
                <Shield className="w-10 h-10 text-cyber-green" />
              </div>
              <h1 className="text-4xl md:text-6xl font-display font-bold text-white tracking-tighter mb-2">
                SENTINEL
              </h1>
              <p className="text-xs sm:text-sm font-mono text-cyber-green/70 tracking-widest uppercase">
                Secure Attendance Protocol v1.0
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 sm:gap-6 w-full max-w-2xl z-10">
              {/* Lecturer Button */}
              <button 
                onClick={() => setCurrentView(View.LECTURER)}
                className="group relative p-6 sm:p-8 border border-gray-800 bg-gray-900/50 hover:bg-gray-900 hover:border-cyber-green transition-all duration-300 text-left overflow-hidden rounded-sm"
              >
                <div className="absolute inset-0 bg-cyber-green/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                
                <div className="relative z-10">
                  <ScanLine className="w-8 h-8 text-gray-500 group-hover:text-cyber-green mb-4 transition-colors" />
                  <h3 className="text-lg sm:text-xl font-bold font-display text-white mb-2">BEACON MODE</h3>
                  <p className="text-[10px] sm:text-xs text-gray-500 font-mono">For Lecturers. Generates a cryptographically secure, rotating QR token.</p>
                </div>
              </button>

              {/* Student Button */}
              <button 
                onClick={() => setCurrentView(View.STUDENT)}
                className="group relative p-6 sm:p-8 border border-gray-800 bg-gray-900/50 hover:bg-gray-900 hover:border-cyber-green transition-all duration-300 text-left overflow-hidden rounded-sm"
              >
                <div className="absolute inset-0 bg-cyber-green/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                
                <div className="relative z-10">
                  <Smartphone className="w-8 h-8 text-gray-500 group-hover:text-cyber-green mb-4 transition-colors" />
                  <h3 className="text-lg sm:text-xl font-bold font-display text-white mb-2">SCANNER MODE</h3>
                  <p className="text-[10px] sm:text-xs text-gray-500 font-mono">For Students. Requires biometric gate and live camera feed verification.</p>
                </div>
              </button>
            </div>

            <footer className="absolute bottom-6 font-mono text-[10px] text-gray-700 w-full text-center px-4">
              SYSTEM INTEGRITY: OPTIMAL // ENCRYPTION: AES-256
            </footer>
          </div>
        );
    }
  };

  return (
    <div className="bg-black min-h-screen">
      {renderContent()}
    </div>
  );
};

export default App;