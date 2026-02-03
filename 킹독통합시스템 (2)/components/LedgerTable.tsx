
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Trash2, StopCircle, Play, Edit, AlertCircle, Loader2, Save, Check, X, Download, Upload, Zap, RotateCcw, Ticket, CheckCircle, Plus } from 'lucide-react';
import { updateDoc, doc, onSnapshot, writeBatch, collection, addDoc, getDocs, query, where, arrayUnion, increment } from 'firebase/firestore';
import { db, appId } from '../services/firebase';
import { getNowDate, getNowTime, normalizeDate, formatCurrency, TRANSACTION_CSV_MAP, EXPENSE_CSV_MAP, downloadCSV, readCSVFile, parseCSV, processTransactionUpload, calculateTransactionDiff } from '../utils/helpers';
import { Transaction, Product, Customer, ExpenseCategory, Staff, TicketLog } from '../types';
import { ExcelFilter, ConfirmModal, TransactionEditModal, DuplicateResolveModal, TicketChargeModal } from './Modals';

interface LedgerTableProps {
    type: string;
    transactions: Transaction[];
    customers: Customer[];
    products: Product[];
    expenseCategories: ExpenseCategory[];
    onSave: (data: Transaction, isEdit?: boolean) => void;
    onDelete: (id: string) => void;
    onUpdatePaidAmount: (id: string, amount: number) => void;
    onToggleComplete: (id: string, val: boolean) => void;
    onStopService: (id: string) => void;
    onBatchDelete: (ids: string[]) => void;
    dateRange: { start: string, end: string };
    staff: Staff[];
}

