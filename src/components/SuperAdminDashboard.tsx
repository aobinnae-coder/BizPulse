import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, getDocs, doc, updateDoc, where } from 'firebase/firestore';
import { Users, Building2, CreditCard, Activity, Search, ExternalLink, ShieldCheck, TrendingUp, DollarSign, XCircle, CheckCircle2, AlertTriangle, BarChart3, PieChart, Star, Briefcase, Calendar, MapPin, Globe, Mail, Phone, Lock, Unlock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SuperAdminDashboard({ user }: { user: any }) {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'businesses' | 'analytics'>('businesses');
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null);
  const [businessStaff, setBusinessStaff] = useState<any[]>([]);
  const [isStaffLoading, setIsStaffLoading] = useState(false);
  const [suspendModalVisibility, setSuspendModalVisibility] = useState<{ isOpen: boolean, businessId: string | null, currentStatus: boolean }>({ isOpen: false, businessId: null, currentStatus: false });

  useEffect(() => {
    if (user?.email !== 'a.obinnae@skyrouteusa.com') return;

    const unsubs: any[] = [];
    
    const bQuery = query(collection(db, 'businesses'), orderBy('createdAt', 'desc'));
    unsubs.push(onSnapshot(bQuery, (s) => setBusinesses(s.docs.map(d => ({ id: d.id, ...d.data() })))));

    Promise.all([
      getDocs(collection(db, 'surveys')),
      getDocs(collection(db, 'responses')),
      getDocs(collection(db, 'orders'))
    ]).then(([surveysSnap, repsSnap, ordersSnap]) => {
      setSurveys(surveysSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setResponses(repsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setOrders(ordersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });

    return () => unsubs.forEach(u => u());
  }, [user]);

  useEffect(() => {
    if (selectedBusiness) {
      setIsStaffLoading(true);
      const q = query(collection(db, 'staff'), where('businessId', '==', selectedBusiness.id));
      getDocs(q).then(s => {
        setBusinessStaff(s.docs.map(d => ({ id: d.id, ...d.data() })));
        setIsStaffLoading(false);
      });
    }
  }, [selectedBusiness]);

  if (user?.email !== 'a.obinnae@skyrouteusa.com') {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <ShieldCheck className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-stone-900">Access Denied</h2>
        <p className="text-stone-500">You must be a platform administrator to view this area.</p>
      </div>
    );
  }

  const handleSuspendToggle = async (businessId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'businesses', businessId), {
        isSuspended: !currentStatus
      });
      if (selectedBusiness?.id === businessId) {
        setSelectedBusiness({ ...selectedBusiness, isSuspended: !currentStatus });
      }
    } catch (error) {
      console.error("Failed to toggle suspension:", error);
      alert(`Failed to ${currentStatus ? 'unsuspend' : 'suspend'} user account.`);
    }
  };

  const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  const avgSatisfaction = responses.length > 0 
    ? (responses.reduce((sum, r) => sum + (r.score || 0), 0) / responses.length).toFixed(1)
    : '0.0';

  const filteredBusinesses = businesses.filter(b => 
    b.name?.toLowerCase().includes(search.toLowerCase()) || 
    b.industry?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Platform Command Center</h1>
            <span className="px-3 py-1 bg-gradient-to-r from-stone-900 to-stone-700 text-white text-xs font-bold uppercase tracking-widest rounded-full flex items-center gap-1 shadow-sm">
              <ShieldCheck className="w-3 h-3" /> Super Admin
            </span>
          </div>
          <p className="text-stone-500 mt-2">Manage all network businesses, observe system health, and review metrics.</p>
        </div>
        <div className="flex bg-stone-100 p-1 rounded-2xl">
          <button 
            onClick={() => setView('businesses')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
              view === 'businesses' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900"
            )}
          >
            <Building2 className="w-4 h-4" /> Businesses
          </button>
          <button 
            onClick={() => setView('analytics')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
              view === 'analytics' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900"
            )}
          >
            <BarChart3 className="w-4 h-4" /> Platform Analytics
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900" />
        </div>
      ) : (
        <>
          {view === 'businesses' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-[32px] border border-stone-200 shadow-sm relative overflow-hidden group">
                  <Building2 className="w-8 h-8 text-stone-900 mb-4" />
                  <h3 className="text-4xl font-black text-stone-900 mb-1">{businesses.length}</h3>
                  <p className="text-stone-500 font-medium">Active Businesses</p>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-stone-200 shadow-sm relative overflow-hidden group">
                  <Users className="w-8 h-8 text-stone-900 mb-4" />
                  <h3 className="text-4xl font-black text-stone-900 mb-1">{businesses.length}</h3>
                  <p className="text-stone-500 font-medium">Unique Owners</p>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-stone-200 shadow-sm relative overflow-hidden group">
                  <Star className="w-8 h-8 text-amber-500 mb-4" />
                  <h3 className="text-4xl font-black text-stone-900 mb-1">{avgSatisfaction}</h3>
                  <p className="text-stone-500 font-medium">Avg Satisfaction</p>
                </div>
                <div className="bg-stone-900 p-6 rounded-[32px] border border-stone-800 shadow-xl relative overflow-hidden group text-white">
                  <DollarSign className="w-8 h-8 text-emerald-400 mb-4" />
                  <h3 className="text-4xl font-black mb-1 text-white">${totalRevenue.toLocaleString()}</h3>
                  <p className="text-stone-400 font-medium">Total Revenue</p>
                </div>
              </div>

              <div className="bg-white rounded-[32px] border border-stone-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-stone-100 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-stone-900">Tenant Workspaces</h3>
                    <p className="text-sm text-stone-500">View and manage all businesses on the platform.</p>
                  </div>
                  <div className="relative w-full md:w-auto min-w-[300px]">
                    <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search by name or industry..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-stone-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-stone-900"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-stone-50 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                        <th className="px-6 py-4">Business / Brand</th>
                        <th className="px-6 py-4">Industry</th>
                        <th className="px-6 py-4">Plan</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filteredBusinesses.map(b => (
                        <tr key={b.id} className="hover:bg-stone-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                                style={{ backgroundColor: b.brandColor || '#1c1917' }}
                              >
                                {b.name?.charAt(0) || 'B'}
                              </div>
                              <div className="cursor-pointer" onClick={() => setSelectedBusiness(b)}>
                                <div className="font-bold text-stone-900 hover:underline">{b.name}</div>
                                <div className="text-xs text-stone-500 font-mono">{b.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-bold">
                              {b.industry || 'Unspecified'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest",
                              b.plan === 'pro' ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-600"
                            )}>
                              {b.plan || 'free'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {b.isSuspended ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-lg text-[10px] uppercase font-bold tracking-widest">
                                <XCircle className="w-3 h-3" /> Suspended
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] uppercase font-bold tracking-widest">
                                <CheckCircle2 className="w-3 h-3" /> Active
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleSuspendToggle(b.id, b.isSuspended || false)}
                                className={cn(
                                  "p-2 rounded-xl transition-all",
                                  b.isSuspended ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-red-50 text-red-600 hover:bg-red-100"
                                )}
                                title={b.isSuspended ? "Unsuspend" : "Suspend"}
                              >
                                {b.isSuspended ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                              </button>
                              <button 
                                onClick={() => setSelectedBusiness(b)}
                                className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 rounded-xl inline-flex"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white p-8 rounded-[40px] border border-stone-200 shadow-sm space-y-6">
                    <h3 className="text-xl font-bold text-stone-900">Revenue Growth</h3>
                    <div className="h-64 flex items-end justify-between gap-2">
                      {[40, 60, 45, 90, 120, 80, 140].map((h, i) => (
                        <div key={i} className="flex-1 space-y-2">
                          <div className="w-full bg-stone-900 rounded-t-xl" style={{ height: `${h}%` }} />
                          <p className="text-[10px] font-bold text-stone-400 text-center uppercase">Day {i+1}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-[40px] border border-stone-200 shadow-sm">
                      <h3 className="text-lg font-bold text-stone-900 mb-6">User Acquisition</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-stone-900 rounded-full" />
                            <span className="text-sm font-medium text-stone-500">New Businesses</span>
                          </div>
                          <span className="text-sm font-black text-stone-900">+12%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-stone-300 rounded-full" />
                            <span className="text-sm font-medium text-stone-500">Churn Rate</span>
                          </div>
                          <span className="text-sm font-black text-red-500">-2%</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white p-8 rounded-[40px] border border-stone-200 shadow-sm">
                      <h3 className="text-lg font-bold text-stone-900 mb-6">Engagement</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-stone-500">Avg Surveys / Biz</span>
                          <span className="text-sm font-black text-stone-900">{(surveys.length / businesses.length).toFixed(1)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-stone-500">Avg Responses / Biz</span>
                          <span className="text-sm font-black text-stone-900">{(responses.length / businesses.length).toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="bg-stone-900 p-8 rounded-[40px] text-white space-y-6">
                    <h3 className="text-lg font-bold">Platform Health</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-400 text-sm">Uptime</span>
                        <span className="text-emerald-400 font-bold">99.9%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-400 text-sm">Response Time</span>
                        <span className="text-white font-bold">142ms</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-400 text-sm">Active Sessions</span>
                        <span className="text-white font-bold">1,204</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[40px] border border-stone-200 shadow-sm space-y-6">
                    <h3 className="text-lg font-bold text-stone-900">Global Metrics</h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-stone-50 rounded-2xl flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Total Surveys</span>
                        <span className="text-lg font-black text-stone-900">{surveys.length}</span>
                      </div>
                      <div className="p-4 bg-stone-50 rounded-2xl flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Total Responses</span>
                        <span className="text-lg font-black text-stone-900">{responses.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Business Detail Modal */}
      <AnimatePresence>
        {selectedBusiness && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-stone-200"
            >
              <div className="p-8 bg-stone-50 border-b border-stone-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-6">
                  <div 
                    className="w-16 h-16 rounded-[24px] flex items-center justify-center text-white text-2xl font-black shadow-lg"
                    style={{ backgroundColor: selectedBusiness.brandColor || '#1c1917' }}
                  >
                    {selectedBusiness.name?.charAt(0) || 'B'}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-stone-900">{selectedBusiness.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 bg-stone-200 text-stone-600 rounded text-[10px] font-black uppercase tracking-widest">{selectedBusiness.industry || 'Unknown Industry'}</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                        selectedBusiness.plan === 'pro' ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-500"
                      )}>{selectedBusiness.plan || 'Free'} Plan</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleSuspendToggle(selectedBusiness.id, selectedBusiness.isSuspended || false)}
                    className={cn(
                      "px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all",
                      selectedBusiness.isSuspended ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-red-600 text-white hover:bg-red-700"
                    )}
                  >
                    {selectedBusiness.isSuspended ? <><Unlock className="w-4 h-4" /> Unsuspend Business</> : <><Lock className="w-4 h-4" /> Suspend Business</>}
                  </button>
                  <button 
                    onClick={() => setSelectedBusiness(null)}
                    className="p-3 bg-stone-200 text-stone-600 rounded-2xl hover:bg-stone-300 transition-colors"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 space-y-8">
                    <div className="bg-stone-50 p-8 rounded-3xl space-y-6">
                      <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Business Details</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest flex items-center gap-1">
                            <Mail className="w-3 h-3" /> Owner UID
                          </p>
                          <p className="text-sm font-bold text-stone-900 font-mono truncate">{selectedBusiness.ownerUid}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Registered
                          </p>
                          <p className="text-sm font-bold text-stone-900">{new Date(selectedBusiness.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="space-y-1 col-span-2">
                          <p className="text-[10px] text-stone-400 uppercase font-bold tracking-widest flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> Address
                          </p>
                          <p className="text-sm font-bold text-stone-900">{selectedBusiness.address || 'No address provided'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-stone-900">Current Usage & activity</h3>
                        <Activity className="w-5 h-5 text-stone-400" />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-6 bg-white border border-stone-200 rounded-[32px] text-center">
                          <p className="text-3xl font-black text-stone-900 mb-1">{surveys.filter(s => s.ownerUid === selectedBusiness.ownerUid).length}</p>
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Surveys</p>
                        </div>
                        <div className="p-6 bg-white border border-stone-200 rounded-[32px] text-center">
                          <p className="text-3xl font-black text-stone-900 mb-1">{responses.filter(r => r.businessId === selectedBusiness.id).length}</p>
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Responses</p>
                        </div>
                        <div className="p-6 bg-white border border-stone-200 rounded-[32px] text-center">
                          <p className="text-3xl font-black text-stone-900 mb-1">{orders.filter(o => o.businessId === selectedBusiness.id).length}</p>
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Orders</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-stone-50 p-6 rounded-3xl h-full">
                      <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-4">Associated Staff</h3>
                      {isStaffLoading ? (
                        <div className="flex justify-center p-8">
                          <div className="w-6 h-6 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin" />
                        </div>
                      ) : businessStaff.length > 0 ? (
                        <div className="space-y-3">
                          {businessStaff.map(s => (
                            <div key={s.id} className="p-3 bg-white rounded-xl border border-stone-100 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center">
                                <Users className="w-4 h-4 text-stone-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-stone-900 truncate">{s.email}</p>
                                <p className="text-[10px] font-medium text-stone-400 capitalize">{s.role || 'staff'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-stone-500 text-center py-8 italic">No staff members listed.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
