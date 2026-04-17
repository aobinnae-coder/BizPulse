import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, updateDoc, doc } from 'firebase/firestore';
import { Bell, ShoppingBag, MessageSquare, AlertTriangle, Info, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export default function NotificationCenter({ businessId, onNavigate }: { businessId: string, onNavigate: (view: string) => void }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!businessId) return;
    const q = query(
      collection(db, 'notifications'), 
      where('businessId', '==', businessId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (s) => {
      setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [businessId]);

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      await updateDoc(doc(db, 'notifications', n.id), { read: true });
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'order': return <ShoppingBag className="w-4 h-4 text-blue-600" />;
      case 'feedback': return <MessageSquare className="w-4 h-4 text-emerald-600" />;
      case 'stock': return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      default: return <Info className="w-4 h-4 text-stone-600" />;
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-stone-100 z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-stone-50 flex items-center justify-between bg-stone-50/50">
                <h3 className="text-sm font-bold text-stone-900">Notifications</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-[10px] font-bold text-stone-400 hover:text-stone-900 uppercase tracking-widest"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              
              <div className="max-h-[400px] overflow-y-auto divide-y divide-stone-50">
                {notifications.map(n => (
                  <div 
                    key={n.id} 
                    className={cn(
                      "p-4 hover:bg-stone-50 transition-colors cursor-pointer relative group",
                      !n.read && "bg-stone-50/50"
                    )}
                    onClick={() => {
                      markAsRead(n.id);
                      if (n.link) onNavigate(n.link);
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                        n.type === 'order' ? 'bg-blue-50' :
                        n.type === 'feedback' ? 'bg-emerald-50' :
                        n.type === 'stock' ? 'bg-amber-50' : 'bg-stone-100'
                      )}>
                        {getIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-stone-900 mb-0.5">{n.title}</p>
                        <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed">{n.message}</p>
                        <p className="text-[9px] text-stone-400 mt-2 font-medium uppercase tracking-wider">
                          {format(new Date(n.createdAt), 'MMM dd, HH:mm')}
                        </p>
                      </div>
                      {!n.read && (
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1" />
                      )}
                    </div>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <div className="p-12 text-center">
                    <Bell className="w-8 h-8 text-stone-200 mx-auto mb-3" />
                    <p className="text-xs text-stone-400 font-medium">No notifications yet</p>
                  </div>
                )}
              </div>
              
              <div className="p-3 bg-stone-50 border-t border-stone-100 text-center">
                <button className="text-[10px] font-bold text-stone-400 hover:text-stone-900 uppercase tracking-widest">
                  View all activity
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
