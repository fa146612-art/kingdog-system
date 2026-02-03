
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Customer, AttendanceLog, KindergartenDailyRecord, Transaction, AttendanceStatus, Notification, TicketLog } from '../types';
import { db, appId } from '../services/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, getDoc, updateDoc, orderBy, addDoc, getDocs, increment, arrayUnion } from 'firebase/firestore';
import { getNowDate, getLocalYMD, getNowTime } from '../utils/helpers';

interface KindergartenContextType {
  today: string;
  students: Customer[]; 
  attendanceMap: Record<string, AttendanceLog>; 
  dailyRecords: Record<string, KindergartenDailyRecord>; 
  notifications: Notification[];
  globalCurriculum: string[];
  
  // Actions
  // Modified: accepts mainCustomerId to support multi-dog household ticket deduction
  markAttendance: (dog: Customer, status: AttendanceStatus, force?: boolean, mainCustomerId?: string) => Promise<string | void>;
  updateDailyRecord: (dogId: string, data: Partial<KindergartenDailyRecord>) => Promise<void>;
  getStudentStatus: (dogId: string) => AttendanceStatus;
  markNotificationRead: (id: string) => Promise<void>;
}

const KindergartenContext = createContext<KindergartenContextType | undefined>(undefined);

interface KindergartenProviderProps {
  children: React.ReactNode;
  customers: Customer[];
  transactions: Transaction[];
}

