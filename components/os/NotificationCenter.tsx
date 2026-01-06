
import React, { useEffect } from 'react';
import { create } from 'zustand';
import { X, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
}

interface NotificationStore {
  notifications: Notification[];
  addNotification: (title: string, message: string, type?: NotificationType) => void;
  removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  addNotification: (title, message, type = 'info') => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({ notifications: [...state.notifications, { id, title, message, type }] }));
    
    // Auto dismiss
    setTimeout(() => {
      set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) }));
    }, 5000);
  },
  removeNotification: (id) => set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),
}));

export const NotificationCenter = () => {
  const { notifications, removeNotification } = useNotificationStore();

  return (
    <div className="fixed top-4 right-4 z-[10001] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            layout
            className="pointer-events-auto w-80 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl p-4 flex gap-3 relative overflow-hidden group"
          >
            {/* Status Line */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
              n.type === 'success' ? 'bg-green-500' : 
              n.type === 'error' ? 'bg-red-500' : 
              n.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
            }`} />

            <div className={`mt-1 ${
              n.type === 'success' ? 'text-green-400' : 
              n.type === 'error' ? 'text-red-400' : 
              n.type === 'warning' ? 'text-amber-400' : 'text-blue-400'
            }`}>
               {n.type === 'success' ? <CheckCircle size={18} /> : 
                n.type === 'error' ? <AlertTriangle size={18} /> : 
                n.type === 'warning' ? <AlertTriangle size={18} /> : <Info size={18} />}
            </div>

            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-200">{n.title}</h4>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{n.message}</p>
            </div>

            <button 
              onClick={() => removeNotification(n.id)}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
