import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { Plus, MoreVertical, Clock, AlertCircle, CheckCircle2, Trash2, Calendar, X, Save, ArrowUpDown, Filter, Check, RotateCcw, Users, Paperclip, FileText, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'bg-stone-100' },
  { id: 'in-progress', label: 'In Progress', color: 'bg-blue-50' },
  { id: 'done', label: 'Done', color: 'bg-emerald-50' }
];

export default function ActionBoard({ user, business }: { user: any, business: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ 
    title: '', 
    description: '', 
    priority: 'medium', 
    dueDate: '', 
    assignedTo: '', 
    parentId: '',
    recurrence: 'none',
    recurrenceEndDate: ''
  });
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'upcoming' | 'overdue'>('all');
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(false);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'createdAt' | 'dueDate'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editTaskData, setEditTaskData] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [staffFilter, setStaffFilter] = useState('all');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  useEffect(() => {
    if (!business) return;
    const q = query(collection(db, 'actionItems'), where('businessId', '==', business.id));
    const unsubscribe = onSnapshot(q, (s) => {
      setItems(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    const staffQuery = query(collection(db, 'staff'), where('businessId', '==', business.id));
    const staffUnsub = onSnapshot(staffQuery, (s) => {
      setStaff(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribe();
      staffUnsub();
    };
  }, [business]);

  useEffect(() => {
    if (selectedTask) {
      const qComments = query(collection(db, 'actionItems', selectedTask.id, 'comments'), orderBy('createdAt', 'desc'));
      const unsubComments = onSnapshot(qComments, (s) => setComments(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      
      const qSubtasks = query(collection(db, 'actionItems', selectedTask.id, 'subtasks'), orderBy('createdAt', 'asc'));
      const unsubSubtasks = onSnapshot(qSubtasks, (s) => setSubtasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));

      return () => {
        unsubComments();
        unsubSubtasks();
      };
    }
  }, [selectedTask]);

  const updateStatus = async (id: string, status: string) => {
    const task = items.find(i => i.id === id);
    // Dependency Check
    if (task?.parentId && (status === 'in-progress' || status === 'done')) {
      const parent = items.find(i => i.id === task.parentId);
      if (parent && parent.status !== 'done') {
        alert(`Dependency Error: "${parent.title}" must be "Done" first.`);
        return;
      }
    }

    await updateDoc(doc(db, 'actionItems', id), { 
      status,
      updatedAt: new Date().toISOString()
    });

    // Handle Recurrence
    if (status === 'done' && task?.recurrence && task.recurrence !== 'none') {
      const nextDate = new Date(task.dueDate || new Date());
      if (task.recurrence === 'daily') nextDate.setDate(nextDate.getDate() + 1);
      else if (task.recurrence === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
      else if (task.recurrence === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);

      const recurrenceEndDate = task.recurrenceEndDate ? new Date(task.recurrenceEndDate) : null;
      if (!recurrenceEndDate || nextDate <= recurrenceEndDate) {
        await addDoc(collection(db, 'actionItems'), {
          ...task,
          id: undefined,
          status: 'todo',
          dueDate: nextDate.toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          updatedAt: null
        });
      }
    }
  };

  const addComment = async () => {
    if (!newComment || !selectedTask) return;
    await addDoc(collection(db, 'actionItems', selectedTask.id, 'comments'), {
      text: newComment,
      userId: user.uid,
      userName: user.displayName || user.email,
      createdAt: new Date().toISOString()
    });
    setNewComment('');
  };

  const addSubtask = async () => {
    if (!newSubtaskTitle || !selectedTask) return;
    await addDoc(collection(db, 'actionItems', selectedTask.id, 'subtasks'), {
      title: newSubtaskTitle,
      done: false,
      createdAt: new Date().toISOString()
    });
    setNewSubtaskTitle('');
  };

  const toggleSubtask = async (subtaskId: string, currentStatus: boolean) => {
    await updateDoc(doc(db, 'actionItems', selectedTask.id, 'subtasks', subtaskId), {
      done: !currentStatus
    });
  };

  const addItem = async () => {
    if (!newItem.title) return;
    await addDoc(collection(db, 'actionItems'), {
      ...newItem,
      businessId: business.id,
      ownerUid: user.uid,
      status: 'todo',
      attachments: [],
      createdAt: new Date().toISOString()
    });
    setNewItem({ 
      title: '', 
      description: '', 
      priority: 'medium', 
      dueDate: '', 
      assignedTo: '', 
      parentId: '', 
      recurrence: 'none',
      recurrenceEndDate: '' 
    });
    setIsAdding(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTask) return;

    // Simulate file upload metadata storage
    const newAttachment = {
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      type: file.type,
      createdAt: new Date().toISOString(),
      // In a real app, this would be a Storage URL
      url: '#' 
    };

    const taskRef = doc(db, 'actionItems', selectedTask.id);
    const updatedAttachments = [...(selectedTask.attachments || []), newAttachment];
    
    await updateDoc(taskRef, { attachments: updatedAttachments });
    setSelectedTask({ ...selectedTask, attachments: updatedAttachments });
  };

  const removeAttachment = async (attachmentId: string) => {
    if (!selectedTask) return;
    const taskRef = doc(db, 'actionItems', selectedTask.id);
    const updatedAttachments = (selectedTask.attachments || []).filter((a: any) => a.id !== attachmentId);
    
    await updateDoc(taskRef, { attachments: updatedAttachments });
    setSelectedTask({ ...selectedTask, attachments: updatedAttachments });
  };

  const saveEditTask = async () => {
    if (!selectedTask || !editTaskData) return;
    await updateDoc(doc(db, 'actionItems', selectedTask.id), {
      title: editTaskData.title,
      description: editTaskData.description,
      priority: editTaskData.priority,
      status: editTaskData.status,
      dueDate: editTaskData.dueDate,
      assignedTo: editTaskData.assignedTo || null,
      parentId: editTaskData.parentId || null,
      recurrence: editTaskData.recurrence || 'none',
      recurrenceEndDate: editTaskData.recurrenceEndDate || null
    });
    setSelectedTask({ ...selectedTask, ...editTaskData });
    setIsEditingTask(false);
  };

  const filteredItems = items
    .filter(item => {
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (staffFilter !== 'all' && item.assignedTo !== staffFilter) return false;
      
      if (dateRangeFilter === 'overdue') {
        if (!item.dueDate || item.status === 'done') return false;
        return new Date(item.dueDate) < new Date(new Date().setHours(0,0,0,0));
      }
      if (dateRangeFilter === 'upcoming') {
        if (!item.dueDate || item.status === 'done') return false;
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const due = new Date(item.dueDate);
        return due >= new Date(new Date().setHours(0,0,0,0)) && due <= nextWeek;
      }

      if (showMyTasksOnly) {
        const userStaff = staff.find(s => s.email === user.email);
        if (!userStaff || item.assignedTo !== userStaff.id) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = a[sortBy] ? new Date(a[sortBy]).getTime() : 0;
      const dateB = b[sortBy] ? new Date(b[sortBy]).getTime() : 0;
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleBulkUpdate = async (updates: any) => {
    setIsBulkProcessing(true);
    try {
      const promises = Array.from(selectedIds).map(id => 
        updateDoc(doc(db, 'actionItems', id), { ...updates, updatedAt: new Date().toISOString() })
      );
      await Promise.all(promises);
      setSelectedIds(new Set());
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} tasks?`)) return;
    setIsBulkProcessing(true);
    try {
      const promises = Array.from(selectedIds).map(id => deleteDoc(doc(db, 'actionItems', id)));
      await Promise.all(promises);
      setSelectedIds(new Set());
    } finally {
      setIsBulkProcessing(false);
    }
  };

  return (
    <div className="space-y-8 pb-32">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Action Items</h1>
          <p className="text-stone-500">Close the feedback loop with actionable tasks.</p>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-1.5 shadow-sm">
              <Filter className="w-3.5 h-3.5 text-stone-400" />
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-stone-600 outline-none pr-4"
              >
                <option value="all">Any Priority</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-1.5 shadow-sm">
              <Users className="w-3.5 h-3.5 text-stone-400" />
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-stone-600 outline-none pr-4"
              >
                <option value="all">Any Staff</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name || s.email}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-1.5 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-stone-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-stone-600 outline-none pr-4"
              >
                <option value="all">Any Status</option>
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-1.5 shadow-sm">
              <Calendar className="w-3.5 h-3.5 text-stone-400" />
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value as any)}
                className="bg-transparent border-none text-xs font-bold text-stone-600 outline-none pr-4"
              >
                <option value="all">Any Date</option>
                <option value="upcoming">Next 7 Days</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-1.5 shadow-sm">
              <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent border-none text-xs font-bold text-stone-600 outline-none pr-2"
              >
                <option value="createdAt">Created Date</option>
                <option value="dueDate">Due Date</option>
              </select>
              <button 
                onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                className="p-1 hover:bg-stone-100 rounded-md text-stone-400 transition-colors"
              >
                <div className={cn("transition-transform duration-200", sortOrder === 'asc' ? "rotate-0" : "rotate-180")}>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </button>
            </div>

            {(priorityFilter !== 'all' || statusFilter !== 'all' || staffFilter !== 'all' || sortBy !== 'createdAt' || sortOrder !== 'desc' || showMyTasksOnly || showOverdueOnly) && (
              <button 
                onClick={() => {
                  setPriorityFilter('all');
                  setStatusFilter('all');
                  setStaffFilter('all');
                  setSortBy('createdAt');
                  setSortOrder('desc');
                  setShowMyTasksOnly(false);
                  setShowOverdueOnly(false);
                }}
                className="text-[10px] font-bold text-stone-400 uppercase tracking-widest hover:text-stone-900 transition-colors px-2"
              >
                Clear Filters
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMyTasksOnly(!showMyTasksOnly)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                showMyTasksOnly 
                  ? "bg-stone-900 text-white border-stone-900" 
                  : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
              )}
            >
              My Tasks
            </button>
            <button
              onClick={() => setShowOverdueOnly(!showOverdueOnly)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                showOverdueOnly 
                  ? "bg-red-600 text-white border-red-600" 
                  : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
              )}
            >
              Overdue
            </button>
            <button 
              onClick={() => setIsAdding(true)}
              className="px-6 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-bold hover:bg-stone-800 shadow-xl shadow-stone-900/10 transition-all flex items-center gap-2 active:scale-95 ml-2"
            >
              <Plus className="w-4 h-4" /> New Task
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-16rem)]">
        {COLUMNS.map(col => (
          <div key={col.id} className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-stone-900">{col.label}</h3>
                <span className="bg-stone-200 text-stone-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {items.filter(i => i.status === col.id).length}
                </span>
              </div>
            </div>
            
            <div className={cn("flex-1 rounded-3xl p-4 space-y-4 overflow-y-auto", col.color)}>
              <AnimatePresence mode="popLayout">
                {filteredItems.filter(i => i.status === col.id).map(item => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={item.id} 
                    onClick={() => setSelectedTask(item)}
                    className={cn(
                      "p-4 rounded-2xl shadow-sm border group cursor-pointer transition-all relative overflow-hidden",
                      selectedIds.has(item.id) ? "ring-2 ring-stone-900 border-stone-900" : "border-stone-200/50 hover:border-stone-400",
                      item.priority === 'high' ? "bg-red-50" :
                      item.priority === 'medium' ? "bg-blue-50" : "bg-stone-50/60"
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div 
                          onClick={(e) => toggleSelect(item.id, e)}
                          className={cn(
                            "w-4 h-4 rounded border transition-colors flex items-center justify-center",
                            selectedIds.has(item.id) ? "bg-stone-900 border-stone-900" : "border-stone-300 bg-white"
                          )}
                        >
                          {selectedIds.has(item.id) && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <div className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                          item.priority === 'high' ? "bg-red-100 text-red-700" :
                          item.priority === 'medium' ? "bg-blue-100 text-blue-700" : "bg-stone-100 text-stone-600"
                        )}>
                          {item.priority}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        {col.id !== 'todo' && <button onClick={() => updateStatus(item.id, 'todo')} className="p-1 hover:bg-white rounded shadow-sm transition-colors"><Clock className="w-3 h-3 text-stone-400" /></button>}
                        {col.id !== 'in-progress' && <button onClick={() => updateStatus(item.id, 'in-progress')} className="p-1 hover:bg-white rounded shadow-sm transition-colors"><AlertCircle className="w-3 h-3 text-stone-400" /></button>}
                        {col.id !== 'done' && (
                          <motion.button 
                            whileTap={{ scale: 0.9 }}
                            onClick={() => updateStatus(item.id, 'done')} 
                            className="p-1 hover:bg-emerald-50 rounded shadow-sm transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          </motion.button>
                        )}
                        <button onClick={() => deleteDoc(doc(db, 'actionItems', item.id))} className="p-1 hover:bg-red-50 rounded shadow-sm transition-colors"><Trash2 className="w-3 h-3 text-red-400" /></button>
                      </div>
                    </div>
                    <h4 className="text-sm font-bold text-stone-900 mb-1">{item.title}</h4>
                    <p className="text-xs text-stone-500 line-clamp-2 mb-4 font-medium leading-relaxed">{item.description}</p>
                    
                    <div className="flex items-center justify-between mt-auto">
                      {item.assignedTo ? (
                        <div className="flex items-center gap-1.5 border border-white/50 bg-white/40 w-fit px-1.5 py-0.5 rounded-lg backdrop-blur-sm">
                          <div className="w-3.5 h-3.5 bg-stone-200 rounded-full flex items-center justify-center text-[7px] font-black text-stone-600">
                            {staff.find(s => s.id === item.assignedTo)?.name?.charAt(0) || staff.find(s => s.id === item.assignedTo)?.email?.charAt(0) || '?'}
                          </div>
                          <span className="text-[9px] font-bold text-stone-600">
                            {staff.find(s => s.id === item.assignedTo)?.name || staff.find(s => s.id === item.assignedTo)?.email?.split('@')[0] || 'Unknown'}
                          </span>
                        </div>
                      ) : <div />}

                      <div className="flex items-center gap-2 text-[10px] text-stone-400 font-bold whitespace-nowrap">
                        {item.dueDate && (
                          <div className={cn(
                            "flex items-center gap-1 px-2 py-0.5 rounded",
                            new Date(item.dueDate) < new Date() ? "text-red-600 bg-red-50" : "text-amber-600 bg-amber-50"
                          )}>
                            <Clock className="w-3 h-3" />
                            {format(new Date(item.dueDate), 'MMM dd')}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-stone-900 text-white px-6 py-4 rounded-[32px] shadow-2xl z-[100] flex items-center gap-8 border border-white/10 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 pr-8 border-r border-white/20">
              <div className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black">
                {selectedIds.size}
              </div>
              <span className="text-sm font-bold uppercase tracking-widest text-stone-300">Selected</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Move to:</span>
                <div className="flex bg-white/5 p-1 rounded-xl">
                  {COLUMNS.map(col => (
                    <button 
                      key={col.id}
                      onClick={() => handleBulkUpdate({ status: col.id })}
                      className="px-3 py-1.5 hover:bg-white/10 rounded-lg text-xs font-bold transition-all"
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Set Priority:</span>
                <div className="flex bg-white/5 p-1 rounded-xl">
                  {['low', 'medium', 'high'].map(p => (
                    <button 
                      key={p}
                      onClick={() => handleBulkUpdate({ priority: p })}
                      className={cn(
                        "px-3 py-1.5 hover:bg-white/10 rounded-lg text-xs font-bold transition-all capitalize",
                        p === 'high' ? "text-red-400" : p === 'medium' ? "text-blue-400" : "text-stone-400"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleBulkDelete}
                className="p-2 hover:bg-red-500/20 text-red-400 rounded-xl transition-all"
                title="Delete Selected"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              <button 
                onClick={() => setSelectedIds(new Set())}
                className="p-2 hover:bg-white/10 text-stone-400 rounded-xl transition-all"
              >
                <RotateCcw className="w-5 h-5 transition-transform hover:rotate-180 duration-500" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isAdding && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[32px] p-10 shadow-2xl border border-stone-200 animate-in fade-in zoom-in duration-300">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black text-stone-900 tracking-tight">Create Task</h2>
                <p className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-1">New action item</p>
              </div>
              <button 
                onClick={() => setIsAdding(false)}
                className="p-3 bg-stone-50 text-stone-400 hover:text-stone-900 rounded-2xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between px-2 py-3 bg-stone-50 rounded-2xl border border-stone-100">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-stone-400" />
                  <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Entry Date</span>
                </div>
                <span className="text-xs font-bold text-stone-600">{format(new Date(), 'MMM dd, yyyy')}</span>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Task Details</label>
                <input 
                  type="text" 
                  placeholder="What needs to be done?"
                  value={newItem.title}
                  onChange={e => setNewItem({...newItem, title: e.target.value})}
                  className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-stone-200 transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <textarea 
                  placeholder="Add more context or details..."
                  value={newItem.description}
                  onChange={e => setNewItem({...newItem, description: e.target.value})}
                  className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-stone-200 transition-all resize-none font-medium h-32"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Priority</label>
                  <div className="flex bg-stone-50 p-1.5 rounded-2xl border border-stone-100">
                    {['low', 'medium', 'high'].map(p => (
                      <button
                        key={p}
                        onClick={() => setNewItem({...newItem, priority: p})}
                        className={cn(
                          "flex-1 py-1 px-3 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all",
                          newItem.priority === p 
                            ? "bg-stone-900 text-white shadow-sm" 
                            : "text-stone-400 hover:text-stone-600"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Due Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                    <input 
                      type="date" 
                      value={newItem.dueDate}
                      onChange={e => setNewItem({...newItem, dueDate: e.target.value})}
                      className="w-full p-3 pl-11 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-stone-200 transition-all text-sm font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Assign To</label>
                <div className="relative">
                  <select 
                    value={newItem.assignedTo}
                    onChange={e => setNewItem({...newItem, assignedTo: e.target.value})}
                    className="w-full p-4 pl-11 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-stone-200 transition-all text-sm font-bold appearance-none"
                  >
                    <option value="">No one assigned</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.name || s.email}</option>
                    ))}
                  </select>
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <div className="w-5 h-5 bg-stone-200 rounded-full flex items-center justify-center text-[10px] font-bold text-stone-600">
                      {newItem.assignedTo ? (staff.find(s => s.id === newItem.assignedTo)?.name?.[0] || staff.find(s => s.id === newItem.assignedTo)?.email?.[0] || '?') : '?'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Assigned To</label>
                  <select 
                    value={newItem.assignedTo}
                    onChange={e => setNewItem({...newItem, assignedTo: e.target.value})}
                    className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-stone-200 transition-all text-sm font-bold"
                  >
                    <option value="">Unassigned</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.name || s.email}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Recurrence</label>
                  <select 
                    value={newItem.recurrence}
                    onChange={e => setNewItem({...newItem, recurrence: e.target.value})}
                    className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-stone-200 transition-all text-sm font-bold"
                  >
                    <option value="none">One-time</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {newItem.recurrence !== 'none' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">End Recurrence</label>
                    <input 
                      type="date" 
                      value={newItem.recurrenceEndDate}
                      onChange={e => setNewItem({...newItem, recurrenceEndDate: e.target.value})}
                      className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-stone-200 transition-all text-sm font-bold"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Dependency (Parent Task)</label>
                <select 
                  value={newItem.parentId}
                  onChange={e => setNewItem({...newItem, parentId: e.target.value})}
                  className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-stone-200 transition-all text-sm font-bold"
                >
                  <option value="">No dependency</option>
                  {items.map(i => (
                    <option key={i.id} value={i.id}>{i.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-10 flex gap-4">
              <button 
                onClick={() => setIsAdding(false)} 
                className="flex-1 py-4 text-sm font-bold text-stone-400 hover:text-stone-900 hover:bg-stone-50 rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={addItem} 
                disabled={!newItem.title}
                className="flex-[2] py-4 bg-stone-900 text-white rounded-2xl font-bold text-sm shadow-xl shadow-stone-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
              >
                Initialize Task
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-[32px] overflow-hidden shadow-2xl border border-stone-200 animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col">
            <div className="px-8 py-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm border border-stone-200">
                  <CheckCircle2 className={cn("w-5 h-5", selectedTask.status === 'done' ? "text-emerald-500" : "text-stone-300")} />
                </div>
                <div>
                  <h2 className="text-sm font-black text-stone-900 uppercase tracking-widest">Task Details</h2>
                  <p className="text-[10px] text-stone-400 font-bold uppercase tracking-tight">Viewing detailed information</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isEditingTask ? (
                  <>
                    <button onClick={saveEditTask} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"><Save className="w-4 h-4" /> Save Changes</button>
                    <button onClick={() => setIsEditingTask(false)} className="p-2 hover:bg-stone-100 rounded-xl text-stone-400 transition-colors"><X className="w-5 h-5" /></button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => {
                        setEditTaskData({ ...selectedTask });
                        setIsEditingTask(true);
                      }} 
                      className="px-4 py-2 bg-white border border-stone-200 text-stone-600 rounded-xl text-xs font-bold hover:bg-stone-50 transition-all shadow-sm"
                    >
                      Edit Info
                    </button>
                    <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-stone-100 rounded-xl text-stone-400 transition-colors"><X className="w-5 h-5" /></button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 lg:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Task Name</label>
                    {isEditingTask ? (
                      <input 
                        type="text" 
                        value={editTaskData?.title || ''}
                        onChange={e => setEditTaskData({...editTaskData, title: e.target.value})}
                        className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-stone-200 transition-all font-bold text-lg"
                      />
                    ) : (
                      <h3 className="text-2xl font-black text-stone-900 leading-tight">{selectedTask.title}</h3>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Context & Details</label>
                    {isEditingTask ? (
                      <textarea 
                        value={editTaskData?.description || ''}
                        onChange={e => setEditTaskData({...editTaskData, description: e.target.value})}
                        className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-stone-200 transition-all resize-none min-h-[200px] text-sm font-medium leading-relaxed"
                      />
                    ) : (
                      <p className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                        {selectedTask.description || 'No description provided for this task.'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-stone-50/50 rounded-3xl p-6 border border-stone-100 space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Metadata</label>
                      <div className="bg-white border border-stone-100 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tight">
                          <span className="text-stone-400">Created:</span>
                          <span className="text-stone-600">{format(new Date(selectedTask.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                        </div>
                        {selectedTask.updatedAt && (
                          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tight">
                            <span className="text-stone-400">Updated:</span>
                            <span className="text-stone-600">{format(new Date(selectedTask.updatedAt), 'MMM dd, yyyy HH:mm')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Assignment</label>
                      {isEditingTask ? (
                        <select 
                          value={editTaskData?.assignedTo || ''}
                          onChange={e => setEditTaskData({...editTaskData, assignedTo: e.target.value})}
                          className="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none text-xs font-bold"
                        >
                          <option value="">No one assigned</option>
                          {staff.map(s => (
                            <option key={s.id} value={s.id}>{s.name || s.email}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white border border-stone-200 rounded-full flex items-center justify-center text-xs font-black text-stone-600 shadow-sm">
                            {selectedTask.assignedTo ? (staff.find(s => s.id === selectedTask.assignedTo)?.name?.[0] || staff.find(s => s.id === selectedTask.assignedTo)?.email?.[0] || '?') : '?'}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-stone-900">
                              {selectedTask.assignedTo 
                                ? staff.find(s => s.id === selectedTask.assignedTo)?.name || staff.find(s => s.id === selectedTask.assignedTo)?.email || 'Unknown User'
                                : 'Unassigned'}
                            </p>
                            <p className="text-[10px] text-stone-400 font-medium">Responsible Staff</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Priority</label>
                      {isEditingTask ? (
                        <select 
                          value={editTaskData?.priority || 'medium'}
                          onChange={e => setEditTaskData({...editTaskData, priority: e.target.value})}
                          className="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none text-xs font-bold"
                        >
                          <option value="low">Low Priority</option>
                          <option value="medium">Medium Priority</option>
                          <option value="high">High Priority</option>
                        </select>
                      ) : (
                        <div className={cn(
                          "inline-flex px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                          selectedTask.priority === 'high' ? "bg-red-50 text-red-600" :
                          selectedTask.priority === 'medium' ? "bg-blue-50 text-blue-600" : "bg-stone-200 text-stone-600"
                        )}>
                          {selectedTask.priority}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Status</label>
                      {isEditingTask ? (
                        <select 
                          value={editTaskData?.status || 'todo'}
                          onChange={e => setEditTaskData({...editTaskData, status: e.target.value})}
                          className="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none text-xs font-bold"
                        >
                          <option value="todo">To Do</option>
                          <option value="in-progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                      ) : (
                        <div className="inline-flex px-3 py-1 bg-stone-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest">
                          {selectedTask.status.replace('-', ' ')}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Target Date</label>
                      {isEditingTask ? (
                        <input 
                          type="date" 
                          value={editTaskData?.dueDate || ''}
                          onChange={e => setEditTaskData({...editTaskData, dueDate: e.target.value})}
                          className="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none text-xs font-bold"
                        />
                      ) : (
                        <div className="flex items-center gap-2 text-stone-900 text-sm font-bold">
                          <Calendar className="w-4 h-4 text-stone-400" />
                          {selectedTask.dueDate ? format(new Date(selectedTask.dueDate), 'MMM dd, yyyy') : 'No target set'}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Dependency</label>
                      {isEditingTask ? (
                        <select 
                          value={editTaskData?.parentId || ''}
                          onChange={e => setEditTaskData({...editTaskData, parentId: e.target.value})}
                          className="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none text-xs font-bold"
                        >
                          <option value="">No dependency</option>
                          {items.filter(i => i.id !== selectedTask.id).map(i => (
                            <option key={i.id} value={i.id}>{i.title}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-2 text-stone-900 text-sm font-bold">
                          <AlertCircle className="w-4 h-4 text-stone-400" />
                          {selectedTask.parentId 
                            ? items.find(i => i.id === selectedTask.parentId)?.title || 'Unknown Task'
                            : 'Standalone Task'}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Recurrence</label>
                      {isEditingTask ? (
                        <div className="space-y-3">
                          <select 
                            value={editTaskData?.recurrence || 'none'}
                            onChange={e => setEditTaskData({...editTaskData, recurrence: e.target.value})}
                            className="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none text-xs font-bold"
                          >
                            <option value="none">One-time</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                          </select>
                          {editTaskData?.recurrence !== 'none' && (
                            <input 
                              type="date" 
                              value={editTaskData.recurrenceEndDate || ''}
                              onChange={e => setEditTaskData({...editTaskData, recurrenceEndDate: e.target.value})}
                              className="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none text-xs font-bold"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-stone-900 text-sm font-bold capitalize">
                            <RotateCcw className="w-4 h-4 text-stone-400" />
                            {selectedTask.recurrence || 'One-time'}
                          </div>
                          {selectedTask.recurrence !== 'none' && selectedTask.recurrenceEndDate && (
                            <span className="text-[10px] text-stone-400 font-bold ml-6">Until {format(new Date(selectedTask.recurrenceEndDate), 'MMM dd, yyyy')}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 pt-4 border-t border-stone-100">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Attachments</label>
                        {!isEditingTask && (
                          <label className="cursor-pointer p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-900 transition-all">
                            <Paperclip className="w-4 h-4" />
                            <input type="file" className="hidden" onChange={handleFileUpload} />
                          </label>
                        )}
                      </div>
                      <div className="space-y-2">
                        {(!selectedTask.attachments || selectedTask.attachments.length === 0) && (
                          <div className="text-[10px] text-stone-300 font-bold italic ml-1">No files attached.</div>
                        )}
                        {(selectedTask.attachments || []).map((file: any) => (
                          <div key={file.id} className="flex items-center gap-3 p-3 bg-white border border-stone-100 rounded-xl group/file shadow-sm">
                            <div className="w-8 h-8 bg-stone-50 rounded-lg flex items-center justify-center">
                              <FileText className="w-4 h-4 text-stone-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-stone-900 truncate">{file.name}</p>
                              <p className="text-[8px] font-bold text-stone-400 uppercase">{file.size} • {file.type.split('/')[1] || 'FILE'}</p>
                            </div>
                            <button className="p-1.5 hover:bg-stone-50 text-stone-300 hover:text-stone-900 rounded-lg transition-all">
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            {!isEditingTask && (
                              <button 
                                onClick={() => removeAttachment(file.id)}
                                className="p-1.5 hover:bg-red-50 text-stone-300 hover:text-red-500 rounded-lg transition-all opacity-0 group-hover/file:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-10">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-stone-900">Sub-tasks</h3>
                      <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                        {subtasks.filter(s => s.done).length}/{subtasks.length} Completed
                      </span>
                    </div>
                    <div className="space-y-3">
                      {subtasks.map(st => (
                        <div key={st.id} className="flex items-center gap-3 p-4 bg-stone-50 rounded-2xl border border-stone-100 group/sub">
                          <button 
                            onClick={() => toggleSubtask(st.id, st.done)}
                            className={cn(
                              "w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
                              st.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-stone-200 bg-white"
                            )}
                          >
                            {st.done && <Check className="w-3 h-3" />}
                          </button>
                          <span className={cn("text-xs font-bold", st.done ? "text-stone-400 line-through" : "text-stone-700")}>
                            {st.title}
                          </span>
                          <button 
                            onClick={() => deleteDoc(doc(db, 'actionItems', selectedTask.id, 'subtasks', st.id))}
                            className="ml-auto opacity-0 group-hover/sub:opacity-100 p-1 hover:bg-red-50 text-red-400 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Add a next step..."
                          value={newSubtaskTitle}
                          onChange={e => setNewSubtaskTitle(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addSubtask()}
                          className="flex-1 bg-stone-50 border border-stone-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-1 focus:ring-stone-200"
                        />
                        <button 
                          onClick={addSubtask}
                          className="px-6 py-3 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-stone-900">Collaboration & Comments</h3>
                    <div className="space-y-6">
                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-stone-200">
                        {comments.length === 0 && (
                          <div className="text-center py-8">
                            <Users className="w-8 h-8 text-stone-200 mx-auto mb-2" />
                            <p className="text-xs text-stone-400 font-bold italic">No comments yet. Start the conversation!</p>
                          </div>
                        )}
                        {comments.map(c => (
                          <div key={c.id} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-stone-900 uppercase tracking-widest">{c.userName}</span>
                              <span className="text-[9px] text-stone-400 font-bold">{format(new Date(c.createdAt), 'MMM dd, HH:mm')}</span>
                            </div>
                            <div className="p-4 bg-stone-50 rounded-[24px] border border-stone-100 text-xs font-medium text-stone-600 leading-relaxed shadow-sm">
                              {c.text}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-3">
                        <textarea 
                          placeholder="Add your thoughts or updates..."
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                          className="w-full bg-stone-50 border border-stone-100 rounded-[24px] px-5 py-4 text-xs font-medium outline-none focus:ring-2 focus:ring-stone-200 resize-none h-24"
                        />
                        <button 
                          onClick={addComment}
                          disabled={!newComment}
                          className="w-full py-4 bg-stone-900 text-white rounded-2xl text-xs font-bold hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/10 disabled:opacity-50"
                        >
                          Post Update
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {!isEditingTask && (
                <div className="mt-12 pt-8 border-t border-stone-100 flex flex-wrap gap-4">
                  {selectedTask.status === 'todo' && (
                    <button 
                      onClick={() => {
                        updateStatus(selectedTask.id, 'in-progress');
                        setSelectedTask({...selectedTask, status: 'in-progress'});
                      }}
                      className="flex-1 min-w-[200px] py-4 bg-white border border-stone-200 text-stone-900 rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-stone-50 hover:border-stone-400 transition-all shadow-sm active:scale-95"
                    >
                      <Clock className="w-5 h-5 text-blue-500" /> Start Processing
                    </button>
                  )}
                  {selectedTask.status !== 'done' && (
                    <button 
                      onClick={() => {
                        updateStatus(selectedTask.id, 'done');
                        setSelectedTask({...selectedTask, status: 'done'});
                      }}
                      className="flex-1 min-w-[200px] py-4 bg-stone-900 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-stone-800 transition-all shadow-xl shadow-stone-900/20 active:scale-95"
                    >
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Mark Completed
                    </button>
                  )}
                  {selectedTask.status === 'done' && (
                    <div className="flex-1 py-4 bg-emerald-50 text-emerald-700 rounded-2xl font-black text-sm flex items-center justify-center gap-3 border border-emerald-100">
                      <CheckCircle2 className="w-5 h-5" /> Task Finished
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
