import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, writeBatch, getDocs, orderBy } from 'firebase/firestore';
import { Search, Plus, User, Mail, Phone, Tag, MoreHorizontal, ArrowUpDown, Filter, X, Calendar, ShoppingBag, MessageSquare, Check, Trash2, Edit2, Send, Star } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function CustomerDirectory({ user, business }: { user: any, business: any }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '', tags: '' });
  const [showBulkEmailModal, setShowBulkEmailModal] = useState(false);
  const [bulkEmailSubject, setBulkEmailSubject] = useState('');
  const [bulkEmailBody, setBulkEmailBody] = useState('');
  const [isSendingBulkEmail, setIsSendingBulkEmail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  
  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);

  // Detailed View
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerResponses, setCustomerResponses] = useState<any[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Tag Management
  const [showTagModal, setShowTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');

  // Filtering
  const [sortBy, setSortBy] = useState<'name' | 'spent' | 'score' | 'recent' | 'tags'>('recent');
  const [filterTag, setFilterTag] = useState('All');
  const [minSpend, setMinSpend] = useState<number | ''>('');
  const [minScore, setMinScore] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lastActivityStart, setLastActivityStart] = useState('');
  const [lastActivityEnd, setLastActivityEnd] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!business) return;
    const q = query(collection(db, 'customers'), where('businessId', '==', business.id));
    const unsubscribe = onSnapshot(q, (s) => {
      setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, [business]);

  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => setActionFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

  // Fetch customer details when selected
  useEffect(() => {
    if (!selectedCustomer || !business) return;

    const fetchDetails = async () => {
      setIsDetailLoading(true);
      try {
        const ordersQ = query(
          collection(db, 'orders'), 
          where('businessId', '==', business.id),
          where('customerEmail', '==', selectedCustomer.email),
          orderBy('createdAt', 'desc')
        );

        const responsesQ = query(
          collection(db, 'responses'),
          where('businessId', '==', business.id),
          where('respondent.email', '==', selectedCustomer.email),
          orderBy('createdAt', 'desc')
        );

        const [ordersSnap, responsesSnap] = await Promise.all([
          getDocs(ordersQ),
          getDocs(responsesQ)
        ]);

        setCustomerOrders(ordersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setCustomerResponses(responsesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error fetching customer details:", error);
      } finally {
        setIsDetailLoading(false);
      }
    };

    fetchDetails();
  }, [selectedCustomer, business]);

  const allTags = Array.from(new Set(customers.flatMap(c => c.tags || []))).sort();

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !confirm(`Are you sure you want to delete ${selectedIds.size} customers?`)) return;
    setIsBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'customers', id));
      });
      await batch.commit();
      setSelectedIds(new Set());
    } catch (error) {
      console.error(error);
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleBulkAddTag = async (tag: string) => {
    if (selectedIds.size === 0 || !tag) return;
    setIsBulkActionLoading(true);
    let updatedCount = 0;
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const customer = customers.find(c => c.id === id);
        if (customer && !customer.tags?.includes(tag)) {
          batch.update(doc(db, 'customers', id), {
            tags: [...(customer.tags || []), tag]
          });
          updatedCount++;
        }
      });
      await batch.commit();
      setSelectedIds(new Set());
      setActionFeedback({ 
        message: `Successfully added tag "${tag}" to ${updatedCount} customers.`, 
        type: 'success' 
      });
    } catch (error) {
      console.error(error);
      setActionFeedback({ message: 'Failed to update tags.', type: 'error' });
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleSendBulkEmail = async () => {
    if (selectedIds.size === 0 || !bulkEmailSubject || !bulkEmailBody) return;
    setIsSendingBulkEmail(true);
    let successCount = 0;
    try {
      const selectedCustomers = customers.filter(c => selectedIds.has(c.id));
      const batch = selectedCustomers.map(async (customer) => {
        if (customer.email) {
          try {
            await fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: customer.email,
                subject: bulkEmailSubject,
                text: bulkEmailBody
              })
            });
            successCount++;
          } catch (e) {
            console.error('Failed to send email to', customer.email, e);
          }
        }
      });
      await Promise.all(batch);
      setActionFeedback({ message: `Successfully sent email to ${successCount} customers.`, type: 'success' });
      setShowBulkEmailModal(false);
      setBulkEmailSubject('');
      setBulkEmailBody('');
    } catch (error) {
      console.error(error);
      setActionFeedback({ message: 'Failed to send bulk email.', type: 'error' });
    } finally {
      setIsSendingBulkEmail(false);
    }
  };

  const handleRenameTag = async (oldTag: string, newTag: string) => {
    if (!newTag || oldTag === newTag) {
      setEditingTag(null);
      return;
    }
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      let affectedCount = 0;
      customers.forEach(c => {
        if (c.tags?.includes(oldTag)) {
          const newTags = c.tags.map((t: string) => t === oldTag ? newTag : t);
          batch.update(doc(db, 'customers', c.id), { tags: newTags });
          affectedCount++;
        }
      });
      await batch.commit();
      setEditingTag(null);
      setActionFeedback({ message: `Successfully renamed "${oldTag}" to "${newTag}" for ${affectedCount} customers.`, type: 'success' });
    } catch (error) {
      console.error(error);
      setActionFeedback({ message: 'Failed to rename tag.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTag = async (tagName: string) => {
    if (!tagName) return;
    const trimmed = tagName.trim();
    if (allTags.includes(trimmed)) {
      setActionFeedback({ message: 'Tag already exists.', type: 'error' });
      return;
    }
    // Tags are derived from customer data. To "create" a tag that doesn't exist on any customer yet,
    // we just give feedback that it's ready. In this system, tags only exist if a customer has them.
    setActionFeedback({ message: `Tag "${trimmed}" is ready to be applied to customers.`, type: 'success' });
    setNewTagName('');
  };

  const handleDeleteTag = async (tag: string) => {
    if (!confirm(`Are you sure you want to delete the tag "${tag}" from all customers?`)) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      let affectedCount = 0;
      customers.forEach(c => {
        if (c.tags?.includes(tag)) {
          const newTags = c.tags.filter((t: string) => t !== tag);
          batch.update(doc(db, 'customers', c.id), { tags: newTags });
          affectedCount++;
        }
      });
      await batch.commit();
      setActionFeedback({ message: `Removed tag "${tag}" from ${affectedCount} customers.`, type: 'success' });
    } catch (error) {
      console.error(error);
      setActionFeedback({ message: 'Failed to delete tag.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCustomers = customers
    .filter(c => {
      const matchesSearch = (c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()));
      const matchesTag = (filterTag === 'All' || c.tags?.includes(filterTag));
      const matchesSpend = (minSpend === '' || (c.totalSpent || 0) >= minSpend);
      const matchesScore = (minScore === '' || (c.avgScore || 0) >= minScore);
      
      const createdAt = new Date(c.createdAt).getTime();
      const matchesStart = !startDate || createdAt >= new Date(startDate).getTime();
      const matchesEnd = !endDate || createdAt <= new Date(endDate).getTime() + 86400000;

      const lastActivity = new Date(c.updatedAt || c.createdAt).getTime();
      const matchesLAStart = !lastActivityStart || lastActivity >= new Date(lastActivityStart).getTime();
      const matchesLAEnd = !lastActivityEnd || lastActivity <= new Date(lastActivityEnd).getTime() + 86400000;

      return matchesSearch && matchesTag && matchesSpend && matchesScore && matchesStart && matchesEnd && matchesLAStart && matchesLAEnd;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'spent') return (b.totalSpent || 0) - (a.totalSpent || 0);
      if (sortBy === 'score') return (b.avgScore || 0) - (a.avgScore || 0);
      if (sortBy === 'tags') return (a.tags?.[0] || '').localeCompare(b.tags?.[0] || '');
      if (sortBy === 'recent') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    });

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCustomers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCustomers.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 10) {
      // US Format (default)
      const match = digits.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
      if (!match) return digits;
      return (!match[2] ? match[1] : `(${match[1]}) ${match[2]}${match[3] ? `-${match[3]}` : ''}`);
    }
    return `+${digits}`; // Fallback to E.164 style for longer numbers
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newCustomer.name || !newCustomer.email) {
      setActionFeedback({ message: 'Name and Email are required.', type: 'error' });
      return;
    }
    if (!emailRegex.test(newCustomer.email)) {
      setActionFeedback({ message: 'Please enter a valid email address.', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'customers'), {
        ...newCustomer,
        tags: newCustomer.tags.split(',').map(t => t.trim()).filter(Boolean),
        businessId: business.id,
        ownerUid: user.uid,
        totalSpent: 0,
        avgScore: 0,
        responseCount: 0,
        createdAt: new Date().toISOString()
      });
      setShowAddModal(false);
      setNewCustomer({ name: '', email: '', phone: '', tags: '' });
      setActionFeedback({ message: 'Customer added successfully.', type: 'success' });
    } catch (error) {
      console.error(error);
      setActionFeedback({ message: 'Failed to add customer.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Feedback Toast */}
      <AnimatePresence>
        {actionFeedback && (
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className={cn(
              "fixed top-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-xl z-[100] flex items-center gap-3 font-bold text-sm",
              actionFeedback.type === 'success' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
            )}
          >
            {actionFeedback.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {actionFeedback.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Customer Directory</h1>
          <p className="text-stone-500">Manage your customer relationships and segments.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowTagModal(true)}
            className="px-4 py-2 bg-white border border-stone-200 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors flex items-center gap-2"
          >
            <Tag className="w-4 h-4" /> Manage Tags
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-stone-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-[60] flex items-center gap-6"
          >
            <div className="flex items-center gap-2 pr-6 border-r border-white/10">
              <span className="text-sm font-bold">{selectedIds.size} selected</span>
              <button onClick={() => setSelectedIds(new Set())} className="text-stone-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <select 
                  onChange={(e) => handleBulkAddTag(e.target.value)}
                  className="bg-white/10 border-none rounded-lg py-1.5 px-3 text-xs font-bold text-white outline-none"
                  defaultValue=""
                >
                  <option value="" disabled>Add Tag...</option>
                  {allTags.map(t => <option key={t} value={t} className="text-stone-900">{t}</option>)}
                </select>
              </div>
              <button 
                onClick={() => setShowBulkEmailModal(true)}
                className="flex items-center gap-2 text-xs font-bold hover:text-amber-400 transition-colors"
              >
                <Send className="w-4 h-4" /> Email
              </button>
              <button 
                onClick={handleBulkDelete}
                className="flex items-center gap-2 text-xs font-bold text-red-400 hover:text-red-300 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Email Modal */}
      {showBulkEmailModal && (
        <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl border border-stone-200">
            <h2 className="text-xl font-bold mb-2">Compose Email</h2>
            <p className="text-sm text-stone-500 mb-6">Sending to {selectedIds.size} selected customer(s).</p>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Subject Line</label>
                <input 
                  type="text" 
                  value={bulkEmailSubject}
                  onChange={e => setBulkEmailSubject(e.target.value)}
                  className="w-full p-4 bg-stone-50 rounded-2xl outline-none focus:ring-2 focus:ring-stone-900"
                  placeholder="Special offer for you!"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Email Body</label>
                <textarea 
                  value={bulkEmailBody}
                  onChange={e => setBulkEmailBody(e.target.value)}
                  className="w-full p-4 bg-stone-50 rounded-2xl outline-none focus:ring-2 focus:ring-stone-900 h-32 resize-none"
                  placeholder="Type your message here..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setShowBulkEmailModal(false)}
                className="flex-1 px-4 py-3 bg-stone-100 text-stone-900 rounded-xl font-bold hover:bg-stone-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSendBulkEmail}
                disabled={isSendingBulkEmail || !bulkEmailSubject || !bulkEmailBody}
                className="flex-1 px-4 py-3 bg-stone-900 text-white rounded-xl font-bold hover:bg-stone-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSendingBulkEmail ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Send Email <Send className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl border border-stone-200">
            <h2 className="text-xl font-bold mb-6">Add New Customer</h2>
            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={newCustomer.name}
                  onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                  className="w-full p-4 bg-stone-50 rounded-2xl outline-none focus:ring-2 focus:ring-stone-900"
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={newCustomer.email}
                  onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                  className="w-full p-4 bg-stone-50 rounded-2xl outline-none focus:ring-2 focus:ring-stone-900"
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Phone Number</label>
                <input 
                  type="tel" 
                  value={newCustomer.phone}
                  onChange={e => setNewCustomer({...newCustomer, phone: formatPhone(e.target.value)})}
                  className="w-full p-4 bg-stone-50 rounded-2xl outline-none focus:ring-2 focus:ring-stone-900"
                  placeholder="(555) 000-0000"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Tags (comma separated)</label>
                <input 
                  type="text" 
                  value={newCustomer.tags}
                  onChange={e => setNewCustomer({...newCustomer, tags: e.target.value})}
                  className="w-full p-4 bg-stone-50 rounded-2xl outline-none focus:ring-2 focus:ring-stone-900"
                  placeholder="VIP, Regular, Local"
                />
              </div>
              <div className="mt-8 flex gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-sm font-bold text-stone-500 hover:bg-stone-50 rounded-xl">Cancel</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-bold text-sm disabled:opacity-50">
                  {isSaving ? 'Saving...' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tag Management Modal */}
      {showTagModal && (
        <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Manage Tags</h2>
              <button onClick={() => setShowTagModal(false)} className="text-stone-400 hover:text-stone-900"><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-4 mb-8">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Create New Tag</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                    placeholder="Enter tag name..."
                  />
                  <button 
                    onClick={() => handleCreateTag(newTagName)}
                    className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition-colors"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {allTags.map(tag => (
                <motion.div 
                  layout
                  key={tag} 
                  className="flex items-center justify-between p-3 bg-stone-50 rounded-2xl group border border-transparent hover:border-stone-200 transition-all"
                >
                  {editingTag === tag ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input 
                        type="text" 
                        value={newTagName}
                        onChange={e => setNewTagName(e.target.value)}
                        className="flex-1 bg-white border border-stone-200 rounded-xl px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-stone-900"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameTag(tag, newTagName);
                          if (e.key === 'Escape') setEditingTag(null);
                        }}
                      />
                      <button 
                        onClick={() => handleRenameTag(tag, newTagName)} 
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Save Rename"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setEditingTag(null)} 
                        className="p-1.5 text-stone-400 hover:bg-stone-100 rounded-lg transition-colors"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-stone-300" />
                        <span className="text-sm font-bold text-stone-700">{tag}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingTag(tag);
                            setNewTagName(tag);
                          }} 
                          className="p-2 text-stone-400 hover:text-stone-900 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-stone-100 transition-all"
                          title="Rename Tag"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteTag(tag)}
                          className="p-2 text-stone-400 hover:text-red-500 hover:bg-white rounded-lg shadow-sm border border-transparent hover:border-stone-100 transition-all"
                          title="Delete Tag"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
              {allTags.length === 0 && (
                <div className="text-center py-12">
                  <Tag className="w-12 h-12 text-stone-100 mx-auto mb-4" />
                  <p className="text-stone-400 text-sm">No tags found. Create one above!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-4xl h-[80vh] rounded-[40px] shadow-2xl border border-stone-200 flex flex-col overflow-hidden"
          >
            <div className="p-8 border-b border-stone-100 flex items-start justify-between bg-stone-50/50">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-stone-900 rounded-[32px] flex items-center justify-center text-white">
                  <User className="w-10 h-10" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-stone-900">{selectedCustomer.name}</h2>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5 text-sm text-stone-500"><Mail className="w-4 h-4" /> {selectedCustomer.email}</div>
                    <div className="flex items-center gap-1.5 text-sm text-stone-500 group/phone relative">
                      <Phone className="w-4 h-4" />
                      <input 
                        type="tel"
                        value={selectedCustomer.phone || ''}
                        onChange={async (e) => {
                          const formatted = formatPhone(e.target.value);
                          setSelectedCustomer({ ...selectedCustomer, phone: formatted });
                        }}
                        onBlur={async (e) => {
                          if (e.target.value !== selectedCustomer.phone) {
                            await updateDoc(doc(db, 'customers', selectedCustomer.id), { phone: e.target.value });
                            setActionFeedback({ message: 'Phone number updated.', type: 'success' });
                          }
                        }}
                        className="bg-transparent border-none outline-none text-stone-500 focus:text-stone-900 focus:ring-0 p-0 w-32"
                        placeholder="Add phone..."
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {selectedCustomer.tags?.map((t: string) => (
                      <span 
                        key={t} 
                        className="group/tag px-3 py-1 bg-stone-900 text-white text-[10px] font-bold rounded-full uppercase tracking-wider flex items-center gap-2"
                      >
                        {t}
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            const newTags = selectedCustomer.tags.filter((tag: string) => tag !== t);
                            await updateDoc(doc(db, 'customers', selectedCustomer.id), { tags: newTags });
                            setSelectedCustomer({ ...selectedCustomer, tags: newTags });
                            setActionFeedback({ message: `Tag "${t}" removed.`, type: 'success' });
                          }}
                          className="opacity-0 group-hover/tag:opacity-100 transition-opacity hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <div className="relative">
                      <button 
                        onClick={() => {
                          const tag = prompt('Enter new tag:');
                          if (tag) {
                            const newTags = Array.from(new Set([...(selectedCustomer.tags || []), tag]));
                            updateDoc(doc(db, 'customers', selectedCustomer.id), { tags: newTags });
                            setSelectedCustomer({ ...selectedCustomer, tags: newTags });
                            setActionFeedback({ message: `Tag "${tag}" added.`, type: 'success' });
                          }
                        }}
                        className="px-3 py-1 border border-stone-200 text-stone-400 text-[10px] font-bold rounded-full uppercase tracking-wider hover:border-stone-900 hover:text-stone-900 transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Tag
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-stone-200 rounded-2xl transition-colors"><X className="w-6 h-6" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Stats & Info */}
              <div className="space-y-6">
                <div className="bg-stone-900 p-6 rounded-3xl text-white">
                  <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Recent Activity</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-stone-400">Last Order</span>
                      <span className="text-xs font-bold">
                        {customerOrders[0] ? new Date(customerOrders[0].createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-stone-400">Last Feedback</span>
                      <span className="text-xs font-bold">
                        {customerResponses[0] ? new Date(customerResponses[0].createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-stone-400">Avg. Score</span>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-bold">{(selectedCustomer.avgScore || 0).toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100">
                  <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Customer Value</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="text-2xl font-bold text-stone-900">${(selectedCustomer.totalSpent || 0).toLocaleString()}</div>
                      <div className="text-xs text-stone-500">Total Lifetime Spend</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-stone-900">{(selectedCustomer.avgScore || 0).toFixed(1)}</div>
                      <div className="text-xs text-stone-500">Average Feedback Score</div>
                    </div>
                  </div>
                </div>

                <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100">
                  <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Internal Notes</h3>
                  <textarea 
                    className="w-full bg-white border border-stone-200 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-stone-900 min-h-[150px]"
                    placeholder="Add notes about this customer..."
                    defaultValue={selectedCustomer.notes || ''}
                    onBlur={async (e) => {
                      await updateDoc(doc(db, 'customers', selectedCustomer.id), { notes: e.target.value });
                    }}
                  />
                </div>
              </div>

              {/* Activity History */}
              <div className="lg:col-span-2 space-y-8">
                {/* Orders */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <ShoppingBag className="w-5 h-5 text-stone-900" />
                    <h3 className="font-bold text-stone-900">Order History</h3>
                  </div>
                  <div className="space-y-3">
                    {customerOrders.map(order => (
                      <div key={order.id} className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-stone-900">Order #{order.id.slice(-6).toUpperCase()}</div>
                          <div className="text-xs text-stone-500">{new Date(order.createdAt).toLocaleDateString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-stone-900">${(order.total || 0).toLocaleString()}</div>
                          <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{order.status}</div>
                        </div>
                      </div>
                    ))}
                    {customerOrders.length === 0 && <p className="text-sm text-stone-400 italic">No orders found.</p>}
                  </div>
                </div>

                {/* Survey Responses */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="w-5 h-5 text-stone-900" />
                    <h3 className="font-bold text-stone-900">Survey Responses</h3>
                  </div>
                  <div className="space-y-3">
                    {customerResponses.map(resp => (
                      <div key={resp.id} className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-bold text-stone-900">Feedback Response</div>
                            {resp.sentiment && (
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                                resp.sentiment === 'positive' ? "bg-emerald-100 text-emerald-700" :
                                resp.sentiment === 'negative' ? "bg-red-100 text-red-700" : "bg-stone-100 text-stone-600"
                              )}>
                                {resp.sentiment}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-stone-500">{new Date(resp.createdAt).toLocaleDateString()}</div>
                        </div>
                        <div className="flex items-center gap-1 mb-3">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn("w-3 h-3", i < (resp.score || 0) ? "text-amber-400 fill-amber-400" : "text-stone-200")} />
                          ))}
                        </div>
                        <p className="text-xs text-stone-600 line-clamp-2">{resp.notes || 'No comments provided.'}</p>
                      </div>
                    ))}
                    {customerResponses.length === 0 && <p className="text-sm text-stone-400 italic">No responses found.</p>}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex flex-wrap items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input 
              type="text" 
              placeholder="Search customers..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-stone-50 border-none rounded-xl py-2 pl-10 pr-4 text-sm outline-none"
            />
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                showFilters ? "bg-stone-900 text-white" : "bg-stone-50 text-stone-600 hover:bg-stone-100"
              )}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            {(filterTag !== 'All' || minSpend !== '' || minScore !== '' || startDate || endDate || lastActivityStart || lastActivityEnd) && (
              <button 
                onClick={() => {
                  setFilterTag('All');
                  setMinSpend('');
                  setMinScore('');
                  setStartDate('');
                  setEndDate('');
                  setLastActivityStart('');
                  setLastActivityEnd('');
                }}
                className="text-xs font-bold text-stone-400 hover:text-stone-900 transition-colors"
              >
                Reset
              </button>
            )}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-stone-400" />
              <select 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-stone-50 border-none rounded-lg py-1.5 px-3 text-xs font-bold text-stone-600 outline-none"
              >
                <option value="recent">Sort by Recent</option>
                <option value="name">Sort by Name</option>
                <option value="spent">Sort by Spend</option>
                <option value="score">Sort by Score</option>
                <option value="tags">Sort by Tags</option>
              </select>
            </div>
          </div>
        </div>

        {showFilters && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="p-4 bg-stone-50 border-b border-stone-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Customer Tag</label>
              <select 
                value={filterTag} 
                onChange={e => setFilterTag(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-xl py-2 px-3 text-sm outline-none"
              >
                <option value="All">All Tags</option>
                {allTags.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Min Spend ($)</label>
              <input 
                type="number"
                value={minSpend}
                onChange={e => setMinSpend(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0"
                className="w-full bg-white border border-stone-200 rounded-xl py-2 px-3 text-sm outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Min Score (1-5)</label>
              <input 
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={minScore}
                onChange={e => setMinScore(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.0"
                className="w-full bg-white border border-stone-200 rounded-xl py-2 px-3 text-sm outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Acquired From</label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-xl py-2 px-3 text-xs outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Acquired To</label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-xl py-2 px-3 text-xs outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Last Activity From</label>
                <input 
                  type="date"
                  value={lastActivityStart}
                  onChange={e => setLastActivityStart(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-xl py-2 px-3 text-xs outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Last Activity To</label>
                <input 
                  type="date"
                  value={lastActivityEnd}
                  onChange={e => setLastActivityEnd(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-xl py-2 px-3 text-xs outline-none"
                />
              </div>
            </div>
          </motion.div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-50/50">
                <th className="px-6 py-4 w-10">
                  <button 
                    onClick={toggleSelectAll}
                    className={cn(
                      "w-4 h-4 rounded border transition-colors flex items-center justify-center",
                      selectedIds.size === filteredCustomers.length && filteredCustomers.length > 0
                        ? "bg-stone-900 border-stone-900 text-white"
                        : "border-stone-300 hover:border-stone-400"
                    )}
                  >
                    {selectedIds.size === filteredCustomers.length && filteredCustomers.length > 0 && <Check className="w-3 h-3" />}
                  </button>
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Customer</th>
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Contact</th>
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Stats</th>
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Tags</th>
                <th className="px-6 py-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Added</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filteredCustomers.map(c => (
                <tr 
                  key={c.id} 
                  className={cn(
                    "hover:bg-stone-50/50 transition-colors cursor-pointer group",
                    selectedIds.has(c.id) && "bg-stone-50"
                  )}
                  onClick={() => setSelectedCustomer(c)}
                >
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => toggleSelect(c.id)}
                      className={cn(
                        "w-4 h-4 rounded border transition-colors flex items-center justify-center",
                        selectedIds.has(c.id)
                          ? "bg-stone-900 border-stone-900 text-white"
                          : "border-stone-300 hover:border-stone-400"
                      )}
                    >
                      {selectedIds.has(c.id) && <Check className="w-3 h-3" />}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-stone-100 rounded-full flex items-center justify-center text-stone-400">
                        <User className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-bold text-stone-900">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-stone-500"><Mail className="w-3 h-3" /> {c.email}</div>
                      {c.phone && <div className="flex items-center gap-2 text-xs text-stone-500"><Phone className="w-3 h-3" /> {c.phone}</div>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-stone-900">${(c.totalSpent || 0).toLocaleString()} spent</div>
                      <div className="text-[10px] text-stone-400 uppercase tracking-wider font-bold">Score: {(c.avgScore || 0).toFixed(1)}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {c.tags?.map((t: string) => (
                        <span key={t} className="px-2 py-0.5 bg-stone-100 text-stone-600 text-[10px] font-bold rounded uppercase tracking-wider">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-stone-400">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-stone-300 hover:text-stone-900"><MoreHorizontal className="w-5 h-5" /></button>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-stone-400 text-sm">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

