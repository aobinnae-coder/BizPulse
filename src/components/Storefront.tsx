import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, doc, getDoc, getDocs, limit, updateDoc } from 'firebase/firestore';
import { ShoppingCart, Search, Filter, ChevronRight, Star, Plus, Minus, X, CheckCircle2, Truck, Tag, CreditCard as CreditCardIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { updateOrCreateCustomer } from '../lib/customers';
import { createNotification } from '../lib/notifications';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Setup Stripe Promise (using a placeholder test key if not provided via env variables)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "pk_test_TYooMQauvdEDq54NiTphI7jx");

function CheckoutForm({ clientSecret, amount, onSuccessfulPayment }: { clientSecret: string, amount: number, onSuccessfulPayment: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required' 
    });

    if (error) {
      setErrorMessage(error.message || "An unexpected error occurred.");
    } else {
      onSuccessfulPayment();
    }
    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      {errorMessage && <div className="text-red-500 text-sm mt-2">{errorMessage}</div>}
      <button 
        disabled={isProcessing || !stripe || !elements}
        className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        {isProcessing ? "Processing..." : `Pay $${amount.toFixed(2)}`}
      </button>
    </form>
  );
}

export default function Storefront({ businessId }: { businessId: string }) {
  const [business, setBusiness] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orderComplete, setOrderComplete] = useState<any>(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<any>(null);
  const [trackingError, setTrackingError] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc'>('featured');
  const [showSort, setShowSort] = useState(false);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  }).sort((a, b) => {
    if (sortBy === 'price_asc') return a.price - b.price;
    if (sortBy === 'price_desc') return b.price - a.price;
    return 0; // featured
  });
  const [view, setView] = useState<'shop' | 'track'>('shop');
  const [monthlyOrderCount, setMonthlyOrderCount] = useState(0);
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', phone: '' });
  const [clientSecret, setClientSecret] = useState('');
  const [isCheckoutProcessing, setIsCheckoutProcessing] = useState(false);
  const { checkLimit } = usePlanLimits(business, { totalOrders: monthlyOrderCount });

  const lookupOrder = async () => {
    setTrackingError('');
    setTrackedOrder(null);
    if (!trackingId) return;
    
    try {
      const docRef = doc(db, 'orders', trackingId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setTrackedOrder({ id: docSnap.id, ...docSnap.data() });
      } else {
        setTrackingError('Order not found. Please check your ID.');
      }
    } catch (error) {
      setTrackingError('Error looking up order');
    }
  };

  useEffect(() => {
    const fetchBusiness = async () => {
      const docRef = doc(db, 'businesses', businessId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setBusiness({ id: docSnap.id, ...docSnap.data() });
    };
    fetchBusiness();

    const q = query(collection(db, 'products'), where('businessId', '==', businessId), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (s) => {
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    // Fetch monthly order count for limit enforcement
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);
    const ordersQ = query(
      collection(db, 'orders'), 
      where('businessId', '==', businessId),
      where('createdAt', '>=', startOfMonth.toISOString())
    );
    const unsubOrders = onSnapshot(ordersQ, (s) => {
      setMonthlyOrderCount(s.size);
    });

    return () => {
      unsubscribe();
      unsubOrders();
    };
  }, [businessId]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return newQty === 0 ? null : { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  const discountAmount = appliedCoupon 
    ? (appliedCoupon.type === 'percentage' ? (subtotal * appliedCoupon.value / 100) : appliedCoupon.value)
    : 0;
  
  const cartTotal = Math.max(0, subtotal - discountAmount);

  const applyCoupon = async () => {
    setCouponError('');
    if (!couponCode) return;
    
    try {
      const q = query(collection(db, 'coupons'), where('businessId', '==', businessId), where('code', '==', couponCode.toUpperCase()), where('active', '==', true));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setCouponError('Invalid or expired coupon code');
        return;
      }
      
      const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
      
      // Check usage limit
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        setCouponError('This coupon has reached its usage limit');
        return;
      }
      
      // Check expiry date
      if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
        setCouponError('This coupon has expired');
        return;
      }

      setAppliedCoupon(coupon);
      setCouponCode('');
    } catch (error) {
      setCouponError('Error validating coupon');
    }
  };

  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  const handleCheckoutInit = async () => {
    if (!customerInfo.name || !customerInfo.email) {
      alert("Please provide your name and email for the order.");
      return;
    }
    const limit = checkLimit('orders');
    if (!limit.allowed) {
      alert("This business is currently unable to accept new orders due to plan limits. Please contact the owner.");
      return;
    }
    
    setIsCheckoutProcessing(true);
    try {
      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.max(50, Math.round(cartTotal * 100)), // convert to cents, min $0.50
          currency: 'usd'
        })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to initialize payment");

      const orderData = {
        businessId,
        ownerUid: business?.ownerUid || null,
        items: cart,
        subtotal,
        discount: discountAmount,
        total: cartTotal,
        couponCode: appliedCoupon?.code || null,
        status: 'pending',
        paymentStatus: 'pending',
        customerName: customerInfo.name,
        customerEmail: customerInfo.email,
        customerPhone: customerInfo.phone,
        createdAt: new Date().toISOString()
      };
      // For a real app, you would pass the PaymentIntent ID to the order record
      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      setPendingOrderId(docRef.id);
      setClientSecret(data.clientSecret);
    } catch (error: any) {
      console.error(error);
      alert(error.message);
    } finally {
      setIsCheckoutProcessing(false);
    }
  };

  const handlePaymentSuccess = async () => {
    if (!pendingOrderId) return;
    
    try {
      await updateDoc(doc(db, 'orders', pendingOrderId), {
        paymentStatus: 'paid',
        status: 'processing'
      });

      await updateOrCreateCustomer(businessId, {
        name: customerInfo.name,
        email: customerInfo.email,
        phone: customerInfo.phone,
        spent: cartTotal
      }, business?.ownerUid);

      await createNotification({
        businessId,
        type: 'order',
        title: 'New Order Received',
        message: `${customerInfo.name} just placed an order for $${cartTotal.toFixed(2)}`,
        link: 'orders'
      }, business?.ownerUid);

      if (appliedCoupon) {
        const couponRef = doc(db, 'coupons', appliedCoupon.id);
        await updateDoc(couponRef, {
          usageCount: (appliedCoupon.usageCount || 0) + 1
        });
      }

      const finalDoc = await getDoc(doc(db, 'orders', pendingOrderId));
      
      setClientSecret('');
      setOrderComplete({ id: finalDoc.id, ...finalDoc.data() });
      setCart([]);
      setShowCart(false);
      setAppliedCoupon(null);
    } catch (e) {
      console.error(e);
      alert("Payment successful, but error finalizing order. Please contact support.");
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-stone-50">Loading Storefront...</div>;

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-12 rounded-[40px] shadow-xl text-center max-w-md w-full border border-stone-100"
        >
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-stone-900 mb-2">Order Confirmed!</h2>
          <p className="text-stone-500 mb-8">Thank you for your purchase. Your order ID is <span className="font-mono font-bold text-stone-900">#{orderComplete.id.slice(-6).toUpperCase()}</span></p>
          
          {orderComplete.trackingNumber && (
            <div className="mb-8 p-6 bg-stone-900 rounded-3xl text-white text-left">
              <div className="flex items-center gap-3 mb-4">
                <Truck className="w-5 h-5 text-stone-400" />
                <h4 className="font-bold">Shipping Update</h4>
              </div>
              <p className="text-xs text-stone-400 uppercase tracking-widest mb-1">Carrier</p>
              <p className="text-sm font-bold mb-3">{orderComplete.carrier}</p>
              <p className="text-xs text-stone-400 uppercase tracking-widest mb-1">Tracking Number</p>
              <p className="text-sm font-mono font-bold">{orderComplete.trackingNumber}</p>
            </div>
          )}

          <button 
            onClick={() => setOrderComplete(null)}
            className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all"
          >
            Continue Shopping
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {business?.logoUrl && <img src={business.logoUrl} alt={business.name} className="w-10 h-10 rounded-xl object-cover" />}
            <h1 className="text-xl font-bold text-stone-900 tracking-tight cursor-pointer" onClick={() => setView('shop')}>{business?.name || 'Storefront'}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setView(view === 'shop' ? 'track' : 'shop')}
              className="text-sm font-bold text-stone-600 hover:text-stone-900 transition-colors"
            >
              {view === 'shop' ? 'Track Order' : 'Back to Shop'}
            </button>
            <button 
              onClick={() => setShowCart(true)}
              className="relative p-3 bg-stone-100 rounded-2xl text-stone-900 hover:bg-stone-200 transition-all"
            >
              <ShoppingCart className="w-6 h-6" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 w-6 h-6 bg-stone-900 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                  {cart.reduce((acc, i) => acc + i.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {view === 'track' ? (
        <div className="max-w-2xl mx-auto px-4 py-24">
          <div className="bg-white p-12 rounded-[40px] shadow-xl border border-stone-100 text-center">
            <div className="w-16 h-16 bg-stone-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Truck className="w-8 h-8 text-stone-900" />
            </div>
            <h2 className="text-3xl font-bold text-stone-900 mb-2">Track Your Order</h2>
            <p className="text-stone-500 mb-8">Enter your order ID to see the current status and tracking info.</p>
            
            <div className="flex gap-3 mb-8">
              <input 
                type="text" 
                placeholder="Order ID (e.g. abc-123)"
                value={trackingId}
                onChange={e => setTrackingId(e.target.value)}
                className="flex-1 bg-stone-50 border-none rounded-2xl px-6 py-4 text-lg outline-none focus:ring-2 focus:ring-stone-900"
              />
              <button 
                onClick={lookupOrder}
                className="px-8 py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all"
              >
                Track
              </button>
            </div>

            {trackingError && <p className="text-red-500 font-bold mb-8">{trackingError}</p>}

            {trackedOrder && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-left space-y-6"
              >
                <div className="p-6 bg-stone-50 rounded-3xl border border-stone-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Status</p>
                    <p className="text-xl font-bold text-stone-900 capitalize">{trackedOrder.status}</p>
                  </div>
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                </div>

                {trackedOrder.trackingNumber && (
                  <div className="p-6 bg-stone-900 rounded-3xl text-white">
                    <div className="flex items-center gap-3 mb-4">
                      <Truck className="w-5 h-5 text-stone-400" />
                      <h4 className="font-bold">Shipping Information</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-stone-400 uppercase tracking-widest mb-1">Carrier</p>
                        <p className="text-sm font-bold">{trackedOrder.carrier}</p>
                      </div>
                      <div>
                        <p className="text-xs text-stone-400 uppercase tracking-widest mb-1">Tracking Number</p>
                        <p className="text-sm font-mono font-bold">{trackedOrder.trackingNumber}</p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      ) : (
        /* Hero */
        <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="bg-stone-900 rounded-[40px] p-12 text-white relative overflow-hidden mb-12">
          <div className="relative z-10 max-w-xl">
            <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold uppercase tracking-widest mb-4 inline-block">Welcome to our store</span>
            <h2 className="text-5xl font-bold mb-6 leading-tight">Discover our latest products & services.</h2>
            <p className="text-stone-400 text-lg mb-8">Quality items curated just for you. Fast delivery and secure payments guaranteed.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-4 bg-white text-stone-900 rounded-2xl font-bold hover:bg-stone-100 transition-all"
              >
                Shop Now
              </button>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-stone-800/50 to-transparent pointer-events-none" />
        </div>

        {/* Filters */}
        <div id="products" className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar flex-1">
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-6 py-2 border rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                  activeCategory === cat 
                    ? "bg-stone-900 border-stone-900 text-white" 
                    : "bg-white border-stone-200 text-stone-500 hover:border-stone-900"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center transition-all overflow-hidden bg-white border border-stone-200 rounded-xl",
              showSearch ? "w-full sm:w-64 px-3 py-2" : "w-0 border-transparent"
            )}>
              <input 
                type="text" 
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn("bg-transparent border-none outline-none text-sm w-full", !showSearch && "hidden")}
              />
              {showSearch && (
                <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="text-stone-400 hover:text-stone-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {!showSearch && (
              <button onClick={() => setShowSearch(true)} className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all">
                <Search className="w-5 h-5" />
              </button>
            )}
            <div className="relative">
              <button 
                onClick={() => setShowSort(!showSort)}
                className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all"
              >
                <Filter className="w-5 h-5" />
              </button>
              {showSort && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-stone-100 py-2 z-20">
                  <button onClick={() => { setSortBy('featured'); setShowSort(false); }} className={cn("w-full text-left px-4 py-2 text-sm hover:bg-stone-50", sortBy === 'featured' && "font-bold text-stone-900")}>Featured</button>
                  <button onClick={() => { setSortBy('price_asc'); setShowSort(false); }} className={cn("w-full text-left px-4 py-2 text-sm hover:bg-stone-50", sortBy === 'price_asc' && "font-bold text-stone-900")}>Price: Low to High</button>
                  <button onClick={() => { setSortBy('price_desc'); setShowSort(false); }} className={cn("w-full text-left px-4 py-2 text-sm hover:bg-stone-50", sortBy === 'price_desc' && "font-bold text-stone-900")}>Price: High to Low</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {filteredProducts.map(p => (
            <motion.div 
              key={p.id}
              whileHover={{ y: -8 }}
              className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden group"
            >
              <div className="aspect-square bg-stone-100 relative overflow-hidden">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-300">
                    <ShoppingCart className="w-12 h-12" />
                  </div>
                )}
                <button 
                  onClick={() => addToCart(p)}
                  className="absolute bottom-4 right-4 w-12 h-12 bg-white rounded-2xl shadow-lg flex items-center justify-center text-stone-900 hover:bg-stone-900 hover:text-white transition-all transform translate-y-16 group-hover:translate-y-0"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{p.category || 'Product'}</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span className="text-xs font-bold text-stone-900">4.9</span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-stone-900 mb-1">{p.name}</h3>
                <p className="text-stone-500 text-sm mb-4 line-clamp-2">{p.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-stone-900">${p.price.toFixed(2)}</span>
                  {p.stock <= 5 && p.stock > 0 && <span className="text-[10px] font-bold text-amber-600 uppercase">Only {p.stock} left</span>}
                  {p.stock === 0 && <span className="text-[10px] font-bold text-red-600 uppercase">Out of Stock</span>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    )}

      {/* Cart Drawer */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-stone-100 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-stone-900">Your Cart</h2>
                <button onClick={() => setShowCart(false)} className="p-2 hover:bg-stone-100 rounded-xl transition-all">
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-stone-400">
                    <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium">Your cart is empty</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex gap-4">
                      <div className="w-20 h-20 bg-stone-100 rounded-2xl overflow-hidden flex-shrink-0">
                        {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-stone-900 mb-1">{item.name}</h4>
                        <p className="text-stone-500 text-sm mb-3">${item.price.toFixed(2)}</p>
                        <div className="flex items-center gap-3">
                          <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 bg-stone-100 rounded-lg flex items-center justify-center hover:bg-stone-200 transition-all">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 bg-stone-100 rounded-lg flex items-center justify-center hover:bg-stone-200 transition-all">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-stone-900">${(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-8 bg-stone-50 border-t border-stone-100 space-y-6">
                  {/* Customer Info */}
                  <div className="space-y-4 bg-white p-4 rounded-2xl border border-stone-200">
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Customer Information</h4>
                    <div className="space-y-3">
                      <input 
                        type="text" 
                        placeholder="Full Name"
                        value={customerInfo.name}
                        onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})}
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-2 text-sm outline-none"
                      />
                      <input 
                        type="email" 
                        placeholder="Email Address"
                        value={customerInfo.email}
                        onChange={e => setCustomerInfo({...customerInfo, email: e.target.value})}
                        className="w-full bg-stone-50 border-none rounded-xl px-4 py-2 text-sm outline-none"
                      />
                    </div>
                  </div>

                  {/* Coupon Code */}
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Coupon Code"
                        value={couponCode}
                        onChange={e => setCouponCode(e.target.value)}
                        className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                      />
                      <button 
                        onClick={applyCoupon}
                        className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition-all"
                      >
                        Apply
                      </button>
                    </div>
                    {couponError && <p className="text-[10px] text-red-500 font-bold">{couponError}</p>}
                    {appliedCoupon && (
                      <div className="flex items-center justify-between bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                        <div className="flex items-center gap-2 text-emerald-700 text-[10px] font-bold">
                          <Tag className="w-3 h-3" />
                          {appliedCoupon.code} APPLIED
                        </div>
                        <button onClick={() => setAppliedCoupon(null)} className="text-emerald-700 hover:text-emerald-900">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-stone-500 text-sm">
                      <span>Subtotal</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    {appliedCoupon && (
                      <div className="flex justify-between text-emerald-600 text-sm font-medium">
                        <span>Discount</span>
                        <span>-${discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-stone-500 text-sm">
                      <span>Shipping</span>
                      <span className="text-green-600 font-bold uppercase tracking-widest text-[10px]">Free</span>
                    </div>
                    <div className="flex justify-between text-stone-900 font-bold text-xl pt-2 border-t border-stone-200">
                      <span>Total</span>
                      <span>${cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  {clientSecret ? (
                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                      <CheckoutForm clientSecret={clientSecret} amount={cartTotal} onSuccessfulPayment={handlePaymentSuccess} />
                    </Elements>
                  ) : (
                    <button 
                      onClick={handleCheckoutInit}
                      disabled={isCheckoutProcessing}
                      className="w-full py-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      {isCheckoutProcessing ? "Processing..." : "Checkout"} <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
