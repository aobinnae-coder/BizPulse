import { db } from './firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, limit, updateDoc, doc } from 'firebase/firestore';

export type NotificationType = 'order' | 'feedback' | 'stock' | 'system';

export interface Notification {
  id?: string;
  businessId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

export async function createNotification(notification: Omit<Notification, 'read' | 'createdAt'>, ownerUid?: string) {
  try {
    await addDoc(collection(db, 'notifications'), {
      ...notification,
      ownerUid: ownerUid || null,
      read: false,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}
