import React, { useState, useEffect } from 'react';
import { auth, db, googleProvider, signInWithPopup, signOut } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  ClipboardList, 
  MessageSquare, 
  BarChart3, 
  CheckSquare, 
  Users, 
  Settings, 
  LogOut, 
  Plus,
  Send,
  Menu,
  X,
  Sparkles,
  Package,
  ShoppingBag,
  Store,
  Tag,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';

// Components
import Dashboard from './components/Dashboard';
import SurveyBuilder from './components/SurveyBuilder';
import FeedbackInbox from './components/FeedbackInbox';
import Analytics from './components/Analytics';
import ActionBoard from './components/ActionBoard';
import CustomerDirectory from './components/CustomerDirectory';
import InventoryManager from './components/InventoryManager';
import OrderManager from './components/OrderManager';
import Storefront from './components/Storefront';
import SettingsPage from './components/Settings';
import PublicSurvey from './components/PublicSurvey';
import GeminiChat from './components/GeminiChat';
import OnboardingWizard from './components/OnboardingWizard';
import CouponManager from './components/CouponManager';
import PricingPage from './components/Pricing';
import NotificationCenter from './components/NotificationCenter';

type View = 'dashboard' | 'surveys' | 'feedback' | 'analytics' | 'actions' | 'customers' | 'inventory' | 'orders' | 'settings' | 'storefront' | 'coupons' | 'pricing';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [business, setBusiness] = useState<any>(null);
  const [isBusinessLoading, setIsBusinessLoading] = useState(true);
  const [isPublicSurvey, setIsPublicSurvey] = useState(false);
  const [publicSurveyId, setPublicSurveyId] = useState<string | null>(null);
  const [isPublicStore, setIsPublicStore] = useState(false);
  const [publicStoreId, setPublicStoreId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) {
        return saved === 'true';
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [isDarkMode]);

  useEffect(() => {
    // Check if we are on a public survey link or storefront
    const params = new URLSearchParams(window.location.search);
    const surveyId = params.get('survey');
    const storeId = params.get('store');
    
    if (surveyId) {
      setIsPublicSurvey(true);
      setPublicSurveyId(surveyId);
    } else if (storeId) {
      setIsPublicStore(true);
      setPublicStoreId(storeId);
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      // Fetch business profile
      const q = query(collection(db, 'businesses'), where('ownerUid', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          setBusiness({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
        } else {
          setBusiness(null);
        }
        setIsBusinessLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-stone-200 border-t-stone-800 rounded-full"
        />
      </div>
    );
  }

  if (isPublicSurvey && publicSurveyId) {
    return <PublicSurvey surveyId={publicSurveyId} />;
  }

  if (isPublicStore && publicStoreId) {
    return <Storefront businessId={publicStoreId} />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-12 rounded-[40px] shadow-xl border border-stone-100 text-center">
          <div className="w-20 h-20 bg-stone-900 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-stone-900 mb-4 tracking-tight">BizPulse</h1>
          <p className="text-stone-500 mb-10 leading-relaxed text-lg">The all-in-one operating system for your small business.</p>
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/layout/google.svg" className="w-5 h-5" alt="Google" referrerPolicy="no-referrer" />
            Continue with Google
          </button>
          <p className="mt-8 text-xs text-stone-400">By continuing, you agree to our Terms of Service.</p>
        </div>
      </div>
    );
  }

  if (!business && !isBusinessLoading) {
    return <OnboardingWizard user={user} onComplete={(biz) => setBusiness(biz)} />;
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'surveys', label: 'Surveys', icon: ClipboardList },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'actions', label: 'Action Items', icon: CheckSquare },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'coupons', label: 'Coupons', icon: Tag },
    { id: 'pricing', label: 'Plans & Pricing', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex transition-colors duration-300">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 transition-transform duration-300 lg:relative lg:translate-x-0",
        !isSidebarOpen && "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-stone-900 dark:bg-white rounded-lg flex items-center justify-center">
              <Sparkles className="text-white dark:text-stone-900 w-5 h-5" />
            </div>
            <span className="text-xl font-bold text-stone-900 dark:text-white">BizPulse</span>
          </div>

          <nav className="flex-1 px-4 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id as View)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                  currentView === item.id 
                    ? "bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-white" 
                    : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
            
            <button
              onClick={() => setCurrentView('storefront')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors mt-4 border border-dashed border-stone-200 dark:border-stone-700",
                currentView === 'storefront'
                  ? "bg-stone-900 dark:bg-white text-white dark:text-stone-900"
                  : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:hover:text-white"
              )}
            >
              <Store className="w-5 h-5" />
              View Storefront
            </button>
          </nav>

          <div className="p-4 border-t border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-3 px-4 py-3">
              <img src={user.photoURL || ''} className="w-8 h-8 rounded-full" alt={user.displayName || ''} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-900 dark:text-white truncate">{user.displayName}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{user.email}</p>
              </div>
              <button onClick={handleLogout} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between px-6 lg:px-8 transition-colors duration-300">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden text-stone-500 dark:text-stone-400">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 dark:hover:text-stone-100 rounded-xl transition-all"
            >
              {isDarkMode ? <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>}
            </button>
            {business && (
              <NotificationCenter 
                businessId={business.id} 
                onNavigate={(v) => setCurrentView(v as View)} 
              />
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {currentView === 'dashboard' && <Dashboard user={user} business={business} onNavigate={(v) => setCurrentView(v as View)} />}
              {currentView === 'inventory' && <InventoryManager user={user} business={business} />}
              {currentView === 'orders' && <OrderManager user={user} business={business} initialOrderId={selectedOrderId} />}
              {currentView === 'surveys' && <SurveyBuilder user={user} business={business} />}
              {currentView === 'feedback' && (
                <FeedbackInbox 
                  user={user} 
                  business={business} 
                  onViewOrder={(id) => {
                    setSelectedOrderId(id);
                    setCurrentView('orders');
                  }} 
                />
              )}
              {currentView === 'analytics' && <Analytics user={user} business={business} />}
              {currentView === 'actions' && <ActionBoard user={user} business={business} />}
              {currentView === 'customers' && <CustomerDirectory user={user} business={business} />}
              {currentView === 'coupons' && <CouponManager user={user} business={business} />}
              {currentView === 'pricing' && <PricingPage business={business} />}
              {currentView === 'settings' && <SettingsPage user={user} business={business} />}
              {currentView === 'storefront' && <Storefront businessId={business?.id} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* AI Assistant */}
      <GeminiChat user={user} business={business} />
    </div>
  );
}
