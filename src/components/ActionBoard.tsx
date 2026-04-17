import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Plus, MoreVertical, Clock, AlertCircle, CheckCircle2, Trash2, Calendar, X, Save } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'bg-stone-100' },
  { id: 'in-progress', label: 'In Progress', color: 'bg-blue-50' },
  { id: 'done', label: 'Done', color: 'bg-emerald-50' }
];

export default function ActionBoard({ user, business }: { user: any, business: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', description: '', priority: 'medium', dueDate: '' });
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editTaskData, setEditTaskData] = useState<any>(null);

  useEffect(() => {
    if (!business) return;
    const q = query(collection(db, 'actionItems'), where('businessId', '==', business.id));
    const unsubscribe = onSnapshot(q, (s) => {
      setItems(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
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
    setNewItem({ title: '', description: '', priority: 'medium', dueDate: '' });
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
      assignee: editTaskData.assignee
    });
    setSelectedTask({ ...selectedTask, ...editTaskData });
    setIsEditingTask(false);
  };

  const filteredItems = items.filter(item => {
    if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Action Items</h1>
          <p className="text-stone-500">Close the feedback loop with actionable tasks.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-stone-50 border-none rounded-xl py-2 px-3 text-sm font-bold text-stone-600 outline-none"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-stone-50 border-none rounded-xl py-2 px-3 text-sm font-bold text-stone-600 outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="todo">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Task
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
        <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl border border-stone-200">
            <h2 className="text-xl font-bold mb-6">Add Action Item</h2>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Task Title"
                value={newItem.title}
                onChange={e => setNewItem({...newItem, title: e.target.value})}
                className="w-full p-4 bg-stone-50 rounded-2xl outline-none"
              />
              <textarea 
                placeholder="Description"
                value={newItem.description}
                onChange={e => setNewItem({...newItem, description: e.target.value})}
                className="w-full p-4 bg-stone-50 rounded-2xl outline-none resize-none"
                rows={3}
              />
              <div className="flex gap-2">
                {['low', 'medium', 'high'].map(p => (
                  <button
                    key={p}
                    onClick={() => setNewItem({...newItem, priority: p})}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-xs font-bold capitalize border-2 transition-all",
                      newItem.priority === p ? "border-stone-900 bg-stone-50" : "border-stone-100"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Due Date</label>
                <input 
                  type="date" 
                  value={newItem.dueDate}
                  onChange={e => setNewItem({...newItem, dueDate: e.target.value})}
                  className="w-full p-4 bg-stone-50 rounded-2xl outline-none"
                />
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button onClick={() => setIsAdding(false)} className="flex-1 py-3 text-sm font-bold text-stone-500 hover:bg-stone-50 rounded-xl">Cancel</button>
              <button onClick={addItem} className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-bold text-sm">Create Task</button>
            </div>
          </div>
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[32px] p-8 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Task Details</h2>
              <div className="flex items-center gap-2">
                {isEditingTask ? (
                  <>
                    <button onClick={saveEditTask} className="p-2 hover:bg-stone-50 rounded-xl text-stone-400 hover:text-emerald-600"><Save className="w-5 h-5" /></button>
                    <button onClick={() => setIsEditingTask(false)} className="p-2 hover:bg-stone-50 rounded-xl text-stone-400 hover:text-red-600"><X className="w-5 h-5" /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => {
                      setEditTaskData({ ...selectedTask });
                      setIsEditingTask(true);
                    }} className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-sm font-bold hover:bg-stone-200">Edit Task</button>
                    <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-stone-50 rounded-xl text-stone-400"><X className="w-5 h-5" /></button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Title</label>
                {isEditingTask ? (
                  <input 
                    type="text" 
                    value={editTaskData?.title || ''}
                    onChange={e => setEditTaskData({...editTaskData, title: e.target.value})}
                    className="w-full p-3 bg-stone-50 rounded-xl outline-none"
                  />
                ) : (
                  <p className="text-stone-900 font-medium">{selectedTask.title}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">Description</label>
                {isEditingTask ? (
                  <textarea 
                    value={editTaskData?.description || ''}
                    onChange={e => setEditTaskData({...editTaskData, description: e.target.value})}
                    className="w-full p-3 bg-stone-50 rounded-xl outline-none resize-none min-h-[100px]"
                  />
                ) : (
                  <p className="text-stone-600">{selectedTask.description || 'No description provided.'}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1">Priority</label>
                  {isEditingTask ? (
                    <select 
                      value={editTaskData?.priority || 'medium'}
                      onChange={e => setEditTaskData({...editTaskData, priority: e.target.value})}
                      className="w-full p-3 bg-stone-50 rounded-xl outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  ) : (
                    <div className={cn(
                      "inline-block px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider",
                      selectedTask.priority === 'high' ? "bg-red-50 text-red-600" :
                      selectedTask.priority === 'medium' ? "bg-blue-50 text-blue-600" : "bg-stone-50 text-stone-500"
                    )}>
                      {selectedTask.priority}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1">Status</label>
                  {isEditingTask ? (
                    <select 
                      value={editTaskData?.status || 'todo'}
                      onChange={e => setEditTaskData({...editTaskData, status: e.target.value})}
                      className="w-full p-3 bg-stone-50 rounded-xl outline-none"
                    >
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  ) : (
                    <div className="inline-block px-3 py-1 bg-stone-100 text-stone-600 rounded-lg text-xs font-bold uppercase tracking-wider">
                      {selectedTask.status}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1">Due Date</label>
                  {isEditingTask ? (
                    <input 
                      type="date" 
                      value={editTaskData?.dueDate || ''}
                      onChange={e => setEditTaskData({...editTaskData, dueDate: e.target.value})}
                      className="w-full p-3 bg-stone-50 rounded-xl outline-none"
                    />
                  ) : (
                    <p className="text-stone-900">{selectedTask.dueDate ? format(new Date(selectedTask.dueDate), 'MMM dd, yyyy') : 'No due date'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1">Assignee</label>
                  {isEditingTask ? (
                    <input 
                      type="text" 
                      placeholder="Assignee Name"
                      value={editTaskData?.assignee || ''}
                      onChange={e => setEditTaskData({...editTaskData, assignee: e.target.value})}
                      className="w-full p-3 bg-stone-50 rounded-xl outline-none"
                    />
                  ) : (
                    <p className="text-stone-900">{selectedTask.assignee || 'Unassigned'}</p>
                  )}
                </div>
              </div>

              {!isEditingTask && (
                <div className="pt-6 border-t border-stone-100 flex gap-3">
                  {selectedTask.status === 'todo' && (
                    <button 
                      onClick={() => {
                        updateStatus(selectedTask.id, 'in-progress');
                        setSelectedTask({...selectedTask, status: 'in-progress'});
                      }}
                      className="flex-1 py-4 bg-white border border-stone-200 text-stone-900 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-50 transition-all"
                    >
                      <Clock className="w-5 h-5" /> Start Processing
                    </button>
                  )}
                  {selectedTask.status !== 'done' && (
                    <button 
                      onClick={() => {
                        updateStatus(selectedTask.id, 'done');
                        setSelectedTask({...selectedTask, status: 'done'});
                      }}
                      className="flex-1 py-4 bg-stone-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all"
                    >
                      <CheckCircle2 className="w-5 h-5" /> Mark Completed
                    </button>
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