export const KindergartenProvider: React.FC<KindergartenProviderProps> = ({ 
  children, 
  customers, 
  transactions 
}) => {
  const today = getNowDate();
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceLog>>({});
  const [dailyRecords, setDailyRecords] = useState<Record<string, KindergartenDailyRecord>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [globalCurriculum, setGlobalCurriculum] = useState<string[]>([
      '차징 (Charging)', '아이컨택', '유혹물 극복', '엎드려/놔둬', 
      '기다려 (기초)', '기다려 (심화)', '자리 (Place)', 
      '하우스 (기초)', '하우스 (심화)'
  ]);

  // 1. Filter Active Students
  const students = useMemo(() => {
    return customers.filter(c => {
        if (c.kindergarten && Object.keys(c.kindergarten).length > 0) return true;
        return transactions.some(t => 
            (t.customerId === c.id || (t.dogName === c.dogName && t.customerName === c.ownerName)) &&
            ['유치원', '놀이방'].includes(t.category) &&
            t.startDate >= getLocalYMD(new Date(new Date().setMonth(new Date().getMonth() - 6)))
        );
    });
  }, [customers, transactions]);

  // 2. Sync Attendance Logs for Today
  useEffect(() => {
    const q = query(
      collection(db, 'kingdog', appId, 'attendance_logs'),
      where('date', '==', today)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const map: Record<string, AttendanceLog> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data() as AttendanceLog;
        map[data.dogId] = data;
      });
      setAttendanceMap(map);
    });
    return () => unsubscribe();
  }, [today]);

  // 3. Sync Daily Records for Today
  useEffect(() => {
    const q = query(
      collection(db, 'kingdog', appId, 'daily_records'),
      where('date', '==', today)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const map: Record<string, KindergartenDailyRecord> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data() as KindergartenDailyRecord;
        map[data.dogId] = data;
      });
      setDailyRecords(map);
    });
    return () => unsubscribe();
  }, [today]);

  // 4. Sync Global Curriculum
  useEffect(() => {
      const settingsRef = doc(db, 'kingdog', appId, 'settings', 'curriculum');
      const unsub = onSnapshot(settingsRef, (snapshot) => {
          if (snapshot.exists()) {
              setGlobalCurriculum(snapshot.data().items || []);
          } else {
              // Initialize defaults if missing
              setDoc(settingsRef, { items: [
                  '차징 (Charging)', '아이컨택', '유혹물 극복', '엎드려/놔둬', 
                  '기다려 (기초)', '기다려 (심화)', '자리 (Place)', 
                  '하우스 (기초)', '하우스 (심화)'
              ] });
          }
      });
      return () => unsub();
  }, []);

  // 5. Sync Notifications (Unread only)
  useEffect(() => {
      const q = query(
          collection(db, 'kingdog', appId, 'notifications'),
          where('isRead', '==', false)
      );
      const unsub = onSnapshot(q, (snap) => {
          const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
          loaded.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setNotifications(loaded);
      });
      return () => unsub();
  }, []);

  // Actions
  const markAttendance = async (dog: Customer, status: AttendanceStatus, force: boolean = false, mainCustomerId?: string) => {
    // 1. Log Attendance: Use the specific DOG ID (e.g. sub-dog ID)
    const docId = `${today}_${dog.id}`;
    const ref = doc(db, 'kingdog', appId, 'attendance_logs', docId);
    
    // Get previous status to prevent double deduction
    const previousStatus = attendanceMap[dog.id]?.status || 'absent';
    // 'present' and 'home' count as "already attended today"
    const wasAttended = previousStatus === 'present' || previousStatus === 'home';
    
    // 2. Ticket Deduction: Use the Customer Document ID (mainCustomerId if sub-dog, else dog.id)
    const targetCustId = mainCustomerId || dog.id;
    const custRef = doc(db, 'kingdog', appId, 'customers', targetCustId);
    
    // 1. Case: Absent -> Present (Deduct Ticket)
    // Strict logic: Only deduct if the dog was previously NOT attended (absent)
    if (status === 'present' && !wasAttended) {
        const remaining = dog.ticket?.remaining || 0;
        
        // Return explicit requirement for confirmation if ticket is low/zero and not forced
        if (remaining <= 0 && !force) {
            return 'REQUIRE_CONFIRM';
        }

        const log: TicketLog = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            type: 'use',
            amount: -1,
            prevRemaining: remaining,
            newRemaining: remaining - 1,
            staffName: 'System', 
            reason: `${today} 등원 차감`
        };

        await updateDoc(custRef, {
            "ticket.remaining": increment(-1),
            "ticket.history": arrayUnion(log),
            "ticket.lastUpdated": new Date().toISOString()
        });
    }
    // 2. Case: Present/Home -> Absent (Restore Ticket - Undo)
    // Strict logic: Only restore if the dog WAS attended
    else if (status === 'absent' && wasAttended) {
        const remaining = dog.ticket?.remaining || 0;
        const log: TicketLog = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            type: 'restore',
            amount: 1,
            prevRemaining: remaining,
            newRemaining: remaining + 1,
            staffName: 'System',
            reason: `${today} 등원 취소 복구`
        };

        await updateDoc(custRef, {
            "ticket.remaining": increment(1),
            "ticket.history": arrayUnion(log),
            "ticket.lastUpdated": new Date().toISOString()
        });
    }
    // 3. Case: Present -> Home or Home -> Present
    // Do not change ticket count, just update timestamp/status below.

    // --- Standard Attendance Logic ---
    const payload: Partial<AttendanceLog> = {
      date: today,
      dogId: dog.id,
      dogName: dog.dogName,
      status: status,
      updatedAt: new Date().toISOString()
    };

    if (status === 'present') {
        const snap = await getDoc(ref);
        if (!snap.exists()) {
            payload.arrivalTime = getNowTime();
        }
        
        // Sync with Planned Dates (Bi-directional)
        // Update the main customer document's plan list using specific dog key
        const planKey = `${today}_${dog.id}`;
        // Fallback for main dog in single household or old data format might be just `today`
        const isPlanned = dog.plannedDates?.includes(today) || dog.plannedDates?.includes(planKey);

        if (!isPlanned) {
            await updateDoc(custRef, {
                plannedDates: arrayUnion(planKey)
            });
        }
    } else if (status === 'home') {
        payload.pickupTime = getNowTime();
    }

    await setDoc(ref, payload, { merge: true });
  };

  const updateDailyRecord = async (dogId: string, data: Partial<KindergartenDailyRecord>) => {
    const docId = `${today}_${dogId}`;
    const ref = doc(db, 'kingdog', appId, 'daily_records', docId);
    
    await setDoc(ref, {
        ...data,
        date: today,
        dogId,
        updatedAt: new Date().toISOString()
    }, { merge: true });
  };

  const getStudentStatus = (dogId: string): AttendanceStatus => {
    return attendanceMap[dogId]?.status || 'absent';
  };

  const markNotificationRead = async (id: string) => {
      await updateDoc(doc(db, 'kingdog', appId, 'notifications', id), { isRead: true });
  };

  return (
    <KindergartenContext.Provider value={{
      today,
      students,
      attendanceMap,
      dailyRecords,
      notifications,
      globalCurriculum,
      markAttendance,
      updateDailyRecord,
      getStudentStatus,
      markNotificationRead
    }}>
      {children}
    </KindergartenContext.Provider>
  );
};

export const useKindergarten = () => {
  const context = useContext(KindergartenContext);
  if (context === undefined) {
    throw new Error('useKindergarten must be used within a KindergartenProvider');
  }
  return context;
};
