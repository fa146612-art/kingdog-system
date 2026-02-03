
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Scissors, ChevronLeft, ChevronRight, AlertCircle, 
    Book, X, Search, AlertTriangle, Check, Trash2,
    ArrowDown, MessageCircle, Clock, CheckCircle2, Zap, Calendar, User
} from 'lucide-react';
import { collection, addDoc, writeBatch, doc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
import { db, appId } from '../services/firebase';
import { formatCurrency, getLocalYMD, getNowDate, getNowTime, normalizeDate, copyToClipboardFallback } from '../utils/helpers';
import { Appointment, Staff } from '../types';

// Updated props to include Staff[]
const GroomingTab = ({ customers, transactions, appointments, staff }: { customers: any[], transactions: any[], appointments: Appointment[], staff: Staff[] }) => { 
    const [view, setView] = useState<'weekly' | 'monthly'>('weekly'); 
    const [baseDate, setBaseDate] = useState(new Date());
    
    const [showModal, setShowModal] = useState(false);
    const [custSearch, setCustSearch] = useState('');
    const [showCustList, setShowCustList] = useState(false);
    
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null); 
    const [customerNotes, setCustomerNotes] = useState(''); 
    
    // UI States
    const [validationError, setValidationError] = useState<string | null>(null);
    const [deleteStep, setDeleteStep] = useState(0); 

    // Drag & Resize State
    const [draggedApp, setDraggedApp] = useState<Appointment | null>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [cursorMessage, setCursorMessage] = useState<{text: string, type: 'info'|'warning'} | null>(null);
    const cursorRef = useRef<HTMLDivElement>(null);
    
    const isDraggingRef = useRef(false);

    const [formData, setFormData] = useState<any>({
        id: null, customerName: '', dogName: '', contact: '', dogBreed: '',
        date: getNowDate(), startTime: '10:00', duration: 120,
        type: '전체미용',
        groomingOptions: { 
            face: '', body: '', legs: '동그랗게',
            spa: false, pack: false, boots: false
        },
        memo: '', status: '상담중',
        consultant: '', 
        staffStart: '', 
        pickDrop: false,
        depositAccount: '기업은행 010 8618 4567 심우찬',
        deposit: 0,
        category: '미용'
    });

    const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0];
    const CELL_HEIGHT = 80; 

    // --- Template Constants ---
    const CONSULTATION_TEMPLATE = `[킹독 미용 예약 상담]
안녕하세요! 000의 예쁜 미용을 위해 아래 내용을 적어 보내주시면, 스케줄 확인 후 즉시 답변 드리겠습니다. ^^

✂️ A. 미용 스타일 (택 1)
1. 목욕 (목욕만 진행)
2. 위생미용 (목욕X + 발바닥/배/생식기/항문 기계컷)
3. 부분미용 (목욕O + 위생미용 + 얼굴컷 등)
4. 전체미용 (아래 상세 선택 필요)

(※ 전체미용 선택 시 상세 스타일)
 - 전체가위컷: 기계 사용 없이 가위로만 디자인
 - 스포팅: 몸통은 기계컷 + 다리는 가위컷
 - 기계컷: 전체 밀기 (3mm / 6mm / 1cm)

✂️ B. 얼굴 스타일
(예: 하이바, 테디베어, 곰돌이, 알머리 등)
👉 

✂️ C. 발 모양
(예: 닭발, 동그랗게 등)
👉 

📅 원하시는 요일/시간
1순위: 
2순위: `;

    // --- Effects ---

    useEffect(() => {
        const moveCursor = (e: MouseEvent) => {
            if (cursorRef.current && cursorMessage) {
                cursorRef.current.style.transform = `translate(${e.clientX + 15}px, ${e.clientY + 15}px)`;
            }
        };
        window.addEventListener('mousemove', moveCursor);
        return () => window.removeEventListener('mousemove', moveCursor);
    }, [cursorMessage]);

    useEffect(() => {
        if (!formData.id && formData.status === '상담중') { 
             const isExempt = selectedCustomer?.isDepositExempt || false;
             if (isExempt) {
                 setFormData((prev: any) => ({ ...prev, deposit: 0 }));
             } else {
                 const hours = (formData.duration || 0) / 60;
                 const deposit = Math.ceil(hours * 1.5) * 10000;
                 setFormData((prev: any) => ({ ...prev, deposit }));
             }
        }
    }, [formData.duration, formData.id, selectedCustomer]);

    const weekDates = useMemo(() => {
        const start = new Date(baseDate);
        start.setDate(baseDate.getDate() - baseDate.getDay());
        return Array.from({length: 7}, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    }, [baseDate]);

    const monthDates = useMemo(() => {
        const year = baseDate.getFullYear();
        const month = baseDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const dates = [];
        for(let i=0; i<firstDay.getDay(); i++) dates.push(null);
        for(let i=1; i<=lastDay.getDate(); i++) dates.push(new Date(year, month, i));
        return dates;
    }, [baseDate]);


    // --- Drag & Drop Logic ---

    const handleDragStart = (e: React.DragEvent, app: Appointment) => {
        if (isResizing) {
            e.preventDefault();
            return;
        }
        setDraggedApp(app);
        isDraggingRef.current = true; // Block clicks
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", app.id);
        setCursorMessage({ text: "원하는 시간 칸에 놓으세요", type: 'info' });
    };

    const handleDragEnd = () => {
        setDraggedApp(null);
        setCursorMessage(null);
        setTimeout(() => {
            isDraggingRef.current = false;
        }, 200);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); 
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e: React.DragEvent, date: Date) => {
        e.preventDefault();
        e.stopPropagation();
        setCursorMessage(null);
        
        if (!draggedApp) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const hourIndex = Math.floor(offsetY / CELL_HEIGHT);
        
        const targetHour = HOURS[Math.max(0, Math.min(HOURS.length - 1, hourIndex))];
        
        const newDate = getLocalYMD(date);
        const [_, minutes] = draggedApp.startTime.split(':');
        const newTime = `${String(targetHour).padStart(2, '0')}:${minutes || '00'}`;

        if (newDate === draggedApp.date && newTime === draggedApp.startTime) {
            setDraggedApp(null);
            setTimeout(() => { isDraggingRef.current = false; }, 200);
            return;
        }

        setDraggedApp(null);
        setTimeout(() => { isDraggingRef.current = false; }, 200);

        try {
            const batch = writeBatch(db);
            const appRef = doc(db, 'kingdog', appId, 'appointments', draggedApp.id);

            batch.update(appRef, {
                date: newDate,
                startTime: newTime,
                updatedAt: new Date().toISOString()
            });

            await batch.commit();
        } catch (error) {
            console.error("Move failed:", error);
            alert("이동 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        }
    };

    // --- Resizing Logic ---

    const onResizeMouseDown = (e: React.MouseEvent, app: Appointment) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);
        isDraggingRef.current = true; // Block clicks
        
        const startY = e.clientY;
        const startDuration = app.duration;
        const isCompleted = app.status === '예약완료';

        const getNewDuration = (currentY: number) => {
            const deltaY = currentY - startY;
            const deltaMinutes = (deltaY / CELL_HEIGHT) * 60;
            const rawDuration = startDuration + deltaMinutes;
            return Math.max(30, Math.round(rawDuration / 30) * 30);
        };

        const onMouseMove = (moveEvent: MouseEvent) => {
            const newDuration = getNewDuration(moveEvent.clientY);
            const el = document.getElementById(`app-${app.id}`);
            if (el) {
                el.style.height = `${(newDuration / 60) * CELL_HEIGHT}px`;
                const label = el.querySelector('.duration-label');
                if (label) label.textContent = `${newDuration}분`;
            }
            if (isCompleted) {
                setCursorMessage({ text: `🔒 확정됨: 시간만 변경 (${newDuration}분)`, type: 'info' });
            } else {
                setCursorMessage({ text: `⚠️ 상담중: 금액 재계산됨 (${newDuration}분)`, type: 'warning' });
            }
        };

        const onMouseUp = async (upEvent: MouseEvent) => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            setIsResizing(false);
            setCursorMessage(null);
            setTimeout(() => { isDraggingRef.current = false; }, 200);

            const newDuration = getNewDuration(upEvent.clientY);

            if (newDuration !== app.duration) {
                try {
                    const updates: any = { duration: newDuration };
                    if (!isCompleted) {
                        const linkedCustomer = customers.find(c => 
                            (c.dogName === app.dogName && c.ownerName === app.customerName)
                        );
                        if (!linkedCustomer?.isDepositExempt) {
                            const hours = newDuration / 60;
                            updates.deposit = Math.ceil(hours * 1.5) * 10000;
                        }
                    }
                    await updateDoc(doc(db, 'kingdog', appId, 'appointments', app.id), updates);
                } catch (err) {
                    console.error("Resize update failed", err);
                    const el = document.getElementById(`app-${app.id}`);
                    if (el) el.style.height = `${(app.duration / 60) * CELL_HEIGHT}px`;
                }
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };


    // --- Form Logic ---

    const handleCellClick = (date: Date, hour: number) => {
        if (isDraggingRef.current) return;

        setFormData({
            id: null, customerName: '', dogName: '', contact: '', dogBreed: '',
            date: getLocalYMD(date), startTime: `${String(hour).padStart(2, '0')}:00`,
            duration: 120, type: '전체미용',
            groomingOptions: { face: '', body: '', legs: '동그랗게', spa: false, pack: false, boots: false },
            memo: '', status: '상담중', 
            consultant: '', staffStart: '', 
            pickDrop: false,
            depositAccount: '기업은행 010 8618 4567 심우찬',
            deposit: 30000,
            category: '미용'
        });
        setCustSearch('');
        setCustomerNotes('');
        setSelectedCustomer(null);
        setValidationError(null);
        setDeleteStep(0);
        setShowModal(true);
    };

    const handleSave = async () => {
        setValidationError(null);

        if (!formData.customerName || !formData.date) {
            setValidationError('고객명과 날짜는 필수입니다.');
            return;
        }
        if (!formData.consultant) {
            setValidationError('⚠️ [예약 상담자] 정보는 필수입니다.');
            return;
        }
        if (formData.status === '예약완료' && !formData.staffStart) {
            setValidationError('⚠️ 예약 확정 시 [담당 미용사] 정보가 필요합니다.');
            return; 
        }

        if (selectedCustomer && customerNotes !== selectedCustomer.notes) {
            await updateDoc(doc(db, 'kingdog', appId, 'customers', selectedCustomer.id), { notes: customerNotes });
        }
        
        const { id, ...payload } = formData;
        // Ensure category is always set to '미용' for data integrity
        const data = { ...payload, category: '미용', updatedAt: new Date().toISOString() };

        try {
            if (id) {
                await updateDoc(doc(db, 'kingdog', appId, 'appointments', id), data);
            } else {
                await addDoc(collection(db, 'kingdog', appId, 'appointments'), { ...data, createdAt: new Date().toISOString() });
                
                if (formData.status === '예약완료') {
                    const batch = writeBatch(db);
                    
                    // 1. 예약금 (수입) - 고객 잔액 증가 (Credit +)
                    if (formData.deposit > 0) {
                        batch.set(doc(collection(db, 'kingdog', appId, 'transactions')), {
                            startDate: getNowDate(), startTime: getNowTime(),
                            endDate: getNowDate(), endTime: getNowTime(),
                            category: '미용', serviceDetail: '예약금 (선수납)',
                            dogName: formData.dogName, customerName: formData.customerName, contact: formData.contact,
                            customerId: selectedCustomer?.id, // Ensure Linking
                            price: 0, 
                            paidAmount: formData.deposit, 
                            quantity: 1, discountValue: 0, discountType: 'amount',
                            paymentMethod: '계좌', type: '수입', createdAt: new Date().toISOString(),
                            pickDrop: formData.pickDrop,
                            memo: `${formData.date} 예약금`
                        });

                        // Phase 3: 잔액 업데이트 (입금액만큼 +)
                        if (selectedCustomer?.id) {
                            batch.update(doc(db, 'kingdog', appId, 'customers', selectedCustomer.id), {
                                balance: increment(formData.deposit),
                                lastBalanceUpdate: new Date().toISOString()
                            });
                        }
                    }
                    
                    // 2. 미용 청구서 생성 (미수금 발생)
                    // Price is 0 initially, updated by admin later. So balance impact is 0 initially.
                    const opts = [];
                    if(formData.groomingOptions.spa) opts.push('스파');
                    if(formData.groomingOptions.pack) opts.push('팩');
                    const detailText = `${formData.type}/${formData.groomingOptions.body}/${formData.groomingOptions.face}/${formData.groomingOptions.legs} ${opts.join(',')}`;
                    
                    batch.set(doc(collection(db, 'kingdog', appId, 'transactions')), {
                        startDate: formData.date, startTime: formData.startTime,
                        endDate: formData.date, endTime: formData.startTime,
                        category: '미용', serviceDetail: detailText,
                        dogName: formData.dogName, customerName: formData.customerName, contact: formData.contact,
                        customerId: selectedCustomer?.id, // Ensure Linking
                        paidAmount: 0, price: 0, quantity: 1, discountValue: 0, discountType: 'amount',
                        paymentMethod: '미정', type: '수입', createdAt: new Date().toISOString(),
                        pickDrop: formData.pickDrop,
                        memo: formData.deposit > 0 ? `예약금 ${formatCurrency(formData.deposit)}원 선납` : '예약금 면제'
                    });
                    
                    await batch.commit();
                }
            }
            setShowModal(false);
        } catch (e: any) {
            setValidationError(`오류 발생: ${e.message}`);
        }
    };

    const handleDelete = async () => {
        if (!formData.id) return;
        if (deleteStep === 0) {
            setDeleteStep(1);
            return;
        }
        try {
            await deleteDoc(doc(db, 'kingdog', appId, 'appointments', formData.id));
            setShowModal(false);
        } catch (e: any) {
            setValidationError(`삭제 실패: ${e.message}`);
        }
    };

    const selectCustomer = (c: any) => {
        setFormData({ ...formData, customerName: c.ownerName, dogName: c.dogName, contact: c.phone, dogBreed: c.breed });
        setCustSearch(`${c.dogName}(${c.ownerName})`);
        setShowCustList(false);
        setSelectedCustomer(c);
        setCustomerNotes(c.notes || '');
    };

    const toggleDepositExempt = async () => {
        if (!selectedCustomer) return;
        const newState = !selectedCustomer.isDepositExempt;
        setSelectedCustomer({ ...selectedCustomer, isDepositExempt: newState });
        if (newState) {
            setFormData({ ...formData, deposit: 0 });
        } else {
            const hours = (formData.duration || 0) / 60;
            const deposit = Math.ceil(hours * 1.5) * 10000;
            setFormData({ ...formData, deposit });
        }
        try {
            await updateDoc(doc(db, 'kingdog', appId, 'customers', selectedCustomer.id), { isDepositExempt: newState });
        } catch (e) { console.error(e); }
    };

    // --- Mobile & List View Helpers ---
    const mobileAppointments = useMemo(() => {
        const dateStr = getLocalYMD(baseDate);
        return appointments
            .filter(a => normalizeDate(a.date) === dateStr)
            .sort((a,b) => a.startTime.localeCompare(b.startTime));
    }, [appointments, baseDate]);

    const renderDailyAppointments = (date: Date) => {
        const dateStr = getLocalYMD(date);
        const dailyApps = appointments.filter(a => normalizeDate(a.date) === dateStr);
        
        return dailyApps.map(app => {
            const [h, m] = app.startTime.split(':').map(Number);
            const topIndex = HOURS.indexOf(h);
            const validTopIndex = topIndex !== -1 ? topIndex : (h >= 9 ? h - 9 : h + 15);
            
            const topPx = (validTopIndex * CELL_HEIGHT) + ((m / 60) * CELL_HEIGHT);
            const heightPx = (app.duration / 60) * CELL_HEIGHT;

            return (
                <div 
                    id={`app-${app.id}`}
                    key={app.id} 
                    onClick={(e)=>{ 
                        if(isDraggingRef.current) return;
                        e.stopPropagation(); 
                        setFormData(app); setValidationError(null); setDeleteStep(0); setShowModal(true); 
                    }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, app)}
                    onDragEnd={handleDragEnd}
                    style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                    className={`absolute left-1 right-1 rounded-lg border-l-4 p-1 shadow-md cursor-grab active:cursor-grabbing overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg z-10 select-none group flex flex-col justify-between ${app.status==='상담중' ? 'bg-yellow-50 border-yellow-500 ring-2 ring-yellow-200 animate-pulse' : 'bg-blue-50 border-blue-600'}`}
                >
                    <div className="text-[10px] font-black flex justify-between items-center leading-none">
                        <span className="text-gray-900">{app.startTime}</span>
                        <span className={app.status==='상담중' ? 'text-yellow-600' : 'text-blue-600'}>{app.status}</span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <div className="text-xs font-black text-gray-900 truncate">{app.dogName}</div>
                        <div className="text-[9px] text-gray-700 font-bold truncate">{app.type}</div>
                    </div>
                    <div className="flex justify-between items-end pb-1">
                            <div className="flex gap-1">
                            {app.pickDrop && <span className="bg-green-100 text-green-700 text-[8px] px-1 rounded">P/D</span>}
                            <span className="bg-gray-200 text-gray-700 text-[8px] px-1 rounded truncate">{app.staffStart}</span>
                            </div>
                            <span className="duration-label text-[8px] text-gray-500 font-mono">{app.duration}분</span>
                    </div>
                    <div 
                        onMouseDown={(e) => onResizeMouseDown(e, app)}
                        className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize hover:bg-black/5 flex justify-center items-center group-hover:bg-black/10 transition-colors"
                    >
                        <div className="w-6 h-1 bg-gray-400 rounded-full opacity-50"></div>
                    </div>
                </div>
            );
        });
    };

    return (
        <div className="h-full flex flex-col bg-white rounded-xl shadow-lg border overflow-hidden relative text-gray-900">
            {cursorMessage && (
                <div 
                    ref={cursorRef} 
                    className={`fixed z-[9999] px-3 py-2 rounded-lg shadow-xl text-xs font-bold pointer-events-none border-2 flex items-center whitespace-nowrap hidden md:flex ${
                        cursorMessage.type === 'warning' 
                        ? 'bg-yellow-100 text-yellow-800 border-yellow-400' 
                        : 'bg-blue-600 text-white border-blue-400'
                    }`}
                >
                    {cursorMessage.type === 'warning' ? <AlertTriangle className="w-3 h-3 mr-1"/> : <Check className="w-3 h-3 mr-1"/>}
                    {cursorMessage.text}
                </div>
            )}
            
            {/* --- PC Header (hidden on mobile) --- */}
            <div className="hidden md:flex p-4 bg-white border-b justify-between items-center shrink-0 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-black text-indigo-900 flex items-center"><Scissors className="mr-2"/> 미용실 스케줄</h2>
                    <div className="flex bg-gray-50 border rounded-lg overflow-hidden p-1 shadow-sm">
                        <button onClick={()=>setView('weekly')} className={`px-4 py-1.5 text-sm font-bold rounded-md transition ${view==='weekly'?'bg-indigo-600 text-white shadow':'text-gray-500 hover:text-gray-900'}`}>주간</button>
                        <button onClick={()=>setView('monthly')} className={`px-4 py-1.5 text-sm font-bold rounded-md transition ${view==='monthly'?'bg-indigo-600 text-white shadow':'text-gray-500 hover:text-gray-900'}`}>월간</button>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={()=>{
                        const d = new Date(baseDate);
                        view === 'weekly' ? d.setDate(d.getDate()-7) : d.setMonth(d.getMonth()-1);
                        setBaseDate(d);
                    }} className="p-2 hover:bg-gray-100 rounded-full transition"><ChevronLeft className="text-gray-500"/></button>
                    <span className="font-black text-gray-700 min-w-[150px] text-center text-lg">
                        {baseDate.getFullYear()}년 {baseDate.getMonth()+1}월
                    </span>
                    <button onClick={()=>{
                        const d = new Date(baseDate);
                        view === 'weekly' ? d.setDate(d.getDate()+7) : d.setMonth(d.getMonth()+1);
                        setBaseDate(d);
                    }} className="p-2 hover:bg-gray-100 rounded-full transition"><ChevronRight className="text-gray-500"/></button>
                    <button onClick={()=>setBaseDate(new Date())} className="bg-white border px-3 py-1.5 rounded-lg font-bold text-sm shadow-sm text-gray-600 hover:bg-gray-50">오늘</button>
                </div>
            </div>

            {/* --- Mobile Header (md:hidden) --- */}
            <div className="md:hidden p-4 bg-white border-b flex justify-between items-center shrink-0 z-20 shadow-sm">
                <div className="flex items-center gap-2">
                    <Scissors className="text-indigo-600 w-5 h-5"/>
                    <span className="font-black text-lg">미용 예약</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={()=>{const d = new Date(baseDate); d.setDate(d.getDate()-1); setBaseDate(d);}} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft/></button>
                    <span className="font-bold text-sm">{getLocalYMD(baseDate)}</span>
                    <button onClick={()=>{const d = new Date(baseDate); d.setDate(d.getDate()+1); setBaseDate(d);}} className="p-2 hover:bg-gray-100 rounded-full"><ChevronRight/></button>
                </div>
            </div>

            {/* --- Mobile List View (md:hidden) --- */}
            <div className="md:hidden flex-1 overflow-y-auto bg-gray-50 p-4 space-y-3">
                {mobileAppointments.length === 0 && (
                    <div className="text-center text-gray-400 py-20 flex flex-col items-center">
                        <Calendar className="w-12 h-12 mb-3 opacity-20"/>
                        <p className="font-bold">예약된 미용이 없습니다.</p>
                        <button 
                            onClick={()=>handleCellClick(baseDate, 10)} 
                            className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md"
                        >
                            + 새 예약 등록
                        </button>
                    </div>
                )}
                {mobileAppointments.map(app => (
                    <div 
                        key={app.id}
                        onClick={() => { setFormData(app); setShowModal(true); }}
                        className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4 active:scale-[0.98] transition-transform"
                    >
                        <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold text-xs shrink-0 ${app.status==='상담중' ? 'bg-yellow-100 text-yellow-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            <span>{app.startTime}</span>
                            <span className="text-[10px] opacity-70">({app.duration}분)</span>
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-black text-gray-900 text-lg">{app.dogName}</span>
                                {app.status==='상담중' && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold animate-pulse">상담중</span>}
                            </div>
                            <div className="text-sm text-gray-600 mb-2">{app.type} / {app.groomingOptions?.body || '-'}</div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <User className="w-3 h-3"/> {app.customerName}
                                {app.staffStart && <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-gray-600">D: {app.staffStart}</span>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* --- PC Grid View (hidden md:flex) --- */}
            <div className="hidden md:flex flex-1 overflow-hidden">
                <div className="flex-1 overflow-auto bg-white custom-scrollbar relative">
                    {view === 'weekly' ? (
                        <div className="min-w-[800px]">
                            <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b bg-gray-50 sticky top-0 z-20 shadow-sm">
                                <div className="p-3 border-r"></div>
                                {weekDates.map((d, i) => (
                                    <div key={i} className={`p-2 text-center border-r last:border-0 ${getLocalYMD(d) === getNowDate() ? 'bg-blue-50' : ''}`}>
                                        <div className="text-xs font-bold text-gray-400">{['일','월','화','수','목','금','토'][d.getDay()]}</div>
                                        <div className={`text-lg font-black ${getLocalYMD(d) === getNowDate() ? 'text-blue-600' : 'text-gray-700'}`}>{d.getDate()}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="relative grid grid-cols-[80px_repeat(7,1fr)]">
                                <div className="bg-gray-50 border-r">
                                    {HOURS.map(h => (
                                        <div key={h} className="border-b text-[10px] text-gray-400 p-1 font-mono text-right pr-2" style={{height: CELL_HEIGHT}}>{String(h).padStart(2, '0')}:00</div>
                                    ))}
                                </div>
                                {weekDates.map((date, i) => (
                                    <div 
                                        key={i} 
                                        className="relative border-r last:border-0" 
                                        onDragOver={handleDragOver} 
                                        onDrop={(e) => handleDrop(e, date)} 
                                    >
                                        {HOURS.map(h => (
                                            <div 
                                                key={h} 
                                                onClick={()=>handleCellClick(date, h)}
                                                className="border-b hover:bg-blue-50/30 cursor-pointer transition"
                                                style={{height: CELL_HEIGHT}}
                                            ></div>
                                        ))}
                                        {renderDailyAppointments(date)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            <div className="grid grid-cols-7 border-b bg-gray-50">
                                {['일','월','화','수','목','금','토'].map(d => (
                                    <div key={d} className="p-2 text-center text-xs font-bold text-gray-500">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                                {monthDates.map((date, i) => (
                                    <div 
                                        key={i} 
                                        className={`border-b border-r p-1 min-h-[100px] relative ${!date ? 'bg-gray-50/50' : ''} ${date && getLocalYMD(date) === getNowDate() ? 'bg-blue-50' : ''}`}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => date && handleDrop(e, date)}
                                        onClick={() => date && handleCellClick(date, 10)}
                                    >
                                        {date && (
                                            <>
                                                <span className={`text-xs font-bold p-1 rounded-full ${getLocalYMD(date)===getNowDate()?'bg-blue-600 text-white':''}`}>{date.getDate()}</span>
                                                <div className="space-y-1 mt-1">
                                                    {appointments.filter(a => normalizeDate(a.date) === getLocalYMD(date)).sort((a,b)=>a.startTime.localeCompare(b.startTime)).map(app => (
                                                        <div 
                                                            key={app.id}
                                                            draggable
                                                            onDragStart={(e) => handleDragStart(e, app)}
                                                            onClick={(e)=>{ 
                                                                if(isDraggingRef.current) return;
                                                                e.stopPropagation(); setFormData(app); setShowModal(true); 
                                                            }}
                                                            className={`text-[9px] p-1 rounded border-l-2 truncate cursor-pointer hover:opacity-80 ${app.status==='상담중' ? 'bg-yellow-100 border-yellow-500 text-yellow-900' : 'bg-blue-100 border-blue-600 text-blue-900'}`}
                                                        >
                                                            <span className="font-bold mr-1">{app.startTime}</span>
                                                            {app.dogName}
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
                        
                        {validationError && (
                            <div className="bg-red-600 text-white p-3 text-center font-bold text-sm animate-pulse z-50 flex items-center justify-center absolute top-0 left-0 right-0 shadow-lg">
                                <AlertTriangle className="w-5 h-5 mr-2 text-white fill-current"/>
                                {validationError}
                                <button onClick={() => setValidationError(null)} className="ml-4 underline opacity-80 hover:opacity-100">닫기</button>
                            </div>
                        )}

                        <div className="flex flex-1 overflow-hidden pt-2">
                             {/* --- Manual Section (Left) - Enhanced SOP Card UI --- */}
                            <div className="w-1/4 bg-slate-50 border-r p-6 overflow-y-auto hidden lg:flex flex-col gap-6 text-gray-900 shadow-inner">
                                <h3 className="font-black text-xl flex items-center text-slate-800 border-b border-slate-200 pb-4">
                                    <Book className="w-6 h-6 mr-2 text-indigo-600"/> 미용 예약 SOP
                                </h3>
                                
                                <div className="space-y-4">
                                    {/* STEP 1 */}
                                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100 relative group transition-all hover:shadow-md hover:border-indigo-300">
                                        <div className="absolute -top-3 -left-2 bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-sm">STEP 1</div>
                                        <h4 className="font-black text-indigo-900 text-sm mb-2 flex items-center"><Scissors className="w-4 h-4 mr-2"/> 스타일 확정</h4>
                                        <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                                            <p className="font-bold bg-slate-100 p-2 rounded-lg text-slate-700">💡 핵심 원칙</p>
                                            <p>고객이 "내일 되나요?"라고 물어도, <span className="font-bold text-red-500 underline">스타일부터</span> 물어봐야 합니다.</p>
                                            <p className="text-[10px] text-slate-400">이유: 스타일을 알아야 소요 시간을 계산하고, 그래야 빈 시간을 찾을 수 있음.</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-slate-300"/></div>

                                    {/* STEP 2 */}
                                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative group transition-all hover:shadow-md">
                                        <div className="absolute -top-3 -left-2 bg-slate-500 text-white text-[10px] font-black px-2 py-1 rounded shadow-sm">STEP 2</div>
                                        <h4 className="font-black text-slate-800 text-sm mb-2 flex items-center"><Clock className="w-4 h-4 mr-2"/> 시간 설정 (Matching)</h4>
                                        <div className="text-xs text-slate-600 space-y-1">
                                            <p>1. 스타일별 소요 시간 산출</p>
                                            <p>2. 캘린더 빈 슬롯 확인</p>
                                            <p>3. 고객에게 가능 시간 안내</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-slate-300"/></div>

                                    {/* STEP 3 */}
                                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 relative group transition-all hover:shadow-md">
                                        <div className="absolute -top-3 -left-2 bg-slate-500 text-white text-[10px] font-black px-2 py-1 rounded shadow-sm">STEP 3</div>
                                        <h4 className="font-black text-slate-800 text-sm mb-2 flex items-center"><CheckCircle2 className="w-4 h-4 mr-2"/> 예약금 안내</h4>
                                        <p className="text-xs text-slate-500">노쇼 방지를 위해 예약금 안내 필수.</p>
                                    </div>

                                    {/* Busy Alert Card */}
                                    <div className="mt-4 bg-red-50 border border-red-200 p-4 rounded-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                                        <div className="flex items-start gap-3">
                                            <div className="bg-white p-2 rounded-full shadow-sm shrink-0">
                                                <Zap className="w-5 h-5 text-red-500 fill-red-500"/>
                                            </div>
                                            <div>
                                                <h4 className="font-black text-red-700 text-sm mb-1">지금 바쁘신가요?</h4>
                                                <p className="text-xs text-red-600 leading-snug">
                                                    통화가 길어지면 안 됩니다!<br/>
                                                    하단의 <span className="font-bold underline">[상담양식 복사]</span> 버튼을 눌러 카톡으로 보내고 끊으세요.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col h-full bg-white relative">
                                <div className="bg-white border-b p-5 flex justify-between items-center shrink-0">
                                    <div><h3 className="text-xl font-black text-gray-900">{formData.id ? '미용 예약 수정' : '미용 예약 상담'}</h3></div>
                                    <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500"><X/></button>
                                </div>
                                
                                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6 text-gray-900 mt-6">
                                    <div className="space-y-4">
                                        <div className="relative z-20">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400"/>
                                                <input type="text" value={custSearch} onChange={e=>{setCustSearch(e.target.value); setShowCustList(true);}} placeholder="고객명/반려견 검색" className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white text-gray-900"/>
                                            </div>
                                            {showCustList && custSearch && (
                                                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 shadow-xl rounded-xl mt-1 max-h-40 overflow-y-auto z-50">
                                                    {customers.filter(c => (c.dogName||'').includes(custSearch) || (c.ownerName||'').includes(custSearch)).slice(0,5).map((c: any) => (
                                                        <div key={c.id} onClick={()=>selectCustomer(c)} className="p-3 hover:bg-blue-50 cursor-pointer flex justify-between border-b last:border-0 text-gray-900">
                                                            <div><span className="font-bold text-blue-700">{c.dogName}</span> <span className="text-xs text-gray-500">({c.breed})</span></div>
                                                            <div className="text-right text-xs text-gray-600"><div>{c.ownerName}</div><div>{c.phone}</div></div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-red-50 border border-red-100 p-3 rounded-xl">
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-xs font-bold text-red-700 flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/> 특이사항</label>
                                                {selectedCustomer && (
                                                    <button onClick={toggleDepositExempt} className={`text-xs px-3 py-1.5 rounded-full font-bold ${selectedCustomer.isDepositExempt ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                                        {selectedCustomer.isDepositExempt ? 'VIP 면제' : '예약금 대상'}
                                                    </button>
                                                )}
                                            </div>
                                            <textarea value={customerNotes} onChange={e=>setCustomerNotes(e.target.value)} placeholder="특이사항 입력..." className="w-full bg-white p-2 rounded border border-red-200 text-sm outline-none text-gray-900" rows={2}/>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="text-xs font-bold text-gray-500 mb-1 block">보호자</label><input type="text" value={formData.customerName || ''} onChange={e=>setFormData({...formData, customerName: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold bg-white text-gray-900"/></div>
                                        <div><label className="text-xs font-bold text-gray-500 mb-1 block">반려견</label><input type="text" value={formData.dogName || ''} onChange={e=>setFormData({...formData, dogName: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold bg-white text-gray-900"/></div>
                                    </div>

                                    <div className="bg-gray-50 p-4 rounded-xl space-y-3 border">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div><label className="text-xs font-bold text-gray-500 mb-1 block">날짜</label><input type="date" value={formData.date || ''} onChange={e=>setFormData({...formData, date: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"/></div>
                                            <div><label className="text-xs font-bold text-gray-500 mb-1 block">시간</label><input type="time" value={formData.startTime || ''} onChange={e=>setFormData({...formData, startTime: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"/></div>
                                            <div><label className="text-xs font-bold text-gray-500 mb-1 block">소요(분)</label><input type="number" step="30" value={formData.duration || 0} onChange={e=>setFormData({...formData, duration: parseInt(e.target.value) || 0})} className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold text-blue-600 bg-white"/></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-bold text-red-600 mb-1 block flex items-center"><Check className="w-3 h-3 mr-1"/> 예약 상담자 (필수)</label>
                                                {/* Updated Staff Select */}
                                                <select value={formData.consultant || ''} onChange={e=>setFormData({...formData, consultant: e.target.value})} className="w-full p-2 border-2 border-red-100 rounded-lg text-sm bg-white text-gray-900 focus:border-red-500">
                                                    <option value="">선택하세요</option>
                                                    {staff.map(s => <option key={s.id} value={s.name}>{s.name} ({s.role})</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 mb-1 block">담당 미용사</label>
                                                {/* Updated Staff Select */}
                                                <select value={formData.staffStart || ''} onChange={e=>setFormData({...formData, staffStart: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900">
                                                    <option value="">선택</option>
                                                    {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-bold text-gray-800 flex items-center"><Scissors className="w-4 h-4 mr-2"/> 스타일</h4>
                                            <label className="flex items-center text-xs font-bold bg-green-50 text-green-700 px-2 py-1 rounded border border-green-200"><input type="checkbox" checked={formData.pickDrop || false} onChange={e=>setFormData({...formData, pickDrop: e.target.checked})} className="mr-1.5"/> 픽업/드랍</label>
                                        </div>
                                        <div className="flex gap-2 mb-3">
                                            {['목욕', '위생', '목욕+위생', '전체미용'].map(t => (
                                                <button key={t} onClick={()=>setFormData({...formData, type: t})} className={`flex-1 py-2 text-sm rounded-lg border font-bold transition ${formData.type===t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500'}`}>{t}</button>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 p-4 border rounded-xl bg-indigo-50/30">
                                            <div className="col-span-1"><label className="text-xs font-bold text-indigo-900 block">얼굴</label><input type="text" value={formData.groomingOptions?.face || ''} onChange={e=>setFormData({...formData, groomingOptions: {...formData.groomingOptions, face: e.target.value}})} className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"/></div>
                                            <div className="col-span-1">
                                                <label className="text-xs font-bold text-indigo-900 block">몸</label>
                                                <select value={formData.groomingOptions?.body || ''} onChange={e=>setFormData({...formData, groomingOptions: {...formData.groomingOptions, body: e.target.value}})} className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900">
                                                    <option value="">선택</option><option>3mm</option><option>5mm</option><option>스포팅</option><option>가위컷</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2"><label className="text-xs font-bold text-indigo-900 block">다리/추가</label><input type="text" placeholder="예: 닭발, 스파" value={formData.groomingOptions?.legs || ''} onChange={e=>setFormData({...formData, groomingOptions: {...formData.groomingOptions, legs: e.target.value}})} className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"/></div>
                                        </div>
                                    </div>

                                    <div className="border-t pt-4">
                                        <div className="flex gap-2 mb-3">
                                            <input type="number" value={formData.deposit || 0} onChange={e=>setFormData({...formData, deposit: parseInt(e.target.value) || 0})} disabled={selectedCustomer?.isDepositExempt} className={`w-24 p-2 border border-gray-300 rounded-lg text-sm font-bold text-right bg-white text-gray-900 ${selectedCustomer?.isDepositExempt ? 'bg-gray-100 text-gray-400' : ''}`}/>
                                            <input type="text" value={formData.depositAccount || ''} onChange={e=>setFormData({...formData, depositAccount: e.target.value})} className="flex-1 p-2 border border-gray-300 rounded-lg text-xs bg-white text-gray-600" placeholder="입금 계좌"/>
                                        </div>
                                        <select value={formData.status || '상담중'} onChange={e=>setFormData({...formData, status: e.target.value})} className={`w-full p-3 border-2 rounded-lg text-sm font-black outline-none bg-white ${formData.status==='상담중'?'border-yellow-400 text-yellow-600':'border-blue-600 text-blue-600'}`}>
                                            <option value="상담중">🏮 상담중 (미확정)</option>
                                            <option value="예약완료">🆙 예약완료 (장부등록)</option>
                                            <option value="취소">❌ 취소</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="p-4 border-t bg-gray-50 flex gap-3 shrink-0 items-center">
                                    {formData.id && (
                                        <button 
                                            onClick={handleDelete} 
                                            className={`border p-3 rounded-xl transition-all duration-200 flex items-center justify-center ${
                                                deleteStep === 1 
                                                ? 'bg-red-600 text-white border-red-600 w-32 font-bold' 
                                                : 'bg-white border-red-200 text-red-600 hover:bg-red-50 w-12'
                                            }`} 
                                            title="예약 삭제"
                                        >
                                            {deleteStep === 1 ? '삭제 확인!' : <Trash2 className="w-5 h-5"/>}
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => { copyToClipboardFallback(CONSULTATION_TEMPLATE); alert("상담 양식이 복사되었습니다."); }} 
                                        className="flex-1 bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
                                    >
                                        <MessageCircle className="w-4 h-4"/> 상담양식 복사
                                    </button>
                                    <button onClick={() => { copyToClipboardFallback("안내문내용"); alert("복사됨"); }} className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 py-3 rounded-xl font-bold text-gray-700 text-xs">안내문 복사</button>
                                    <button onClick={handleSave} className="flex-[1.5] bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black text-lg shadow-lg">저장</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroomingTab;
