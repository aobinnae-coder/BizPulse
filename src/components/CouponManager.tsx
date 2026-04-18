import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Tag, Plus, Trash2, Calendar, Hash, Percent, DollarSign, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function CouponManager({ user, business }: { user: any, business: any }) {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    type: 'percentage',
    value: 10,
    expiryDate: '',
    usageLimit: 100,
    active: true
  });

  useEffect(() => {
    if (!business) return;
    const q = query(collection(db, 'coupons'), where('businessId', '==', business.id));
    const unsubscribe = onSnapshot(q, (s) => {
      setCoupons(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [business]);

  const handleAddCoupon = async () => {
    if (!newCoupon.code) return;
    
    const codeUpper = newCoupon.code.toUpperCase();
    const existing = coupons.find(c => c.code === codeUpper);
    if (existing) {
      alert('A coupon with this code already exists.');
      return;
    }

    try {
      await addDoc(collection(db, 'coupons'), {
        ...newCoupon,
        code: codeUpper,
        businessId: business.id,
        ownerUid: user.uid,
        usageCount: 0,
        createdAt: new Date().toISOString()
      });
      setIsAdding(false);
      setNewCoupon({
        code: '',
        type: 'percentage',
        value: 10,
        expiryDate: '',
        usageLimit: 100,
        active: true
      });
    } catch (error) {
      console.error("Error adding coupon:", error);
    }
  };

  const toggleCoupon = async (id: string, active: boolean) => {
    await updateDoc(doc(db, 'coupons', id), { active });
  };

  const deleteCoupon = async (id: string) => {
    if (confirm('Delete this coupon?')) {
      await deleteDoc(doc(db, 'coupons', id));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Coupons & Discounts</h1>
          <p className="text-stone-500">Create promotional codes to drive sales.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Coupon
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {coupons.map(coupon => {
          const isExpired = coupon.expiryDate && new Date(coupon.expiryDate) < new Date();
          const isFullyUsed = coupon.usageCount >= coupon.usageLimit;
          const isDisabled = !coupon.active || isExpired || isFullyUsed;

          return (
          <div key={coupon.id} className={cn("bg-white p-6 rounded-3xl border shadow-sm relative overflow-hidden group transition-all", isDisabled ? "opacity-60 grayscale border-stone-100" : "border-stone-200 hover:border-stone-300")}>
            <div className="flex items-center justify-between mb-4">
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                isExpired ? "bg-red-50 text-red-600" :
                isFullyUsed ? "bg-amber-50 text-amber-600" :
                coupon.active ? "bg-emerald-50 text-emerald-600" : "bg-stone-100 text-stone-400"
              )}>
                {isExpired ? 'Expired' : isFullyUsed ? 'Limit Reached' : coupon.active ? 'Active' : 'Paused'}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => toggleCoupon(coupon.id, !coupon.active)}
                  className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-50 rounded-lg"
                  title={coupon.active ? "Pause Coupon" : "Activate Coupon"}
                >
                  {coupon.active ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => deleteCoupon(coupon.id)}
                  className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                  title="Delete Coupon"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-4 mb-6">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white", isDisabled ? "bg-stone-400" : "bg-stone-900")}>
                <Tag className="w-6 h-6" />
              </div>
              <div>
                <h3 className={cn("text-xl font-mono font-bold tracking-tighter", isDisabled ? "text-stone-500 line-through" : "text-stone-900")}>{coupon.code}</h3>
                <p className="text-xs text-stone-500">
                  {coupon.type === 'percentage' ? `${coupon.value}% OFF` : `$${coupon.value} OFF`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-stone-100">
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Usage</p>
                <p className={cn("text-sm font-bold", isFullyUsed ? "text-amber-600" : "text-stone-900")}>{coupon.usageCount} / {coupon.usageLimit}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Expires</p>
                <p className={cn("text-sm font-bold", isExpired ? "text-red-600" : "text-stone-900")}>{coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleDateString() : 'Never'}</p>
              </div>
            </div>
          </div>
        )})}

        {coupons.length === 0 && !isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="col-span-full h-48 border-2 border-dashed border-stone-200 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-stone-400 hover:bg-stone-50 transition-all"
          >
            <Tag className="w-8 h-8 text-stone-300" />
            <p className="text-stone-500 font-medium">No coupons created yet</p>
          </button>
        )}
      </div>

      {/* Add Coupon Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-stone-100">
              <h2 className="text-2xl font-bold text-stone-900">Create Coupon</h2>
              <p className="text-stone-500">Define your discount code and limits.</p>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Coupon Code</label>
                <input 
                  type="text" 
                  placeholder="e.g. SUMMER25"
                  value={newCoupon.code}
                  onChange={e => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})}
                  className="w-full bg-stone-50 border-none rounded-2xl py-3 px-4 text-lg font-mono font-bold outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Type</label>
                  <select 
                    value={newCoupon.type}
                    onChange={e => setNewCoupon({...newCoupon, type: e.target.value})}
                    className="w-full bg-stone-50 border-none rounded-2xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Value</label>
                  <input 
                    type="number" 
                    value={newCoupon.value}
                    onChange={e => setNewCoupon({...newCoupon, value: Number(e.target.value)})}
                    className="w-full bg-stone-50 border-none rounded-2xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Usage Limit (Max Uses)</label>
                  <input 
                    type="number" 
                    min="1"
                    placeholder="e.g. 100"
                    value={newCoupon.usageLimit || ''}
                    onChange={e => setNewCoupon({...newCoupon, usageLimit: parseInt(e.target.value) || 0})}
                    className="w-full bg-stone-50 border-none rounded-2xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Expiry Date (Optional)</label>
                  <input 
                    type="datetime-local" 
                    value={newCoupon.expiryDate}
                    onChange={e => setNewCoupon({...newCoupon, expiryDate: e.target.value})}
                    className="w-full bg-stone-50 border-none rounded-2xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                  />
                </div>
              </div>
            </div>
            <div className="p-8 bg-stone-50 flex gap-4">
              <button onClick={() => setIsAdding(false)} className="flex-1 py-3 bg-white border border-stone-200 text-stone-600 rounded-xl font-bold text-sm hover:bg-stone-50">Cancel</button>
              <button onClick={handleAddCoupon} className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-bold text-sm hover:bg-stone-800">Create Coupon</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
