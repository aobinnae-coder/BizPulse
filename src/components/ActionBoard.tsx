import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy, getDocs } from 'firebase/firestore';
import { Plus, MoreVertical, Clock, AlertCircle, CheckCircle2, Trash2, Calendar, X, Save, ArrowUpDown, Filter, Check, RotateCcw, Users, Paperclip, FileText, Download, GitBranch, Edit, Edit3 } from 'lucide-react';
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
  const [sortBy, setSortBy] = useState<'createdAt' | 'dueDate' | 'priority' | 'status'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editTaskData, setEditTaskData] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [staffFilter, setStaffFilter] = useState('all');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'calendar'>('board');
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'month' | 'week'>('month');

  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [timeLogs, setTimeLogs] = useState<any[]>([]);
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'subtasks' | 'comments' | 'activity' | 'time'>('details');
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [editingSubtask, setEditingSubtask] = useState<string | null>(null);
  const [subtaskSortBy, setSubtaskSortBy] = useState<'createdAt' | 'dueDate' | 'done'>('createdAt');
  const [subtaskSortOrder, setSubtaskSortOrder] = useState<'asc' | 'desc'>('asc');
  const [subtaskFilter, setSubtaskFilter] = useState<'all' | 'pending' | 'done'>('all');

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

    const templatesQuery = query(collection(db, 'taskTemplates'), where('businessId', '==', business.id));
    const templatesUnsub = onSnapshot(templatesQuery, (s) => {
      setTemplates(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubscribe();
      staffUnsub();
      templatesUnsub();
    };
  }, [business]);

  useEffect(() => {
    if (selectedTask) {
      const qComments = query(collection(db, 'actionItems', selectedTask.id, 'comments'), orderBy('createdAt', 'desc'));
      const unsubComments = onSnapshot(qComments, (s) => setComments(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      
      const qSubtasks = query(collection(db, 'actionItems', selectedTask.id, 'subtasks'), orderBy('createdAt', 'asc'));
      const unsubSubtasks = onSnapshot(qSubtasks, (s) => setSubtasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));

      const qActivity = query(collection(db, 'actionItems', selectedTask.id, 'activity'), orderBy('createdAt', 'desc'));
      const unsubActivity = onSnapshot(qActivity, (s) => setActivity(s.docs.map(d => ({ id: d.id, ...d.data() }))));

      const qTimeLogs = query(collection(db, 'actionItems', selectedTask.id, 'timeLogs'), orderBy('createdAt', 'desc'));
      const unsubTimeLogs = onSnapshot(qTimeLogs, (s) => setTimeLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));

      // Check for active timer
      const qActiveTimer = query(
        collection(db, 'actionItems', selectedTask.id, 'timeLogs'), 
        where('endTime', '==', null),
        where('userId', '==', user.uid)
      );
      const unsubActiveTimer = onSnapshot(qActiveTimer, (s) => {
        if (!s.empty) {
          setActiveTimer({ id: s.docs[0].id, ...s.docs[0].data() });
        } else {
          setActiveTimer(null);
        }
      });

      return () => {
        unsubComments();
        unsubSubtasks();
        unsubActivity();
        unsubTimeLogs();
        unsubActiveTimer();
      };
    }
  }, [selectedTask]);

  const logActivity = async (taskId: string, type: string, details: string) => {
    await addDoc(collection(db, 'actionItems', taskId, 'activity'), {
      type,
      details,
      userId: user.uid,
      userName: user.displayName || user.email,
      createdAt: new Date().toISOString()
    });
  };

  const handleStatusChange = async (id: string, status: string) => {
    const task = items.find(i => i.id === id);
    if (!task) return { success: false, message: 'Task not found' };

    // Dependency Check
    if (status === 'in-progress' || status === 'done') {
      if (task.parentId) {
        const parent = items.find(i => i.id === task.parentId);
        if (parent && parent.status !== 'done') {
          return { success: false, message: `Dependency Alert: "${parent.title}" must be completed before you can start or finish this task.` };
        }
      }
    }

    await updateDoc(doc(db, 'actionItems', id), { 
      status,
      updatedAt: new Date().toISOString()
    });

    await logActivity(id, 'status_change', `Status changed to ${status}`);

    // Handle Recurrence
    if (status === 'done' && task.recurrence && task.recurrence !== 'none') {
      const nextDate = new Date(task.dueDate || new Date());
      if (task.recurrence === 'daily') {
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (task.recurrence === 'weekly') {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (task.recurrence === 'monthly') {
        const day = nextDate.getDate();
        nextDate.setMonth(nextDate.getMonth() + 1);
        if (nextDate.getDate() !== day) nextDate.setDate(0);
      }

      const recurrenceEndDate = task.recurrenceEndDate ? new Date(task.recurrenceEndDate) : null;
      if (!recurrenceEndDate || nextDate <= recurrenceEndDate) {
        const nextDateStr = nextDate.toISOString().split('T')[0];
        const existingNext = items.find(i => i.title === task.title && i.dueDate === nextDateStr && i.status !== 'done');
        
        if (!existingNext) {
          const { id: oldId, ...taskData } = task;
          const newDoc = await addDoc(collection(db, 'actionItems'), {
            ...taskData,
            status: 'todo',
            dueDate: nextDateStr,
            subtasksDone: 0,
            createdAt: new Date().toISOString(),
            updatedAt: null
          });

          // Clone Subtasks
          const qSub = query(collection(db, 'actionItems', task.id, 'subtasks'));
          const subSnap = await getDocs(qSub);
          for (const subDoc of subSnap.docs) {
            const sd = subDoc.data();
            await addDoc(collection(db, 'actionItems', newDoc.id, 'subtasks'), {
              title: sd.title,
              done: false,
              dueDate: sd.dueDate || '',
              attachments: sd.attachments || [],
              createdAt: new Date().toISOString()
            });
          }
        }
      }
    }
    return { success: true };
  };

  const updateStatus = async (id: string, status: string) => {
    const result = await handleStatusChange(id, status);
    if (!result.success && result.message) {
      alert(result.message);
      return false;
    }
    return true;
  };

  const addComment = async () => {
    if (!newComment || !selectedTask) return;
    await addDoc(collection(db, 'actionItems', selectedTask.id, 'comments'), {
      text: newComment,
      userId: user.uid,
      userName: user.displayName || user.email,
      createdAt: new Date().toISOString()
    });
    await logActivity(selectedTask.id, 'comment', `Added a comment: "${newComment.substring(0, 50)}${newComment.length > 50 ? '...' : ''}"`);
    setNewComment('');
  };

  const addSubtask = async () => {
    if (!newSubtaskTitle || !selectedTask) return;
    await addDoc(collection(db, 'actionItems', selectedTask.id, 'subtasks'), {
      title: newSubtaskTitle,
      done: false,
      dueDate: '',
      parentId: '',
      attachments: [],
      createdAt: new Date().toISOString()
    });
    await logActivity(selectedTask.id, 'subtask_create', `Created subtask: "${newSubtaskTitle}"`);
    
    // Update denormalized counts
    const taskRef = doc(db, 'actionItems', selectedTask.id);
    await updateDoc(taskRef, {
      subtasksTotal: (selectedTask.subtasksTotal || 0) + 1
    });
    setSelectedTask({ ...selectedTask, subtasksTotal: (selectedTask.subtasksTotal || 0) + 1 });
    
    setNewSubtaskTitle('');
  };

  const toggleSubtask = async (subtaskId: string, currentStatus: boolean) => {
    const subtask = subtasks.find(s => s.id === subtaskId);
    
    // Dependency Check
    if (!currentStatus && subtask?.parentId) {
      const parentSub = subtasks.find(s => s.id === subtask.parentId);
      if (parentSub && !parentSub.done) {
        alert(`Blocked: Please complete "${parentSub.title}" first.`);
        return;
      }
    }

    await updateDoc(doc(db, 'actionItems', selectedTask.id, 'subtasks', subtaskId), {
      done: !currentStatus
    });

    await logActivity(selectedTask.id, 'subtask_toggle', `Marked subtask "${subtask?.title}" as ${!currentStatus ? 'done' : 'not done'}`);

    // Update denormalized counts
    const taskRef = doc(db, 'actionItems', selectedTask.id);
    const newDone = currentStatus ? (selectedTask.subtasksDone || 0) - 1 : (selectedTask.subtasksDone || 0) + 1;
    await updateDoc(taskRef, {
      subtasksDone: Math.max(0, newDone)
    });
    setSelectedTask({ ...selectedTask, subtasksDone: Math.max(0, newDone) });
  };

  const deleteSubtask = async (subtaskId: string, wasDone: boolean) => {
    await deleteDoc(doc(db, 'actionItems', selectedTask.id, 'subtasks', subtaskId));
    
    // Update denormalized counts
    const taskRef = doc(db, 'actionItems', selectedTask.id);
    await updateDoc(taskRef, {
      subtasksTotal: Math.max(0, (selectedTask.subtasksTotal || 0) - 1),
      subtasksDone: Math.max(0, wasDone ? (selectedTask.subtasksDone || 0) - 1 : (selectedTask.subtasksDone || 0))
    });
    setSelectedTask({ 
      ...selectedTask, 
      subtasksTotal: Math.max(0, (selectedTask.subtasksTotal || 0) - 1),
      subtasksDone: Math.max(0, wasDone ? (selectedTask.subtasksDone || 0) - 1 : (selectedTask.subtasksDone || 0))
    });
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task? All sub-tasks and comments will also be removed.')) return;
    
    // 1. Delete comments sub-collection
    const qComments = query(collection(db, 'actionItems', taskId, 'comments'));
    const commentsSnap = await getDocs(qComments);
    const commentDeletes = commentsSnap.docs.map(d => deleteDoc(d.ref));
    
    // 2. Delete subtasks sub-collection
    const qSubtasks = query(collection(db, 'actionItems', taskId, 'subtasks'));
    const subtasksSnap = await getDocs(qSubtasks);
    const subtaskDeletes = subtasksSnap.docs.map(d => deleteDoc(d.ref));
    
    await Promise.all([...commentDeletes, ...subtaskDeletes]);
    
    // 3. Delete parent task
    await deleteDoc(doc(db, 'actionItems', taskId));
    
    if (selectedTask?.id === taskId) {
      setSelectedTask(null);
    }
    
    // Remove from selectedIds if present
    const newSelected = new Set(selectedIds);
    newSelected.delete(taskId);
    setSelectedIds(newSelected);
  };

  const handleSubtaskFileUpload = async (subtaskId: string) => {
    if (!selectedTask) return;
    
    const url = prompt("Please enter the file URL for this sub-task:");
    if (!url) return;
    
    const name = prompt("Enter a name for this sub-task attachment:", "Sub-task resource");
    if (!name) return;

    const newAttachment = {
      id: Math.random().toString(36).substring(7),
      name,
      url,
      type: 'link',
      size: 'Remote',
      createdAt: new Date().toISOString()
    };

    const subtask = subtasks.find(s => s.id === subtaskId);
    const updatedAttachments = [...(subtask?.attachments || []), newAttachment];
    
    await updateDoc(doc(db, 'actionItems', selectedTask.id, 'subtasks', subtaskId), { 
      attachments: updatedAttachments 
    });
  };

  const removeSubtaskAttachment = async (subtaskId: string, attachmentId: string) => {
    if (!selectedTask) return;
    const subtask = subtasks.find(s => s.id === subtaskId);
    const updatedAttachments = (subtask?.attachments || []).filter((a: any) => a.id !== attachmentId);
    
    await updateDoc(doc(db, 'actionItems', selectedTask.id, 'subtasks', subtaskId), { 
      attachments: updatedAttachments 
    });
  };

  const updateSubtaskField = async (subtaskId: string, field: string, value: any) => {
    await updateDoc(doc(db, 'actionItems', selectedTask.id, 'subtasks', subtaskId), {
      [field]: value
    });
  };

  const editSubtaskAttachment = async (subtaskId: string, attachmentId: string) => {
    if (!selectedTask) return;
    const subtask = subtasks.find(s => s.id === subtaskId);
    const attachment = (subtask?.attachments || []).find((a: any) => a.id === attachmentId);
    if (!attachment) return;

    const newUrl = prompt("Edit file URL:", attachment.url);
    if (newUrl === null) return;
    
    const newName = prompt("Edit attachment name:", attachment.name);
    if (newName === null) return;

    const updatedAttachments = (subtask?.attachments || []).map((a: any) => 
      a.id === attachmentId ? { ...a, url: newUrl, name: newName } : a
    );
    
    await updateDoc(doc(db, 'actionItems', selectedTask.id, 'subtasks', subtaskId), { 
      attachments: updatedAttachments 
    });
  };

  const filteredSubtasks = subtasks.filter(st => {
    if (subtaskFilter === 'pending') return !st.done;
    if (subtaskFilter === 'done') return st.done;
    return true;
  });

  const sortedSubtasks = [...filteredSubtasks].sort((a, b) => {
    if (subtaskSortBy === 'done') {
      const valA = a.done ? 1 : 0;
      const valB = b.done ? 1 : 0;
      return subtaskSortOrder === 'asc' ? valA - valB : valB - valA;
    }
    const valA = a[subtaskSortBy] || '';
    const valB = b[subtaskSortBy] || '';
    return subtaskSortOrder === 'asc' 
      ? valA.toString().localeCompare(valB.toString()) 
      : valB.toString().localeCompare(valA.toString());
  });

  const addItem = async () => {
    if (!newItem.title) return;
    const docRef = await addDoc(collection(db, 'actionItems'), {
      ...newItem,
      businessId: business.id,
      ownerUid: user.uid,
      status: 'todo',
      attachments: [],
      createdAt: new Date().toISOString()
    });

    const pendingSubtasks = (window as any)._pendingTemplateSubtasks;
    if (pendingSubtasks && Array.isArray(pendingSubtasks)) {
      for (const st of pendingSubtasks) {
        let subtaskDueDate = '';
        if (st.dueDateOffset !== null && newItem.dueDate) {
          const d = new Date(newItem.dueDate);
          d.setDate(d.getDate() + st.dueDateOffset);
          subtaskDueDate = d.toISOString().split('T')[0];
        }
        await addDoc(collection(db, 'actionItems', docRef.id, 'subtasks'), {
          title: st.title,
          done: false,
          dueDate: subtaskDueDate,
          parentId: '',
          attachments: [],
          createdAt: new Date().toISOString()
        });
      }
      delete (window as any)._pendingTemplateSubtasks;
      
      // Update counts
      await updateDoc(docRef, {
        subtasksTotal: pendingSubtasks.length,
        subtasksDone: 0
      });
    }

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

  const handleFileUpload = async () => {
    if (!selectedTask) return;
    
    const url = prompt("Please enter the file URL (e.g., a link from Google Drive or Dropbox):");
    if (!url) return;
    
    const name = prompt("Enter a name for this attachment:", "Resource link");
    if (!name) return;

    const newAttachment = {
      id: Math.random().toString(36).substring(7),
      name,
      url,
      type: 'link',
      size: 'Remote',
      createdAt: new Date().toISOString()
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

  const editAttachment = async (attachmentId: string) => {
    if (!selectedTask) return;
    const attachment = (selectedTask.attachments || []).find((a: any) => a.id === attachmentId);
    if (!attachment) return;

    const newUrl = prompt("Edit file URL:", attachment.url);
    if (newUrl === null) return;
    
    const newName = prompt("Edit attachment name:", attachment.name);
    if (newName === null) return;

    const updatedAttachments = (selectedTask.attachments || []).map((a: any) => 
      a.id === attachmentId ? { ...a, url: newUrl, name: newName } : a
    );
    
    const taskRef = doc(db, 'actionItems', selectedTask.id);
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
    await logActivity(selectedTask.id, 'edit', 'Task details updated');
    setSelectedTask({ ...selectedTask, ...editTaskData });
    setIsEditingTask(false);
  };

  const startTimeTracking = async () => {
    if (!selectedTask) return;
    await addDoc(collection(db, 'actionItems', selectedTask.id, 'timeLogs'), {
      startTime: new Date().toISOString(),
      endTime: null,
      userId: user.uid,
      userName: user.displayName || user.email,
      createdAt: new Date().toISOString()
    });
    await logActivity(selectedTask.id, 'time_start', 'Started time tracking');
  };

  const stopTimeTracking = async () => {
    if (!selectedTask || !activeTimer) return;
    const endTime = new Date().toISOString();
    const duration = new Date(endTime).getTime() - new Date(activeTimer.startTime).getTime();
    
    await updateDoc(doc(db, 'actionItems', selectedTask.id, 'timeLogs', activeTimer.id), {
      endTime,
      duration // in ms
    });
    await logActivity(selectedTask.id, 'time_stop', `Stopped time tracking (${Math.round(duration / 60000)} mins)`);
  };

  const addManualTime = async (minutes: number, note: string) => {
    if (!selectedTask) return;
    const now = new Date().toISOString();
    await addDoc(collection(db, 'actionItems', selectedTask.id, 'timeLogs'), {
      startTime: now,
      endTime: now,
      duration: minutes * 60000,
      note,
      userId: user.uid,
      userName: user.displayName || user.email,
      createdAt: now
    });
    await logActivity(selectedTask.id, 'time_manual', `Manually added ${minutes} mins: ${note}`);
  };

  const saveAsTemplate = async () => {
    if (!selectedTask) return;
    const name = prompt("Enter a name for this template:");
    if (!name) return;

    const templateData = {
      businessId: business.id,
      name,
      description: selectedTask.description,
      priority: selectedTask.priority,
      subtasks: subtasks.map(s => ({
        title: s.title,
        dueDateOffset: s.dueDate ? Math.round((new Date(s.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null
      }))
    };

    await addDoc(collection(db, 'taskTemplates'), templateData);
    alert("Template saved successfully!");
  };

  const applyTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    setNewItem({
      ...newItem,
      title: template.name,
      description: template.description,
      priority: template.priority
    });
    
    // We'll handle applying subtasks after the main task is created in addItem
    (window as any)._pendingTemplateSubtasks = template.subtasks;
    setShowTemplateModal(false);
  };

  useEffect(() => {
    // Automated Notifications
    if (!("Notification" in window)) return;
    
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    const checkNotifications = () => {
      const now = new Date();
      items.forEach(item => {
        if (item.status === 'done') return;

        // Due soon (within 24 hours)
        if (item.dueDate) {
          const due = new Date(item.dueDate);
          const diff = due.getTime() - now.getTime();
          if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
            const notifiedKey = `notified_due_${item.id}`;
            if (!localStorage.getItem(notifiedKey)) {
              new Notification("Task Due Soon", { body: `"${item.title}" is due within 24 hours.` });
              localStorage.setItem(notifiedKey, 'true');
            }
          }
        }

        // Unblocked check
        if (item.parentId) {
          const parent = items.find(i => i.id === item.parentId);
          if (parent && parent.status === 'done') {
            const notifiedKey = `notified_unblocked_${item.id}`;
            if (!localStorage.getItem(notifiedKey)) {
              new Notification("Task Unblocked", { body: `"${item.title}" is now unblocked because its parent task is done.` });
              localStorage.setItem(notifiedKey, 'true');
            }
          }
        }
      });
    };

    const interval = setInterval(checkNotifications, 10 * 60 * 1000); // Check every 10 mins
    checkNotifications(); // Initial check

    return () => clearInterval(interval);
  }, [items]);

  const filteredItems = items
    .filter(item => {
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (staffFilter !== 'all' && item.assignedTo !== staffFilter) return false;
      
      const isOverdue = item.dueDate && new Date(item.dueDate) < new Date(new Date().setHours(0,0,0,0)) && item.status !== 'done';

      if (dateRangeFilter === 'overdue' && !isOverdue) return false;
      if (dateRangeFilter === 'upcoming') {
        if (!item.dueDate || item.status === 'done' || isOverdue) return false;
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const due = new Date(item.dueDate);
        return due >= new Date(new Date().setHours(0,0,0,0)) && due <= nextWeek;
      }

      if (showOverdueOnly && !isOverdue) return false;

      if (showMyTasksOnly) {
        const userStaff = staff.find(s => s.email === user.email);
        if (!userStaff || item.assignedTo !== userStaff.id) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'priority') {
        const ranks: any = { high: 3, medium: 2, low: 1 };
        const rankA = ranks[a.priority] || 0;
        const rankB = ranks[b.priority] || 0;
        return sortOrder === 'asc' ? rankA - rankB : rankB - rankA;
      }
      if (sortBy === 'status') {
        const ranks: any = { todo: 1, 'in-progress': 2, done: 3 };
        const rankA = ranks[a.status] || 0;
        const rankB = ranks[b.status] || 0;
        return sortOrder === 'asc' ? rankA - rankB : rankB - rankA;
      }
      const valA = a[sortBy] || '';
      const valB = b[sortBy] || '';
      return sortOrder === 'asc' 
        ? valA.toString().localeCompare(valB.toString()) 
        : valB.toString().localeCompare(valA.toString());
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
      const ids = Array.from(selectedIds);
      const blockedTasks: string[] = [];

      if (updates.status && (updates.status === 'in-progress' || updates.status === 'done')) {
        for (const id of ids) {
          const task = items.find(i => i.id === id);
          if (task?.parentId) {
            const parent = items.find(i => i.id === task.parentId);
            if (parent && parent.status !== 'done' && !selectedIds.has(parent.id)) {
              blockedTasks.push(task.title);
            }
          }
        }
      }

      if (blockedTasks.length > 0) {
        alert(`The following tasks are blocked by incomplete dependencies: \n- ${blockedTasks.join('\n- ')}`);
      }

      const tasksToUpdate = ids.filter(id => {
        const t = items.find(i => i.id === id);
        if (updates.status && (updates.status === 'in-progress' || updates.status === 'done')) {
          if (t?.parentId) {
            const p = items.find(i => i.id === t.parentId);
            return !p || p.status === 'done' || selectedIds.has(p.id);
          }
        }
        return true;
      });

      const promises = tasksToUpdate.map(async id => {
        if (updates.status) {
          return handleStatusChange(id, updates.status);
        } else {
          return updateDoc(doc(db, 'actionItems', id), { ...updates, updatedAt: new Date().toISOString() });
        }
      });
      const results = await Promise.all(promises);
      const failures = results.filter(r => r && typeof r === 'object' && r.success === false);
      if (failures.length > 0) {
        alert(`${failures.length} task(s) could not be updated due to blocking dependencies.`);
      }
      setSelectedIds(new Set());
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} tasks? This will remove all their sub-tasks and comments.`)) return;
    setIsBulkProcessing(true);
    try {
      const promises = Array.from(selectedIds).map(id => deleteTask(id));
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
          <h1 className="text-2xl font-bold text-stone-900">Action Board</h1>
          <p className="text-stone-500">Track tasks and maintain high business standards.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowTemplateModal(true)}
            className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-xs font-bold hover:bg-stone-200 transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Templates
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            className="px-6 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-bold hover:bg-stone-800 shadow-xl shadow-stone-900/10 transition-all flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4" /> New Task
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-stone-100 p-1 rounded-xl mr-2">
            <button 
              onClick={() => setViewMode('board')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                viewMode === 'board' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
              )}
            >
              Board
            </button>
            <button 
              onClick={() => setViewMode('calendar')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                viewMode === 'calendar' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
              )}
            >
              Calendar
            </button>
          </div>

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
                <option value="priority">Priority</option>
                <option value="status">Status</option>
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

        {viewMode === 'board' ? (
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
                        {item.parentId && items.find(i => i.id === item.parentId)?.status !== 'done' && (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-black uppercase tracking-widest border border-amber-200 shadow-sm" title={`Depends on: ${items.find(i => i.id === item.parentId)?.title}`}>
                            <AlertCircle className="w-2.5 h-2.5" />
                            Blocked
                          </div>
                        )}
                        {items.some(i => i.parentId === item.id && i.status !== 'done') && (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-black uppercase tracking-widest border border-blue-200 shadow-sm" title="Blocking other tasks">
                            <GitBranch className="w-2.5 h-2.5" />
                            Blocking
                          </div>
                        )}
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
                        <button onClick={(e) => { e.stopPropagation(); deleteTask(item.id); }} className="p-1 hover:bg-red-50 rounded shadow-sm transition-colors"><Trash2 className="w-3 h-3 text-red-400" /></button>
                      </div>
                    </div>
                    <h4 className="text-sm font-bold text-stone-900 mb-1 flex items-center gap-2">
                      {item.title}
                      {item.recurrence && item.recurrence !== 'none' && (
                        <div title={`Recurring: ${item.recurrence}`}>
                          <RotateCcw className="w-3 h-3 text-emerald-500" />
                        </div>
                      )}
                      {item.parentId && (
                        <div className="flex items-center gap-1" title={`Depends on: ${items.find(i => i.id === item.parentId)?.title}`}>
                          <GitBranch className={cn(
                            "w-3 h-3",
                            items.find(i => i.id === item.parentId)?.status === 'done' ? "text-emerald-500" : "text-amber-500 animate-pulse"
                          )} />
                        </div>
                      )}
                    </h4>
                    <p className="text-xs text-stone-500 line-clamp-2 mb-2 font-medium leading-relaxed">{item.description}</p>
                    
                    {/* Subtask Progress */}
                    {((item.subtasksTotal || 0) > 0) ? (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Growth</span>
                          <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
                            {item.subtasksDone || 0}/{item.subtasksTotal || 0}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-stone-200/50 rounded-full overflow-hidden border border-stone-100/50 p-[1px]">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${item.subtasksTotal ? (item.subtasksDone / item.subtasksTotal * 100) : 0}%` }}
                            className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)] transition-all duration-700" 
                          />
                        </div>
                      </div>
                    ) : null}
                    
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
      ) : (
        <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm flex flex-col h-[calc(100vh-16rem)]">
          <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-stone-900">
                {format(currentCalendarDate, 'MMMM yyyy')}
              </h2>
              <div className="flex bg-white border border-stone-200 rounded-xl p-1">
                <button 
                  onClick={() => {
                    const d = new Date(currentCalendarDate);
                    d.setMonth(d.getMonth() - 1);
                    setCurrentCalendarDate(d);
                  }}
                  className="p-1.5 hover:bg-stone-50 rounded-lg text-stone-400 hover:text-stone-900 transition-all"
                >
                  <X className="w-4 h-4 rotate-180" />
                </button>
                <button 
                  onClick={() => setCurrentCalendarDate(new Date())}
                  className="px-3 py-1.5 text-[10px] font-bold text-stone-600 hover:text-stone-900"
                >
                  Today
                </button>
                <button 
                  onClick={() => {
                    const d = new Date(currentCalendarDate);
                    d.setMonth(d.getMonth() + 1);
                    setCurrentCalendarDate(d);
                  }}
                  className="p-1.5 hover:bg-stone-50 rounded-lg text-stone-400 hover:text-stone-900 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-xs text-stone-400 font-medium">Click a date to add task</span>
            </div>
          </div>
          
          <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-3 text-center border-b border-r border-stone-100 bg-stone-50/30 text-[10px] font-black text-stone-400 uppercase tracking-widest leading-none">
                {day}
              </div>
            ))}
            {(() => {
              const start = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), 1);
              const daysInMonth = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 0).getDate();
              const padding = start.getDay();
              
              const totalDays = [];
              for (let i = 0; i < padding; i++) totalDays.push(null);
              for (let i = 1; i <= daysInMonth; i++) totalDays.push(new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), i));
              
              return totalDays.map((date, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "min-h-[120px] p-3 border-b border-r border-stone-100 group transition-colors",
                    !date ? "bg-stone-50/10" : "hover:bg-stone-50/50 cursor-pointer"
                  )}
                  onClick={() => {
                    if (date) {
                      setNewItem({ ...newItem, dueDate: date.toISOString().split('T')[0] });
                      setIsAdding(true);
                    }
                  }}
                >
                  {date && (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className={cn(
                          "text-xs font-bold",
                          date.toDateString() === new Date().toDateString() ? "bg-stone-900 text-white w-6 h-6 rounded-full flex items-center justify-center -ml-1.5 -mt-1.5" : "text-stone-400"
                        )}>
                          {date.getDate()}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {items.filter(i => i.dueDate === date.toISOString().split('T')[0]).map(item => (
                          <div 
                            key={item.id}
                            onClick={(e) => { e.stopPropagation(); setSelectedTask(item); }}
                            className={cn(
                              "px-2 py-1 rounded text-[10px] font-bold truncate transition-all shadow-sm",
                              item.status === 'done' ? "bg-emerald-50 text-emerald-700 border border-emerald-100 opacity-60" :
                              item.priority === 'high' ? "bg-red-50 text-red-700 border border-red-100" :
                              "bg-blue-50 text-blue-700 border border-blue-100"
                            )}
                          >
                            {item.title}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ));
            })()}
          </div>
        </div>
      )}

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
                <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest text-[9px]">Move:</span>
                <div className="flex bg-white/5 p-1 rounded-xl">
                  {COLUMNS.map(col => (
                    <button 
                      key={col.id}
                      onClick={() => handleBulkUpdate({ status: col.id })}
                      className="px-2 py-1.5 hover:bg-white/10 rounded-lg text-[10px] font-bold transition-all"
                    >
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest text-[9px]">Priority:</span>
                <div className="flex bg-white/5 p-1 rounded-xl">
                  {['low', 'medium', 'high'].map(p => (
                    <button 
                      key={p}
                      onClick={() => handleBulkUpdate({ priority: p })}
                      className={cn(
                        "px-2 py-1.5 hover:bg-white/10 rounded-lg text-[10px] font-bold transition-all capitalize",
                        p === 'high' ? "text-red-400" : p === 'medium' ? "text-blue-400" : "text-stone-400"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest text-[9px]">Assign:</span>
                <select 
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkUpdate({ assignedTo: e.target.value });
                      e.target.value = ""; 
                    }
                  }}
                  className="bg-white/10 border border-white/10 text-[10px] font-bold px-3 py-2 rounded-xl outline-none focus:ring-1 focus:ring-white/20 transition-all cursor-pointer"
                  value=""
                >
                  <option value="" disabled className="text-stone-900 font-bold bg-white">Select Staff</option>
                  {staff.map(s => (
                    <option key={s.id} value={s.id} className="text-stone-900 bg-white font-medium">{s.name || s.email}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 ml-2 pl-4 border-l border-white/10">
                <button 
                  onClick={handleBulkDelete}
                  className="p-2.5 hover:bg-red-500 text-red-400 hover:text-white rounded-xl transition-all duration-300"
                  title="Delete Selected"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setSelectedIds(new Set())}
                  className="p-2.5 hover:bg-white/10 text-stone-400 hover:text-white rounded-xl transition-all duration-300"
                  title="Cancel selection"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
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

                {newItem.recurrence !== 'none' ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">End Recurrence</label>
                    <input 
                      type="date" 
                      value={newItem.recurrenceEndDate}
                      onChange={e => setNewItem({...newItem, recurrenceEndDate: e.target.value})}
                      className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl outline-none focus:ring-2 focus:ring-stone-200 transition-all text-sm font-bold"
                    />
                  </div>
                ) : (
                  <div />
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

      {showTemplateModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-[120] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl border border-stone-200">
             <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-stone-900">Task Templates</h2>
                <button onClick={() => setShowTemplateModal(false)} className="p-2 hover:bg-stone-100 rounded-xl"><X className="w-5 h-5" /></button>
             </div>
             <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {templates.map(t => (
                  <button 
                    key={t.id}
                    onClick={() => applyTemplate(t.id)}
                    className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl text-left hover:border-stone-900 transition-all group"
                  >
                    <p className="font-bold text-stone-900">{t.name}</p>
                    <p className="text-xs text-stone-400">{t.description || 'No description'}</p>
                    <p className="text-[10px] text-blue-500 font-bold mt-2 uppercase tracking-widest">{t.subtasks?.length || 0} Sub-tasks included</p>
                  </button>
                ))}
                {templates.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-xs text-stone-400 font-bold italic">No templates saved yet.</p>
                  </div>
                )}
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
              <div className="flex bg-stone-100 p-1 rounded-2xl">
                {[
                  { id: 'details', label: 'Details' },
                  { id: 'subtasks', label: 'Sub-tasks' },
                  { id: 'comments', label: 'Comments' },
                  { id: 'activity', label: 'Timeline' },
                  { id: 'time', label: 'Time' }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                      activeTab === tab.id ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-600"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                {isEditingTask ? (
                  <>
                    <button onClick={saveEditTask} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">
                      <Save className="w-4 h-4" /> Save Changes
                    </button>
                    <button onClick={() => setIsEditingTask(false)} className="p-2 hover:bg-stone-100 rounded-xl text-stone-400 transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setIsEditingTask(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-600 rounded-xl text-xs font-bold hover:bg-stone-200 transition-all"
                  >
                    <Edit3 className="w-4 h-4" /> Edit Details
                  </button>
                )}
                <button 
                  onClick={saveAsTemplate}
                  className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all"
                >
                  Save as Template
                </button>
                <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-stone-100 rounded-xl text-stone-400 transition-colors"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 lg:p-10">
              {activeTab === 'details' && (
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
                          <button 
                            onClick={handleFileUpload}
                            className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-900 transition-all"
                          >
                            <Paperclip className="w-4 h-4" />
                          </button>
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
                              <p className="text-[8px] font-bold text-stone-400 uppercase">
                                {file.type === 'link' ? 'LINK' : (file.size + ' • ' + (file.type.split('/')[1] || 'FILE'))}
                              </p>
                            </div>
                            <a 
                              href={file.url} 
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 hover:bg-stone-50 text-stone-300 hover:text-stone-900 rounded-lg transition-all"
                              title="Open Link/File"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            {!isEditingTask && (
                              <div className="flex items-center gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => editAttachment(file.id)}
                                  className="p-1.5 hover:bg-stone-50 text-stone-300 hover:text-blue-500 rounded-lg transition-all"
                                  title="Edit Attachment"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => removeAttachment(file.id)}
                                  className="p-1.5 hover:bg-red-50 text-stone-300 hover:text-red-500 rounded-lg transition-all"
                                  title="Delete Attachment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

              {activeTab === 'subtasks' && (
                <div className="space-y-10">
                  <div className="space-y-8 bg-stone-50/50 p-6 rounded-[24px] border border-stone-100/50">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-extrabold text-stone-900 tracking-tight">Progress Tracker</h3>
                        <div className="px-3 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20">
                          {Math.round((subtasks.filter(s => s.done).length / (subtasks.length || 1)) * 100)}%
                        </div>
                      </div>
                      <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-stone-200/50 p-[2px] shadow-inner">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(subtasks.filter(s => s.done).length / (subtasks.length || 1)) * 100}%` }}
                          className="h-full bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h4 className="text-sm font-bold text-stone-800 uppercase tracking-widest">Sub-tasks</h4>
                        <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1 border border-stone-200">
                          <select 
                            value={subtaskFilter}
                            onChange={(e) => setSubtaskFilter(e.target.value as any)}
                            className="bg-transparent border-none text-[8px] font-black uppercase tracking-widest text-stone-500 outline-none cursor-pointer pr-1 border-r border-stone-200 mr-1"
                          >
                            <option value="all">All</option>
                            <option value="pending">Todo</option>
                            <option value="done">Done</option>
                          </select>
                          <select 
                            value={subtaskSortBy}
                            onChange={(e) => setSubtaskSortBy(e.target.value as any)}
                            className="bg-transparent border-none text-[8px] font-black uppercase tracking-widest text-stone-500 outline-none cursor-pointer pr-1"
                          >
                            <option value="createdAt">Created</option>
                            <option value="dueDate">Due Date</option>
                            <option value="done">Status</option>
                          </select>
                          <button 
                            onClick={() => setSubtaskSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                            className="p-0.5 hover:bg-stone-200 rounded text-stone-400 transition-colors"
                          >
                            <ArrowUpDown className={cn("w-2.5 h-2.5 transition-transform", subtaskSortOrder === 'desc' && "rotate-180")} />
                          </button>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                        {subtasks.filter(s => s.done).length}/{subtasks.length} Completed
                      </span>
                    </div>
                  </div>
                <div className="space-y-4">
                  {sortedSubtasks.map(st => (
                    <div key={st.id} className={cn(
                      "rounded-2xl border transition-all overflow-hidden group/sub",
                      st.done ? "bg-emerald-50/50 border-emerald-100" : "bg-stone-50 border-stone-100"
                    )}>
                      <div className="flex items-center gap-3 p-4">
                        {st.done ? (
                          <button 
                            onClick={() => toggleSubtask(st.id, st.done)}
                            className="bg-emerald-500 w-5 h-5 rounded-md flex items-center justify-center text-white hover:bg-emerald-600 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        ) : (
                          <button 
                            onClick={() => toggleSubtask(st.id, st.done)}
                            disabled={st.parentId && !subtasks.find(s => s.id === st.parentId)?.done}
                            className={cn(
                              "w-5 h-5 rounded-md border flex items-center justify-center transition-colors shadow-sm",
                              "border-stone-200 bg-white",
                              st.parentId && !subtasks.find(s => s.id === st.parentId)?.done && "opacity-50 cursor-not-allowed bg-stone-100"
                            )}
                            title={st.parentId && !subtasks.find(s => s.id === st.parentId)?.done ? `Blocked by "${subtasks.find(s => s.id === st.parentId)?.title}"` : ""}
                          >
                            {st.parentId && !subtasks.find(s => s.id === st.parentId)?.done && <AlertCircle className="w-2.5 h-2.5 text-amber-500" />}
                          </button>
                        )}
                        <div className="flex-1 min-w-0" onClick={() => setEditingSubtask(editingSubtask === st.id ? null : st.id)}>
                          <div className="flex items-center gap-2">
                            {editingSubtask === st.id ? (
                              <input 
                                type="text"
                                value={st.title}
                                onChange={(e) => updateSubtaskField(st.id, 'title', e.target.value)}
                                className="bg-transparent border-none text-xs font-bold text-stone-900 focus:ring-0 p-0 w-full"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span className={cn("text-xs font-bold truncate", st.done ? "text-stone-400 line-through" : "text-stone-700")}>
                                {st.title}
                              </span>
                            )}
                            {st.dueDate && !editingSubtask && (
                              <span className={cn(
                                "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                                new Date(st.dueDate) < new Date() && !st.done ? "bg-red-100 text-red-600" : "bg-stone-200 text-stone-500"
                              )}>
                                {format(new Date(st.dueDate), 'MMM dd')}
                              </span>
                            )}
                            {st.parentId && (
                              <GitBranch className={cn("w-3 h-3", subtasks.find(s => s.id === st.parentId)?.done ? "text-emerald-500" : "text-amber-500")} />
                            )}
                          </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition-all">
                          <button 
                            onClick={() => setEditingSubtask(editingSubtask === st.id ? null : st.id)}
                            className={cn(
                              "p-1.5 rounded-lg transition-all",
                              editingSubtask === st.id ? "bg-stone-900 text-white" : "hover:bg-stone-200 text-stone-400"
                            )}
                          >
                            {editingSubtask === st.id ? <Check className="w-3.5 h-3.5" /> : <MoreVertical className="w-3.5 h-3.5" />}
                          </button>
                          <button 
                            onClick={() => deleteSubtask(st.id, st.done)}
                            className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                      
                      <AnimatePresence>
                        {editingSubtask === st.id && (
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="border-t border-stone-200/50 bg-white/50 overflow-hidden"
                          >
                            <div className="p-4 space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-1">Due Date</label>
                                  <input 
                                    type="date" 
                                    value={st.dueDate || ''}
                                    onChange={(e) => updateSubtaskField(st.id, 'dueDate', e.target.value)}
                                    className="w-full p-2 bg-stone-50 border border-stone-100 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-stone-200"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black text-stone-400 uppercase tracking-widest ml-1">Depends On</label>
                                  <select 
                                    value={st.parentId || ''}
                                    onChange={(e) => updateSubtaskField(st.id, 'parentId', e.target.value)}
                                    className="w-full p-2 bg-stone-50 border border-stone-100 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-stone-200"
                                  >
                                    <option value="">No Dependency</option>
                                    {subtasks.filter(s => s.id !== st.id).map(s => (
                                      <option key={s.id} value={s.id}>{s.title}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Add a next step..."
                      value={newSubtaskTitle}
                      onChange={e => setNewSubtaskTitle(e.target.value)}
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
            )}

              {activeTab === 'comments' && (
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
              )}

              {activeTab === 'activity' && (
                <div className="space-y-8 max-w-2xl mx-auto">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                    <h3 className="text-lg font-bold text-stone-900">Activity Timeline</h3>
                    <div className="flex items-center gap-2 text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                      <RotateCcw className="w-3 h-3" /> Real-time log
                    </div>
                  </div>
                  <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-0 before:w-px before:bg-stone-200">
                    {activity.map((a, idx) => (
                      <div key={a.id || idx} className="relative pl-8 group">
                        <div className="absolute left-0 top-1.5 w-6 h-6 bg-white border-2 border-stone-100 rounded-full flex items-center justify-center z-10 group-hover:border-stone-900 transition-colors">
                          <div className="w-2 h-2 bg-stone-300 rounded-full group-hover:bg-stone-900 transition-colors" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-stone-900 uppercase tracking-widest">{a.userName}</span>
                            <span className="text-[9px] text-stone-400 font-bold">{format(new Date(a.createdAt), 'MMM dd, HH:mm')}</span>
                          </div>
                          <p className="text-xs font-bold text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100 inline-block">
                            {a.details}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'time' && (
                <div className="space-y-10 max-w-2xl mx-auto">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                    <h3 className="text-lg font-bold text-stone-900">Time Tracking</h3>
                    <div className="flex items-center gap-2">
                       {activeTimer ? (
                         <button 
                           onClick={stopTimeTracking}
                           className="px-6 py-2 bg-red-600 text-white rounded-xl text-xs font-bold"
                         >
                           Stop Timer
                         </button>
                       ) : (
                         <button 
                           onClick={startTimeTracking}
                           className="px-6 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold"
                         >
                           <Clock className="w-4 h-4" /> Start Timer
                         </button>
                       )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-stone-900 text-white p-6 rounded-3xl shadow-xl shadow-stone-900/20 flex flex-col justify-between">
                       <h4 className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Total Logged</h4>
                       <div className="mt-4">
                         <span className="text-4xl font-black">
                           {Math.round(timeLogs.reduce((acc, curr) => acc + (curr.duration || 0), 0) / 60000)}
                         </span>
                         <span className="text-xs font-bold text-stone-500 ml-2 uppercase">Mins</span>
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {!isEditingTask && (
              <div className="mt-12 pt-8 border-t border-stone-100 flex flex-wrap gap-4">
                  {selectedTask.status === 'todo' && (
                    <button 
                      onClick={async () => {
                        const success = await updateStatus(selectedTask.id, 'in-progress');
                        if (success) setSelectedTask({...selectedTask, status: 'in-progress'});
                      }}
                      className={cn(
                        "flex-1 min-w-[200px] py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all shadow-sm active:scale-95",
                        selectedTask.parentId && items.find(i => i.id === selectedTask.parentId)?.status !== 'done'
                          ? "bg-stone-50 text-stone-300 border border-stone-100 cursor-not-allowed"
                          : "bg-white border border-stone-200 text-stone-900 hover:bg-stone-50 hover:border-stone-400"
                      )}
                      title={selectedTask.parentId && items.find(i => i.id === selectedTask.parentId)?.status !== 'done' ? "Blocked by parent task" : ""}
                    >
                      <Clock className={cn("w-5 h-5", selectedTask.parentId && items.find(i => i.id === selectedTask.parentId)?.status !== 'done' ? "text-stone-200" : "text-blue-500")} /> 
                      {selectedTask.parentId && items.find(i => i.id === selectedTask.parentId)?.status !== 'done' ? "Blocked by Parent" : "Start Processing"}
                    </button>
                  )}
                  {selectedTask.status !== 'done' && (
                    <button 
                      onClick={async () => {
                        const success = await updateStatus(selectedTask.id, 'done');
                        if (success) {
                          setSelectedTask({...selectedTask, status: 'done'});
                        }
                      }}
                      className={cn(
                        "flex-1 min-w-[200px] py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95",
                        selectedTask.parentId && items.find(i => i.id === selectedTask.parentId)?.status !== 'done'
                          ? "bg-stone-800 text-stone-500 cursor-not-allowed"
                          : "bg-stone-900 text-white hover:bg-stone-800 shadow-stone-900/20"
                      )}
                      title={selectedTask.parentId && items.find(i => i.id === selectedTask.parentId)?.status !== 'done' ? "Blocked by parent task" : ""}
                    >
                      <CheckCircle2 className={cn("w-5 h-5", selectedTask.parentId && items.find(i => i.id === selectedTask.parentId)?.status !== 'done' ? "text-stone-600" : "text-emerald-400")} />
                      {selectedTask.parentId && items.find(i => i.id === selectedTask.parentId)?.status !== 'done' ? "Blocked by Parent" : "Mark Completed"}
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
        )}
      </div>
    );
  }
