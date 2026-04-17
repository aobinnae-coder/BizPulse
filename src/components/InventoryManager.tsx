import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Plus, Search, Package, MoreVertical, Edit2, Trash2, AlertTriangle, Tag, DollarSign, Layers, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import UpgradeBanner from './UpgradeBanner';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { createNotification } from '../lib/notifications';

export default function InventoryManager({ user, business }: { user: any, business: any }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [variants, setVariants] = useState<any[]>([]);
  const { checkLimit } = usePlanLimits(business, { totalProducts: products.length });

  useEffect(() => {
    if (editingProduct) {
      setVariants(editingProduct.variants || []);
    } else {
      setVariants([]);
    }
  }, [editingProduct]);

  const addVariant = () => {
    setVariants([...variants, { name: '', price: editingProduct?.price || 0, stock: 0 }]);
  };

  const updateVariant = (idx: number, updates: any) => {
    const newVariants = [...variants];
    newVariants[idx] = { ...newVariants[idx], ...updates };
    setVariants(newVariants);
  };

  const removeVariant = (idx: number) => {
    setVariants(variants.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    if (!business) return;
    const q = query(collection(db, 'products'), where('businessId', '==', business.id));
    const unsubscribe = onSnapshot(q, (s) => {
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [business]);

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(search.toLowerCase()) || 
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: products.length,
    lowStock: products.filter(p => p.stock <= (p.threshold || 5)).length,
    outOfStock: products.filter(p => p.stock === 0).length,
    totalValue: products.reduce((acc, p) => acc + (p.price * p.stock), 0)
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const productData = {
      businessId: business.id,
      ownerUid: user.uid,
      name: formData.get('name'),
      description: formData.get('description'),
      price: Number(formData.get('price')),
      sku: formData.get('sku'),
      stock: Number(formData.get('stock')),
      threshold: Number(formData.get('threshold')),
      category: formData.get('category'),
      variants,
      status: 'active',
      createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        
        // Check for low stock notification
        if (productData.stock <= (productData.threshold || 5)) {
          await createNotification({
            businessId: business.id,
            type: 'stock',
            title: 'Low Stock Alert',
            message: `${productData.name} is running low (${productData.stock} left)`,
            link: 'inventory'
          });
        }
      } else {
        const limit = checkLimit('products');
        if (!limit.allowed) {
          alert(limit.message);
          return;
        }
        await addDoc(collection(db, 'products'), productData);
      }
      setShowAddModal(false);
      setEditingProduct(null);
    } catch (error) {
      console.error("Error saving product:", error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Inventory Management</h1>
          <p className="text-stone-500">Manage your products, services, and stock levels.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-600">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-stone-500 uppercase tracking-wider">Total Items</span>
          </div>
          <p className="text-3xl font-bold text-stone-900">{stats.total}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-stone-500 uppercase tracking-wider">Low Stock</span>
          </div>
          <p className="text-3xl font-bold text-stone-900">{stats.lowStock}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-stone-500 uppercase tracking-wider">Out of Stock</span>
          </div>
          <p className="text-3xl font-bold text-stone-900">{stats.outOfStock}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-600">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-stone-500 uppercase tracking-wider">Inventory Value</span>
          </div>
          <p className="text-3xl font-bold text-stone-900">${stats.totalValue.toLocaleString()}</p>
        </div>

        {business?.plan === 'free' && (
          <div className="md:col-span-4">
            <UpgradeBanner 
              title="Advanced Inventory Tools"
              description="Unlock low-stock alerts, bulk CSV exports, and multi-location inventory tracking."
              className="bg-stone-50 border border-stone-200 text-stone-900"
            />
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input 
              type="text" 
              placeholder="Search by name or SKU..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-stone-50 border-none rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-stone-200 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <button className="p-2 text-stone-400 hover:text-stone-900 transition-colors"><Layers className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Product</th>
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">SKU</th>
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Price</th>
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Stock</th>
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-stone-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-400 overflow-hidden">
                        {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" /> : <Package className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-stone-900">{p.name}</p>
                        <p className="text-xs text-stone-500">{p.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-stone-600 font-mono">{p.sku || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm font-bold text-stone-900">${p.price.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-bold",
                        p.stock === 0 ? "text-red-600" : p.stock <= (p.threshold || 5) ? "text-amber-600" : "text-stone-900"
                      )}>
                        {p.stock}
                      </span>
                      {p.stock <= (p.threshold || 5) && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      p.status === 'active' ? "bg-green-50 text-green-600" : "bg-stone-100 text-stone-500"
                    )}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingProduct(p); setShowAddModal(true); }}
                        className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={async () => { if(confirm('Delete this product?')) await deleteDoc(doc(db, 'products', p.id)); }}
                        className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-stone-900">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => { setShowAddModal(false); setEditingProduct(null); }} className="text-stone-400 hover:text-stone-900">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Product Name</label>
                  <input name="name" defaultValue={editingProduct?.name} required className="w-full bg-stone-50 border-none rounded-xl py-2 px-4 text-sm outline-none focus:ring-2 focus:ring-stone-200" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Description</label>
                  <textarea name="description" defaultValue={editingProduct?.description} className="w-full bg-stone-50 border-none rounded-xl py-2 px-4 text-sm outline-none focus:ring-2 focus:ring-stone-200 h-24" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Price ($)</label>
                  <input name="price" type="number" step="0.01" defaultValue={editingProduct?.price} required className="w-full bg-stone-50 border-none rounded-xl py-2 px-4 text-sm outline-none focus:ring-2 focus:ring-stone-200" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">SKU</label>
                  <input name="sku" defaultValue={editingProduct?.sku} className="w-full bg-stone-50 border-none rounded-xl py-2 px-4 text-sm outline-none focus:ring-2 focus:ring-stone-200" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Stock Quantity</label>
                  <input name="stock" type="number" defaultValue={editingProduct?.stock || 0} required className="w-full bg-stone-50 border-none rounded-xl py-2 px-4 text-sm outline-none focus:ring-2 focus:ring-stone-200" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Low Stock Alert at</label>
                  <input name="threshold" type="number" defaultValue={editingProduct?.threshold || 5} className="w-full bg-stone-50 border-none rounded-xl py-2 px-4 text-sm outline-none focus:ring-2 focus:ring-stone-200" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Category</label>
                  <input name="category" defaultValue={editingProduct?.category} className="w-full bg-stone-50 border-none rounded-xl py-2 px-4 text-sm outline-none focus:ring-2 focus:ring-stone-200" />
                </div>
                
                <div className="col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">Product Variants</label>
                    <button type="button" onClick={addVariant} className="text-[10px] font-bold text-stone-900 flex items-center gap-1 hover:underline">
                      <Plus className="w-3 h-3" /> Add Variant
                    </button>
                  </div>
                  <div className="space-y-2">
                    {variants.map((v, i) => (
                      <div key={i} className="flex gap-2 items-center bg-stone-50 p-2 rounded-xl">
                        <input 
                          placeholder="Size/Color" 
                          value={v.name} 
                          onChange={e => updateVariant(i, { name: e.target.value })}
                          className="flex-1 bg-white border-none rounded-lg py-1 px-3 text-xs outline-none"
                        />
                        <input 
                          type="number" 
                          placeholder="Price" 
                          value={v.price} 
                          onChange={e => updateVariant(i, { price: Number(e.target.value) })}
                          className="w-20 bg-white border-none rounded-lg py-1 px-3 text-xs outline-none"
                        />
                        <input 
                          type="number" 
                          placeholder="Stock" 
                          value={v.stock} 
                          onChange={e => updateVariant(i, { stock: Number(e.target.value) })}
                          className="w-16 bg-white border-none rounded-lg py-1 px-3 text-xs outline-none"
                        />
                        <button type="button" onClick={() => removeVariant(i)} className="text-stone-300 hover:text-red-500">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => { setShowAddModal(false); setEditingProduct(null); }} className="flex-1 px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-sm font-medium hover:bg-stone-200 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
