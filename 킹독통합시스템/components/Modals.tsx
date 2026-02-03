
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Filter, Check, AlertTriangle, AlertOctagon, X, Plus, RefreshCw, Loader, Clock, Calendar as CalendarIcon, Save, Activity, Brain, Home, User, Syringe, ShieldAlert, Phone, MapPin, FileText, Edit, Copy, Trash2, RotateCcw, Ticket, Wallet, History, Minus, ArrowRight, CheckCircle, Link, UserPlus, Settings2, SplitSquareHorizontal, ClipboardPaste, ArrowDownToLine } from 'lucide-react';
import { formatCurrency, getNowDate, calculateAge, calculateTransactionDiff, getLocalYMD } from '../utils/helpers';
import { Customer, Transaction, Staff, TicketLog, Dog } from '../types';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, increment, writeBatch, addDoc } from 'firebase/firestore';
import { db, appId } from '../services/firebase';

export const ExcelFilter = ({ title, options, selected, onChange, align = 'left' }: { title: string, options: any[], selected: any[], onChange: (val: any[]) => void, align?: 'left'|'right'|'center' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const filterRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    const uniqueOptions = useMemo(() => {
        const set = new Set(options.filter(o => o !== null && o !== undefined && o !== ''));
        return Array.from(set).sort();
    }, [options]);
    const filteredOptions = uniqueOptions.filter(opt => String(opt).toLowerCase().includes(search.toLowerCase()));
    const toggleOption = (opt: any) => {
        if (selected.includes(opt)) onChange(selected.filter(s => s !== opt));
        else onChange([...selected, opt]);
    };
    const toggleAll = () => {
        if (selected.length === uniqueOptions.length) onChange([]);
        else onChange(uniqueOptions);
    };
    const isActive = selected.length > 0 && selected.length < uniqueOptions.length;
    
    // Determine justification based on align prop
    const justifyClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

    return (
        <div className={`relative inline-block w-full text-${align}`} ref={filterRef}>
            <button onClick={() => setIsOpen(!isOpen)} className={`flex items-center ${justifyClass} w-full px-1 py-1 text-[11px] border rounded transition-colors ${isActive || isOpen ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                <span className="truncate font-bold mr-1">{title}</span>
                <Filter className={`w-3 h-3 flex-shrink-0 ${isActive ? 'fill-blue-700' : 'text-gray-400'}`}/>
            </button>
            {isOpen && (
                <div className="absolute z-50 mt-1 w-56 bg-white border border-gray-300 rounded-lg shadow-xl p-2 left-0 text-left animate-in fade-in zoom-in-95 duration-100 max-h-64 flex flex-col text-gray-900">
                    <input type="text" placeholder="검색..." value={search} onChange={e => setSearch(e.target.value)} className="w-full px-2 py-1.5 mb-2 text-xs border rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900" autoFocus />
                    <div className="flex items-center mb-1 pb-1 border-b cursor-pointer hover:bg-gray-50 p-1 rounded" onClick={toggleAll}>
                        <div className={`w-4 h-4 border rounded mr-2 flex items-center justify-center ${selected.length === uniqueOptions.length ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                            {selected.length === uniqueOptions.length && <Check className="w-3 h-3 text-white"/>}
                        </div>
                        <span className="text-xs font-bold text-gray-700">(모두 선택)</span>
                    </div>
                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                        {filteredOptions.map((opt, idx) => (
                            <div key={idx} className="flex items-center hover:bg-blue-50 p-1.5 rounded cursor-pointer" onClick={() => toggleOption(opt)}>
                                <div className={`w-4 h-4 border rounded mr-2 flex items-center justify-center flex-shrink-0 ${selected.includes(opt) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                    {selected.includes(opt) && <Check className="w-3 h-3 text-white"/>}
                                </div>
                                <span className="text-xs text-gray-700 truncate">{opt}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export const ConfirmModal = ({ isOpen, message, onConfirm, onCancel }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6 text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-6 h-6 text-red-600"/></div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">확인해주세요</h3>
                    <p className="text-gray-600 mb-6 whitespace-pre-wrap">{message}</p>
                    <div className="flex gap-3 justify-center">
                        <button onClick={onCancel} className="px-4 py-2 border rounded-lg text-gray-600 font-bold hover:bg-gray-50 bg-white">취소</button>
                        <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700">확인</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const DataMatchingModal = ({ isOpen, onClose, transactions, customers }: { isOpen: boolean, onClose: () => void, transactions: Transaction[], customers: Customer[] }) => {
    const [matches, setMatches] = useState<{ transaction: Transaction, customer: Customer }[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isLinking, setIsLinking] = useState(false);

    useEffect(() => {
        if (isOpen) {
            scanData();
        }
    }, [isOpen, transactions, customers]);

    const normalize = (str?: string) => str ? str.trim().replace(/\s+/g, '') : '';

    const scanData = () => {
        setIsScanning(true);
        const candidates: { transaction: Transaction, customer: Customer }[] = [];
        
        const unlinked = transactions.filter(t => !t.customerId);

        unlinked.forEach(t => {
            const tDog = normalize(t.dogName);
            const tPhone = t.contact ? t.contact.replace(/[^0-9]/g, '') : '';
            const tOwner = normalize(t.customerName);

            if (!tDog) return;

            const match = customers.find(c => {
                const cDog = normalize(c.dogName);
                if (cDog !== tDog) return false;

                const cPhone = c.phone.replace(/[^0-9]/g, '');
                const cOwner = normalize(c.ownerName);

                return (tPhone && cPhone && cPhone.endsWith(tPhone.slice(-4))) || (tOwner && cOwner === tOwner);
            });

            if (match) {
                candidates.push({ transaction: t, customer: match });
            }
        });

        setMatches(candidates);
        setIsScanning(false);
    };

    const handleExecuteLink = async () => {
        if (matches.length === 0) return;
        setIsLinking(true);
        
        const batch = writeBatch(db);
        let count = 0;

        const targetMatches = matches.slice(0, 400);

        targetMatches.forEach(({ transaction, customer }) => {
            const ref = doc(db, 'kingdog', appId, 'transactions', transaction.id);
            batch.update(ref, {
                customerId: customer.id,
                dogName: customer.dogName,
                customerName: customer.ownerName,
                contact: customer.phone,
                dogBreed: customer.breed || transaction.dogBreed
            });
            count++;
        });

        try {
            await batch.commit();
            alert(`${count}건의 데이터가 성공적으로 연결되었습니다.\n(남은 건수는 다시 검색됩니다)`);
            scanData(); 
        } catch (e) {
            console.error(e);
            alert("연결 중 오류가 발생했습니다.");
        } finally {
            setIsLinking(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in zoom-in duration-200">
            <div className="bg-white w-full max-w-3xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                <div className="bg-indigo-900 p-5 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h3 className="font-black text-lg flex items-center"><Link className="mr-2 w-5 h-5"/> 미연동 데이터 자동 연결</h3>
                        <p className="text-xs text-indigo-300 mt-1">장부에만 있고 고객 정보와 연결되지 않은 데이터를 찾아 병합합니다.</p>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition"><X className="w-5 h-5"/></button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col p-6">
                    {isScanning ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                            <Loader className="w-10 h-10 animate-spin mb-4 text-indigo-600"/>
                            <p className="font-bold">데이터를 분석 중입니다...</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center mb-4 shrink-0">
                                <div className="text-sm font-bold text-gray-700">
                                    발견된 매칭 후보: <span className="text-indigo-600 text-lg">{matches.length}건</span>
                                </div>
                                <div className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded">
                                    기준: 강아지이름 + (연락처 또는 보호자명) 일치
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar border rounded-xl bg-gray-50">
                                {matches.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                        <CheckCircle className="w-12 h-12 mb-3 text-green-500"/>
                                        <p className="font-bold">연결할 데이터가 없습니다.</p>
                                        <p className="text-xs">모든 장부 데이터가 고객 정보와 잘 연결되어 있습니다.</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-gray-100 text-gray-500 font-bold sticky top-0 shadow-sm">
                                            <tr>
                                                <th className="p-3">장부 데이터 (Source)</th>
                                                <th className="p-3 text-center"><ArrowRight className="w-4 h-4 mx-auto"/></th>
                                                <th className="p-3">고객 정보 (Target)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {matches.map((m, i) => (
                                                <tr key={i} className="hover:bg-indigo-50 transition-colors">
                                                    <td className="p-3">
                                                        <div className="font-bold text-gray-800">{m.transaction.dogName}</div>
                                                        <div className="text-gray-500">{m.transaction.customerName} ({m.transaction.contact})</div>
                                                        <div className="text-[10px] text-gray-400 mt-1">{m.transaction.startDate} | {m.transaction.category}</div>
                                                    </td>
                                                    <td className="p-3 text-center text-indigo-300">
                                                        <Link className="w-4 h-4 mx-auto"/>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="font-bold text-indigo-700">{m.customer.dogName}</div>
                                                        <div className="text-gray-600">{m.customer.ownerName} ({m.customer.phone})</div>
                                                        <div className="text-[10px] text-green-600 font-bold mt-1">ID: {m.customer.customerNumber || '자동부여'}</div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className="p-5 border-t bg-gray-50 flex justify-end shrink-0">
                    <button 
                        onClick={handleExecuteLink}
                        disabled={matches.length === 0 || isLinking}
                        className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg flex items-center gap-2 transition-all ${matches.length > 0 ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95' : 'bg-gray-300 cursor-not-allowed'}`}
                    >
                        {isLinking ? <Loader className="w-4 h-4 animate-spin"/> : <Link className="w-4 h-4"/>}
                        {isLinking ? '연결 중...' : `${matches.length}건 전체 연결하기`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const TicketChargeModal = ({ isOpen, onClose, onConfirm, transaction, staffList }: { 
    isOpen: boolean, 
    onClose: () => void, 
    onConfirm: (data: any) => void, 
    transaction: Transaction | null,
    staffList: Staff[] 
}) => {
    const [count, setCount] = useState<number>(transaction?.quantity || 10);
    const [expiryDate, setExpiryDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 60); 
        return getLocalYMD(d);
    });
    const [staffName, setStaffName] = useState('');
    const [memo, setMemo] = useState('');

    useEffect(() => {
        if (transaction) {
            let initialCount = transaction.quantity;
            const match = transaction.serviceDetail.match(/(\d+)회/);
            if (match) {
                initialCount = parseInt(match[1]);
            }
            setCount(initialCount);
            setMemo(`${transaction.serviceDetail} 구매 충전`);
        }
    }, [transaction]);

    if (!isOpen || !transaction) return null;

    const handleSubmit = () => {
        if (!staffName) return;
        onConfirm({ count, expiryDate, staffName, memo });
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full h-full md:h-auto md:max-w-sm md:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-200">
                <div className="bg-indigo-600 p-4 text-white flex justify-between items-center shrink-0">
                    <h3 className="font-black flex items-center"><Ticket className="w-5 h-5 mr-2"/> 이용권 충전 (장부연동)</h3>
                    <button onClick={onClose}><X className="w-5 h-5"/></button>
                </div>
                
                <div className="bg-gray-50 p-4 border-b shrink-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold bg-white border px-2 py-0.5 rounded text-gray-500">{transaction.startDate}</span>
                        <span className="text-xs font-black text-gray-800">{transaction.dogName} ({transaction.customerName})</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-600">{transaction.serviceDetail}</span>
                        <span className="text-sm font-black text-blue-600">{formatCurrency(transaction.paidAmount)}원</span>
                    </div>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">충전 횟수 (회)</label>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setCount(Math.max(1, count - 1))} className="w-10 h-10 border rounded-lg flex items-center justify-center hover:bg-gray-50 bg-white"><X className="w-4 h-4 rotate-45"/></button>
                            <input type="number" value={count} onChange={e => setCount(parseInt(e.target.value) || 0)} className="flex-1 h-10 border p-2 rounded-lg text-center font-bold text-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"/>
                            <button onClick={() => setCount(count + 1)} className="w-10 h-10 border rounded-lg flex items-center justify-center hover:bg-gray-50 bg-white"><Plus className="w-4 h-4"/></button>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">유효기간 설정</label>
                        <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm font-medium bg-white text-gray-900"/>
                        <div className="flex gap-2 mt-2">
                            <button onClick={() => { const d = new Date(); d.setDate(d.getDate() + 30); setExpiryDate(getLocalYMD(d)); }} className="flex-1 py-1.5 text-xs border rounded bg-white hover:bg-gray-50 text-gray-600">30일</button>
                            <button onClick={() => { const d = new Date(); d.setDate(d.getDate() + 60); setExpiryDate(getLocalYMD(d)); }} className="flex-1 py-1.5 text-xs border rounded bg-white hover:bg-gray-50 text-gray-600">60일</button>
                            <button onClick={() => { const d = new Date(); d.setDate(d.getDate() + 90); setExpiryDate(getLocalYMD(d)); }} className="flex-1 py-1.5 text-xs border rounded bg-white hover:bg-gray-50 text-gray-600">90일</button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-red-600 mb-1 flex items-center"><User className="w-3 h-3 mr-1"/> 담당 직원 (필수)</label>
                        <select value={staffName} onChange={e => setStaffName(e.target.value)} className="w-full border-2 border-red-100 p-2.5 rounded-lg text-sm bg-white font-bold outline-none focus:border-red-500 text-gray-900">
                            <option value="">담당자를 선택하세요</option>
                            {staffList.filter(s => s.isActive).map(s => (
                                <option key={s.id} value={s.name}>{s.name} ({s.role})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">메모</label>
                        <input type="text" value={memo} onChange={e => setMemo(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm bg-white text-gray-900" placeholder="예: 이벤트 추가 증정"/>
                    </div>

                    <button 
                        onClick={handleSubmit} 
                        disabled={!staffName || count <= 0}
                        className={`w-full py-3 rounded-xl font-black text-white shadow-lg transition-all flex items-center justify-center gap-2 ${staffName && count > 0 ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95' : 'bg-gray-300 cursor-not-allowed'}`}
                    >
                        <Wallet className="w-5 h-5"/> 충전하기
                    </button>
                </div>
            </div>
        </div>
    );
};

export const TicketHistoryModal = ({ isOpen, onClose, customer, onUpdate, staffList }: { 
    isOpen: boolean, 
    onClose: () => void, 
    customer: Customer, 
    onUpdate: (updated: Customer) => void,
    staffList: Staff[]
}) => {
    const [isAdjusting, setIsAdjusting] = useState(false);
    const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('subtract');
    const [amount, setAmount] = useState(1);
    const [staffName, setStaffName] = useState('');
    const [reason, setReason] = useState('');

    if (!isOpen || !customer.ticket) return null;

    const history = [...(customer.ticket.history || [])].sort((a, b) => b.date.localeCompare(a.date));

    const handleManualAdjustment = async () => {
        if (!staffName || !reason) return alert('담당자와 사유는 필수입니다.');
        if (amount <= 0) return alert('수량은 1 이상이어야 합니다.');

        const adjustValue = adjustType === 'add' ? amount : -amount;
        const currentRemaining = customer.ticket?.remaining || 0;
        const newRemaining = currentRemaining + adjustValue;

        const newLog: TicketLog = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            type: 'edit',
            amount: adjustValue,
            prevRemaining: currentRemaining,
            newRemaining: newRemaining,
            staffName: staffName,
            reason: `[수동조정] ${reason}`
        };

        try {
            await updateDoc(doc(db, 'kingdog', appId, 'customers', customer.id), {
                "ticket.remaining": increment(adjustValue),
                "ticket.history": arrayUnion(newLog),
                "ticket.lastUpdated": new Date().toISOString()
            });

            const updatedTicket = {
                ...customer.ticket!,
                remaining: newRemaining,
                history: [...(customer.ticket?.history || []), newLog]
            };
            onUpdate({ ...customer, ticket: updatedTicket });
            
            setIsAdjusting(false);
            setAmount(1);
            setReason('');
            setStaffName('');
            alert('조정되었습니다.');
        } catch (e) {
            console.error(e);
            alert('오류가 발생했습니다.');
        }
    };

    const getTypeBadge = (type: string) => {
        switch(type) {
            case 'init': return <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold">초기화</span>;
            case 'charge': return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">충전</span>;
            case 'use': return <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold border">사용</span>;
            case 'restore': return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">복구</span>;
            case 'edit': return <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold">조정</span>;
            default: return <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px]">기타</span>;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in duration-200">
            <div className="bg-white w-full h-full md:h-[85vh] md:max-w-lg md:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="bg-indigo-900 p-5 flex justify-between items-center text-white shrink-0">
                    <h3 className="font-black text-lg flex items-center"><History className="mr-2 w-5 h-5"/> 이용권 상세 이력</h3>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition"><X className="w-5 h-5"/></button>
                </div>
                <div className="p-6 bg-indigo-50 border-b flex justify-between items-center shrink-0">
                    <div>
                        <div className="text-xs font-bold text-indigo-400 mb-1">현재 잔여 횟수</div>
                        <div className="text-4xl font-black text-indigo-900">{customer.ticket.remaining}<span className="text-lg text-indigo-400 ml-1">회</span></div>
                        <div className="text-[10px] font-bold text-indigo-400 mt-1">유효기간: {customer.ticket.expiryDate} 까지</div>
                    </div>
                    <button onClick={() => setIsAdjusting(!isAdjusting)} className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${isAdjusting ? 'bg-gray-200 text-gray-600' : 'bg-white text-indigo-600 border-indigo-200 shadow-sm hover:bg-indigo-50'}`}>
                        {isAdjusting ? '조정 취소' : '🛠️ 수동 조정'}
                    </button>
                </div>
                {isAdjusting && (
                    <div className="bg-orange-50 p-5 border-b border-orange-100 animate-in slide-in-from-top-2 shrink-0">
                        <h4 className="font-black text-orange-800 text-sm mb-3 flex items-center"><AlertOctagon className="w-4 h-4 mr-2"/> 관리자 수동 조정</h4>
                        <div className="flex gap-2 mb-3">
                            <button onClick={()=>setAdjustType('subtract')} className={`flex-1 py-2 text-xs font-bold rounded border ${adjustType==='subtract' ? 'bg-red-50 text-white border-red-600' : 'bg-white text-gray-500'}`}>차감 (-)</button>
                            <button onClick={()=>setAdjustType('add')} className={`flex-1 py-2 text-xs font-bold rounded border ${adjustType==='add' ? 'bg-blue-500 text-white border-blue-600' : 'bg-white text-gray-500'}`}>지급 (+)</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 block mb-1">수량</label>
                                <input type="number" value={amount} onChange={e=>setAmount(parseInt(e.target.value)||0)} className="w-full p-2 text-sm border rounded font-bold bg-white text-gray-900"/>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 block mb-1">담당자</label>
                                <select value={staffName} onChange={e=>setStaffName(e.target.value)} className="w-full p-2 text-sm border rounded bg-white text-gray-900">
                                    <option value="">선택</option>
                                    {staffList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <input type="text" value={reason} onChange={e=>setReason(e.target.value)} placeholder="조정 사유를 입력하세요 (필수)" className="w-full p-2 text-sm border rounded bg-white mb-3 text-gray-900"/>
                        <button onClick={handleManualAdjustment} className="w-full py-3 bg-orange-600 text-white font-bold rounded-lg text-sm shadow hover:bg-orange-700 transition">적용하기</button>
                    </div>
                )}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white p-4">
                    <div className="space-y-3">
                        {history.map((log, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50 transition-colors">
                                <div className="flex items-start gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${log.amount > 0 ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                                        {log.amount > 0 ? '+' : ''}{log.amount}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            {getTypeBadge(log.type)}
                                            <span className="text-xs font-bold text-gray-800">{log.reason}</span>
                                        </div>
                                        <div className="text-[10px] text-gray-400">
                                            {log.date.slice(0, 16).replace('T', ' ')} · 담당: {log.staffName}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-gray-400">잔여</div>
                                    <div className="font-black text-gray-800 text-sm">{log.newRemaining}</div>
                                </div>
                            </div>
                        ))}
                        {history.length === 0 && <div className="text-center text-gray-400 py-10 text-xs">기록이 없습니다.</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const TicketInitModal = ({ isOpen, onClose, onConfirm, staffList }: { isOpen: boolean, onClose: () => void, onConfirm: (data: any) => void, staffList: Staff[] }) => {
    const [count, setCount] = useState<number>(10);
    const [startDate, setStartDate] = useState(getNowDate());
    const [expiryDate, setExpiryDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 2); // Default 2 months
        return getLocalYMD(d);
    });
    const [staffName, setStaffName] = useState('');
    const [reason, setReason] = useState('신규 등록');

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!staffName) return;
        onConfirm({ count, startDate, expiryDate, staffName, reason });
    };

    const validStaffList = Array.isArray(staffList) ? staffList : [];

    return (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full h-full md:h-auto md:max-w-sm md:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-200">
                <div className="bg-purple-600 p-4 text-white flex justify-between items-center shrink-0">
                    <h3 className="font-black flex items-center"><Ticket className="w-5 h-5 mr-2"/> 유치원 이용권 시작</h3>
                    <button onClick={onClose}><X className="w-5 h-5"/></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">초기 횟수</label>
                        <div className="flex gap-2">
                            {[10, 20, 30].map(n => (
                                <button key={n} onClick={() => setCount(n)} className={`flex-1 py-2 text-xs font-bold rounded-lg border ${count === n ? 'bg-purple-50 border-purple-500 text-purple-700' : 'bg-white text-gray-600'}`}>
                                    {n}회
                                </button>
                            ))}
                        </div>
                        <input type="number" value={count} onChange={e => setCount(parseInt(e.target.value) || 0)} className="w-full mt-2 border p-2 rounded-lg text-center font-bold text-lg outline-none focus:ring-2 focus:ring-purple-500 bg-white text-gray-900"/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">시작일</label>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border p-2 rounded-lg text-sm font-medium bg-white text-gray-900"/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">유효기간</label>
                            <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full border p-2 rounded-lg text-sm font-medium text-red-600 bg-white"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-red-600 mb-1 flex items-center"><User className="w-3 h-3 mr-1"/> 담당 직원 (필수)</label>
                        <select value={staffName} onChange={e => setStaffName(e.target.value)} className="w-full border-2 border-red-100 p-2.5 rounded-lg text-sm bg-white font-bold outline-none focus:border-red-500 text-gray-900">
                            <option value="">담당자를 선택하세요</option>
                            {validStaffList.filter(s => s.isActive).map(s => (
                                <option key={s.id} value={s.name}>{s.name} ({s.role})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">메모 (사유)</label>
                        <input type="text" value={reason} onChange={e => setReason(e.target.value)} className="w-full border p-2 rounded-lg text-sm bg-white text-gray-900" placeholder="예: 신규 결제, 이벤트 증정"/>
                    </div>
                    <button onClick={handleSubmit} disabled={!staffName} className={`w-full py-3 rounded-xl font-black text-white shadow-lg transition-all ${staffName ? 'bg-purple-600 hover:bg-purple-700 active:scale-95' : 'bg-gray-300 cursor-not-allowed'}`}>
                        이용권 생성 및 시작
                    </button>
                </div>
            </div>
        </div>
    );
};

export const DuplicateResolveModal = ({ duplicates, onResolve, onCancel }: { duplicates: any[], onResolve: (action: 'keep' | 'skip' | 'replace') => void, onCancel: () => void }) => {
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[220] p-4">
            <div className="bg-white w-full h-full md:h-auto md:max-w-md md:rounded-xl shadow-2xl overflow-hidden animate-in zoom-in duration-200 text-gray-900 flex flex-col">
                <div className="bg-orange-500 p-4 text-white flex items-center justify-between shrink-0">
                    <h3 className="font-bold flex items-center"><AlertOctagon className="w-5 h-5 mr-2"/> 중복 데이터 발견</h3>
                    <button onClick={onCancel}><X className="w-5 h-5"/></button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto">
                    <p className="text-gray-700 font-bold mb-2 text-lg">총 {duplicates.length}건의 중복 데이터가 있습니다.</p>
                    <div className="bg-gray-50 p-3 rounded text-xs text-gray-500 mb-6 max-h-32 overflow-y-auto">
                        {duplicates.slice(0, 5).map((d: any, i: number) => (
                            <div key={i} className="border-b last:border-0 py-1">
                                {d.new.startDate} | {d.new.dogName} | {d.new.serviceDetail} | {formatCurrency(d.new.paidAmount)}원 
                            </div>
                        ))}
                        {duplicates.length > 5 && <div className="text-center pt-2">...외 {duplicates.length - 5}건</div>}
                    </div>
                    <div className="flex flex-col gap-2">
                        <button onClick={() => onResolve('keep')} className="w-full py-3 bg-blue-50 text-blue-700 rounded-lg font-bold hover:bg-blue-100 flex items-center justify-center border border-blue-200">
                            <Copy className="w-4 h-4 mr-2"/> 모두 유지 (중복 등록)
                        </button>
                        <button onClick={() => onResolve('replace')} className="w-full py-3 bg-orange-50 text-orange-700 rounded-lg font-bold hover:bg-orange-100 flex items-center justify-center border border-orange-200">
                            <RefreshCw className="w-4 h-4 mr-2"/> 덮어쓰기 (기존 삭제 후 등록)
                        </button>
                        <button onClick={() => onResolve('skip')} className="w-full py-3 bg-gray-50 text-gray-700 rounded-lg font-bold hover:bg-gray-100 flex items-center justify-center border border-gray-200">
                            <Trash2 className="w-4 h-4 mr-2"/> 건너뛰기 (중복 제외 등록)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ProgressModal = ({ status }: any) => {
    if (!status.active) return null;
    const percentage = status.total > 0 ? Math.round((status.current / status.total) * 100) : 0;
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[210] p-4 backdrop-blur-sm text-gray-900">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center">
                <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4"/>
                <h3 className="text-xl font-bold mb-1">{status.type} 진행 중</h3>
                <div className="w-full bg-gray-200 rounded-full h-4 mb-2 overflow-hidden mt-6">
                    <div className="bg-blue-600 h-4 rounded-full transition-all duration-300" style={{ width: `${percentage}%` }}></div>
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-500">
                    <span>{status.current} / {status.total} 건</span>
                    <span>{percentage}%</span>
                </div>
            </div>
        </div>
    );
};

export const TabLoading = ({ message = "데이터를 불러오고 있습니다..." }: { message?: string }) => (
    <div className="flex flex-col items-center justify-center h-full text-gray-400 min-h-[300px]">
        <Loader className="w-12 h-12 mb-4 animate-spin text-blue-500" />
        <p className="font-bold text-lg text-gray-600">{message}</p>
    </div>
);

export const InitialLoader = () => (
    <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center">
        <div className="w-20 h-20 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-gray-800">시스템 데이터 로딩 중...</h2>
    </div>
);

export const TransactionEditModal = ({ transaction, onSave, onCancel }: any) => {
    const [form, setForm] = useState({ ...transaction });

    useEffect(() => {
        if (['호텔', '놀이방'].includes(form.category)) {
            const start = new Date(`${form.startDate}T${form.startTime}`);
            const end = new Date(`${form.endDate}T${form.endTime}`);
            const diffMs = end.getTime() - start.getTime();
            if (diffMs >= 0) {
                if (form.category === '호텔') {
                    const nights = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
                    if (form.quantity !== nights) setForm(prev => ({ ...prev, quantity: nights }));
                } else if (form.category === '놀이방') {
                    const hours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
                    if (form.quantity !== hours) setForm(prev => ({ ...prev, quantity: hours }));
                }
            }
        }
    }, [form.startDate, form.startTime, form.endDate, form.endTime, form.category]);

    return (
        <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm text-gray-900">
            <div className="bg-white w-full h-full md:h-auto md:max-w-md md:rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
                <div className="bg-white border-b p-5 flex justify-between items-center shrink-0">
                    <h3 className="text-xl font-black text-gray-900">서비스 시간 및 금액 수정</h3>
                    <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition"><X/></button>
                </div>
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                    <div className="flex items-center gap-3 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">{form.dogName[0]}</div>
                        <div>
                            <div className="font-black text-gray-900">{form.dogName} <span className="text-xs font-normal text-gray-500">({form.category})</span></div>
                            <div className="text-xs text-indigo-600 font-bold">{form.serviceDetail}</div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 flex items-center"><CalendarIcon className="w-3 h-3 mr-1"/> 서비스 시작</label>
                            <div className="flex gap-2">
                                <input type="date" value={form.startDate} onChange={e=>setForm({...form, startDate: e.target.value})} className="flex-[2] border border-gray-300 p-2.5 rounded-xl text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                                <input type="time" value={form.startTime} onChange={e=>setForm({...form, startTime: e.target.value})} className="flex-1 border border-gray-300 p-2.5 rounded-xl text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 flex items-center"><Clock className="w-3 h-3 mr-1"/> 서비스 종료</label>
                            <div className="flex gap-2">
                                <input type="date" value={form.endDate} onChange={e=>setForm({...form, endDate: e.target.value})} className="flex-[2] border border-gray-300 p-2.5 rounded-xl text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                                <input type="time" value={form.endTime} onChange={e=>setForm({...form, endTime: e.target.value})} className="flex-1 border border-gray-300 p-2.5 rounded-xl text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                            </div>
                        </div>
                        
                        {/* Financials & Discount Edit Section */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
                            <h4 className="font-bold text-sm text-gray-700">금액 및 할인 수정</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 block mb-1">단가</label>
                                    <input 
                                        type="number" 
                                        value={form.price} 
                                        onChange={e => setForm({...form, price: parseInt(e.target.value) || 0})}
                                        className="w-full border border-gray-300 p-2 rounded-lg text-sm text-right font-bold bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 block mb-1">수량</label>
                                    <input 
                                        type="number" 
                                        value={form.quantity} 
                                        onChange={e => setForm({...form, quantity: parseInt(e.target.value) || 1})}
                                        className="w-full border border-gray-300 p-2 rounded-lg text-sm text-center font-bold bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 block mb-1">할인 설정</label>
                                    <div className="flex gap-1">
                                        <input 
                                            type="number" 
                                            value={form.discountValue} 
                                            onChange={e => setForm({...form, discountValue: parseFloat(e.target.value) || 0})}
                                            className="w-full border border-gray-300 p-2 rounded-lg text-sm text-right text-red-500 font-bold bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                            placeholder="0"
                                        />
                                        <select 
                                            value={form.discountType} 
                                            onChange={e => setForm({...form, discountType: e.target.value as any})}
                                            className="border border-gray-300 rounded-lg text-xs bg-gray-50 outline-none"
                                        >
                                            <option value="amount">원</option>
                                            <option value="percent">%</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 block mb-1">실결제액</label>
                                    <input 
                                        type="number" 
                                        value={form.paidAmount} 
                                        onChange={e => setForm({...form, paidAmount: parseInt(e.target.value) || 0})}
                                        className="w-full border-2 border-indigo-100 p-2 rounded-lg text-sm text-right font-black text-indigo-600 bg-white focus:border-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {['호텔', '놀이방'].includes(form.category) && (
                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex justify-between items-center">
                                <span className="text-sm font-bold text-orange-800">자동 계산 수량</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl font-black text-orange-600">{form.quantity}</span>
                                    <span className="text-xs text-orange-400 font-bold">{form.category === '호텔' ? '박' : '시간'}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl space-y-2">
                        <label className="text-xs font-bold text-gray-400">비고 (메모)</label>
                        <textarea value={form.memo || ''} onChange={e=>setForm({...form, memo: e.target.value})} className="w-full border border-gray-300 p-2 rounded-xl text-sm h-20 outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900" placeholder="참고사항 입력..."/>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onCancel} className="flex-1 py-4 bg-gray-100 rounded-2xl font-black text-gray-600 hover:bg-gray-200 transition">취소</button>
                        <button onClick={() => onSave(form)} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition transform active:scale-95">수정 완료</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const CustomerForm = ({ initialData, onSave, onCancel }: { initialData?: Customer | null, onSave: (data: Customer) => void, onCancel: () => void }) => {
    const [form, setForm] = useState<Customer>(initialData || {
        id: '',
        customerNumber: '', createdAt: getNowDate(),
        dogName: '', breed: '', birthDate: '', gender: '수컷', isNeutered: false, regNumber: '', weight: '',
        vaccinations: { dhpp: false, corona: false, kennel: false, flu: false, rabies: false },
        parasitePreventionDate: '', vetName: '', vetPhone: '', allergies: '', diseases: '', surgeryHistory: '',
        peopleReaction: '', dogReaction: '', biteHistory: false, resourceGuarding: false, separationAnxiety: false, barking: '', fears: '', sensitiveAreas: '',
        pottyHabits: '', marking: false, eatingHabits: '', playStyle: '',
        ownerName: '', address: '', phone: '', emergencyContact: '',
        notes: ''
    });

    // Smart Import Logic
    const [showSmartImport, setShowSmartImport] = useState(false);
    const [importText, setImportText] = useState('');

    const handleSmartImport = () => {
        if(!importText.trim()) {
            setShowSmartImport(false);
            return;
        }

        const newForm = { ...form };
        const getValue = (keywords: string[]) => {
            for (const key of keywords) {
                // Regex to capture value after colon or just line content if key is present
                // Matches "* key : value" or "* key: value" or just "key: value"
                const regex = new RegExp(`(?:\\*|\\-)?\\s*${key}\\s*[:：]\\s*(.*)`, 'i');
                const match = importText.match(regex);
                if (match && match[1]) return match[1].trim();
            }
            return '';
        };

        // Basic Info
        const name = getValue(['이름', '강아지이름']);
        if (name) newForm.dogName = name;

        const breed = getValue(['견종', '품종']);
        if (breed) newForm.breed = breed;

        const weight = getValue(['몸무게', '체중']);
        if (weight) newForm.weight = weight.replace(/[^0-9.]/g, '');

        const genderLine = getValue(['성별', '중성화']);
        if (genderLine) {
            if (genderLine.includes('수') || genderLine.includes('남')) newForm.gender = '수컷';
            if (genderLine.includes('암') || genderLine.includes('여')) newForm.gender = '암컷';
            if (genderLine.includes('완료') || genderLine.includes('O') || genderLine.includes('예') || genderLine.includes('했')) newForm.isNeutered = true;
        }

        const birth = getValue(['생년월일', '나이']);
        if (birth) newForm.birthDate = birth; // Just put raw string if complex parsing needed later

        // Health
        const vet = getValue(['병원', '주거래병원']);
        if (vet) newForm.vetName = vet;

        const parasite = getValue(['심장사상충', '예방일']);
        if (parasite) newForm.parasitePreventionDate = parasite;

        const allergy = getValue(['알레르기', '지병']);
        if (allergy) newForm.allergies = allergy;

        const surgery = getValue(['수술', '수술이력']);
        if (surgery) newForm.surgeryHistory = surgery;

        // Behavior
        const bite = getValue(['입질', '공격성']);
        if (bite && (bite.includes('있') || bite.includes('O') || bite.includes('예'))) newForm.biteHistory = true;

        const sep = getValue(['분리불안']);
        if (sep && (sep.includes('있') || sep.includes('O') || sep.includes('예'))) newForm.separationAnxiety = true;

        const dogReact = getValue(['사회성', '다른 강아지']);
        if (dogReact) newForm.dogReaction = dogReact;

        const potty = getValue(['배변', '배변습관']);
        if (potty) newForm.pottyHabits = potty;

        const fear = getValue(['무서워하는', '싫어하는']);
        if (fear) newForm.fears = fear;

        // Owner Info
        const owner = getValue(['성함', '보호자']);
        if (owner) newForm.ownerName = owner;

        const phone = getValue(['연락처', '전화번호']);
        if (phone) {
            // Normalize phone
            const nums = phone.replace(/[^0-9]/g, '');
            if (nums.length === 11) newForm.phone = `${nums.slice(0,3)}-${nums.slice(3,7)}-${nums.slice(7)}`;
            else newForm.phone = phone;
        }

        const emergency = getValue(['비상연락처', '비상']);
        if (emergency) newForm.emergencyContact = emergency;

        const addr = getValue(['주소']);
        if (addr) newForm.address = addr;

        // Append full text to notes for safety
        newForm.notes = (newForm.notes ? newForm.notes + '\n\n' : '') + "[신청서 원문]\n" + importText;

        setForm(newForm);
        setShowSmartImport(false);
        setImportText('');
    };

    const SectionHeader = ({ icon, title }: { icon: any, title: string }) => (
        <div className="flex items-center gap-2 mb-4 mt-8 pb-2 border-b-2 border-indigo-100 text-indigo-900">
            {icon}
            <h4 className="font-black text-lg">{title}</h4>
        </div>
    );

    const Checkbox = ({ label, checked, onChange }: { label: string, checked?: boolean, onChange: (val: boolean) => void }) => (
        <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${checked ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'}`}>
                {checked && <Check className="w-3 h-3 text-white"/>}
            </div>
            <span className="text-xs select-none">{label}</span>
            <input type="checkbox" className="hidden" checked={checked} onChange={e => onChange(e.target.checked)}/>
        </label>
    );

    const YesNoSelect = ({ label, value, onChange }: { label: string, value?: boolean, onChange: (val: boolean) => void }) => (
        <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500">{label}</label>
            <div className="flex gap-1">
                <button onClick={() => onChange(true)} className={`flex-1 py-2 text-xs rounded border font-bold ${value ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white text-gray-400'}`}>있음/예</button>
                <button onClick={() => onChange(false)} className={`flex-1 py-2 text-xs rounded border font-bold ${value === false ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white text-gray-400'}`}>없음/아니오</button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/70 z-[300] flex items-center justify-center p-4 backdrop-blur-sm text-gray-900">
            <div className="bg-white w-full h-full md:h-[90vh] md:max-w-4xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-200 relative">
                
                {/* Smart Import Overlay */}
                {showSmartImport && (
                    <div className="absolute inset-0 bg-white z-50 flex flex-col p-6 animate-in fade-in duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-black text-xl text-indigo-900 flex items-center">
                                <ClipboardPaste className="mr-2 w-6 h-6"/> 신청서 붙여넣기
                            </h3>
                            <button onClick={() => setShowSmartImport(false)} className="p-2 hover:bg-gray-100 rounded-full"><X/></button>
                        </div>
                        <div className="flex-1 flex flex-col gap-2">
                            <div className="bg-indigo-50 p-4 rounded-xl text-sm text-indigo-800 border border-indigo-100 mb-2">
                                <p className="font-bold mb-1">💡 사용 방법</p>
                                <p>카카오톡이나 문자로 받은 <strong>신청서 전체 내용</strong>을 아래에 복사해서 붙여넣으세요.<br/>시스템이 이름, 연락처, 견종 등을 자동으로 분석해서 입력해줍니다.</p>
                            </div>
                            <textarea 
                                value={importText}
                                onChange={e => setImportText(e.target.value)}
                                className="flex-1 w-full border-2 border-gray-200 rounded-xl p-4 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none resize-none font-mono leading-relaxed"
                                placeholder={`[예시]\n* 이름: 뽀삐\n* 견종: 말티즈\n* 연락처: 010-1234-5678\n...`}
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
                            <button onClick={() => setShowSmartImport(false)} className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100">취소</button>
                            <button onClick={handleSmartImport} className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-black shadow-lg hover:bg-indigo-700 flex items-center gap-2">
                                <ArrowDownToLine className="w-5 h-5"/> 분석 및 적용
                            </button>
                        </div>
                    </div>
                )}

                <div className="bg-white border-b p-5 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center font-black text-white shadow-sm">
                            {form.dogName?.[0] || <User/>}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900">{initialData ? '고객 정보 수정' : '신규 고객 등록'}</h3>
                            <div className="text-xs text-gray-500">작성일: {form.createdAt}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!initialData && (
                            <button 
                                onClick={() => setShowSmartImport(true)}
                                className="hidden md:flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-bold text-xs hover:bg-indigo-100 transition border border-indigo-200"
                            >
                                <ClipboardPaste className="w-4 h-4"/> 신청서 붙여넣기
                            </button>
                        )}
                        <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition"><X className="w-6 h-6"/></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-gray-50">
                    <div className="mt-0">
                        <SectionHeader icon={<Check className="w-5 h-5 text-indigo-600"/>} title="1. 기본 정보" />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-5 rounded-xl border shadow-sm">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500">고객번호</label>
                                <input type="text" value={form.customerNumber || ''} onChange={e => setForm({...form, customerNumber: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500">이름 <span className="text-red-500">*</span></label>
                                <input type="text" value={form.dogName} onChange={e => setForm({...form, dogName: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 font-bold"/>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500">견종</label>
                                <input type="text" value={form.breed || ''} onChange={e => setForm({...form, breed: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500">생년월일 {form.birthDate && <span className="text-indigo-600">({calculateAge(form.birthDate)})</span>}</label>
                                <input type="date" value={form.birthDate || ''} onChange={e => setForm({...form, birthDate: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500">성별</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setForm({...form, gender: '수컷'})} className={`flex-1 py-2.5 rounded-lg border text-sm font-bold ${form.gender === '수컷' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white text-gray-500'}`}>수컷</button>
                                    <button onClick={() => setForm({...form, gender: '암컷'})} className={`flex-1 py-2.5 rounded-lg border text-sm font-bold ${form.gender === '암컷' ? 'bg-pink-50 border-pink-500 text-pink-700' : 'bg-white text-gray-500'}`}>암컷</button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500">중성화 및 동물등록</label>
                                <div className="flex gap-2">
                                    <Checkbox label="중성화 완료" checked={form.isNeutered} onChange={v => setForm({...form, isNeutered: v})} />
                                    <input type="text" placeholder="동물등록번호" value={form.regNumber || ''} onChange={e => setForm({...form, regNumber: e.target.value})} className="flex-1 border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500">몸무게 (kg)</label>
                                <input type="text" value={form.weight || ''} onChange={e => setForm({...form, weight: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 text-right" placeholder="0.0"/>
                            </div>
                        </div>
                    </div>
                    <div>
                        <SectionHeader icon={<Activity className="w-5 h-5 text-red-500"/>} title="2. 건강 정보" />
                        <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-2 block flex items-center"><Syringe className="w-3 h-3 mr-1"/> 예방접종 현황</label>
                                <div className="flex flex-wrap gap-2">
                                    <Checkbox label="종합백신(DHPPL)" checked={form.vaccinations?.dhpp} onChange={v => setForm({...form, vaccinations: {...form.vaccinations, dhpp: v}})} />
                                    <Checkbox label="코로나" checked={form.vaccinations?.corona} onChange={v => setForm({...form, vaccinations: {...form.vaccinations, corona: v}})} />
                                    <Checkbox label="켄넬코프" checked={form.vaccinations?.kennel} onChange={v => setForm({...form, vaccinations: {...form.vaccinations, kennel: v}})} />
                                    <Checkbox label="인플루엔자" checked={form.vaccinations?.flu} onChange={v => setForm({...form, vaccinations: {...form.vaccinations, flu: v}})} />
                                    <Checkbox label="광견병" checked={form.vaccinations?.rabies} onChange={v => setForm({...form, vaccinations: {...form.vaccinations, rabies: v}})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">심장사상충/기생충 예방일</label>
                                    <input type="date" value={form.parasitePreventionDate || ''} onChange={e => setForm({...form, parasitePreventionDate: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">주거래 동물병원</label>
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="병원명" value={form.vetName || ''} onChange={e => setForm({...form, vetName: e.target.value})} className="flex-1 border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                                        <input type="text" placeholder="연락처" value={form.vetPhone || ''} onChange={e => setForm({...form, vetPhone: e.target.value})} className="flex-1 border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">알레르기 (음식/약물 등)</label>
                                    <input type="text" value={form.allergies || ''} onChange={e => setForm({...form, allergies: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">현재 질병/복용약</label>
                                    <input type="text" value={form.diseases || ''} onChange={e => setForm({...form, diseases: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">수술 이력 (슬개골 등)</label>
                                    <input type="text" value={form.surgeryHistory || ''} onChange={e => setForm({...form, surgeryHistory: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <SectionHeader icon={<Brain className="w-5 h-5 text-orange-500"/>} title="3. 행동 및 성향" />
                        <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <YesNoSelect label="입질 이력" value={form.biteHistory} onChange={v => setForm({...form, biteHistory: v})} />
                                <YesNoSelect label="자원 방어 (식탐 등)" value={form.resourceGuarding} onChange={v => setForm({...form, resourceGuarding: v})} />
                                <YesNoSelect label="분리불안" value={form.separationAnxiety} onChange={v => setForm({...form, separationAnxiety: v})} />
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">예민한 신체 부위</label>
                                    <input type="text" placeholder="발, 귀, 꼬리 등" value={form.sensitiveAreas || ''} onChange={e => setForm({...form, sensitiveAreas: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">사람에 대한 반응</label>
                                    <select value={form.peopleReaction || ''} onChange={e => setForm({...form, peopleReaction: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                                        <option value="">선택하세요</option>
                                        <option>매우 좋아함</option>
                                        <option>낯가림 있음</option>
                                        <option>경계심 심함</option>
                                        <option>공격성 보임</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">다른 개에 대한 반응</label>
                                    <select value={form.dogReaction || ''} onChange={e => setForm({...form, dogReaction: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                                        <option value="">선택하세요</option>
                                        <option>잘 놈 (매너 좋음)</option>
                                        <option>들이댐 (매너 부족)</option>
                                        <option>무서워함/피함</option>
                                        <option>짖음/공격성</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">짖음 빈도 및 상황</label>
                                    <input type="text" value={form.barking || ''} onChange={e => setForm({...form, barking: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500">두려워하는 대상 (소리/물체)</label>
                                    <input type="text" value={form.fears || ''} onChange={e => setForm({...form, fears: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <SectionHeader icon={<Home className="w-5 h-5 text-green-600"/>} title="4. 생활 습관" />
                        <div className="bg-white p-5 rounded-xl border shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500">배변 습관</label>
                                <input type="text" placeholder="패드, 실외배변 등" value={form.pottyHabits || ''} onChange={e => setForm({...form, pottyHabits: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                            </div>
                            <div className="flex items-center pt-6">
                                <Checkbox label="실내 마킹(영역표시) 함" checked={form.marking} onChange={v => setForm({...form, marking: v})} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500">식습관 (자율급식/제한급식)</label>
                                <input type="text" value={form.eatingHabits || ''} onChange={e => setForm({...form, eatingHabits: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500">좋아하는 놀이</label>
                                <input type="text" value={form.playStyle || ''} onChange={e => setForm({...form, playStyle: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                            </div>
                        </div>
                    </div>
                    <div className="mb-10">
                        <SectionHeader icon={<User className="w-5 h-5 text-blue-600"/>} title="5. 보호자 정보" />
                        <div className="bg-white p-5 rounded-xl border shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500">보호자 성함 <span className="text-red-500">*</span></label>
                                <input type="text" value={form.ownerName} onChange={e => setForm({...form, ownerName: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 font-bold"/>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500">연락처 <span className="text-red-500">*</span></label>
                                <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 font-bold"/>
                            </div>
                            <div className="space-y-1 col-span-2">
                                <label className="text-xs font-bold text-gray-500">주소</label>
                                <input type="text" value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-xs font-bold text-red-600 flex items-center"><ShieldAlert className="w-3 h-3 mr-1"/> 비상 연락망 (제2 보호자)</label>
                                <input type="text" value={form.emergencyContact || ''} onChange={e => setForm({...form, emergencyContact: e.target.value})} className="w-full border-2 border-red-50 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-red-200" placeholder="이름 / 연락처"/>
                            </div>
                            <div className="col-span-2 space-y-1 mt-2">
                                <label className="text-xs font-bold text-gray-500">통합 메모</label>
                                <textarea value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} rows={3} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"/>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-5 border-t bg-white flex gap-4 shrink-0">
                    <button onClick={onCancel} className="flex-1 py-4 rounded-xl border-2 border-gray-100 text-gray-500 font-bold hover:bg-gray-50 transition bg-white">취소</button>
                    <button onClick={() => onSave(form)} className="flex-[2] py-4 rounded-xl bg-indigo-600 text-white font-black shadow-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                        <Save className="w-5 h-5"/> 저장하기
                    </button>
                </div>
            </div>
        </div>
    );
};

export const CustomerDetailModal = ({ customer, allCustomers, onClose, onEdit, staff = [] }: { customer: Customer, allCustomers: Customer[], onClose: () => void, onEdit: () => void, staff?: Staff[] }) => {
    // ... (Existing CustomerDetailModal code remains unchanged)
    const hasDogs = customer.dogs && customer.dogs.length > 0;
    const [activeDogIndex, setActiveDogIndex] = useState(0);
    const [isMigrating, setIsMigrating] = useState(false);
    const [migName1, setMigName1] = useState(customer.dogName || '');
    const [migName2, setMigName2] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    const currentDog: any = useMemo(() => {
        if (hasDogs && customer.dogs) {
            return customer.dogs[activeDogIndex];
        }
        return customer;
    }, [customer, hasDogs, activeDogIndex]);

    const handleRefreshBalance = async () => {
        if (!confirm(`${customer.ownerName}님의 전체 거래 내역을 조회하여 잔액을 재계산하시겠습니까?`)) return;
        setIsRefreshing(true);
        try {
            const transRef = collection(db, 'kingdog', appId, 'transactions');
            let q = query(transRef, where('customerId', '==', customer.id), where('type', '==', '수입'));
            const snap = await getDocs(q);
            let totalBalance = 0;
            snap.docs.forEach(d => {
                const t = d.data() as Transaction;
                const diff = calculateTransactionDiff(t);
                totalBalance += diff;
            });
            await updateDoc(doc(db, 'kingdog', appId, 'customers', customer.id), {
                balance: totalBalance,
                lastBalanceUpdate: new Date().toISOString()
            });
            alert(`잔액 동기화 완료! 현재 잔액: ${formatCurrency(totalBalance)}원`);
        } catch (e) {
            console.error(e);
            alert("잔액 새로고침 실패. 로그를 확인하세요.");
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleTicketInit = async (data: any) => {
        const { count, startDate, expiryDate, staffName, reason } = data;
        const newTicket = {
            total: count,
            remaining: count,
            startDate,
            expiryDate,
            lastUpdated: new Date().toISOString(),
            history: [{
                id: Date.now().toString(),
                date: new Date().toISOString(),
                type: 'init',
                amount: count,
                prevRemaining: 0,
                newRemaining: count,
                staffName,
                reason
            } as TicketLog]
        };
        try {
            await updateDoc(doc(db, 'kingdog', appId, 'customers', customer.id), { ticket: newTicket });
            setShowTicketModal(false);
            alert("유치원 이용권이 시작되었습니다.");
        } catch (e) {
            console.error(e);
            alert("이용권 시작 실패");
        }
    };

    const handleMigration = async () => {
        if (!migName1 || !migName2) return alert("두 마리의 이름을 모두 입력해주세요.");
        try {
            const dog1: Dog = {
                id: Date.now().toString(),
                dogName: migName1,
                breed: customer.breed,
                birthDate: customer.birthDate,
                gender: customer.gender,
                isNeutered: customer.isNeutered,
                weight: customer.weight,
                regNumber: customer.regNumber,
                photoUrl: customer.photoUrl,
                vaccinations: customer.vaccinations,
                parasitePreventionDate: customer.parasitePreventionDate,
                vetName: customer.vetName,
                vetPhone: customer.vetPhone,
                allergies: customer.allergies,
                diseases: customer.diseases,
                surgeryHistory: customer.surgeryHistory,
                peopleReaction: customer.peopleReaction,
                dogReaction: customer.dogReaction,
                biteHistory: customer.biteHistory,
                resourceGuarding: customer.resourceGuarding,
                separationAnxiety: customer.separationAnxiety,
                barking: customer.barking,
                fears: customer.fears,
                sensitiveAreas: customer.sensitiveAreas,
                pottyHabits: customer.pottyHabits,
                marking: customer.marking,
                eatingHabits: customer.eatingHabits,
                playStyle: customer.playStyle,
                kindergarten: customer.kindergarten,
                notes: customer.notes
            };
            const dog2: Dog = {
                id: (Date.now() + 1).toString(),
                dogName: migName2,
            };
            await updateDoc(doc(db, 'kingdog', appId, 'customers', customer.id), {
                dogs: [dog1, dog2]
            });
            setIsMigrating(false);
            alert("가족 분리가 완료되었습니다! 상단 탭을 눌러 각 아이의 정보를 수정해주세요.");
        } catch(e) {
            console.error(e);
            alert("분리 저장 실패");
        }
    };

    const InfoRow = ({ label, value, full = false }: { label: string, value: any, full?: boolean }) => (
        <div className={`flex flex-col ${full ? 'col-span-2' : ''}`}>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</span>
            <span className={`text-sm font-bold ${!value ? 'text-gray-300' : 'text-gray-800'}`}>{value || '-'}</span>
        </div>
    );

    const Badge = ({ active, label, color = 'blue' }: { active: boolean, label: string, color?: string }) => {
        if (!active) return null;
        const colorClasses: any = {
            blue: 'bg-blue-50 text-blue-700 border-blue-200',
            red: 'bg-red-50 text-red-700 border-red-200',
            green: 'bg-green-50 text-green-700 border-green-200',
            orange: 'bg-orange-50 text-orange-700 border-orange-200',
        };
        return <span className={`px-2 py-1 rounded-md text-[10px] font-black border ${colorClasses[color]} mr-1 mb-1 inline-block`}>{label}</span>;
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[250] flex items-center justify-center p-4 backdrop-blur-sm text-gray-900">
            <TicketInitModal isOpen={showTicketModal} onClose={() => setShowTicketModal(false)} onConfirm={handleTicketInit} staffList={staff} />
            <TicketHistoryModal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} customer={customer} onUpdate={() => {}} staffList={staff} />
            
            <div className="bg-white w-full h-full md:h-[90vh] md:max-w-5xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden relative animate-in fade-in zoom-in duration-200">
                <div className="bg-indigo-900 px-6 pt-4 pb-0 flex items-center gap-2 overflow-x-auto whitespace-nowrap shrink-0">
                    <div className="text-white/50 text-[10px] font-bold uppercase tracking-wider mr-2 mb-2">FAMILY</div>
                    {hasDogs ? (
                        customer.dogs!.map((d, idx) => (
                            <button 
                                key={d.id || idx}
                                onClick={() => setActiveDogIndex(idx)}
                                className={`px-5 py-3 rounded-t-xl text-sm font-bold transition-all flex items-center gap-2 ${activeDogIndex === idx ? 'bg-white text-indigo-900' : 'bg-indigo-800/50 text-indigo-200 hover:bg-indigo-800'}`}
                            >
                                {d.dogName}
                            </button>
                        ))
                    ) : (
                        <button className="px-5 py-3 rounded-t-xl text-sm font-bold bg-white text-indigo-900 flex items-center gap-2">
                            {customer.dogName} (Main)
                        </button>
                    )}
                    <button 
                        onClick={() => setIsMigrating(true)}
                        className="px-3 py-3 mb-1 text-indigo-300 hover:text-white transition-colors flex items-center gap-1 text-xs font-bold"
                    >
                        <Plus className="w-4 h-4"/> 가족 추가
                    </button>
                </div>

                {isMigrating ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-10 bg-gray-50">
                        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full border border-indigo-100 animate-in zoom-in-95">
                            <h3 className="text-xl font-black text-indigo-900 mb-2 flex items-center">
                                <SplitSquareHorizontal className="w-6 h-6 mr-2"/> 다견 가정 분리 설정
                            </h3>
                            <p className="text-sm text-gray-500 mb-6">
                                현재 <strong>{customer.dogName}</strong>님의 정보에 새로운 아이를 추가합니다.<br/>
                                기존 정보의 주인을 선택하고, 새 아이의 이름을 입력해주세요.
                            </p>
                            <div className="space-y-4">
                                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                    <label className="text-xs font-bold text-indigo-800 mb-1 block">기존 정보(현재 입력된 내용)의 주인 이름</label>
                                    <input 
                                        type="text" 
                                        value={migName1} 
                                        onChange={e=>setMigName1(e.target.value)} 
                                        className="w-full border p-2 rounded-lg bg-white font-bold"
                                    />
                                    <p className="text-[10px] text-indigo-400 mt-1">* 기존 건강정보, 알러지 등이 이 아이에게 귀속됩니다.</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                    <label className="text-xs font-bold text-gray-600 mb-1 block">새로 추가할 아이 이름</label>
                                    <input 
                                        type="text" 
                                        value={migName2} 
                                        onChange={e=>setMigName2(e.target.value)} 
                                        className="w-full border p-2 rounded-lg bg-white font-bold"
                                        placeholder="이름 입력"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">* 빈 프로필이 생성됩니다.</p>
                                </div>
                                <div className="pt-4 flex gap-3">
                                    <button onClick={()=>setIsMigrating(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-500">취소</button>
                                    <button onClick={handleMigration} className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700">분리 및 저장</button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="bg-white p-6 border-b flex justify-between items-start shrink-0 z-10 sticky top-0">
                            <div className="flex items-center gap-5">
                                <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center border-2 border-indigo-100 shadow-sm overflow-hidden hidden md:flex">
                                    {currentDog.photoUrl ? <img src={currentDog.photoUrl} className="w-full h-full object-cover"/> : <span className="text-3xl">🐶</span>}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h2 className="text-2xl md:text-3xl font-black text-gray-900">{currentDog.dogName}</h2>
                                        <span className="text-base md:text-lg font-medium text-gray-400">| {currentDog.breed || '견종미상'}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 items-center">
                                        <span className="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-600">{currentDog.birthDate ? `${calculateAge(currentDog.birthDate)} (${currentDog.birthDate})` : '나이 미상'}</span>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${currentDog.gender === '수컷' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>{currentDog.gender}</span>
                                        {currentDog.isNeutered && <span className="bg-purple-100 text-purple-600 px-3 py-1 rounded-full text-xs font-bold">중성화 완료</span>}
                                        {currentDog.biteHistory && <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/> 입질 주의</span>}
                                        <div className="hidden md:flex ml-4 items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1 rounded-lg">
                                            <span className="text-[10px] font-bold text-gray-400">현재 잔액 (가구통합)</span>
                                            <span className={`font-black text-sm ${customer.balance && customer.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(customer.balance)}원</span>
                                            <button onClick={handleRefreshBalance} disabled={isRefreshing} className={`p-1 rounded-full hover:bg-gray-200 transition-colors ${isRefreshing ? 'animate-spin text-indigo-500' : 'text-gray-400'}`} title="잔액 재계산 (동기화)"><RotateCcw className="w-3 h-3"/></button>
                                        </div>
                                        <div className="ml-2 hidden md:block">
                                            {customer.ticket && customer.ticket.startDate ? (
                                                <div onClick={() => setShowHistoryModal(true)} className="flex items-center gap-2 bg-purple-50 border border-purple-200 px-3 py-1 rounded-lg cursor-pointer hover:bg-purple-100 transition-colors" title="이용권 이력 보기">
                                                    <Ticket className="w-3 h-3 text-purple-600"/>
                                                    <span className="text-[10px] font-bold text-purple-600">이용권:</span>
                                                    <span className="font-black text-sm text-purple-800">{customer.ticket.remaining}회 남음</span>
                                                    <span className="text-[10px] text-purple-400 ml-1">(D-{Math.ceil((new Date(customer.ticket.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))})</span>
                                                    <ArrowRight className="w-3 h-3 text-purple-300"/>
                                                </div>
                                            ) : (
                                                <button onClick={(e) => { e.stopPropagation(); setShowTicketModal(true); }} className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-transform active:scale-95 animate-pulse"><Ticket className="w-3.5 h-3.5"/> 유치원 이용권 시작</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={onEdit} className="bg-indigo-600 text-white px-3 md:px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 active:scale-95 text-xs md:text-sm">
                                    <Edit className="w-4 h-4"/> <span className="hidden md:inline">수정하기</span>
                                </button>
                                <button onClick={onClose} className="bg-gray-100 text-gray-500 p-2.5 rounded-xl hover:bg-gray-200 transition"><X/></button>
                            </div>
                        </div>
                        <div className="md:hidden px-6 pb-2 flex flex-col gap-2">
                             <div className="flex items-center justify-between bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg">
                                <span className="text-xs font-bold text-gray-500">현재 잔액</span>
                                <div className="flex items-center gap-2">
                                    <span className={`font-black text-sm ${customer.balance && customer.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(customer.balance)}원</span>
                                    <button onClick={handleRefreshBalance} disabled={isRefreshing} className={`p-1 rounded-full ${isRefreshing ? 'animate-spin text-indigo-500' : 'text-gray-400'}`}><RotateCcw className="w-3 h-3"/></button>
                                </div>
                            </div>
                            {customer.ticket && customer.ticket.startDate ? (
                                <div onClick={() => setShowHistoryModal(true)} className="flex items-center justify-between bg-purple-50 border border-purple-200 px-3 py-2 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Ticket className="w-3 h-3 text-purple-600"/>
                                        <span className="text-xs font-bold text-purple-600">이용권 잔여</span>
                                    </div>
                                    <span className="font-black text-sm text-purple-800">{customer.ticket.remaining}회</span>
                                </div>
                            ) : (
                                <button onClick={() => setShowTicketModal(true)} className="w-full bg-purple-600 text-white py-2 rounded-lg text-xs font-bold">유치원 이용권 시작</button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50 p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <h3 className="font-black text-gray-800 flex items-center mb-4"><User className="w-5 h-5 mr-2 text-indigo-500"/> 보호자 정보 (공통)</h3>
                                    <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                                        <InfoRow label="보호자 성함" value={customer.ownerName} />
                                        <InfoRow label="연락처" value={customer.phone} />
                                        <InfoRow label="주소" value={customer.address} full />
                                        <InfoRow label="비상 연락망" value={customer.emergencyContact} full />
                                        {customer.customerNumber && <InfoRow label="고객번호" value={customer.customerNumber} />}
                                        {currentDog.regNumber && <InfoRow label="동물등록번호" value={currentDog.regNumber} />}
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <h3 className="font-black text-gray-800 flex items-center mb-4"><Activity className="w-5 h-5 mr-2 text-red-500"/> 건강 정보 ({currentDog.dogName})</h3>
                                    <div className="mb-4">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">접종 현황</span>
                                        <div className="flex flex-wrap gap-1">
                                            <Badge active={!!currentDog.vaccinations?.dhpp} label="종합백신" color="green" />
                                            <Badge active={!!currentDog.vaccinations?.corona} label="코로나" color="green" />
                                            <Badge active={!!currentDog.vaccinations?.kennel} label="켄넬코프" color="green" />
                                            <Badge active={!!currentDog.vaccinations?.flu} label="인플루엔자" color="green" />
                                            <Badge active={!!currentDog.vaccinations?.rabies} label="광견병" color="green" />
                                            {!currentDog.vaccinations && <span className="text-xs text-gray-300">정보 없음</span>}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                                        <InfoRow label="심장사상충 예방일" value={currentDog.parasitePreventionDate} />
                                        <InfoRow label="주거래 병원" value={`${currentDog.vetName || ''} ${currentDog.vetPhone ? `(${currentDog.vetPhone})` : ''}`} />
                                        <InfoRow label="알레르기" value={currentDog.allergies} full />
                                        <InfoRow label="질병/복용약" value={currentDog.diseases} full />
                                        <InfoRow label="수술 이력" value={currentDog.surgeryHistory} full />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <h3 className="font-black text-gray-800 flex items-center mb-4"><Brain className="w-5 h-5 mr-2 text-orange-500"/> 성향 및 행동</h3>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        <Badge active={!!currentDog.biteHistory} label="⚠️ 입질 이력" color="red" />
                                        <Badge active={!!currentDog.resourceGuarding} label="자원 방어" color="orange" />
                                        <Badge active={!!currentDog.separationAnxiety} label="분리불안" color="orange" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                                        <InfoRow label="사람 반응" value={currentDog.peopleReaction} />
                                        <InfoRow label="다른 개 반응" value={currentDog.dogReaction} />
                                        <InfoRow label="짖음 빈도/상황" value={currentDog.barking} full />
                                        <InfoRow label="무서워하는 것" value={currentDog.fears} full />
                                        <InfoRow label="예민한 부위" value={currentDog.sensitiveAreas} full />
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <h3 className="font-black text-gray-800 flex items-center mb-4"><Home className="w-5 h-5 mr-2 text-green-600"/> 생활 습관</h3>
                                    <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                                        <InfoRow label="배변 습관" value={currentDog.pottyHabits} full />
                                        <InfoRow label="실내 마킹" value={currentDog.marking ? '있음 (매너벨트 필요)' : '없음'} />
                                        <InfoRow label="식습관" value={currentDog.eatingHabits} />
                                        <InfoRow label="좋아하는 놀이" value={currentDog.playStyle} full />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-100">
                                <h3 className="font-black text-yellow-800 flex items-center mb-3"><FileText className="w-5 h-5 mr-2"/> 통합 관리 메모</h3>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{currentDog.notes || '등록된 메모가 없습니다.'}</p>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
