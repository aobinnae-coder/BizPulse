import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Users, Building2, CreditCard, Activity, Search, ExternalLink, ShieldCheck, TrendingUp, DollarSign, XCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SuperAdminDashboard({ user }: { user: any }) {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only load if exactly the super admin
    if (user?.email !== 'a.obinnae@skyrouteusa.com') return;

    const unsubs: any[] = [];
    
    // Subscribe to all platform businesses
    const bQuery = query(collection(db, 'businesses'), orderBy('createdAt', 'desc'));
    unsubs.push(onSnapshot(bQuery, (s) => setBusinesses(s.docs.map(d => ({ id: d.id, ...d.data() })))));

    // Fetch snapshot metrics (no real-time needed for everything just for stats)
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

  if (user?.email !== 'a.obinnae@skyrouteusa.com') {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <ShieldCheck className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-stone-900">Access Denied</h2>
        <p className="text-stone-500">You must be a platform administrator to view this area.</p>
      </div>
    );
  }

  const toggleSuspend = async (businessId: string, currentStatus: boolean) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'unsuspend' : 'suspend'} this business?`)) return;
    try {
      await updateDoc(doc(db, 'businesses', businessId), {
        isSuspended: !currentStatus
      });
    } catch (error) {
      console.error("Failed to toggle suspension:", error);
      alert("Failed to update suspension status.");
    }
  };

  const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  const totalPlatformFees = totalRevenue * 0.05; // Quick mock estimation of platform fees

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
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-[32px] border border-stone-200 shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-stone-50 rounded-full group-hover:scale-110 transition-transform" />
              <Building2 className="w-8 h-8 text-stone-900 mb-4 relative z-10" />
              <h3 className="text-4xl font-black text-stone-900 mb-1 relative z-10">{businesses.length}</h3>
              <p className="text-stone-500 font-medium relative z-10">Active Businesses</p>
            </div>
            <div className="bg-white p-6 rounded-[32px] border border-stone-200 shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full group-hover:scale-110 transition-transform" />
              <Activity className="w-8 h-8 text-indigo-600 mb-4 relative z-10" />
              <h3 className="text-4xl font-black text-stone-900 mb-1 relative z-10">{responses.length}</h3>
              <p className="text-stone-500 font-medium relative z-10">Survey Responses Gathered</p>
            </div>
            <div className="bg-white p-6 rounded-[32px] border border-stone-200 shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-110 transition-transform" />
              <CreditCard className="w-8 h-8 text-emerald-600 mb-4 relative z-10" />
              <h3 className="text-4xl font-black text-stone-900 mb-1 relative z-10">{orders.length}</h3>
              <p className="text-stone-500 font-medium relative z-10">Global Orders Processed</p>
            </div>
            <div className="bg-stone-900 p-6 rounded-[32px] border border-stone-800 shadow-xl relative overflow-hidden group text-white">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full group-hover:scale-110 transition-transform" />
              <DollarSign className="w-8 h-8 text-emerald-400 mb-4 relative z-10" />
              <h3 className="text-4xl font-black mb-1 relative z-10">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
              <p className="text-stone-400 font-medium relative z-10">Platform Storefront Volume</p>
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
                    <th className="px-6 py-4">Owner UID</th>
                    <th className="px-6 py-4">Created</th>
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
                          <div>
                            <div className="font-bold text-stone-900">{b.name}</div>
                            <div className="text-xs text-stone-500 font-mono">{b.id}</div>
                            {b.isSuspended && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 bg-red-100 text-red-700 rounded text-[10px] uppercase font-bold tracking-widest">
                                <XCircle className="w-3 h-3" /> Suspended
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-xs font-bold">
                          {b.industry || 'Unspecified'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-stone-500">
                        {b.ownerUid}
                      </td>
                      <td className="px-6 py-4 text-sm text-stone-600">
                        {new Date(b.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleSuspend(b.id, b.isSuspended || false)}
                            className={`p-2 rounded-lg inline-flex ${b.isSuspended ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-stone-100 text-stone-400 hover:text-red-600 hover:bg-red-50'}`}
                            title={b.isSuspended ? "Unsuspend Business" : "Suspend Business"}
                          >
                            {b.isSuspended ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          </button>
                          <a 
                            href={'/?business=' + b.id}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 rounded-lg inline-flex"
                            title="View Data"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredBusinesses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-stone-500">
                        <Building2 className="w-8 h-8 text-stone-300 mx-auto mb-3" />
                        <p>No businesses match your search.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
