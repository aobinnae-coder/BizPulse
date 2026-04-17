import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { ShoppingBag, Search, Filter, MoreHorizontal, Eye, CheckCircle2, Clock, XCircle, Truck } from 'lucide-react';
import { cn } from '../lib/utils';

export default function OrderManager({ user, business, initialOrderId }: { user: any, business: any, initialOrderId?: string | null }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [trackingInfo, setTrackingInfo] = useState({ trackingNumber: '', carrier: '' });

  useEffect(() => {
    if (selectedOrder) {
      setTrackingInfo({
        trackingNumber: selectedOrder.trackingNumber || '',
        carrier: selectedOrder.carrier || ''
      });
    }
  }, [selectedOrder]);

  const saveTracking = async () => {
    if (!selectedOrder) return;
    try {
      await updateDoc(doc(db, 'orders', selectedOrder.id), trackingInfo);
      setSelectedOrder({ ...selectedOrder, ...trackingInfo });
      alert('Tracking info updated!');
    } catch (error) {
      console.error("Error saving tracking:", error);
    }
  };

  useEffect(() => {
    if (!business) return;
    const q = query(collection(db, 'orders'), where('businessId', '==', business.id));
    const unsubscribe = onSnapshot(q, (s) => {
      const fetchedOrders = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(fetchedOrders);
      setLoading(false);

      if (initialOrderId) {
        const order = fetchedOrders.find(o => o.id === initialOrderId);
        if (order) setSelectedOrder(order);
      }
    });
    return () => unsubscribe();
  }, [business, initialOrderId]);

  const updateStatus = async (orderId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status });
    } catch (error) {
      console.error("Error updating order status:", error);
    }
  };

  const filteredOrders = orders.filter(o => 
    o.id.toLowerCase().includes(search.toLowerCase()) || 
    o.items?.some((i: any) => i.name.toLowerCase().includes(search.toLowerCase()))
  );

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-600',
    confirmed: 'bg-blue-50 text-blue-600',
    processing: 'bg-purple-50 text-purple-600',
    ready: 'bg-indigo-50 text-indigo-600',
    completed: 'bg-green-50 text-green-600',
    cancelled: 'bg-red-50 text-red-600'
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Order Management</h1>
          <p className="text-stone-500">Track and fulfill customer orders in real-time.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input 
              type="text" 
              placeholder="Search by Order ID or product..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-stone-50 border-none rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-stone-200"
            />
          </div>
          <div className="flex gap-2">
            <button className="p-2 text-stone-400 hover:text-stone-900 transition-colors"><Filter className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Order ID</th>
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Items</th>
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Total</th>
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Payment</th>
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filteredOrders.map(o => (
                <tr key={o.id} className="hover:bg-stone-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="text-sm font-mono font-bold text-stone-900">#{o.id.slice(-6).toUpperCase()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex -space-x-2">
                      {o.items?.slice(0, 3).map((item: any, idx: number) => (
                        <div key={idx} className="w-8 h-8 rounded-full border-2 border-white bg-stone-100 flex items-center justify-center text-[10px] font-bold text-stone-600 overflow-hidden">
                          {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : item.name[0]}
                        </div>
                      ))}
                      {o.items?.length > 3 && (
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-stone-200 flex items-center justify-center text-[10px] font-bold text-stone-600">
                          +{o.items.length - 3}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-stone-900">${o.total.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      statusColors[o.status] || 'bg-stone-100 text-stone-500'
                    )}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", o.paymentStatus === 'paid' ? 'bg-green-500' : 'bg-amber-500')} />
                      <span className="text-xs font-medium text-stone-600 capitalize">{o.paymentStatus}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-stone-400">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setSelectedOrder(o)}
                        className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <div className="relative group/menu">
                        <button className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-stone-100 py-2 z-10 hidden group-hover/menu:block">
                          {['pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled'].map(s => (
                            <button 
                              key={s}
                              onClick={() => updateStatus(o.id, s)}
                              className="w-full text-left px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 capitalize"
                            >
                              Mark as {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Order Details</h2>
                <p className="text-stone-500 font-mono text-sm">#{selectedOrder.id.toUpperCase()}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-stone-100 rounded-xl transition-all">
                <XCircle className="w-6 h-6 text-stone-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Customer Info</h3>
                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                    <p className="text-sm font-bold text-stone-900">Guest Customer</p>
                    <p className="text-xs text-stone-500">No contact info provided</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Order Status</h3>
                  <div className={cn("p-4 rounded-2xl border flex items-center gap-3", statusColors[selectedOrder.status])}>
                    {selectedOrder.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    <span className="text-sm font-bold capitalize">{selectedOrder.status}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Tracking Information</h3>
                {selectedOrder.status === 'completed' && !selectedOrder.trackingNumber && (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3">
                    <Truck className="w-5 h-5 text-amber-600" />
                    <p className="text-xs font-bold text-amber-900">This order is completed but missing tracking information.</p>
                  </div>
                )}
                <div className={cn(
                  "p-6 rounded-3xl border space-y-4 transition-all",
                  selectedOrder.status === 'completed' ? "bg-stone-900 text-white border-stone-900" : "bg-stone-50 border-stone-100"
                )}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={cn(
                        "block text-[10px] font-bold uppercase tracking-widest mb-2",
                        selectedOrder.status === 'completed' ? "text-stone-400" : "text-stone-400"
                      )}>Carrier</label>
                      <input 
                        type="text" 
                        placeholder="e.g. FedEx, UPS"
                        value={trackingInfo.carrier}
                        onChange={e => setTrackingInfo({...trackingInfo, carrier: e.target.value})}
                        className={cn(
                          "w-full border rounded-xl py-2 px-4 text-sm outline-none focus:ring-2",
                          selectedOrder.status === 'completed' 
                            ? "bg-stone-800 border-stone-700 text-white focus:ring-stone-600" 
                            : "bg-white border-stone-200 text-stone-900 focus:ring-stone-900"
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">Tracking Number</label>
                      <input 
                        type="text" 
                        placeholder="Enter tracking #"
                        value={trackingInfo.trackingNumber}
                        onChange={e => setTrackingInfo({...trackingInfo, trackingNumber: e.target.value})}
                        className={cn(
                          "w-full border rounded-xl py-2 px-4 text-sm outline-none focus:ring-2",
                          selectedOrder.status === 'completed' 
                            ? "bg-stone-800 border-stone-700 text-white focus:ring-stone-600" 
                            : "bg-white border-stone-200 text-stone-900 focus:ring-stone-900"
                        )}
                      />
                    </div>
                  </div>
                  <button 
                    onClick={saveTracking}
                    className={cn(
                      "w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                      selectedOrder.status === 'completed'
                        ? "bg-white text-stone-900 hover:bg-stone-100"
                        : "bg-stone-900 text-white hover:bg-stone-800"
                    )}
                  >
                    <Truck className="w-4 h-4" /> {selectedOrder.trackingNumber ? 'Update Tracking' : 'Add Tracking Info'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Line Items</h3>
                <div className="divide-y divide-stone-100 border border-stone-100 rounded-2xl overflow-hidden">
                  {selectedOrder.items?.map((item: any, idx: number) => (
                    <div key={idx} className="p-4 flex items-center justify-between bg-white">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-stone-50 rounded-xl flex items-center justify-center text-stone-400">
                          {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : <ShoppingBag className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-stone-900">{item.name}</p>
                          <p className="text-xs text-stone-500">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-stone-900">${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-stone-900 p-6 rounded-3xl text-white flex items-center justify-between">
                <div>
                  <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest mb-1">Total Amount</p>
                  <p className="text-3xl font-bold">${selectedOrder.total.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest mb-1">Payment Status</p>
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    {selectedOrder.paymentStatus}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-stone-100 bg-stone-50/50 flex gap-4">
              <button 
                onClick={() => updateStatus(selectedOrder.id, 'processing')}
                className="flex-1 py-4 bg-white border border-stone-200 text-stone-900 rounded-2xl font-bold hover:border-stone-900 transition-all flex items-center justify-center gap-2"
              >
                <Clock className="w-5 h-5" /> Start Processing
              </button>
              <button 
                onClick={() => updateStatus(selectedOrder.id, 'completed')}
                className="flex-1 py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" /> Mark Completed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
