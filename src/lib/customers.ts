import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, increment } from 'firebase/firestore';

export async function updateOrCreateCustomer(businessId: string, customerData: { name: string, email: string, phone?: string, spent?: number, score?: number }, ownerUid?: string) {
  if (!customerData.email) return;

  const customersRef = collection(db, 'customers');
  const q = query(customersRef, where('businessId', '==', businessId), where('email', '==', customerData.email));
  const snap = await getDocs(q);

  if (snap.empty) {
    // Create new customer
    await addDoc(customersRef, {
      businessId,
      ownerUid: ownerUid || null,
      name: customerData.name,
      email: customerData.email,
      phone: customerData.phone || '',
      totalSpent: customerData.spent || 0,
      avgScore: customerData.score || 0,
      responseCount: customerData.score ? 1 : 0,
      tags: ['New'],
      createdAt: new Date().toISOString()
    });
  } else {
    // Update existing customer
    const customerDoc = snap.docs[0];
    const data = customerDoc.data();
    
    const newResponseCount = (data.responseCount || 0) + (customerData.score ? 1 : 0);
    const newAvgScore = customerData.score 
      ? ((data.avgScore || 0) * (data.responseCount || 0) + customerData.score) / newResponseCount
      : (data.avgScore || 0);

    await updateDoc(doc(db, 'customers', customerDoc.id), {
      name: customerData.name || data.name,
      phone: customerData.phone || data.phone,
      totalSpent: increment(customerData.spent || 0),
      avgScore: newAvgScore,
      responseCount: newResponseCount,
      updatedAt: new Date().toISOString()
    });
  }
}
