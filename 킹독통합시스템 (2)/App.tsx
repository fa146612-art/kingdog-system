
// ... existing imports ...
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, Package, Zap, Bed, ClipboardList, CheckSquare,
  Scissors, Edit, Trash2, Search, CreditCard, PieChart, Scale, MessageSquare, ChevronDown,
  AlertCircle, Volume2, VolumeX, Eye, Download, Upload,
  School, CalendarCheck, UserCog, Car, FileInput, LayoutGrid, Sparkles, FileBarChart, Loader2, Bell, Menu, LogOut, X,
  Plus, Dog, AlertTriangle, ArrowRight, Wallet, Copy, Database, BookOpen, Presentation, Compass, Phone
} from 'lucide-react';
import { signInWithEmailAndPassword, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { collection, addDoc, query, where, writeBatch, doc, onSnapshot, orderBy, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { auth, db, appId, ADMIN_EMAIL, ADMIN_PW } from './services/firebase';
import { getLocalYMD, getNowDate, getNowTime, formatCurrency, calculateAge, downloadCSV, CUSTOMER_CSV_MAP, readCSVFile, parseCSV, processCustomerUpload, normalizeDate, copyToClipboardFallback, calculateTransactionDiff } from './utils/helpers';
import { Transaction, Customer, Product, Appointment, Task, Staff, Handover, ExpenseCategory } from './types';
import { NAV_ITEMS } from './utils/navigationMap';

// Context
import { KindergartenProvider, useKindergarten } from './contexts/KindergartenContext';

// Components
import GroomingTab from './components/GroomingTab';
import LedgerTable from './components/LedgerTable';
import AnalysisTab from './components/AnalysisTab';
import BalanceTab from './components/BalanceTab';
import ConsultationTab from './components/ConsultationTab';
import HotelTab from './components/HotelTab';
import NotificationTab from './components/NotificationTab'; 
import TaskTab from './components/TaskTab';
import KindergartenInfoTab from './components/KindergartenInfoTab'; 
import AttendanceTab from './components/AttendanceTab'; 
import StaffTab from './components/StaffTab'; 
import HandoverTab from './components/HandoverTab'; 
import PickupTab from './components/PickupTab'; 
import WeeklyCompass from './components/WeeklyCompass';
import CommandPalette from './components/CommandPalette'; 
import MonthlyReport from './components/MonthlyReport';
import ManagementTab from './components/ManagementTab'; 
import MigrationTool from './components/MigrationTool';
import SystemManual from './components/SystemManual';
import PresentationView from './components/PresentationView'; // Import New Component
import { InitialLoader, ProgressModal, TabLoading, CustomerForm, CustomerDetailModal, DuplicateResolveModal } from './components/Modals';

const TAB_GROUPS = [
  { id: 'ledger', label: '장부', icon: <CreditCard className="w-4 h-4"/>, isSingle: true },
  { 
    id: 'kindergarten', label: '유치원', icon: <School className="w-4 h-4"/>,
    tabs: [
      { id: 'kinder_info', label: '유치원생 정보', icon: <Users className="w-4 h-4"/> },
      { id: 'dailyReport', label: '알림장/생활기록', icon: <ClipboardList className="w-4 h-4"/> },
      { id: 'attendance', label: '출석부', icon: <CalendarCheck className="w-4 h-4"/> },
    ]
  },
  { 
    id: 'ops', label: '운영관리', icon: <Zap className="w-4 h-4"/>,
    tabs: [
      { id: 'hotelRes', label: '호텔예약', icon: <Bed className="w-4 h-4"/> },
      { id: 'grooming', label: '미용예약', icon: <Scissors className="w-4 h-4"/> },
      { id: 'tasks', label: '업무할당', icon: <CheckSquare className="w-4 h-4"/> },
      { id: 'handover', label: '인수인계', icon: <FileInput className="w-4 h-4"/> },
      { id: 'pickup', label: '픽업관리', icon: <Car className="w-4 h-4"/> },
    ]
  },
  {
    id: 'finance', label: '매출/통계', icon: <PieChart className="w-4 h-4"/>,
    tabs: [
      { id: 'analysis', label: '경영분석', icon: <PieChart className="w-4 h-4"/> },
      { id: 'balance', label: '미수/적립', icon: <Scale className="w-4 h-4"/> },
    ]
  },
  {
    id: 'admin', label: '고객/기초', icon: <Users className="w-4 h-4"/>,
    tabs: [
      { id: 'customers', label: '고객관리', icon: <Users className="w-4 h-4"/> },
      { id: 'staff', label: '직원관리', icon: <UserCog className="w-4 h-4"/> },
      { id: 'consultations', label: '상담관리', icon: <MessageSquare className="w-4 h-4"/> },
      { id: 'products', label: '상품관리', icon: <Package className="w-4 h-4"/> },
      { id: 'expenses', label: '지출항목 관리', icon: <Wallet className="w-4 h-4"/> },
      { id: 'migration', label: '데이터 관리', icon: <Database className="w-4 h-4"/> },
    ]
  }
];

const NotificationCenter = ({ setActiveTab, isAlertMode }: { setActiveTab: (t: string) => void, isAlertMode: boolean }) => {
    const { notifications, markNotificationRead } = useKindergarten();
    const [isOpen, setIsOpen] = useState(false);

    const handleClick = async (n: any) => {
        await markNotificationRead(n.id);
        if (n.type === 'comment' || n.type === 'home_record') {
            setActiveTab('dailyReport');
        }
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className={`relative p-2 rounded-full transition-colors ${isAlertMode ? 'hover:bg-red-700 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
                <Bell className="w-5 h-5"/>
                {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse ring-2 ring-white"></span>
                )}
            </button>
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2 text-gray-900">
                    <div className="p-3 border-b bg-gray-50 font-bold text-xs text-gray-500 flex justify-between items-center">
                        <span>알림 센터</span>
                        {notifications.length > 0 && <span className="text-indigo-600">{notifications.length}건의 새 알림</span>}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-xs">새로운 알림이 없습니다.</div>
                        ) : (
                            notifications.map(n => (
                                <div key={n.id} onClick={() => handleClick(n)} className="p-4 border-b hover:bg-indigo-50 cursor-pointer transition-colors last:border-0">
                                    <div className="flex gap-3">
                                        <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${n.type==='comment'?'bg-blue-500':'bg-green-500'}`}></div>
                                        <div>
                                            <p className="text-sm text-gray-800 font-medium line-clamp-2">{n.message}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">{n.createdAt.slice(5,16)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isParentMode, setIsParentMode] = useState(false);

  // Layout States
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('ledger');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Mobile Menu State
  const [isMobileCompassCollapsed, setIsMobileCompassCollapsed] = useState(true); 

  const [ledgerType, setLedgerType] = useState('수입'); 
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]); 
  const [tasks, setTasks] = useState<Task[]>([]); 
  const [staff, setStaff] = useState<Staff[]>([]); 
  const [handovers, setHandovers] = useState<Handover[]>([]); 
  
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null); 
  const [customerSearch, setCustomerSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(true);
  const [processStatus, setProcessStatus] = useState({ active: false, type: '', current: 0, total: 0 });
  const [loading, setLoading] = useState({ transactions: true, customers: true, products: true });

  const [isMuted, setIsMuted] = useState(false); // Controls the urgent audio alert

  // Command Center State
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Manual & Presentation State
  const [showManual, setShowManual] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);

  // Upload States
  const [pendingUpload, setPendingUpload] = useState<any[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const [dateRange, setDateRange] = useState(() => {
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      return { start: getLocalYMD(start), end: '2099-12-31' };
  });

  // Handle Command Center Shortcut (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            setIsCommandOpen(prev => !prev);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigation = (targetId: string) => {
      setActiveTab(targetId);
      setHighlightId(targetId);
      setTimeout(() => setHighlightId(null), 3000);
  };

  const handlePeriodChange = (months: number) => {
    if (months === 0) {
        setDateRange({ start: '2000-01-01', end: '2099-12-31' });
    } else {
        const startD = new Date();
        startD.setMonth(startD.getMonth() - months);
        setDateRange({ start: getLocalYMD(startD), end: '2099-12-31' });
    }
  };

  // ... (Other useEffects and logic retained as is) ...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'parent') {
        setIsParentMode(true);
        signInAnonymously(auth).then(() => setUser({ isAnonymous: true }));
    } else {
        const initAuth = async () => {
            try {
              await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PW);
            } catch (e: any) { 
              await signInAnonymously(auth); 
            }
        };
        initAuth();
    }
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // [Transactions Fetch Effect] - Dependent on dateRange
  useEffect(() => {
    if (!user || isParentMode) return;

    setLoading(prev => ({ ...prev, transactions: true }));

    const transQuery = query(
      collection(db, 'kingdog', appId, 'transactions'),
      where('startDate', '>=', dateRange.start),
      where('startDate', '<=', dateRange.end),
      orderBy('startDate', 'asc')
    );

    const unsubTrans = onSnapshot(transQuery, (snap) => {
      setTransactions(snap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction)));
      setLoading(prev => ({ ...prev, transactions: false }));
      setIsSyncing(false);
    });

    return () => unsubTrans();
  }, [user, isParentMode, dateRange]);

  // [Other Data Fetch Effect] - Global Data
  useEffect(() => {
    if (!user) { setIsSyncing(false); return; }
    
    if (isParentMode) {
        const unsubCust = onSnapshot(query(collection(db, 'kingdog', appId, 'customers')), snap => {
            setCustomers(snap.docs.map(d=>({id: d.id, ...d.data()} as Customer)));
            setIsSyncing(false);
        });
        return () => unsubCust();
    }

    setLoading(prev => ({ ...prev, customers: true, products: true }));
    
    const unsubCust = onSnapshot(query(collection(db, 'kingdog', appId, 'customers'), orderBy('ownerName')), snap => {
        setCustomers(snap.docs.map(d=>({id: d.id, ...d.data()} as Customer)));
        setLoading(prev => ({ ...prev, customers: false }));
    });
    
    const unsubProd = onSnapshot(collection(db, 'kingdog', appId, 'products'), snap => {
        setProducts(snap.docs.map(d=>({id: d.id, ...d.data()} as Product)));
        setLoading(prev => ({ ...prev, products: false }));
    });

    const unsubExpenses = onSnapshot(collection(db, 'kingdog', appId, 'expense_categories'), snap => {
        setExpenseCategories(snap.docs.map(d=>({id: d.id, ...d.data()} as ExpenseCategory)));
    });

    const unsubApps = onSnapshot(query(collection(db, 'kingdog', appId, 'appointments')), snap => {
        setAppointments(snap.docs.map(d => ({ ...d.data(), id: d.id } as Appointment)));
    });

    const unsubTasks = onSnapshot(query(collection(db, 'kingdog', appId, 'tasks')), snap => {
        setTasks(snap.docs.map(d => ({ ...d.data(), id: d.id } as Task)));
    });

    const unsubStaff = onSnapshot(query(collection(db, 'kingdog', appId, 'staff'), orderBy('joinedAt')), snap => {
        setStaff(snap.docs.map(d => ({ ...d.data(), id: d.id } as Staff)));
    });

    const unsubHandover = onSnapshot(query(collection(db, 'kingdog', appId, 'handovers'), orderBy('createdAt', 'desc')), snap => {
        setHandovers(snap.docs.map(d => ({ ...d.data(), id: d.id } as Handover)));
    });

    return () => { unsubCust(); unsubProd(); unsubExpenses(); unsubApps(); unsubTasks(); unsubStaff(); unsubHandover(); };
  }, [user, isParentMode]);

  const pendingUrgentAppointments = useMemo(() => {
      return appointments.filter(a => 
          a.status === '상담중' && (
              a.category === '미용' || 
              a.category === '호텔' || 
              !a.category || 
              !!a.groomingOptions
          )
      );
  }, [appointments]);

  useEffect(() => {
      let interval: any;
      if (!isParentMode && pendingUrgentAppointments.length > 0 && !isMuted) {
          const playSound = () => {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
              audio.volume = 0.5; 
              audio.play().catch(e => console.log('Autoplay blocked', e));
          };
          playSound(); 
          interval = setInterval(playSound, 30000); 
      }
      return () => clearInterval(interval);
  }, [pendingUrgentAppointments.length, isMuted, isParentMode]);

  const handleAlertClick = () => {
      if (pendingUrgentAppointments.length > 0) {
          const target = pendingUrgentAppointments[0];
          if (target.category === '호텔') {
              setActiveTab('hotelRes');
          } else {
              setActiveTab('grooming');
          }
      }
  };

  const handleSaveTransaction = async (data: Transaction, isEdit = false) => {
    try {
        const batch = writeBatch(db);
        const { id, ...restData } = data;
        const dataToSave = { ...restData, isCompleted: data.paidAmount >= ((data.price * data.quantity) - data.discountValue) };
        
        let docRef;
        if (isEdit && id) {
            docRef = doc(db, 'kingdog', appId, 'transactions', id);
            const oldData = transactions.find(t => t.id === id);
            if (oldData && data.type === '수입') {
                const oldDiff = calculateTransactionDiff(oldData);
                const newDiff = calculateTransactionDiff(data);
                const adjustment = newDiff - oldDiff;

                if (adjustment !== 0 && data.customerId) {
                    const custRef = doc(db, 'kingdog', appId, 'customers', data.customerId);
                    batch.update(custRef, { 
                        balance: increment(adjustment),
                        lastBalanceUpdate: new Date().toISOString()
                    });
                }
            }
            batch.update(docRef, dataToSave as any);
        } else {
            docRef = doc(collection(db, 'kingdog', appId, 'transactions'));
            batch.set(docRef, { ...dataToSave, createdAt: new Date().toISOString() });
            
            if (data.type === '수입' && data.customerId) {
                const diff = calculateTransactionDiff(data);
                if (diff !== 0) {
                    const custRef = doc(db, 'kingdog', appId, 'customers', data.customerId);
                    batch.update(custRef, { 
                        balance: increment(diff),
                        lastBalanceUpdate: new Date().toISOString()
                    });
                }
            }
        }
        await batch.commit();
    } catch (e) { 
        console.error(e);
        alert("저장 실패"); 
    }
  };
  
  const handleDeleteTransaction = async (id: string) => { 
      if(!confirm("삭제?")) return;
      try {
          const batch = writeBatch(db);
          const target = transactions.find(t => t.id === id);
          
          if (target && target.type === '수입' && target.customerId) {
              const diff = calculateTransactionDiff(target);
              const custRef = doc(db, 'kingdog', appId, 'customers', target.customerId);
              batch.update(custRef, { 
                  balance: increment(-diff),
                  lastBalanceUpdate: new Date().toISOString()
              });
          }
          
          const ref = doc(db, 'kingdog', appId, 'transactions', id);
          batch.delete(ref);
          await batch.commit();
      } catch (e) {
          console.error(e);
          alert("삭제 실패");
      }
  };

  const handleBatchDeleteTransaction = async (ids: string[]) => { 
      try {
          const batch = writeBatch(db);
          ids.forEach(id => {
              const target = transactions.find(t => t.id === id);
              if (target && target.type === '수입' && target.customerId) {
                  const diff = calculateTransactionDiff(target);
                  const custRef = doc(db, 'kingdog', appId, 'customers', target.customerId);
                  batch.update(custRef, { 
                      balance: increment(-diff),
                      lastBalanceUpdate: new Date().toISOString() 
                  });
              }
              batch.delete(doc(db, 'kingdog', appId, 'transactions', id));
          });
          await batch.commit();
      } catch (e) {
          console.error(e);
          alert("일괄 삭제 실패");
      }
  };

  const handleUpdatePaidAmount = async (id: string, amount: number) => { 
      try {
          const target = transactions.find(t => t.id === id);
          if (!target) return;

          const batch = writeBatch(db);
          const ref = doc(db, 'kingdog', appId, 'transactions', id);
          batch.update(ref, { paidAmount: amount });

          if (target.type === '수입' && target.customerId) {
              const adjustment = amount - (target.paidAmount || 0);
              if (adjustment !== 0) {
                  const custRef = doc(db, 'kingdog', appId, 'customers', target.customerId);
                  batch.update(custRef, { 
                      balance: increment(adjustment),
                      lastBalanceUpdate: new Date().toISOString()
                  });
              }
          }
          await batch.commit();
      } catch (e) {
          console.error(e);
          alert("금액 수정 실패");
      }
  };

  const handleStopService = async (id: string) => { await updateDoc(doc(db, 'kingdog', appId, 'transactions', id), { isRunning: false, endDate: getNowDate(), endTime: getNowTime() }); };
  
  const handleSaveCustomer = async (data: Customer) => { 
      try {
        if(editingCustomer) {
            await updateDoc(doc(db, 'kingdog', appId, 'customers', editingCustomer.id), data as any); 
        } else {
            await addDoc(collection(db, 'kingdog', appId, 'customers'), { ...data, createdAt: new Date().toISOString() }); 
        }
        setShowCustomerForm(false); 
        setEditingCustomer(null);
      } catch(e) {
          console.error(e);
          alert('저장 실패');
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await readCSVFile(file);
    const rawData = parseCSV(text);
    const processed = processCustomerUpload(rawData);
    
    const duplicates = processed.filter(newC => 
        customers.some(oldC => oldC.dogName === newC.dogName && oldC.ownerName === newC.ownerName)
    );

    if (duplicates.length > 0) {
        setPendingUpload(processed);
        setShowDuplicateModal(true);
    } else {
        await processBatchUpload(processed);
    }
  };

  const processBatchUpload = async (data: any[]) => {
      setProcessStatus({ active: true, type: '업로드', current: 0, total: data.length });
      const batchSize = 500;
      for (let i = 0; i < data.length; i += batchSize) {
          const batch = writeBatch(db);
          data.slice(i, i + batchSize).forEach(c => {
              const ref = doc(collection(db, 'kingdog', appId, 'customers'));
              batch.set(ref, c);
          });
          await batch.commit();
          setProcessStatus(prev => ({ ...prev, current: Math.min(prev.total, i + batchSize) }));
      }
      setProcessStatus({ active: false, type: '', current: 0, total: 0 });
      alert('업로드 완료');
  };

  const copyRegistrationTemplate = () => {
        const template = `[킹독 신규 고객 등록 신청서]\n원활한 케어를 위해 아이의 정보를 알려주세요.\n\n1. 기본 정보\n* 이름: \n* 견종: \n* 생년월일(나이): \n* 성별 (중성화 여부): \n* 몸무게: \n\n2. 건강 정보\n* 병원명/연락처: \n* 예방접종 여부: \n* 심장사상충 예방일: \n* 알레르기/지병: \n* 수술 이력 (슬개골 등): \n\n3. 성향 및 습관\n* 입질/공격성 여부: \n* 분리불안 여부: \n* 다른 강아지와의 사회성: \n* 배변 습관 (패드/실외): \n* 싫어하거나 무서워하는 것: \n\n4. 보호자 정보\n* 성함: \n* 연락처: \n* 비상연락처: \n* 주소: `;
        copyToClipboardFallback(template);
        alert("고객 등록 신청서 양식이 복사되었습니다.");
  };

  const isLoadingData = loading.transactions || loading.customers || loading.products;
  const isAlertMode = !isParentMode && pendingUrgentAppointments.length > 0;

  const filteredCustomers = useMemo(() => {
      if (!customerSearch.trim()) return customers;
      const term = customerSearch.toLowerCase();
      return customers.filter(c => 
          (c.dogName && c.dogName.toLowerCase().includes(term)) ||
          (c.ownerName && c.ownerName.toLowerCase().includes(term)) ||
          (c.phone && c.phone.includes(term))
      );
  }, [customers, customerSearch]);

  if (!user || isLoadingData) return <InitialLoader />;

  const isGroupActive = (group: any) => {
      if (group.id === activeTab) return true;
      if (group.tabs) return group.tabs.some((t: any) => t.id === activeTab);
      return false;
  };

  return (
    <KindergartenProvider customers={customers} transactions={transactions}>
        <div className="flex flex-col h-screen bg-gray-100 overflow-hidden font-sans text-gray-900 relative">
            
            {pendingUrgentAppointments.length > 0 && !isParentMode && (
                <div className="pointer-events-none fixed inset-0 z-[9999] shadow-[inset_0_0_20px_rgba(220,38,38,0.3)] animate-pulse border-4 border-red-500/20"></div>
            )}

            <ProgressModal status={processStatus} />
            
            <CommandPalette 
                isOpen={isCommandOpen} 
                onClose={() => setIsCommandOpen(false)} 
                onNavigate={handleNavigation} 
                onOpenManual={() => setShowManual(true)} 
            />
            
            {showManual && <SystemManual onClose={() => setShowManual(false)} />}
            
            {showPresentation && <PresentationView onClose={() => setShowPresentation(false)} />}

            {showCustomerForm && (
                <CustomerForm 
                    initialData={editingCustomer} 
                    onSave={handleSaveCustomer} 
                    onCancel={() => { setShowCustomerForm(false); setEditingCustomer(null); }} 
                />
            )}
            
            {viewingCustomer && (
                <CustomerDetailModal 
                    customer={viewingCustomer}
                    allCustomers={customers} 
                    onClose={() => setViewingCustomer(null)} 
                    onEdit={() => { setEditingCustomer(viewingCustomer); setViewingCustomer(null); setShowCustomerForm(true); }}
                    staff={staff}
                />
            )}
            
            {showDuplicateModal && (
                <DuplicateResolveModal 
                    duplicates={pendingUpload.filter(newC => customers.some(oldC => oldC.dogName === newC.dogName && oldC.ownerName === newC.ownerName)).map(d => ({ new: d, old: customers.find(c => c.dogName===d.dogName && c.ownerName===d.ownerName) }))}
                    onResolve={(action: string) => {
                        setShowDuplicateModal(false);
                        if (action === 'keep_both') processBatchUpload(pendingUpload);
                    }}
                    onCancel={() => { setShowDuplicateModal(false); setPendingUpload([]); }}
                />
            )}

            {isParentMode ? (
                <div className="flex-1 w-full h-full bg-white overflow-hidden">
                    <NotificationTab />
                </div>
            ) : (
                <>
                    <nav className={`hidden md:flex h-16 border-b shadow-md z-[100] items-center px-6 sticky top-0 shrink-0 transition-colors duration-500 ${isAlertMode ? 'bg-red-600 border-red-700' : 'bg-white'}`}>
                        <div className="flex items-center gap-2 mr-10 cursor-pointer z-20" onClick={() => setActiveTab('ledger')}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black italic shadow-lg transition-colors ${isAlertMode ? 'bg-white text-red-600' : 'bg-indigo-600 text-white'}`}>K</div>
                            <span className={`font-black text-xl italic tracking-tighter transition-colors ${isAlertMode ? 'text-white' : 'text-indigo-900'}`}>KINGDOG</span>
                        </div>

                        <div className="flex-1 flex items-center h-full gap-2 relative">
                            {TAB_GROUPS.map(group => {
                                const isActive = isGroupActive(group);
                                let btnClass = "px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-all ";
                                
                                if (isAlertMode) {
                                    btnClass += isActive 
                                        ? 'bg-red-800 text-white shadow-sm ring-1 ring-red-400' 
                                        : 'text-red-100 hover:bg-red-700 hover:text-white';
                                } else {
                                    btnClass += isActive 
                                        ? 'bg-indigo-50 text-indigo-700' 
                                        : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50';
                                }

                                return (
                                    <div
                                        key={group.id}
                                        className="relative h-full flex items-center"
                                        onMouseEnter={() => setHoveredGroup(group.id)}
                                        onMouseLeave={() => setHoveredGroup(null)}
                                    >
                                        <button
                                            onClick={() => group.isSingle && setActiveTab(group.id)}
                                            className={btnClass}
                                        >
                                            {group.icon}
                                            <span className="ml-2">{group.label}</span>
                                            {!group.isSingle && <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${hoveredGroup === group.id ? 'rotate-180' : ''}`} />}
                                        </button>

                                        {!group.isSingle && hoveredGroup === group.id && (
                                            <div className="absolute top-full left-0 w-56 bg-white border border-gray-100 shadow-xl rounded-b-xl overflow-hidden py-2 animate-in fade-in slide-in-from-top-1 z-50">
                                                {group.tabs?.map(tab => (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => { setActiveTab(tab.id); setHoveredGroup(null); }}
                                                        className={`w-full text-left px-4 py-3 text-sm flex items-center transition-colors ${
                                                            activeTab === tab.id
                                                                ? 'bg-indigo-50 text-indigo-700 font-bold'
                                                                : 'text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {tab.id === highlightId && <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2 animate-ping"></span>}
                                                        {tab.icon} <span className="ml-3">{tab.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {isAlertMode && (
                            <div 
                                onClick={handleAlertClick}
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer flex items-center gap-2 animate-pulse whitespace-nowrap group"
                            >
                                <span className="text-lg md:text-2xl font-black text-white drop-shadow-md flex items-center gap-2">
                                    <AlertTriangle className="w-6 h-6 md:w-8 md:h-8 fill-yellow-400 text-red-600"/> 
                                    긴급: 미확정 예약 {pendingUrgentAppointments.length}건 대기 중!
                                </span>
                                <span className="hidden lg:inline text-xs bg-white text-red-600 px-3 py-1 rounded-full font-bold shadow-sm group-hover:scale-105 transition-transform">클릭하여 이동</span>
                            </div>
                        )}

                        <div className="flex items-center gap-3 z-20">
                             <button
                                onClick={() => setIsCommandOpen(true)}
                                className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-colors border ${
                                    isAlertMode 
                                    ? 'bg-red-700 text-red-100 hover:bg-red-800 border-red-600 hover:border-red-50' 
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-500 border-transparent hover:border-gray-300'
                                }`}
                            >
                                <Search className="w-3 h-3"/>
                                <span>Ctrl + K</span>
                            </button>

                            <NotificationCenter setActiveTab={setActiveTab} isAlertMode={isAlertMode} />

                            {isAlertMode && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                                    className="p-2 hover:bg-red-700 text-red-100 rounded-full transition-colors border border-red-500"
                                    title={isMuted ? "소리 켜기" : "소리 끄기"}
                                >
                                    {isMuted ? <VolumeX className="w-4 h-4"/> : <Volume2 className="w-4 h-4"/>}
                                </button>
                            )}

                            <div className={`h-6 w-px mx-1 ${isAlertMode ? 'bg-red-400' : 'bg-gray-200'}`}></div>
                            
                            <button
                                title="매뉴얼 보기"
                                onClick={() => setShowManual(true)}
                                className={`p-2 rounded-full transition-colors ${
                                    isAlertMode 
                                    ? 'text-red-200 hover:text-white hover:bg-red-700' 
                                    : 'hover:bg-red-50 hover:text-indigo-600 text-gray-400'
                                }`}
                            >
                                <BookOpen className="w-4 h-4"/>
                            </button>

                            <button
                                title="분석 보고서 슬라이드 보기"
                                onClick={() => setShowPresentation(true)}
                                className={`p-2 rounded-full transition-colors ${
                                    isAlertMode 
                                    ? 'text-red-200 hover:text-white hover:bg-red-700' 
                                    : 'hover:bg-red-50 hover:text-indigo-600 text-gray-400'
                                }`}
                            >
                                <Presentation className="w-4 h-4"/>
                            </button>

                            <button 
                                title="로그아웃" 
                                onClick={() => auth.signOut()} 
                                className={`p-2 rounded-full transition-colors ${
                                    isAlertMode 
                                    ? 'text-red-200 hover:text-white hover:bg-red-700' 
                                    : 'hover:bg-red-50 hover:text-red-500 text-gray-400'
                                }`}
                            >
                                <LogOut className="w-4 h-4"/>
                            </button>
                        </div>
                    </nav>

                    <nav className={`md:hidden h-14 border-b shadow-sm z-[100] flex justify-between items-center px-4 sticky top-0 transition-colors duration-500 ${isAlertMode ? 'bg-red-600 border-red-700 text-white' : 'bg-white text-gray-900'}`}>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setIsMobileMenuOpen(true)}
                                className={`p-2 rounded-md ${isAlertMode ? 'hover:bg-red-700' : 'hover:bg-gray-100'}`}
                            >
                                <Menu className="w-6 h-6"/>
                            </button>
                            <span className="font-black text-lg italic tracking-tighter">KINGDOG</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            {isAlertMode && (
                                <button onClick={handleAlertClick} className="animate-pulse bg-white/20 p-1.5 rounded-full">
                                    <AlertTriangle className="w-5 h-5 text-white"/>
                                </button>
                            )}
                            
                            <button 
                                onClick={() => setIsMobileCompassCollapsed(!isMobileCompassCollapsed)}
                                className={`p-2 rounded-full ${isAlertMode ? 'hover:bg-red-700' : 'hover:bg-gray-100'} ${!isMobileCompassCollapsed ? 'bg-indigo-100 text-indigo-600' : ''}`}
                            >
                                <Compass className="w-5 h-5"/>
                            </button>

                            <NotificationCenter setActiveTab={setActiveTab} isAlertMode={isAlertMode} />
                        </div>
                    </nav>

                    {isMobileMenuOpen && (
                        <div className="fixed inset-0 z-[200] md:hidden">
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
                            <div className="absolute left-0 top-0 bottom-0 w-[80%] max-w-sm bg-white shadow-2xl animate-in slide-in-from-left duration-200 flex flex-col">
                                <div className="p-5 border-b flex justify-between items-center bg-indigo-900 text-white">
                                    <span className="font-black text-xl italic">KINGDOG MENU</span>
                                    <button onClick={() => setIsMobileMenuOpen(false)}><X className="w-6 h-6"/></button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                    {TAB_GROUPS.map(group => (
                                        <div key={group.id}>
                                            <div 
                                                className="flex items-center gap-2 text-sm font-black text-gray-400 uppercase tracking-wider mb-2 px-2"
                                                onClick={() => { if(group.isSingle) { setActiveTab(group.id); setIsMobileMenuOpen(false); }}}
                                            >
                                                {group.icon} {group.label}
                                            </div>
                                            <div className="space-y-1">
                                                {group.tabs ? group.tabs.map(tab => (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }}
                                                        className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm flex items-center transition-colors ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                                                    >
                                                        {tab.icon} <span className="ml-3">{tab.label}</span>
                                                    </button>
                                                )) : (
                                                    <button
                                                        onClick={() => { setActiveTab(group.id); setIsMobileMenuOpen(false); }}
                                                        className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm flex items-center transition-colors ${activeTab === group.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                                                    >
                                                        {group.icon} <span className="ml-3">{group.label}</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-4 border-t bg-gray-50">
                                    <button onClick={() => auth.signOut()} className="w-full py-3 rounded-xl bg-white border border-gray-200 font-bold text-red-500 flex items-center justify-center gap-2 shadow-sm">
                                        <LogOut className="w-4 h-4"/> 로그아웃
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-1 flex-col md:flex-row overflow-hidden relative">
                        <WeeklyCompass 
                            appointments={appointments} 
                            tasks={tasks}
                            customers={customers}
                            transactions={transactions}
                            staff={staff}
                            handovers={handovers}
                            isMobileCollapsed={isMobileCompassCollapsed}
                            toggleMobile={() => setIsMobileCompassCollapsed(!isMobileCompassCollapsed)}
                            setActiveTab={setActiveTab}
                        />

                        <div className="flex-1 flex flex-col min-w-0 bg-white relative overflow-hidden">
                            {activeTab === 'ledger' && (
                                <div className="h-full flex flex-col">
                                    <div className="p-4 bg-gray-50 border-b flex flex-col md:flex-row justify-between items-center gap-4">
                                        <div className="flex gap-2 w-full md:w-auto">
                                            <button onClick={() => setLedgerType('수입')} className={`flex-1 md:flex-none px-6 py-2 rounded-lg font-black text-sm shadow-sm transition-all ${ledgerType === '수입' ? 'bg-blue-600 text-white scale-105' : 'bg-white text-gray-500'}`}>수입</button>
                                            <button onClick={() => setLedgerType('지출')} className={`flex-1 md:flex-none px-6 py-2 rounded-lg font-black text-sm shadow-sm transition-all ${ledgerType === '지출' ? 'bg-red-500 text-white scale-105' : 'bg-white text-gray-500'}`}>지출</button>
                                        </div>
                                        <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
                                            <div className="flex gap-2 w-full md:w-auto justify-center">
                                                {[0, 1, 3, 6].map(m => (
                                                    <button 
                                                        key={m} 
                                                        onClick={() => handlePeriodChange(m)}
                                                        className="px-3 py-1.5 bg-white border rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 flex-1 md:flex-none"
                                                    >
                                                        {m === 0 ? '전체' : `${m}개월`}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="hidden md:block h-6 w-px bg-gray-300 mx-2"></div>
                                            <div className="flex items-center gap-1 w-full md:w-auto justify-center">
                                                <input 
                                                    type="date" 
                                                    value={dateRange.start} 
                                                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                                    className="px-2 py-1.5 bg-white border rounded-lg text-xs font-bold text-gray-600 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                                />
                                                <span className="text-gray-400 font-bold">~</span>
                                                <input 
                                                    type="date" 
                                                    value={dateRange.end} 
                                                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                                    className="px-2 py-1.5 bg-white border rounded-lg text-xs font-bold text-gray-600 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <LedgerTable 
                                        type={ledgerType} 
                                        transactions={transactions} 
                                        customers={customers} 
                                        products={products} 
                                        expenseCategories={expenseCategories} 
                                        onSave={handleSaveTransaction} 
                                        onDelete={handleDeleteTransaction}
                                        onUpdatePaidAmount={handleUpdatePaidAmount}
                                        onToggleComplete={(id: string, val: boolean) => updateDoc(doc(db, 'kingdog', appId, 'transactions', id), { isCompleted: !val })}
                                        onStopService={handleStopService}
                                        onBatchDelete={handleBatchDeleteTransaction}
                                        dateRange={dateRange}
                                        staff={staff} 
                                    />
                                </div>
                            )}
                            {/* ... other tabs ... */}
                            {activeTab === 'hotelRes' && <HotelTab appointments={appointments} customers={customers} />}
                            {activeTab === 'grooming' && <GroomingTab customers={customers} transactions={transactions} appointments={appointments} staff={staff} />}
                            {activeTab === 'dailyReport' && <NotificationTab />}
                            {activeTab === 'analysis' && <AnalysisTab transactions={transactions} customers={customers} />}
                            {activeTab === 'balance' && <BalanceTab transactions={transactions} customers={customers} dateRange={dateRange} setDateRange={setDateRange} />}
                            {activeTab === 'tasks' && <TaskTab tasks={tasks} staff={staff} />}
                            {activeTab === 'kinder_info' && <KindergartenInfoTab customers={customers} transactions={transactions} staff={staff} />}
                            {activeTab === 'attendance' && <AttendanceTab customers={customers} />}
                            {activeTab === 'staff' && <StaffTab staff={staff} tasks={tasks} />}
                            {activeTab === 'handover' && <HandoverTab handovers={handovers} />}
                            {activeTab === 'pickup' && <PickupTab transactions={transactions} appointments={appointments} customers={customers} setActiveTab={setActiveTab} />}
                            {activeTab === 'consultations' && <ConsultationTab />}
                            {activeTab === 'products' && (
                                <ManagementTab mode="product" data={products} />
                            )}
                            {activeTab === 'expenses' && (
                                <ManagementTab mode="expense" data={expenseCategories} />
                            )}
                            {activeTab === 'customers' && (
                                <div className="h-full flex flex-col p-4 md:p-6 bg-gray-50">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <h2 className="text-xl font-black text-gray-800">고객 관리 <span className="text-gray-500 text-sm font-bold">({filteredCustomers.length}명)</span></h2>
                                            
                                            <div className="relative group flex-1 md:flex-none">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors"/>
                                                <input 
                                                    type="text" 
                                                    value={customerSearch} 
                                                    onChange={e => setCustomerSearch(e.target.value)} 
                                                    placeholder="이름, 연락처 검색" 
                                                    className="w-full md:w-64 pl-9 pr-4 py-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all"
                                                />
                                                {customerSearch && (
                                                    <button onClick={() => setCustomerSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100">
                                                        <X className="w-3 h-3"/>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                            <button onClick={copyRegistrationTemplate} className="bg-white border px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-gray-50 shadow-sm transition-all active:scale-95 flex-1 md:flex-none justify-center">
                                                <Copy className="w-4 h-4"/> 신규신청서 복사
                                            </button>
                                            <label className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-xs cursor-pointer flex items-center gap-2 shadow-sm transition-all active:scale-95 flex-1 md:flex-none justify-center">
                                                <Upload className="w-4 h-4"/> 엑셀 업로드
                                                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden"/>
                                            </label>
                                            <button onClick={() => downloadCSV(CUSTOMER_CSV_MAP.map(m=>m.header), [], '양식.csv')} className="bg-white border px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-gray-50 shadow-sm transition-all active:scale-95 flex-1 md:flex-none justify-center">
                                                <Download className="w-4 h-4"/> 양식 다운로드
                                            </button>
                                            <button onClick={() => setShowCustomerForm(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 flex-1 md:flex-none justify-center">
                                                <Plus className="w-4 h-4"/> 신규 등록
                                            </button>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex-1 flex flex-col">
                                        <div className="overflow-y-auto flex-1 custom-scrollbar">
                                            {/* ... list view ... */}
                                            {/* Copy existing list view code */}
                                            <div className="md:hidden space-y-3 p-3">
                                                {filteredCustomers.length === 0 ? (
                                                    <div className="p-10 text-center text-gray-400">
                                                        <Search className="w-10 h-10 mb-3 opacity-20 mx-auto"/>
                                                        <p className="font-bold">검색 결과가 없습니다.</p>
                                                    </div>
                                                ) : (
                                                    filteredCustomers.map(c => (
                                                        <div key={c.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between" onClick={() => setViewingCustomer(c)}>
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 shrink-0">
                                                                    {c.dogName?.[0]}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-gray-800 text-sm">
                                                                        {c.dogName} <span className="text-gray-400 font-normal text-xs">({c.ownerName})</span>
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                                                        <span className="bg-gray-100 px-1.5 py-0.5 rounded">{c.breed || '견종미상'}</span>
                                                                        {c.phone && <span className="flex items-center"><Phone className="w-3 h-3 mr-1"/>{c.phone.slice(-4)}</span>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button onClick={(e) => { e.stopPropagation(); setEditingCustomer(c); setShowCustomerForm(true); }} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-gray-50 rounded-full transition-colors">
                                                                <Edit className="w-4 h-4"/>
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>

                                            <table className="hidden md:table w-full text-sm text-left border-collapse">
                                                <thead className="bg-gray-50 text-gray-500 font-bold sticky top-0 z-10 border-b border-gray-100 shadow-sm">
                                                    <tr>
                                                        <th className="p-4 bg-gray-50 w-[25%]">이름</th>
                                                        <th className="p-4 bg-gray-50 w-[20%]">연락처</th>
                                                        <th className="p-4 bg-gray-50 w-[20%]">견종</th>
                                                        <th className="p-4 bg-gray-50 w-[20%]">최근 방문</th>
                                                        <th className="p-4 bg-gray-50 w-[15%] text-center">관리</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {filteredCustomers.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={5} className="p-10 text-center text-gray-400">
                                                                <div className="flex flex-col items-center justify-center h-40">
                                                                    <Search className="w-10 h-10 mb-3 opacity-20"/>
                                                                    <p className="font-bold">검색 결과가 없습니다.</p>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        filteredCustomers.map(c => (
                                                            <tr key={c.id} className="hover:bg-indigo-50/30 group transition-colors">
                                                                <td className="p-4 font-bold cursor-pointer text-indigo-900 group-hover:text-indigo-700" onClick={() => setViewingCustomer(c)}>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs border border-gray-200 shrink-0">
                                                                            {c.dogName?.[0]}
                                                                        </div>
                                                                        <div>
                                                                            {c.dogName}
                                                                            <span className="text-gray-400 font-normal text-xs ml-1">({c.ownerName})</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4 text-gray-600 font-mono text-xs">{c.phone}</td>
                                                                <td className="p-4 text-gray-600">
                                                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs">{c.breed || '미입력'}</span>
                                                                </td>
                                                                <td className="p-4 text-gray-400 text-xs">{c.createdAt ? normalizeDate(c.createdAt) : '-'}</td>
                                                                <td className="p-4 text-center">
                                                                    <button onClick={(e) => { e.stopPropagation(); setEditingCustomer(c); setShowCustomerForm(true); }} className="text-gray-400 hover:text-indigo-600 hover:bg-indigo-100 p-2 rounded-full transition-all">
                                                                        <Edit className="w-4 h-4"/>
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeTab === 'migration' && (
                                <MigrationTool />
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    </KindergartenProvider>
  );
}
