import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Plus, MoreVertical, Clock, AlertCircle, CheckCircle2, Trash2, Calendar, X, Save, ArrowUpDown, Filter } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'bg-stone-100' },
  { id: 'in-progress', label: 'In Progress', color: 'bg-blue-50' },
  { id: 'done', label: 'Done', color: 'bg-emerald-50' }
];

export default function ActionBoard({ user, business }: { user: any, business: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', description: '', priority: 'medium', dueDate: '', assignedTo: '' });
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'dueDate'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editTaskData, setEditTaskData] = useState<any>(null);

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

  const updateStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, 'actionItems', id), { status });
  };

  const addItem = async () => {
    if (!newItem.title) return;
    await addDoc(collection(db, 'actionItems'), {
      ...newItem,
      businessId: business.id,
      ownerUid: user.uid,
      status: 'todo',
      createdAt: new Date().toISOString()
    });
    setNewItem({ title: '', description: '', priority: 'medium', dueDate: '', assignedTo: '' });
    setIsAdding(false);
  };

  const saveEditTask = async () => {
    if (!selectedTask || !editTaskData) return;
    await updateDoc(doc(db, 'actionItems', selectedTask.id), {
      title: editTaskData.title,
      description: editTaskData.description,
      priority: editTaskData.priority,
      status: editTaskData.status,
      dueDate: editTaskData.dueDate,
      assignedTo: editTaskData.assignedTo || null
    });
    setSelectedTask({ ...selectedTask, ...editTaskData });
    setIsEditingTask(false);
  };

  const filteredItems = items
    .filter(item => {
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const dateA = a[sortBy] ? new Date(a[sortBy]).getTime() : 0;
      const dateB = b[sortBy] ? new Date(b[sortBy]).getTime() : 0;
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

  return (
    <div className="space-y-8">
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

            {(priorityFilter !== 'all' || statusFilter !== 'all' || sortBy !== 'createdAt' || sortOrder !== 'desc') && (
              <button 
                onClick={() => {
                  setPriorityFilter('all');
                  setStatusFilter('all');
                  setSortBy('createdAt');
                  setSortOrder('desc');
                }}
                className="text-[10px] font-bold text-stone-400 uppercase tracking-widest hover:text-stone-900 transition-colors px-2"
              >
                Clear Filters
              </button>
            )}
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="px-6 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-bold hover:bg-stone-800 shadow-xl shadow-stone-900/10 transition-all flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4" /> New Task
          </button>
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
              {filteredItems.filter(i => i.status === col.id).map(item => (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedTask(item)}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200/50 group cursor-pointer hover:border-stone-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                      item.priority === 'high' ? "bg-red-50 text-red-600" :
                      item.priority === 'medium' ? "bg-blue-50 text-blue-600" : "bg-stone-50 text-stone-500"
                    )}>
                      {item.priority}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      {col.id !== 'todo' && <button onClick={() => updateStatus(item.id, 'todo')} className="p-1 hover:bg-stone-50 rounded"><Clock className="w-3 h-3 text-stone-400" /></button>}
                      {col.id !== 'in-progress' && <button onClick={() => updateStatus(item.id, 'in-progress')} className="p-1 hover:bg-stone-50 rounded"><AlertCircle className="w-3 h-3 text-stone-400" /></button>}
                      {col.id !== 'done' && <button onClick={() => updateStatus(item.id, 'done')} className="p-1 hover:bg-stone-50 rounded"><CheckCircle2 className="w-3 h-3 text-stone-400" /></button>}
                      <button onClick={() => deleteDoc(doc(db, 'actionItems', item.id))} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3 text-red-400" /></button>
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-stone-900 mb-1">{item.title}</h4>
                  <p className="text-xs text-stone-500 line-clamp-2 mb-4">{item.description}</p>
                  
                  {item.assignedTo && (
                    <div className="flex items-center gap-1.5 mb-3 border border-stone-100 bg-stone-50 w-fit px-2 py-1 rounded-lg">
                      <div className="w-4 h-4 bg-stone-200 rounded-full flex items-center justify-center text-[8px] font-bold text-stone-600">
                        {staff.find(s => s.id === item.assignedTo)?.name?.charAt(0) || staff.find(s => s.id === item.assignedTo)?.email?.charAt(0) || '?'}
                      </div>
                      <span className="text-[10px] font-medium text-stone-600">
                        {staff.find(s => s.id === item.assignedTo)?.name || staff.find(s => s.id === item.assignedTo)?.email?.split('@')[0] || 'Unknown'}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-stone-400 font-medium">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(item.createdAt), 'MMM dd, yyyy')}
                    </div>
                    {item.dueDate && (
                      <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                        <Clock className="w-3 h-3" />
                        Due: {format(new Date(item.dueDate), 'MMM dd')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

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