const LedgerTable = ({ type, transactions, customers, products, expenseCategories, onSave, onDelete, onUpdatePaidAmount, onToggleComplete, onStopService, onBatchDelete, dateRange, staff }: LedgerTableProps) => {
    const [filters, setFilters] = useState<any>({ category: [], serviceDetail: [], dogName: [], paymentMethod: [], discount: [], hideZeroBalance: false });
    
    // Category Order State
    const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
    
    // Upload State
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [pendingUpload, setPendingUpload] = useState<any[]>([]);
    const [duplicateData, setDuplicateData] = useState<any[]>([]);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);

    // Balance Sync State
    const [isSyncingBalance, setIsSyncingBalance] = useState(false);

    // Alert for Ticket Charge
    const [alertMessage, setAlertMessage] = useState<string | null>(null);

    // Ticket Charge Modal State
    const [showChargeModal, setShowChargeModal] = useState(false);
    const [chargeTargetTransaction, setChargeTargetTransaction] = useState<Transaction | null>(null);

    // Mobile Input State
    const [isMobileFormOpen, setIsMobileFormOpen] = useState(false);

    // --- Excel-like Input Refs ---
    const isMouseDownRef = useRef(false);
    const ignoreClickRef = useRef(false);

    // Fetch Category Order from Firestore based on Type
    useEffect(() => {
        const docName = type === '수입' ? 'product_category_order' : 'expense_category_order';
        const docRef = doc(db, 'kingdog', appId, 'settings', docName);
        
        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                setCategoryOrder(snap.data().order || []);
            } else {
                setCategoryOrder([]);
            }
        });
        return () => unsubscribe();
    }, [type]);

    // 1. Select Active Data Source (Products for Income, ExpenseCategories for Expense)
    const activeSourceItems = useMemo(() => {
        return type === '수입' ? products : expenseCategories;
    }, [type, products, expenseCategories]);

    // 2. Derive & Sort Categories
    const availableCategories = useMemo(() => {
        if (!activeSourceItems) return [];
        const uniqueCats = Array.from(new Set(activeSourceItems.map((item: any) => item.category).filter(Boolean)));
        
        return uniqueCats.sort((a: any, b: any) => {
            const idxA = categoryOrder.indexOf(a);
            const idxB = categoryOrder.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [activeSourceItems, categoryOrder]);

    const [newEntry, setNewEntry] = useState<Transaction>({
        id: '',
        startDate: getNowDate(), startTime: getNowTime(),
        endDate: getNowDate(), endTime: getNowTime(),
        category: '', // Will be set by useEffect
        serviceDetail: '',
        dogName: '', customerName: '', contact: '', customerId: '', dogBreed: '',
        price: 0, quantity: 1, discountValue: 0, discountType: 'amount', 
        paidAmount: 0, paymentMethod: '카드',
        extraDogCount: 0, isRunning: true, type: '', memo: '', confirmer: ''
    });

    // Auto-select first category when type changes or categories load
    useEffect(() => {
        if (availableCategories.length > 0) {
            // If current category is invalid for the new type, reset to first available
            if (!newEntry.category || !availableCategories.includes(newEntry.category)) {
                setNewEntry(prev => ({ ...prev, category: availableCategories[0], serviceDetail: '', price: 0 }));
            }
        } else {
            setNewEntry(prev => ({ ...prev, category: '', serviceDetail: '', price: 0 }));
        }
    }, [availableCategories, type]);

    const [customerSearch, setCustomerSearch] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
    
    const [optimisticAdds, setOptimisticAdds] = useState<Transaction[]>([]);
    const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, Transaction>>({});
    
    const scrollContainerRef = useRef<HTMLDivElement>(null); 

    // Reset optimistic state on real data update
    useEffect(() => {
        setOptimisticAdds([]);
        setOptimisticUpdates({});
    }, [transactions]);

    const getCustomerBalance = (t: Transaction) => {
        if (t.customerId) {
            const customer = customers.find(c => c.id === t.customerId);
            return customer?.balance || 0;
        }
        if (t.dogName && t.contact) {
            const phone = t.contact.replace(/[^0-9]/g, '');
            const customer = customers.find(c => c.dogName === t.dogName && c.phone.replace(/[^0-9]/g, '') === phone);
            return customer?.balance || 0;
        }
        if (t.dogName && t.customerName) {
            const customer = customers.find(c => c.dogName === t.dogName && c.ownerName === t.customerName);
            return customer?.balance || 0;
        }
        return 0;
    };

    const focusedCustomer = useMemo(() => {
        if (type !== '수입' || filters.dogName.length !== 1) return null;
        const filterStr = filters.dogName[0];
        return customers.find(c => {
            const str = `${c.dogName} (${c.ownerName || '미등록'}) [${c.phone || ''}]`;
            return str === filterStr;
        });
    }, [filters.dogName, customers, type]);

    const handleBalanceSync = async () => {
        if (!focusedCustomer) return;
        setIsSyncingBalance(true);
        try {
            const colRef = collection(db, 'kingdog', appId, 'transactions');
            const queries = [];

            if (focusedCustomer.id) {
                 queries.push(query(colRef, where('customerId', '==', focusedCustomer.id), where('type', '==', '수입')));
            }
            if (focusedCustomer.dogName && focusedCustomer.phone) {
                 queries.push(query(colRef, 
                    where('dogName', '==', focusedCustomer.dogName), 
                    where('contact', '==', focusedCustomer.phone), 
                    where('type', '==', '수입')
                ));
            }
            if (focusedCustomer.dogName && focusedCustomer.ownerName) {
                queries.push(query(colRef, 
                    where('dogName', '==', focusedCustomer.dogName), 
                    where('customerName', '==', focusedCustomer.ownerName), 
                    where('type', '==', '수입')
                ));
            }
            
            const results = await Promise.all(queries.map(q => getDocs(q)));
            
            const uniqueTransactions = new Map();
            results.forEach(snap => {
                snap.docs.forEach(d => {
                    uniqueTransactions.set(d.id, d.data());
                });
            });

            let total = 0;
            uniqueTransactions.forEach((t) => {
                total += calculateTransactionDiff(t);
            });
            
            await updateDoc(doc(db, 'kingdog', appId, 'customers', focusedCustomer.id), {
                balance: total,
                lastBalanceUpdate: new Date().toISOString()
            });
            
            alert(`동기화 완료! 현재 잔액: ${formatCurrency(total)}원 (총 ${uniqueTransactions.size}건 집계)`);
        } catch(e) {
            console.error(e);
            alert("동기화 실패. 잠시 후 다시 시도해주세요.");
        } finally {
            setIsSyncingBalance(false);
        }
    };

    const calculateRow = (row: Transaction) => {
        const unitPrice = (row.price || 0) + ((row.extraDogCount || 0) * 10000);
        const base = unitPrice * (row.quantity || 1);
        let discount = 0;
        if (row.discountType === 'percent') discount = base * ((row.discountValue || 0) / 100);
        else discount = row.discountValue || 0;
        const final = base - discount;
        const balance = final - (row.paidAmount || 0); 
        return { final, balance };
    };

    const handleFullPayment = (t: Transaction) => {
        const { final } = calculateRow(t);
        setOptimisticUpdates(prev => ({
            ...prev,
            [t.id]: { ...t, paidAmount: final, isCompleted: true } 
        }));
        onUpdatePaidAmount(t.id, final);
        const currentComplete = t.isCompleted !== undefined ? t.isCompleted : (t.paidAmount >= final);
        if (!currentComplete) {
            onToggleComplete(t.id, false); 
        }
    };

    const handleTicketCharge = (t: Transaction) => {
        if (t.ticketProcessed) return; 
        setChargeTargetTransaction(t);
        setShowChargeModal(true);
    };

    const onConfirmTicketCharge = async (data: any) => {
        if (!chargeTargetTransaction) return;
        const { count, expiryDate, staffName, memo } = data;

        let targetCustomerId = chargeTargetTransaction.customerId;
        if (!targetCustomerId) {
            const found = customers.find(c => 
                c.dogName === chargeTargetTransaction.dogName && 
                c.ownerName === chargeTargetTransaction.customerName
            );
            if (found) targetCustomerId = found.id;
        }

        if (!targetCustomerId) {
            alert("연동된 고객 정보를 찾을 수 없습니다. 고객 관리에서 먼저 등록해주세요.");
            return;
        }

        const customer = customers.find(c => c.id === targetCustomerId);
        if (!customer) {
             alert("고객 정보를 불러올 수 없습니다.");
             return;
        }

        const batch = writeBatch(db);
        const transRef = doc(db, 'kingdog', appId, 'transactions', chargeTargetTransaction.id);
        batch.update(transRef, { ticketProcessed: true });

        const custRef = doc(db, 'kingdog', appId, 'customers', targetCustomerId);
        const newHistoryItem: TicketLog = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            type: 'charge',
            amount: count,
            prevRemaining: customer.ticket?.remaining || 0,
            newRemaining: (customer.ticket?.remaining || 0) + count,
            staffName: staffName,
            reason: memo || '장부 연동 충전'
        };

        batch.update(custRef, {
            "ticket.remaining": increment(count),
            "ticket.expiryDate": expiryDate,
            "ticket.lastUpdated": new Date().toISOString(),
            "ticket.history": arrayUnion(newHistoryItem)
        });

        try {
            await batch.commit();
            setShowChargeModal(false);
            setChargeTargetTransaction(null);
            
            setOptimisticUpdates(prev => ({
                ...prev,
                [chargeTargetTransaction.id]: { ...chargeTargetTransaction, ticketProcessed: true }
            }));
            
            alert("이용권이 충전되었습니다.");
        } catch (e) {
            console.error(e);
            alert("처리 중 오류가 발생했습니다.");
        }
    };

    // --- Input Ref Handlers ---
    const handleInputMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
        isMouseDownRef.current = true;
        if (document.activeElement === e.currentTarget) {
            ignoreClickRef.current = true;
        } else {
            ignoreClickRef.current = false;
        }
    };

    const handleInputMouseUp = () => {
        isMouseDownRef.current = false;
    };

    const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        if (!isMouseDownRef.current) {
            e.target.select();
        }
    };

    const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
        if (ignoreClickRef.current) return; 
        const input = e.currentTarget;
        if (input.selectionStart === input.selectionEnd) {
            input.select();
        }
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, originalValue: number) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur(); 
        } else if (e.key === 'Escape') {
            e.currentTarget.value = String(originalValue); 
            e.currentTarget.blur();
        }
    };

    const mergedTransactions = useMemo(() => {
        const updatedServerData = transactions.map((t: Transaction) => optimisticUpdates[t.id] || t);
        const relevantAdds = optimisticAdds.filter(t => t.type === type);
        return [...updatedServerData, ...relevantAdds];
    }, [transactions, optimisticUpdates, optimisticAdds, type]);

    const IncomeColumnGroups = () => (
        <colgroup>
            <col className="w-[3%]" />
            <col className="w-[15%]" /> {/* Date Increased to 15% */}
            <col className="w-[7%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" /> {/* Dog Reduced to 9% */}
            <col className="w-[5%]" /> {/* Memo Reduced to 5% */}
            <col className="w-[6%]" />
            <col className="w-[4%]" /> {/* Qty Reduced to 4% */}
            <col className="w-[5%]" /> {/* Discount: 5% */}
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[6%]" />
            <col className="w-[10%]" /> {/* Balance: 10% */}
            <col className="w-[4%]" />
        </colgroup>
    );

    const ExpenseColumnGroups = () => (
        <colgroup>
            <col className="w-[3%]" />
            <col className="w-[15%]" /> {/* Date Increased */}
            <col className="w-[12%]" />
            <col className="w-[15%]" />
            <col className="w-[8%]" />
            <col className="w-[15%]" />
            <col className="w-[20%]" />
            <col className="w-[12%]" />
        </colgroup>
    );

    const searchResults = useMemo(() => {
        if(!customerSearch) return [];
        const term = customerSearch.toLowerCase();
        return customers.filter((c: Customer) => 
            (c.dogName && c.dogName.toLowerCase().includes(term)) ||
            (c.ownerName && c.ownerName.toLowerCase().includes(term)) ||
            (c.phone && c.phone.includes(term))
        ).slice(0, 5);
    }, [customerSearch, customers]);

    const dateFilteredTransactions = useMemo(() => {
        return mergedTransactions.filter((t: Transaction) => t.type === type).filter((t: Transaction) => {
             const normalizedDate = normalizeDate(t.startDate);
             return normalizedDate >= dateRange.start && normalizedDate <= dateRange.end;
        });
    }, [mergedTransactions, type, dateRange]);

    const sortedList = useMemo(() => {
        const result = dateFilteredTransactions.filter((t: Transaction) => {
            if (filters.category.length > 0 && !filters.category.includes(t.category)) return false;
            if (filters.serviceDetail.length > 0 && !filters.serviceDetail.includes(t.serviceDetail)) return false;
            
            if (type === '수입') {
                if (filters.dogName.length > 0) {
                    const infoStr = `${t.dogName} (${t.customerName || '미등록'}) [${t.contact || ''}]`;
                    if (!filters.dogName.includes(infoStr)) return false;
                }
                if (filters.paymentMethod.length > 0 && !filters.paymentMethod.includes(t.paymentMethod)) return false;
                
                // Discount Filter Logic
                if (filters.discount.length > 0) {
                    const val = t.discountValue > 0 
                        ? (t.discountType === 'percent' ? `${t.discountValue}%` : `${formatCurrency(t.discountValue)}`)
                        : '0';
                    if (!filters.discount.includes(val)) return false;
                }

                if (filters.hideZeroBalance) {
                    const balance = getCustomerBalance(t);
                    if (balance === 0) return false;
                }
            }
            return true;
        });
        return result.sort((a: Transaction, b: Transaction) => {
            const dateA = normalizeDate(a.startDate);
            const dateB = normalizeDate(b.startDate);
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            return a.startTime.localeCompare(b.startTime);
        });
    }, [dateFilteredTransactions, filters, customers, type]); 

    useEffect(() => {
        if (scrollContainerRef.current) {
            setTimeout(() => {
                if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                }
            }, 100);
        }
    }, [type]);

    useEffect(() => {
        if (optimisticAdds.length > 0 && scrollContainerRef.current) {
             scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [optimisticAdds.length]);

    const filterOptions = useMemo(() => {
        return {
            category: Array.from(new Set(dateFilteredTransactions.map((t: Transaction) => t.category))),
            serviceDetail: Array.from(new Set(dateFilteredTransactions.map((t: Transaction) => t.serviceDetail))),
            dogName: Array.from(new Set(dateFilteredTransactions.map((t: Transaction) => `${t.dogName} (${t.customerName || '미등록'}) [${t.contact || ''}]`))),
            paymentMethod: Array.from(new Set(dateFilteredTransactions.map((t: Transaction) => t.paymentMethod))),
            discount: Array.from(new Set(dateFilteredTransactions.map((t: Transaction) => 
                t.discountValue > 0 
                    ? (t.discountType === 'percent' ? `${t.discountValue}%` : `${formatCurrency(t.discountValue)}`)
                    : '0'
            ))).sort((a: any, b: any) => {
                // Custom sort for discount strings
                const getVal = (s: string) => {
                    if (s === '0') return 0;
                    if (s.includes('%')) return parseFloat(s) * 1000; // Treat % as high value for sort
                    return parseInt(s.replace(/,/g, ''));
                };
                return getVal(a) - getVal(b);
            })
        };
    }, [dateFilteredTransactions]);

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === sortedList.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(sortedList.map((t: Transaction) => t.id)));
    };

    const handleBatchDelete = () => {
        onBatchDelete(Array.from(selectedIds));
        setSelectedIds(new Set());
        setShowBatchDeleteConfirm(false);
    };
    
    const handleUpdateBilledAmount = async (t: Transaction, newBilledAmount: number) => {
        const basePrice = (t.price + (t.extraDogCount||0)*10000) * t.quantity;
        const newDiscount = basePrice - newBilledAmount;
        
        const updatedItem = { ...t, discountValue: newDiscount, discountType: 'amount' as const };
        setOptimisticUpdates(prev => ({ ...prev, [t.id]: updatedItem }));

        await updateDoc(doc(db, 'kingdog', appId, 'transactions', t.id), {
            discountValue: newDiscount,
            discountType: 'amount'
        });
    };

    const handleResumeService = async (id: string) => {
        const t = transactions.find((item: Transaction) => item.id === id);
        if(t) setOptimisticUpdates(prev => ({ ...prev, [id]: { ...t, isRunning: true } }));

        await updateDoc(doc(db, 'kingdog', appId, 'transactions', id), { isRunning: true });
    };

    const handleRegister = async () => {
        if (!newEntry.dogName && type === '수입') { alert('고객을 선택하거나 입력해주세요.'); return; }
        // For Expenses, serviceDetail is mandatory if it's not typed
        if (type === '지출' && !newEntry.serviceDetail) { alert('지출 항목을 선택해주세요.'); return; }
        
        const unitPrice = newEntry.price + ((newEntry.extraDogCount || 0) * 10000);
        const tempId = `temp_${Date.now()}`;
        
        const transactionData = { ...newEntry, price: unitPrice, type: type };
        const optimisticItem = { ...transactionData, id: tempId, isOptimistic: true };
        setOptimisticAdds(prev => [...prev, optimisticItem]);

        // Reset Form (Preserve Date/Time for convenience)
        setNewEntry(prev => ({ ...prev, serviceDetail: '', price: 0, quantity: 1, discountValue: 0, discountType: 'amount', paidAmount: 0, paymentMethod: '카드', dogName: '', customerName: '', contact: '', customerId: '', extraDogCount: 0, isRunning: true, memo: '', confirmer: '' }));
        setCustomerSearch('');
        setIsMobileFormOpen(false); 

        try {
            await onSave(transactionData);
        } catch (e) {
            console.error(e);
            alert("저장 실패. 목록이 새로고침 됩니다.");
            setOptimisticAdds(prev => prev.filter(item => item.id !== tempId));
        }
    };

    const handleEditSave = async (data: Transaction) => {
        setOptimisticUpdates(prev => ({ ...prev, [data.id]: data }));
        try {
            await onSave(data, true);
            setEditingTransaction(null);
        } catch(e) {
            alert("수정 실패");
            setOptimisticUpdates(prev => {
                const copy = {...prev};
                delete copy[data.id];
                return copy;
            });
        }
    };

    // Filter Items based on Selected Category
    const sortedItems = useMemo(() => {
        const filtered = (activeSourceItems || []).filter((item: any) => item.category === newEntry.category);
        
        return filtered.sort((a: any, b: any) => {
            const orderA = a.order ?? 999999;
            const orderB = b.order ?? 999999;
            if (orderA !== orderB) return orderA - orderB;
            return a.name.localeCompare(b.name);
        });
    }, [activeSourceItems, newEntry.category]);

    useEffect(() => {
        let interval: any;
        if (newEntry.isRunning && newEntry.category === '놀이방') {
            interval = setInterval(() => {
                setNewEntry(prev => ({ ...prev, endDate: getNowDate(), endTime: getNowTime() }));
            }, 60000);
        }
        return () => clearInterval(interval);
    }, [newEntry.isRunning, newEntry.category]);

    useEffect(() => {
        if (['호텔', '놀이방'].includes(newEntry.category)) {
             try {
                 const start = new Date(`${newEntry.startDate}T${newEntry.startTime}`);
                 const end = new Date(`${newEntry.endDate}T${newEntry.endTime}`);
                 const diffInMs = end.getTime() - start.getTime();
                 if (diffInMs >= 0) {
                     if (newEntry.category === '호텔') {
                         const nights = Math.max(1, Math.ceil(diffInMs / (1000 * 60 * 60 * 24)));
                         if (newEntry.quantity !== nights) setNewEntry(prev => ({...prev, quantity: nights}));
                     } else if (newEntry.category === '놀이방') {
                         const diffInMinutes = diffInMs / (1000 * 60);
                         const calculatedQty = Math.max(1, Math.round(diffInMinutes / 60));
                         if (newEntry.quantity !== calculatedQty) setNewEntry(prev => ({...prev, quantity: calculatedQty}));
                     }
                 }
             } catch (e) { console.error("Time calculation error", e); }
        }
    }, [newEntry.startDate, newEntry.startTime, newEntry.endDate, newEntry.endTime, newEntry.category]);

    // Item Selection Handler
    const selectItem = (e: any) => {
        const val = e.target.value;
        const item = activeSourceItems.find((p: any) => p.name === val && p.category === newEntry.category);
        // Only auto-fill price for 'Income'. For 'Expense', users usually enter exact amount.
        const price = (type === '수입' && item) ? item.price : 0;
        setNewEntry(prev => ({ ...prev, serviceDetail: val, price, paidAmount: 0 }));
    };

    const selectCustomer = (c: Customer) => {
        setNewEntry(prev => ({ ...prev, customerId: c.id, dogName: c.dogName, dogBreed: c.breed, customerName: c.ownerName, contact: c.phone }));
        setCustomerSearch(`${c.dogName} (${c.ownerName})`);
        setShowSearch(false);
    };

    const handleDownloadTemplate = () => {
        if (type === '수입') {
            const headers = TRANSACTION_CSV_MAP.map((m: any) => m.header);
            const sampleData = [
                { 
                  '날짜': getNowDate().replace(/-/g, '.'), '시간': '10:00', '종료날짜': getNowDate().replace(/-/g, '.'), '종료시간': '11:00', 
                  '분류': '유치원', 
                  '상세내역': '기본', '반려견명': '바둑이', '보호자명': '홍길동', '연락처': '010-1234-5678', 
                  '단가': 10000, '수량': 1, '할인액': 0, '실결제액': 10000, '결제수단': '카드', '메모': '' 
                }
            ];
            downloadCSV(headers, sampleData, `수입_장부_양식.csv`);
        } else {
            const headers = EXPENSE_CSV_MAP.map((m: any) => m.header);
            const sampleData = [
                { 
                  '날짜': getNowDate().replace(/-/g, '.'), '시간': '10:00',
                  '분류': '식비', '상세내역': '간식비', '확인자': '오수원',
                  '실결제액': 10000, '메모': '마트 장보기' 
                }
            ];
            downloadCSV(headers, sampleData, `지출_장부_양식.csv`);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsProcessing(true);
        try {
            const text = await readCSVFile(file);
            const raw = parseCSV(text);
            const data = processTransactionUpload(raw, type);
            
            if (data.length === 0) {
                alert("업로드할 유효한 데이터가 없습니다.");
                setIsProcessing(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

            const dups: any[] = [];
            data.forEach(newItem => {
                const match = transactions.find((t: Transaction) => 
                    t.startDate === newItem.startDate &&
                    t.contact === newItem.contact &&
                    t.category === newItem.category &&
                    t.paidAmount === newItem.paidAmount
                );
                if (match) dups.push({ new: newItem, old: match });
            });

            if (dups.length > 0) {
                setPendingUpload(data);
                setDuplicateData(dups);
                setShowDuplicateModal(true);
            } else {
                await processBatchUpload(data);
            }
        } catch (err) {
            console.error(err);
            alert("업로드 중 오류가 발생했습니다.");
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const processBatchUpload = async (items: any[], updateItems: any[] = []) => {
        setIsProcessing(true);
        try {
            const batchSize = 500;
            for (let i = 0; i < items.length; i += batchSize) {
                const batch = writeBatch(db);
                items.slice(i, i + batchSize).forEach(item => {
                    const ref = doc(collection(db, 'kingdog', appId, 'transactions'));
                    batch.set(ref, { ...item, createdAt: new Date().toISOString() });
                });
                await batch.commit();
            }
            for (let i = 0; i < updateItems.length; i += batchSize) {
                const batch = writeBatch(db);
                updateItems.slice(i, i + batchSize).forEach(item => {
                    if (item.id) {
                        const ref = doc(db, 'kingdog', appId, 'transactions', item.id);
                        batch.update(ref, { ...item, updatedAt: new Date().toISOString() });
                    }
                });
                await batch.commit();
            }
            alert("업로드 처리 완료되었습니다.");
        } catch (e) {
            console.error(e);
            alert("처리 중 오류가 발생했습니다.");
        } finally {
            setIsProcessing(false);
            setPendingUpload([]);
            setDuplicateData([]);
        }
    };

    const handleDuplicateResolve = (action: 'keep' | 'skip' | 'replace') => {
        setShowDuplicateModal(false);
        if (action === 'keep') {
            processBatchUpload(pendingUpload);
        } else if (action === 'skip') {
            const toAdd = pendingUpload.filter(item => !duplicateData.some(d => d.new === item));
            processBatchUpload(toAdd);
        } else if (action === 'replace') {
            const toAdd = pendingUpload.filter(item => !duplicateData.some(d => d.new === item));
            const toUpdate = duplicateData.map(d => ({ ...d.new, id: d.old.id }));
            processBatchUpload(toAdd, toUpdate);
        }
    };

    const checkboxClass = "appearance-none w-4 h-4 border-2 border-gray-300 rounded bg-white checked:bg-blue-600 checked:border-blue-600 checked:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22white%22%20stroke-width%3D%224%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22M5%2013l4%204L19%207%22%2F%3E%3C%2Fsvg%3E')] cursor-pointer transition-colors";

    return (
        <div className="flex flex-col h-full overflow-hidden bg-white text-gray-900 relative"> 
            {/* Styles, Modals, Top Toolbar same as before */}
            <style>{`
                input[type="date"]::-webkit-calendar-picker-indicator,
                input[type="time"]::-webkit-calendar-picker-indicator {
                    cursor: pointer;
                    filter: invert(0) !important;
                    opacity: 1 !important;
                    transform: scale(1.2);
                    display: block;
                    background-color: transparent;
                }
                input[type="date"], input[type="time"] {
                    color-scheme: light;
                }
            `}</style>

            <ConfirmModal 
                isOpen={!!alertMessage} 
                message={alertMessage || ''} 
                onConfirm={() => setAlertMessage(null)} 
                onCancel={() => setAlertMessage(null)} 
            />

            <TicketChargeModal 
                isOpen={showChargeModal} 
                onClose={() => setShowChargeModal(false)}
                onConfirm={onConfirmTicketCharge}
                transaction={chargeTargetTransaction}
                staffList={staff}
            />

            <ConfirmModal isOpen={showBatchDeleteConfirm} message={`${selectedIds.size}건의 항목을 삭제하시겠습니까?`} onConfirm={handleBatchDelete} onCancel={() => setShowBatchDeleteConfirm(false)} />
            
            {showDuplicateModal && (
                <DuplicateResolveModal 
                    duplicates={duplicateData} 
                    onResolve={handleDuplicateResolve} 
                    onCancel={() => { setShowDuplicateModal(false); setPendingUpload([]); setDuplicateData([]); }}
                />
            )}

            {editingTransaction && (
                <TransactionEditModal transaction={editingTransaction} onSave={handleEditSave} onCancel={() => setEditingTransaction(null)} />
            )}

            {/* Top Toolbar */}
            <div className="flex justify-end gap-2 p-2 bg-gray-50 border-b border-gray-200">
                <button 
                    onClick={handleDownloadTemplate} 
                    className="flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors shadow-sm"
                >
                    <Download className="w-3.5 h-3.5"/> 양식 다운로드
                </button>
                <label className={`flex items-center gap-1.5 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors shadow-sm cursor-pointer ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Upload className="w-3.5 h-3.5"/>}
                    {isProcessing ? '업로드 중...' : '엑셀 업로드'}
                    <input ref={fileInputRef} type="file" accept=".csv" onChange={handleUpload} className="hidden" disabled={isProcessing}/>
                </label>
            </div>

            {/* Main Table Area */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-scroll overflow-x-hidden relative custom-scrollbar bg-gray-50/20">
                {/* ... (Selection Toolbar, Mobile View) ... */}
                {selectedIds.size > 0 && (
                    <div className="sticky top-0 z-50 bg-red-50 px-4 py-2 flex justify-between items-center shadow-sm border-b border-red-100 animate-in fade-in slide-in-from-top-2 duration-200">
                        <span className="text-sm font-bold text-red-700 flex items-center gap-2">
                            <Check className="w-4 h-4"/> {selectedIds.size}개 항목 선택됨
                        </span>
                        <div className="flex gap-2">
                            <button onClick={() => setSelectedIds(new Set())} className="bg-white border border-red-200 text-red-600 text-xs px-3 py-1.5 rounded font-bold hover:bg-red-50 flex items-center">
                                <X className="w-3 h-3 mr-1"/> 취소
                            </button>
                            <button onClick={() => setShowBatchDeleteConfirm(true)} className="bg-red-600 text-white text-xs px-3 py-1.5 rounded font-bold hover:bg-red-700 flex items-center shadow-sm">
                                <Trash2 className="w-3 h-3 mr-1"/> 선택 삭제
                            </button>
                        </div>
                    </div>
                )}

                {/* Mobile Card List View */}
                <div className="md:hidden space-y-3 p-4 pb-24">
                    {/* ... Same as before ... */}
                    {sortedList.length === 0 && (
                        <div className="text-center text-gray-400 py-20">
                            <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-30"/>
                            <p>거래 내역이 없습니다.</p>
                        </div>
                    )}
                    {sortedList.map((t: any) => {
                        const { final } = calculateRow(t);
                        const isCompleted = t.isUploaded ? true : (t.isCompleted !== undefined ? t.isCompleted : (t.paidAmount >= final));
                        
                        return (
                            <div key={t.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                                <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${isCompleted ? 'bg-gray-200' : 'bg-red-500'}`}></div>
                                <div className="pl-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{t.category}</span>
                                            <div className="text-sm font-black text-gray-800 mt-1">{t.dogName} <span className="text-gray-400 font-normal">({t.customerName})</span></div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-gray-400">{t.startDate}</div>
                                            <div className="text-xs font-bold text-blue-600">{t.serviceDetail}</div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-end border-t border-gray-100 pt-2 mt-2">
                                        <div className="text-xs">
                                            <div className="text-gray-500">청구: {formatCurrency(final)}원</div>
                                            <div className={`font-black ${t.paidAmount < final ? 'text-red-600' : 'text-green-600'}`}>
                                                결제: {formatCurrency(t.paidAmount)}원
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => onToggleComplete(t.id, isCompleted)} className={`p-2 rounded-full border ${isCompleted ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-red-50 text-red-500 border-red-200 animate-pulse'}`}><Check className="w-4 h-4"/></button>
                                            <button onClick={() => setEditingTransaction(t)} className="p-2 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100"><Edit className="w-4 h-4"/></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Desktop Table */}
                <table className="hidden md:table w-full text-[11px] text-left whitespace-normal table-fixed border-collapse relative">
                    {type === '수입' ? <IncomeColumnGroups /> : <ExpenseColumnGroups />}
                    <thead className={`sticky top-0 z-30 ${type === '수입' ? 'bg-gray-100' : 'bg-red-50'} font-bold text-gray-600 shadow-sm border-b`}>
                        <tr>
                            <th className="p-2 text-center border-r"><input type="checkbox" checked={sortedList.length > 0 && selectedIds.size === sortedList.length} onChange={toggleSelectAll} className={checkboxClass}/></th>
                            <th className="p-2 border-r">일시</th>
                            <th className="p-2 border-r"><ExcelFilter title="항목" options={filterOptions.category} selected={filters.category} onChange={val => setFilters({...filters, category: val})} /></th>
                            <th className="p-2 border-r"><ExcelFilter title="상세" options={filterOptions.serviceDetail} selected={filters.serviceDetail} onChange={val => setFilters({...filters, serviceDetail: val})} /></th>
                            
                            {type === '수입' ? (
                                <>
                                    <th className="p-2 border-r"><ExcelFilter title="반려견(보호자)" options={filterOptions.dogName} selected={filters.dogName} onChange={val => setFilters({...filters, dogName: val})} /></th>
                                    <th className="p-2 border-r text-center">비고</th>
                                    <th className="p-2 border-r text-right">단가</th>
                                    <th className="p-2 border-r text-center text-gray-900">수량</th>
                                    <th className="p-2 border-r text-right"><ExcelFilter title="할인" options={filterOptions.discount} selected={filters.discount} onChange={val => setFilters({...filters, discount: val})} /></th>
                                    <th className="p-2 border-r text-right">청구액</th>
                                    <th className="p-2 border-r text-right text-blue-700">실결제</th>
                                    <th className="p-2 border-r text-center"><ExcelFilter title="수단" options={filterOptions.paymentMethod} selected={filters.paymentMethod} onChange={val => setFilters({...filters, paymentMethod: val})} /></th>
                                    <th className="p-2 border-r text-right bg-blue-50/50 text-blue-800"><div className="flex items-center justify-end"><span className="mr-1">잔고</span><input type="checkbox" checked={filters.hideZeroBalance} onChange={e => setFilters({...filters, hideZeroBalance: e.target.checked})} className={checkboxClass}/></div></th>
                                </>
                            ) : (
                                <>
                                    <th className="p-2 border-r text-center">확인자</th>
                                    <th className="p-2 border-r text-right text-red-700">결제액</th>
                                    <th className="p-2 border-r text-center">메모 (비고)</th>
                                </>
                            )}
                            <th className="p-2 text-center">관리</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100 bg-white">
                        {sortedList.map((t: any) => {
                             const { final, balance } = calculateRow(t);
                             const isUnpaid = balance > 0;
                             const customerBal = getCustomerBalance(t);
                             const isCompleted = t.isUploaded ? true : (t.isCompleted !== undefined ? t.isCompleted : (t.paidAmount >= final));
                             const isFuture = normalizeDate(t.startDate) > getNowDate();
                             const isOptimistic = t.isOptimistic;

                             let canChargeTicket = false;
                             if (t.category === '유치원') {
                                 let customer: Customer | undefined;
                                 if (t.customerId) customer = customers.find(c => c.id === t.customerId);
                                 else if (t.dogName && t.contact) {
                                     const phone = t.contact.replace(/[^0-9]/g, '');
                                     customer = customers.find(c => c.dogName === t.dogName && c.phone.replace(/[^0-9]/g, '') === phone);
                                 } else if (t.dogName && t.customerName) {
                                     customer = customers.find(c => c.dogName === t.dogName && c.ownerName === t.customerName);
                                 }
                                 if (customer && customer.ticket && customer.ticket.startDate) {
                                     if (normalizeDate(t.startDate) >= customer.ticket.startDate) canChargeTicket = true;
                                 }
                             }

                             let rowClass = "transition group ";
                             if (isOptimistic) rowClass += "bg-indigo-50/80 animate-pulse ";
                             else if (selectedIds.has(t.id)) rowClass += "bg-blue-50/80 ";
                             else if (isFuture) rowClass += "bg-gray-100/50 text-gray-500 hover:bg-gray-50 "; 
                             else if (!isCompleted && type === '수입') rowClass += "bg-yellow-50/60 hover:bg-yellow-50 "; 
                             else rowClass += "hover:bg-gray-50 ";

                             return (
                                <tr key={t.id} className={rowClass}>
                                    {/* ... Rows Content Same As Before ... */}
                                    <td className="p-1.5 text-center border-r">{isOptimistic ? <Loader2 className="w-3 h-3 mx-auto animate-spin text-indigo-500"/> : <input type="checkbox" checked={selectedIds.has(t.id)} onChange={()=>toggleSelect(t.id)} className={checkboxClass}/>}</td>
                                    <td className="p-1.5 border-r text-[10px] text-gray-600"><div>{t.startDate} {t.startTime}</div>{type === '수입' && (<div className="flex items-center justify-between text-gray-400 mt-0.5"><span>~ {t.endDate} {t.endTime}</span>{t.isRunning ? <button onClick={() => onStopService(t.id)} className="text-red-500 animate-pulse" title="종료"><StopCircle className="w-3 h-3"/></button> : t.category === '놀이방' && <button onClick={() => handleResumeService(t.id)} className="text-green-500" title="재개"><Play className="w-3 h-3"/></button>}</div>)}</td>
                                    <td className="p-1.5 border-r font-bold text-gray-700 text-center">{t.category}</td>
                                    <td className="p-1.5 border-r truncate text-gray-600">{t.serviceDetail} {t.extraDogCount && t.extraDogCount > 0 ? <span className="text-orange-500">(+{t.extraDogCount})</span> : null}</td>

                                    {type === '수입' ? (
                                        <>
                                            <td className="p-1.5 border-r"><div className="font-bold text-gray-800">{t.dogName} <span className="text-gray-400 font-normal">({t.customerName})</span></div><div className="text-[9px] text-gray-500 font-mono tracking-tighter">{t.contact}</div></td>
                                            <td className="p-1.5 border-r text-gray-500 truncate">{t.memo}</td>
                                            <td className="p-1.5 border-r text-right text-gray-500">{formatCurrency(t.price)}</td>
                                            <td className="p-1.5 border-r text-center text-gray-900 font-bold">{t.quantity || 1}</td>
                                            <td className="p-1.5 border-r text-right text-red-400">{t.discountValue > 0 ? `-${t.discountValue}${t.discountType==='percent'?'%':''}` : '-'}</td>
                                            <td className="p-1.5 border-r text-right font-medium text-blue-800">{isOptimistic ? formatCurrency(final) : <input type="number" defaultValue={final} onFocus={handleInputFocus} onMouseDown={handleInputMouseDown} onMouseUp={handleInputMouseUp} onClick={handleInputClick} onKeyDown={(e) => handleInputKeyDown(e, final)} onBlur={(e) => handleUpdateBilledAmount(t, parseInt(e.target.value) || 0)} className="w-full text-right bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-blue-300 rounded text-gray-900"/>}</td>
                                            <td className="p-1.5 border-r p-0 relative group/cell">{isOptimistic ? <div className="w-full h-full text-right p-1.5 font-bold text-gray-400">{formatCurrency(t.paidAmount)}</div> : <input key={t.paidAmount} type="number" defaultValue={t.paidAmount} onFocus={handleInputFocus} onMouseDown={handleInputMouseDown} onMouseUp={handleInputMouseUp} onClick={handleInputClick} onKeyDown={(e) => handleInputKeyDown(e, t.paidAmount)} onBlur={(e) => onUpdatePaidAmount(t.id, parseInt(e.target.value))} className="w-full h-full bg-transparent text-right p-1.5 focus:bg-white outline-none font-bold text-gray-900 focus:ring-1 focus:ring-blue-300 rounded"/>}{!isOptimistic && isUnpaid && <button onClick={() => handleFullPayment(t)} className="absolute left-1 top-1/2 -translate-y-1/2 bg-yellow-400 text-white rounded-full p-1 shadow-md hover:bg-yellow-500 hover:scale-110 transition-all opacity-0 group-hover/cell:opacity-100 z-10" title="원클릭 완납"><Zap className="w-3 h-3 fill-white" /></button>}</td>
                                            <td className="p-1.5 border-r text-center text-gray-600">{t.paymentMethod}</td>
                                            <td className="p-1.5 border-r text-right font-bold bg-blue-50/10 text-gray-900">{customerBal < 0 ? <span className="text-red-500">{formatCurrency(Math.abs(customerBal))} (미납)</span> : <span className="text-green-600">{formatCurrency(customerBal)}</span>}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="p-1.5 border-r text-center font-bold text-gray-700">{t.confirmer}</td>
                                            <td className="p-1.5 border-r text-right font-black text-red-600">{formatCurrency(t.paidAmount)}</td>
                                            <td className="p-1.5 border-r text-gray-600 whitespace-pre-wrap leading-tight">{t.memo}</td>
                                        </>
                                    )}
                                    <td className="p-1.5 text-center flex justify-center items-center h-full space-x-1">{!isOptimistic && <>{type === '수입' ? (t.isUploaded ? <span className="text-[9px] font-black bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200 cursor-help select-none" title="엑셀 업로드 데이터 (자동 완료)">Excel</span> : <input type="checkbox" checked={isCompleted} onChange={() => onToggleComplete(t.id, isCompleted)} className={checkboxClass + (isCompleted ? "" : " border-red-300 ring-2 ring-red-50")}/>) : null}{canChargeTicket && (t.ticketProcessed ? <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[9px] font-bold border border-emerald-200 select-none cursor-default"><CheckCircle className="w-3 h-3"/> 충전완료</span> : <button onClick={() => handleTicketCharge(t)} className="p-1.5 rounded transition text-purple-600 hover:text-purple-800 hover:bg-purple-100 animate-pulse"><Ticket className="w-3 h-3"/></button>)}<button onClick={()=>setEditingTransaction(t)} className="text-blue-500 hover:text-blue-700 hover:bg-blue-100 p-1.5 rounded transition"><Edit className="w-3 h-3"/></button></>}</td>
                                </tr>
                             );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Sticky Summary Bar (Income Only) */}
            {type === '수입' && focusedCustomer && (
                <div className="hidden md:flex bg-indigo-700 text-white px-4 py-2 justify-between items-center shadow-inner z-30 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-sm">
                            <span className="opacity-70 font-light text-xs">현재 선택된 고객:</span>
                            <span className="font-black text-lg">{focusedCustomer.dogName}</span>
                            <span className="opacity-80 text-xs">({focusedCustomer.ownerName})</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            {focusedCustomer.balance !== undefined ? (<><span className="text-xs font-bold opacity-80">현재 잔액:</span>{focusedCustomer.balance < 0 ? <span className="font-black text-yellow-300 text-xl">{formatCurrency(Math.abs(focusedCustomer.balance))}원 (미수)</span> : <span className="font-black text-emerald-300 text-xl">{formatCurrency(focusedCustomer.balance)}원 (적립)</span>}</>) : <span className="text-xs opacity-60">잔액 정보 없음</span>}
                        </div>
                        <button onClick={handleBalanceSync} disabled={isSyncingBalance} className={`flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-white/20 ${isSyncingBalance ? 'opacity-50 cursor-not-allowed' : ''}`} title="전체 거래 내역을 다시 조회하여 잔액을 보정합니다."><RotateCcw className={`w-3.5 h-3.5 ${isSyncingBalance ? 'animate-spin' : ''}`}/>{isSyncingBalance ? '동기화 중...' : '잔액 동기화'}</button>
                    </div>
                </div>
            )}

            {/* Mobile FAB */}
            <button onClick={() => setIsMobileFormOpen(true)} className="md:hidden fixed bottom-6 right-6 z-50 bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:bg-indigo-700 transition active:scale-95 animate-in fade-in"><Plus className="w-6 h-6"/></button>

            {/* Mobile Input Modal */}
            {isMobileFormOpen && (
                <div className="md:hidden fixed inset-0 z-[100] bg-white animate-in slide-in-from-bottom flex flex-col">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <h3 className="font-black text-lg">새 거래 등록</h3>
                        <button onClick={() => setIsMobileFormOpen(false)} className="p-2 bg-gray-200 rounded-full"><X className="w-5 h-5"/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">날짜</label><input type="date" value={newEntry.startDate} onChange={e=>setNewEntry({...newEntry, startDate: e.target.value})} className="w-full border p-3 rounded-xl bg-white text-sm" /></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">시간</label><input type="time" value={newEntry.startTime} onChange={e=>setNewEntry({...newEntry, startTime: e.target.value})} className="w-full border p-3 rounded-xl bg-white text-sm" /></div>
                        </div>
                        <div><label className="block text-xs font-bold text-gray-500 mb-1">카테고리</label><select value={newEntry.category} onChange={e=>setNewEntry({...newEntry, category: e.target.value, serviceDetail: ''})} className="w-full border p-3 rounded-xl bg-white text-sm font-bold">{availableCategories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">상세 선택</label>
                            {type === '지출' ? (
                                <>
                                    <input 
                                        list="mobile-expense-details"
                                        value={newEntry.serviceDetail} 
                                        onChange={selectItem} 
                                        className="w-full border p-3 rounded-xl bg-white text-sm"
                                        placeholder="직접 입력 또는 선택"
                                    />
                                    <datalist id="mobile-expense-details">
                                        {sortedItems.map((item: any) => <option key={item.id} value={item.name} />)}
                                    </datalist>
                                </>
                            ) : (
                                <select value={newEntry.serviceDetail} onChange={selectItem} className="w-full border p-3 rounded-xl bg-white text-sm">
                                    <option value="">선택하세요</option>
                                    {sortedItems.map((item: any) => <option key={item.id} value={item.name}>{item.name}</option>)}
                                </select>
                            )}
                        </div>
                        {type === '수입' ? (
                            <>
                                <div className="relative"><label className="block text-xs font-bold text-gray-500 mb-1">고객명/반려견</label><input type="text" value={customerSearch} onChange={e=>{const v = e.target.value; setCustomerSearch(v); setNewEntry(p=>({...p, dogName: v})); setShowSearch(true);}} className="w-full border p-3 rounded-xl bg-white text-sm" placeholder="검색..."/>{showSearch && customerSearch && (<div className="absolute top-full left-0 right-0 bg-white border shadow-xl rounded-xl mt-1 max-h-40 overflow-y-auto z-50">{searchResults.map((c: Customer) => (<div key={c.id} onClick={()=>selectCustomer(c)} className="p-3 border-b hover:bg-gray-50 text-sm"><span className="font-bold text-indigo-600">{c.dogName}</span> ({c.ownerName})</div>))}</div>)}</div>
                                <div className="grid grid-cols-2 gap-2"><div><label className="block text-xs font-bold text-gray-500 mb-1">결제액</label><input type="number" value={newEntry.paidAmount} onChange={e=>setNewEntry({...newEntry, paidAmount: parseInt(e.target.value)||0})} className="w-full border p-3 rounded-xl text-right font-black text-blue-600"/></div><div><label className="block text-xs font-bold text-gray-500 mb-1">결제수단</label><select value={newEntry.paymentMethod} onChange={e=>setNewEntry({...newEntry, paymentMethod: e.target.value})} className="w-full border p-3 rounded-xl bg-white text-sm"><option>카드</option><option>현금</option><option>이체</option></select></div></div>
                            </>
                        ) : (
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">지출 금액</label><input type="number" value={newEntry.paidAmount} onChange={e=>setNewEntry({...newEntry, paidAmount: parseInt(e.target.value)||0})} className="w-full border p-3 rounded-xl text-right font-black text-red-600"/></div>
                        )}
                        <div><label className="block text-xs font-bold text-gray-500 mb-1">메모</label><input type="text" value={newEntry.memo || ''} onChange={e=>setNewEntry({...newEntry, memo: e.target.value})} className="w-full border p-3 rounded-xl bg-white text-sm" /></div>
                        <button onClick={handleRegister} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-lg mt-4 shadow-lg">등록 완료</button>
                    </div>
                </div>
            )}

            {/* Desktop Input Form */}
            <div className={`hidden md:block shrink-0 z-40 border-t-2 shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.1)] overflow-y-scroll custom-scrollbar ${type === '수입' ? 'bg-indigo-50 border-indigo-200' : 'bg-red-50 border-red-200'}`}>
                <table className="w-full text-[11px] text-left table-fixed border-collapse">
                    {type === '수입' ? <IncomeColumnGroups /> : <ExpenseColumnGroups />}
                    <tbody>
                        <tr className={type === '수입' ? 'bg-indigo-50/80' : 'bg-red-50/80'}>
                            <td className="p-2 text-center border-r font-black text-gray-400">NEW</td>
                            <td className="p-2 border-r align-top">
                                <div className="flex flex-col gap-1">
                                    <div className="flex gap-0.5">
                                        <input type="date" value={newEntry.startDate} onChange={e=>setNewEntry({...newEntry, startDate: e.target.value})} className="flex-[3] min-w-0 text-[10px] border rounded px-0.5 py-1 bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400 font-medium cursor-pointer tracking-tighter" />
                                        <input type="time" value={newEntry.startTime} onChange={e=>setNewEntry({...newEntry, startTime: e.target.value})} className="flex-[2] min-w-0 text-[10px] border rounded px-0.5 py-1 bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400 font-medium cursor-pointer tracking-tighter"/>
                                    </div>
                                    {type === '수입' && (
                                        <div className="flex gap-0.5 relative pt-1 border-t border-indigo-200 border-dashed">
                                            <input type="date" value={newEntry.endDate} onChange={e=>setNewEntry({...newEntry, endDate: e.target.value})} className="flex-[3] min-w-0 text-[10px] border rounded px-0.5 py-1 bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400 font-medium cursor-pointer tracking-tighter" />
                                            <input type="time" value={newEntry.endTime} onChange={e=>setNewEntry({...newEntry, endTime: e.target.value})} className="flex-[2] min-w-0 text-[10px] border rounded px-0.5 py-1 bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400 font-medium cursor-pointer tracking-tighter"/>
                                        </div>
                                    )}
                                </div>
                            </td>
                            {/* Shared Category Dropdown */}
                            <td className="p-2 border-r align-top">
                                <select value={newEntry.category} onChange={e=>setNewEntry({...newEntry, category: e.target.value, serviceDetail: ''})} className="w-full border rounded px-1 py-1 font-bold bg-white text-gray-900 text-[10px] focus:ring-2 focus:ring-indigo-400 outline-none">
                                    {availableCategories.length === 0 && <option value="">항목 없음</option>}
                                    {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </td>
                            {/* Shared Detail Dropdown */}
                            <td className="p-2 border-r align-top">
                                {type === '지출' ? (
                                    <>
                                        <input 
                                            list="expense-details" 
                                            value={newEntry.serviceDetail} 
                                            onChange={selectItem} 
                                            className="w-full border rounded px-1 py-1 bg-white text-gray-900 text-[10px] focus:ring-2 focus:ring-red-400 outline-none"
                                            placeholder="직접입력/선택"
                                        />
                                        <datalist id="expense-details">
                                            {sortedItems.map((item: any) => (
                                                <option key={item.id} value={item.name} />
                                            ))}
                                        </datalist>
                                    </>
                                ) : (
                                    <select value={newEntry.serviceDetail} onChange={selectItem} className="w-full border rounded px-1 py-1 bg-white text-gray-900 text-[10px] focus:ring-2 focus:ring-indigo-400 outline-none">
                                        <option value="">상세 선택</option>
                                        {sortedItems.map((item: any) => (
                                            <option key={item.id} value={item.name}>{item.name}</option>
                                        ))}
                                    </select>
                                )}
                            </td>

                            {type === '수입' ? (
                                <>
                                    <td className="p-2 border-r align-top relative"><input type="text" value={customerSearch} onChange={e=>{const v = e.target.value; setCustomerSearch(v); setNewEntry(p=>({...p, dogName: v})); setShowSearch(true);}} placeholder="고객명" className="w-full border rounded px-1 py-1 bg-white text-gray-900 text-[10px] focus:ring-2 focus:ring-indigo-400 outline-none"/>{showSearch && customerSearch && (<div className="absolute bottom-full left-0 w-72 bg-white border border-gray-200 shadow-2xl rounded-xl z-50 mb-2 text-gray-900 overflow-hidden">{searchResults.length > 0 ? searchResults.map((c: Customer) => (<div key={c.id} onClick={()=>selectCustomer(c)} className="p-3 hover:bg-indigo-50 cursor-pointer border-b last:border-0 transition-colors"><div className="flex justify-between items-center mb-1"><span className="font-black text-indigo-700 text-sm">{c.dogName}</span><span className="text-gray-800 font-bold text-xs">({c.ownerName})</span></div><div className="text-right text-gray-600 font-medium text-xs tracking-wider">{c.phone}</div></div>)) : (<div className="p-3 text-center text-gray-400 text-xs">검색 결과가 없습니다.</div>)}</div>)}</td>
                                    <td className="p-2 border-r align-top"><input type="text" value={newEntry.memo || ''} onChange={e=>setNewEntry({...newEntry, memo: e.target.value})} placeholder="비고 입력" className="w-full border rounded px-1 py-1 text-[10px] bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-400"/></td>
                                    <td className="p-2 border-r align-top text-right"><input type="number" value={newEntry.price} onFocus={handleInputFocus} onMouseDown={handleInputMouseDown} onMouseUp={handleInputMouseUp} onClick={handleInputClick} onChange={e=>setNewEntry({...newEntry, price: parseInt(e.target.value)||0})} className="w-full border rounded px-1 text-right mb-1 bg-white text-gray-900 outline-none focus:ring-1 focus:ring-indigo-400"/>{newEntry.category==='호텔' && <select value={newEntry.extraDogCount} onChange={e=>setNewEntry({...newEntry, extraDogCount: parseInt(e.target.value)})} className="text-[9px] border border-orange-200 rounded bg-orange-50 text-orange-700 font-bold outline-none"><option value={0}>+0견</option><option value={1}>+1견</option><option value={2}>+2견</option></select>}</td>
                                    <td className="p-2 border-r align-top"><input type="number" value={newEntry.quantity} onFocus={handleInputFocus} onMouseDown={handleInputMouseDown} onMouseUp={handleInputMouseUp} onClick={handleInputClick} onChange={e=>setNewEntry({...newEntry, quantity: parseInt(e.target.value)||1})} className="w-full border rounded px-1 text-center bg-white text-gray-900 outline-none focus:ring-1 focus:ring-indigo-400"/></td>
                                    <td className="p-2 border-r align-top"><input type="number" value={newEntry.discountValue} onFocus={handleInputFocus} onMouseDown={handleInputMouseDown} onMouseUp={handleInputMouseUp} onClick={handleInputClick} onChange={e=>setNewEntry({...newEntry, discountValue: parseInt(e.target.value)||0})} className="w-full border rounded px-1 text-right text-red-500 bg-white outline-none focus:ring-1 focus:ring-indigo-400 mb-1" placeholder="0"/><select value={newEntry.discountType} onChange={e=>setNewEntry({...newEntry, discountType: e.target.value as any})} className="text-[9px] border rounded bg-white text-gray-700 w-full outline-none"><option value="amount">원</option><option value="percent">%</option></select></td>
                                    <td className="p-2 border-r align-top text-right font-bold text-blue-700 text-sm pt-1">{(() => { const { final } = calculateRow({...newEntry, price: newEntry.price + ((newEntry.extraDogCount||0)*10000)}); return formatCurrency(final); })()}</td>
                                    <td className="p-2 border-r align-top"><input type="number" value={newEntry.paidAmount} onFocus={handleInputFocus} onMouseDown={handleInputMouseDown} onMouseUp={handleInputMouseUp} onClick={handleInputClick} onChange={e=>setNewEntry({...newEntry, paidAmount: parseInt(e.target.value)||0})} onKeyDown={(e) => e.key==='Enter'&&handleRegister()} className="w-full border-2 border-indigo-200 rounded px-1 text-right font-bold focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900 outline-none"/></td>
                                    <td className="p-2 border-r align-top"><select value={newEntry.paymentMethod} onChange={e=>setNewEntry({...newEntry, paymentMethod: e.target.value})} className="w-full border rounded px-1 text-[10px] bg-white text-gray-700 focus:ring-1 focus:ring-indigo-400 outline-none"><option>카드</option><option>현금</option><option>국민은행</option><option>기업은행</option><option>기타</option></select></td>
                                    <td className="p-2 border-r align-top text-right text-sm pt-1">{(() => { const key = newEntry.customerId || (newEntry.dogName && newEntry.contact ? `${newEntry.dogName}_${newEntry.contact}` : null); const customerBal = getCustomerBalance(newEntry); const { balance } = calculateRow({...newEntry, price: newEntry.price + ((newEntry.extraDogCount||0)*10000)}); const totalEst = customerBal + balance; return totalEst < 0 ? <span className="text-red-500 font-bold">{formatCurrency(Math.abs(totalEst))} (미납)</span> : <span className="text-green-500">{formatCurrency(totalEst)}</span>; })()}</td>
                                </>
                            ) : (
                                <>
                                    <td className="p-2 border-r align-top">
                                        <select value={newEntry.confirmer || ''} onChange={e=>setNewEntry({...newEntry, confirmer: e.target.value})} className="w-full border rounded px-1 py-1 bg-white text-gray-900 text-[10px] focus:ring-2 focus:ring-red-400 outline-none font-bold">
                                            <option value="">선택</option>
                                            {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-2 border-r align-top">
                                        <input type="number" value={newEntry.paidAmount} onFocus={handleInputFocus} onMouseDown={handleInputMouseDown} onMouseUp={handleInputMouseUp} onClick={handleInputClick} onChange={e=>setNewEntry({...newEntry, paidAmount: parseInt(e.target.value)||0})} onKeyDown={(e) => e.key==='Enter'&&handleRegister()} className="w-full border-2 border-red-200 rounded px-1 text-right font-black text-red-600 focus:ring-2 focus:ring-red-500 bg-white outline-none"/>
                                    </td>
                                    <td className="p-2 border-r align-top">
                                        <textarea value={newEntry.memo || ''} onChange={e=>setNewEntry({...newEntry, memo: e.target.value})} placeholder="상세 내용 입력 (줄바꿈 가능)" className="w-full h-8 border rounded px-1 py-1 text-[10px] bg-white text-gray-900 outline-none focus:ring-2 focus:ring-red-400 resize-none overflow-hidden hover:h-20 transition-all z-50 relative"/>
                                    </td>
                                </>
                            )}
                            <td className="p-2 align-top text-center"><button onClick={handleRegister} className={`text-white w-full h-10 rounded shadow text-sm font-black transition-transform active:scale-95 ${type === '수입' ? 'bg-indigo-700 hover:bg-indigo-800' : 'bg-red-600 hover:bg-red-700'}`}>등록</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LedgerTable;
