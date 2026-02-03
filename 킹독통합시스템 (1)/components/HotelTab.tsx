
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, // Navigation Icons
    ZoomIn, ZoomOut, // Zoom Icons
    Bed, Info, Plus, Search, AlertTriangle, X, Trash2, GripVertical, 
    Calendar as CalendarIcon, Copy, Video, Car 
} from 'lucide-react';
import { getLocalYMD, normalizeDate, getNowDate, copyToClipboardFallback } from '../utils/helpers';
import { Appointment, Customer } from '../types';
import { addDoc, collection, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, appId } from '../services/firebase';

const ROOMS = ['V1', 'V2', 'V3', 'A', 'B', 'C', 'D', 'E'];
const ROW_HEIGHT = 100; 
const VIEW_DAYS = 30;   

const HotelTab = ({ appointments, customers }: { appointments: Appointment[], customers: Customer[] }) => {
    const [baseDate, setBaseDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 2); 
        return d;
    });

    // --- Zoom State ---
    const [cellWidth, setCellWidth] = useState(120);

    // --- Optimistic UI State ---
    const [optimisticApps, setOptimisticApps] = useState<Record<string, Appointment>>({});
    
    // --- Interaction State ---
    const [isDragging, setIsDragging] = useState(false);
    const [dragState, setDragState] = useState<{ id: string, type: 'move' | 'resize', startX: number, initialLeft: number, initialWidth: number, initialDate: string, initialRoom: string, initialDuration: number } | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // --- Modal State ---
    const [showModal, setShowModal] = useState(false);
    const [custSearch, setCustSearch] = useState('');
    const [showCustList, setShowCustList] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [formData, setFormData] = useState<any>({
        id: null, room: 'V1', customerName: '', dogName: '', contact: '',
        startDate: getNowDate(), endDate: getNowDate(),
        status: '상담중', memo: '', pickDrop: false
    });

    // 1. Merge Server Data with Optimistic Data
    const activeAppointments = useMemo(() => {
        const map = new Map(appointments.map(a => [a.id, a]));
        Object.values(optimisticApps).forEach((optApp: any) => {
            if (optApp && optApp.id) {
                map.set(optApp.id, optApp as Appointment);
            }
        });
        return Array.from(map.values()).filter(a => a.category === '호텔' && a.status !== '취소');
    }, [appointments, optimisticApps]);

    // 2. Date & Helper
    const dates = useMemo(() => {
        const list = [];
        for (let i = 0; i < VIEW_DAYS; i++) {
            const d = new Date(baseDate);
            d.setDate(d.getDate() + i);
            list.push(d);
        }
        return list;
    }, [baseDate]);

    // Safer parsing to avoid timezone issues (YYYY-MM-DD -> Local Midnight)
    const parseDateSafe = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const getDiffDays = (startStr: string, endStr: string) => {
        const s = parseDateSafe(startStr);
        const e = parseDateSafe(endStr);
        return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    };

    const addDays = (dateStr: string, days: number) => {
        const d = parseDateSafe(dateStr);
        d.setDate(d.getDate() + days);
        return getLocalYMD(d);
    };

    // 3. Overlap Check
    const checkOverlap = (room: string, startStr: string, endStr: string, excludeId?: string) => {
        const s1 = parseDateSafe(startStr).getTime();
        const e1 = parseDateSafe(endStr).getTime();

        return activeAppointments.some(app => {
            if (app.id === excludeId) return false;
            if (app.room !== room) return false;
            
            const s2 = parseDateSafe(normalizeDate(app.startDate)).getTime();
            const e2 = parseDateSafe(normalizeDate(app.endDate)).getTime();
            return s1 < e2 && e1 > s2;
        });
    };

    // 4. Prepare Render Data
    const renderedItems = useMemo(() => {
        const baseTime = parseDateSafe(getLocalYMD(baseDate)).getTime();
        
        return activeAppointments.map(app => {
            const startStr = normalizeDate(app.startDate);
            const endStr = normalizeDate(app.endDate);
            
            const startTime = parseDateSafe(startStr).getTime();
            const endTime = parseDateSafe(endStr).getTime();

            const daysFromBase = Math.round((startTime - baseTime) / (1000 * 60 * 60 * 24));
            const duration = Math.max(1, Math.round((endTime - startTime) / (1000 * 60 * 60 * 24)));
            
            return {
                ...app,
                // Add 100px offset for the room name column
                left: daysFromBase * cellWidth + 100,
                width: duration * cellWidth,
                displayDuration: duration
            };
        }).filter(item => {
            const rightEdge = item.left + item.width;
            return rightEdge > 100 && item.left < (VIEW_DAYS * cellWidth + 100);
        });
    }, [activeAppointments, baseDate, cellWidth]);


    // --- Interaction Handlers ---

    const handleMouseDown = (e: React.MouseEvent, app: Appointment, type: 'move' | 'resize') => {
        e.stopPropagation();
        e.preventDefault();

        const el = document.getElementById(`app-bar-${app.id}`);
        if (!el) return;

        setIsDragging(true);
        setDragState({
            id: app.id,
            type,
            startX: e.clientX,
            initialLeft: parseFloat(el.style.left || '0'),
            initialWidth: parseFloat(el.style.width || '0'),
            initialDate: normalizeDate(app.startDate),
            initialRoom: app.room || 'V1',
            initialDuration: getDiffDays(normalizeDate(app.startDate), normalizeDate(app.endDate))
        });

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
        setDragState(prev => {
            if (!prev) return null;
            const deltaX = e.clientX - prev.startX;
            const el = document.getElementById(`app-bar-${prev.id}`);
            
            if (el) {
                el.style.transition = 'none';
                el.style.zIndex = '50';
                
                if (prev.type === 'move') {
                    el.style.transform = `translateX(${deltaX}px)`;
                    el.style.opacity = '0.7';
                } else {
                    const newWidth = Math.max(cellWidth, prev.initialWidth + deltaX);
                    el.style.width = `${newWidth}px`;
                }
            }
            return prev;
        });
    };

    const onMouseUp = async (e: MouseEvent) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        setDragState(currentDrag => {
            if (!currentDrag) return null;

            const el = document.getElementById(`app-bar-${currentDrag.id}`);
            if (el) {
                el.style.transform = '';
                el.style.transition = '';
                el.style.opacity = '';
                el.style.zIndex = '';
                if (currentDrag.type === 'resize') el.style.width = ''; 
            }

            const deltaX = e.clientX - currentDrag.startX;
            
            const app = activeAppointments.find(a => a.id === currentDrag.id);
            if (!app) return null;

            if (currentDrag.type === 'move') {
                if (scrollContainerRef.current) {
                    const containerRect = scrollContainerRef.current.getBoundingClientRect();
                    const scrollTop = scrollContainerRef.current.scrollTop;
                    const mouseRelY = e.clientY - containerRect.top + scrollTop;

                    const roomIdx = Math.floor((mouseRelY - 40) / ROW_HEIGHT); // 40 is header height approx
                    const dayDelta = Math.round(deltaX / cellWidth);
                    
                    const newStartStr = addDays(currentDrag.initialDate, dayDelta);
                    const newEndStr = addDays(newStartStr, currentDrag.initialDuration);
                    
                    let targetRoom = currentDrag.initialRoom;
                    if (roomIdx >= 0 && roomIdx < ROOMS.length) {
                        targetRoom = ROOMS[roomIdx];
                    }

                    if (!checkOverlap(targetRoom, newStartStr, newEndStr, app.id)) {
                        const updatedApp = { ...app, room: targetRoom, startDate: newStartStr, endDate: newEndStr };
                        setOptimisticApps(prev => ({ ...prev, [app.id]: updatedApp }));

                        updateDoc(doc(db, 'kingdog', appId, 'appointments', app.id), {
                            room: targetRoom,
                            startDate: newStartStr,
                            endDate: newEndStr,
                            updatedAt: new Date().toISOString()
                        }).catch(err => {
                            console.error(err);
                            alert("이동 실패 (서버 오류)");
                            setOptimisticApps(prev => {
                                const newState = { ...prev };
                                delete newState[app.id];
                                return newState;
                            });
                        });
                    }
                }
            } else {
                const dayDelta = Math.round(deltaX / cellWidth);
                const newDuration = Math.max(1, currentDrag.initialDuration + dayDelta);
                const newEndStr = addDays(currentDrag.initialDate, newDuration);

                if (!checkOverlap(currentDrag.initialRoom, currentDrag.initialDate, newEndStr, app.id)) {
                     const updatedApp = { ...app, endDate: newEndStr };
                     setOptimisticApps(prev => ({ ...prev, [app.id]: updatedApp }));

                     updateDoc(doc(db, 'kingdog', appId, 'appointments', app.id), {
                        endDate: newEndStr,
                        updatedAt: new Date().toISOString()
                    }).catch(err => {
                        console.error(err);
                        alert("변경 실패");
                         setOptimisticApps(prev => {
                            const newState = { ...prev };
                            delete newState[app.id];
                            return newState;
                        });
                    });
                }
            }

            return null;
        });
        
        setTimeout(() => setIsDragging(false), 100);
    };

    const handleGridClick = (date: Date, room: string) => {
        if (isDragging) return;
        
        const dateStr = getLocalYMD(date);
        const nextDayStr = addDays(dateStr, 1);
        
        if (checkOverlap(room, dateStr, nextDayStr)) {
            alert("이미 예약된 공간입니다.");
            return;
        }

        setFormData({
            id: null, room,
            customerName: '', dogName: '', contact: '',
            startDate: dateStr, endDate: nextDayStr,
            startTime: '14:00', endTime: '11:00',
            status: '상담중', memo: '', pickDrop: false, extraDogCount: 0
        });
        setCustSearch('');
        setValidationError(null);
        setShowModal(true);
    };

    const handleAppClick = (e: React.MouseEvent, app: Appointment) => {
        if (isDragging) return;
        e.stopPropagation();

        const latestApp = activeAppointments.find(a => a.id === app.id) || app;

        setFormData({
            ...latestApp,
            startDate: normalizeDate(latestApp.startDate),
            endDate: normalizeDate(latestApp.endDate)
        });
        setCustSearch(`${latestApp.dogName} (${latestApp.customerName})`);
        setValidationError(null);
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.customerName) { setValidationError("고객명은 필수입니다."); return; }
        if (formData.startDate >= formData.endDate) { setValidationError("날짜 설정이 올바르지 않습니다."); return; }
        if (checkOverlap(formData.room, formData.startDate, formData.endDate, formData.id)) {
            setValidationError("중복된 예약이 있습니다."); return;
        }

        const payload = { ...formData, category: '호텔', date: formData.startDate, updatedAt: new Date().toISOString() };
        
        try {
            if (formData.id) {
                setOptimisticApps(prev => ({ ...prev, [formData.id]: payload }));
                await updateDoc(doc(db, 'kingdog', appId, 'appointments', formData.id), payload);
            } else {
                await addDoc(collection(db, 'kingdog', appId, 'appointments'), { ...payload, createdAt: new Date().toISOString() });
            }
            setShowModal(false);
        } catch (e: any) {
            setValidationError(e.message);
        }
    };

    const handleDelete = async () => {
        if(!formData.id || !confirm("삭제하시겠습니까?")) return;
        setOptimisticApps(prev => {
             const newState = { ...prev };
             delete newState[formData.id]; 
             return newState;
        });
        await deleteDoc(doc(db, 'kingdog', appId, 'appointments', formData.id));
        setShowModal(false);
    };

    const selectCustomer = (c: Customer) => {
        setFormData({ ...formData, customerName: c.ownerName, dogName: c.dogName, contact: c.phone });
        setCustSearch(`${c.dogName} (${c.ownerName})`);
        setShowCustList(false);
    };

    // --- Copy Templates ---
    const copyConsultationForm = () => {
        const text = `
소중한 우리 ${formData.dogName || '00'}의 하루가 보호자님을 기다리며 '견디는 시간'이 아닌, '즐거운 휴가'가 되기를 바랍니다.
집에서 보내던 편안한 일상과 리듬이 깨지지 않도록, 아이의 평소 라이프스타일을 알려주세요.

🍽️ 1. 식사 습관
사료와 간식은 평소에 먹던 것을 평소에 먹던 그릇에 먹는 것이 심리 안정과 건강에 좋습니다.

* 평소 식사 시간: (예: 오전 8시, 오후 7시) 정확한 시간을 알려주시면 최대한 맞춰 급여합니다.
    * [ 오전: _________ / 오후: _________ ]
    * 자율급식 하고있다.
* 식사 스타일:
    * [ ] 건사료 그대로 급여
    * [ ] 물에 불리거나, 따뜻한 물 약간 섞어서 (온도 민감도 체크)
    * [ ] 토핑/화식 섞어주기 (가져오신 경우 비율 기재)
    * [ ] 손으로 떠먹여 주어야 함 / 식기 높이 중요함
* 간식 루틴:
    * 하루 허용 가능한 간식의 양은 어느 정도인가요? (예: 껌 1개, 큐브 3개)
    * 특정 상황에서만 주는 '보상 간식'이 있나요? (예: 배변 후, 빗질 후)


🚶 2. 산책 & 활동
"필요 신체 활동량이 채워지면 마음도 쉽게 채워집니다."
* 산책 필요 여부 :
    * 평소의 산책 주기를 말씀해 주세요.
* 실외 배변 :
    * 실외 배변을 하는 아이라면 말씀해 주세요.
* 친구들과의 관계 (Socializing):
    * [ ] 적극적으로 먼저 다가감
    * [ ] 내 공간만 침범하지 않으면 괜찮음
    * [ ] 친구보다는 사람(선생님)과 노는 것을 선호함

🛌 3. 휴식 & 수면
"낯선 곳에서 집의 향기가 난다."
* 취침 점등 여부:
    * [ ] 완전히 어두운 것을 선호
    * [ ] 조명 필요
* 수면 환경:
    * 평소 사용하던 켄넬(하우스) / 보호자 체취가 남은 옷이나 담료

📸 4. 보호자님을 위한 서비스
* 안부 알림 서비스:
    * 사진 / 영상 : 식사시간 영상, 오전 오후 놀이방 생활모음 각각 1회
    * 산책 추가시 : 산책 영상 사진
    * 잠자는 방에는 : 개별 CCTV를 보실 수 있어요.
    * 갑자기 보고싶을 땐 바로 연락 주세요.
* 특별 요청 사항:
    * 이 외에 저희가 아이를 위해 꼭 알아두어야 할 사항이 있다면 자유롭게 적어주세요.
        `.trim();
        
        copyToClipboardFallback(text);
        alert('상담 양식이 복사되었습니다.');
    };

    const copyCCTVInfo = () => {
        const room = formData.room || 'V1';
        let id = '', pw = '';
        
        const map: Record<string, {id: string, pw: string}> = {
            'A': { id: 'kinga', pw: 'kingdog01' },
            'B': { id: 'kingb', pw: 'kingdog02' },
            'C': { id: 'kingc', pw: 'kingdogc1' },
            'D': { id: 'kingd', pw: 'kingdog04' },
            'E': { id: 'kinge', pw: 'kingdog5' },
            'V1': { id: 'king6', pw: 'kingdog06' },
            'V2': { id: 'kingv2', pw: 'kingdogv7' },
            'V3': { id: 'king8', pw: 'kingdog08' },
        };

        if (map[room]) {
            id = map[room].id;
            pw = map[room].pw;
        } else {
            id = '문의필요';
            pw = '문의필요';
        }

        const text = `
CCTV 링크 보내드립니다!
오늘 ${formData.dogName || '000'} 호텔룸은 ${room} 룸입니다.
ID : ${id}
PW : ${pw}

정보 입력하시면 룸 CCTV 확인 가능합니다. 

호텔 CCTV 앱 다운로드 링크 ↓
Android: https://play.google.com/store/apps/details?id=kr.co.adt.fnsys.viewguard&hl=ko&gl=US
iOS: https://apps.apple.com/kr/app/%EB%B7%B0%EA%B0%80%EB%93%9C-v4-0/id955784673
        `.trim();

        copyToClipboardFallback(text);
        alert(`CCTV 정보(${room}룸)가 복사되었습니다.`);
    };

    // --- Mobile Room Status Logic ---
    const mobileRoomStatus = useMemo(() => {
        const targetDate = getLocalYMD(baseDate);
        const statusMap: Record<string, Appointment | null> = {};
        ROOMS.forEach(r => statusMap[r] = null);

        activeAppointments.forEach(app => {
            const start = normalizeDate(app.startDate);
            const end = normalizeDate(app.endDate);
            // Check if room is occupied on baseDate
            if (targetDate >= start && targetDate < end) {
                statusMap[app.room || 'V1'] = app;
            }
        });
        return statusMap;
    }, [activeAppointments, baseDate]);

    return (
        <div className="flex flex-col h-full bg-white relative select-none">
            {/* Header */}
            <div className="p-4 bg-white border-b flex justify-between items-center shrink-0 z-20 shadow-sm relative">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-black text-indigo-900 flex items-center">
                        <Bed className="mr-2"/> 호텔 타임라인
                    </h2>
                    {/* Zoom Controls (PC Only) */}
                    <div className="hidden md:flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
                        <button 
                            onClick={() => setCellWidth(prev => Math.max(50, prev - 10))} 
                            className="p-1.5 hover:bg-white rounded-md transition text-gray-600 hover:text-indigo-600 hover:shadow-sm" 
                            title="축소 (더 많은 기간 보기)"
                        >
                            <ZoomOut className="w-4 h-4"/>
                        </button>
                        <span className="text-xs font-black text-gray-500 w-12 text-center select-none">
                            {Math.round((cellWidth / 120) * 100)}%
                        </span>
                        <button 
                            onClick={() => setCellWidth(prev => Math.min(200, prev + 10))} 
                            className="p-1.5 hover:bg-white rounded-md transition text-gray-600 hover:text-indigo-600 hover:shadow-sm" 
                            title="확대 (자세히 보기)"
                        >
                            <ZoomIn className="w-4 h-4"/>
                        </button>
                    </div>
                    <div className="hidden xl:flex text-[10px] font-bold text-gray-400 bg-white border px-3 py-1 rounded-full shadow-sm items-center">
                        <Info className="w-3 h-3 mr-1"/>
                        드래그하여 이동 · 우측 끝을 잡아 기간 연장
                    </div>
                </div>
                
                {/* Navigation Controls */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-gray-50 rounded-full p-1 border">
                        <button onClick={() => setBaseDate(d => { const n = new Date(d); n.setDate(n.getDate()-7); return n; })} className="p-2 hover:bg-white hover:shadow-sm rounded-full transition group" title="1주일 전">
                            <ChevronsLeft className="text-gray-400 group-hover:text-indigo-600 w-4 h-4"/>
                        </button>
                        <button onClick={() => setBaseDate(d => { const n = new Date(d); n.setDate(n.getDate()-1); return n; })} className="p-2 hover:bg-white hover:shadow-sm rounded-full transition group" title="1일 전">
                            <ChevronLeft className="text-gray-600 group-hover:text-indigo-600 w-4 h-4"/>
                        </button>
                        <span className="font-black text-gray-700 min-w-[140px] text-center text-lg select-none">
                            {baseDate.getFullYear()}. {baseDate.getMonth() + 1}. {baseDate.getDate()}
                        </span>
                        <button onClick={() => setBaseDate(d => { const n = new Date(d); n.setDate(n.getDate()+1); return n; })} className="p-2 hover:bg-white hover:shadow-sm rounded-full transition group" title="1일 후">
                            <ChevronRight className="text-gray-600 group-hover:text-indigo-600 w-4 h-4"/>
                        </button>
                        <button onClick={() => setBaseDate(d => { const n = new Date(d); n.setDate(n.getDate()+7); return n; })} className="p-2 hover:bg-white hover:shadow-sm rounded-full transition group" title="1주일 후">
                            <ChevronsRight className="text-gray-400 group-hover:text-indigo-600 w-4 h-4"/>
                        </button>
                    </div>
                    <button onClick={() => setBaseDate(new Date(new Date().setDate(new Date().getDate()-2)))} className="px-4 py-2 border bg-white rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50 shadow-sm transition">오늘</button>
                </div>
            </div>

            {/* --- Mobile Room Status Grid (md:hidden) --- */}
            <div className="md:hidden flex-1 overflow-y-auto bg-gray-50 p-4">
                <div className="grid grid-cols-2 gap-4">
                    {ROOMS.map(room => {
                        const app = mobileRoomStatus[room];
                        return (
                            <div 
                                key={room}
                                onClick={() => {
                                    if(app) {
                                        handleAppClick({} as any, app);
                                    } else {
                                        handleGridClick(baseDate, room);
                                    }
                                }}
                                className={`aspect-square rounded-2xl p-4 flex flex-col justify-between shadow-sm transition-all active:scale-95 ${
                                    app 
                                    ? 'bg-indigo-600 text-white shadow-indigo-200' 
                                    : 'bg-white border-2 border-dashed border-gray-200 text-gray-400 hover:border-indigo-300'
                                }`}
                            >
                                <div className="text-2xl font-black">{room}</div>
                                {app ? (
                                    <div>
                                        <div className="text-lg font-bold truncate">{app.dogName}</div>
                                        <div className="text-xs opacity-70 truncate">~{app.endDate.slice(5)} 퇴실</div>
                                    </div>
                                ) : (
                                    <div className="text-xs font-bold flex items-center">
                                        <Plus className="w-4 h-4 mr-1"/> 예약가능
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- PC Timeline View (hidden md:block) --- */}
            <div ref={scrollContainerRef} className="hidden md:block flex-1 overflow-auto relative custom-scrollbar bg-gray-50/30">
                {/* Headers */}
                <div className="flex sticky top-0 z-10" style={{ width: cellWidth * VIEW_DAYS + 100 }}>
                    <div className="w-[100px] shrink-0 bg-white border-b border-r flex items-center justify-center font-bold text-gray-500 shadow-sm z-20">객실</div>
                    {dates.map((date, i) => (
                        <div key={i} className={`h-10 border-b border-r flex items-center justify-center text-xs font-bold shrink-0 ${getLocalYMD(date)===getNowDate() ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600'}`} style={{ width: cellWidth }}>
                            {date.getDate()} ({['일','월','화','수','목','금','토'][date.getDay()]})
                        </div>
                    ))}
                </div>

                {/* Grid */}
                <div style={{ width: cellWidth * VIEW_DAYS + 100 }}>
                    {ROOMS.map(room => (
                        <div key={room} className="flex relative" style={{ height: ROW_HEIGHT }}>
                            {/* Room Name */}
                            <div className="w-[100px] shrink-0 sticky left-0 bg-white border-r border-b flex flex-col items-center justify-center font-black text-gray-700 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                <span className="text-lg">{room}</span>
                                <span className="text-[10px] text-gray-400 font-normal">Standard</span>
                            </div>
                            
                            {/* Cells */}
                            {dates.map((date, i) => (
                                <div 
                                    key={i} 
                                    onClick={() => handleGridClick(date, room)}
                                    className={`border-r border-b shrink-0 hover:bg-indigo-50 transition-colors ${[0,6].includes(date.getDay()) ? 'bg-gray-50/50' : 'bg-white'}`} 
                                    style={{ width: cellWidth }}
                                />
                            ))}

                            {/* Appointments */}
                            {renderedItems.filter(item => item.room === room).map(app => (
                                <div
                                    key={app.id}
                                    id={`app-bar-${app.id}`}
                                    onMouseDown={(e) => handleMouseDown(e, app, 'move')}
                                    onClick={(e) => handleAppClick(e, app)}
                                    className={`absolute top-2 bottom-2 rounded-lg shadow-md border flex items-center px-3 cursor-pointer overflow-hidden group select-none ${app.status==='상담중' ? 'bg-yellow-100 border-yellow-400 text-yellow-900' : 'bg-indigo-600 border-indigo-700 text-white'}`}
                                    style={{ left: app.left, width: app.width, zIndex: 5 }}
                                >
                                    <div className="flex flex-col truncate">
                                        <span className="font-black text-xs truncate">{app.dogName}</span>
                                        <span className="text-[10px] opacity-80 truncate">{app.customerName}</span>
                                    </div>
                                    
                                    {/* Resize Handle */}
                                    <div 
                                        onMouseDown={(e) => handleMouseDown(e, app, 'resize')}
                                        className="absolute right-0 top-0 bottom-0 w-4 cursor-e-resize hover:bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                    >
                                        <GripVertical className="w-3 h-3"/>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-indigo-900 p-4 flex justify-between items-center text-white shrink-0">
                            <h3 className="font-black text-lg flex items-center"><Bed className="mr-2"/> {formData.id ? '예약 수정' : '새로운 예약'}</h3>
                            <button onClick={() => setShowModal(false)} className="hover:bg-white/20 p-2 rounded-full transition"><X/></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
                            {validationError && (
                                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center border border-red-100">
                                    <AlertTriangle className="w-4 h-4 mr-2"/> {validationError}
                                </div>
                            )}

                            {/* Customer Search */}
                            <div className="relative">
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400"/>
                                    <input 
                                        type="text" 
                                        placeholder="고객명 또는 반려견 검색" 
                                        value={custSearch}
                                        onChange={e => { setCustSearch(e.target.value); setShowCustList(true); }}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-gray-900"
                                    />
                                </div>
                                {showCustList && custSearch && (
                                    <div className="absolute top-full left-0 right-0 bg-white border shadow-xl rounded-xl mt-1 max-h-40 overflow-y-auto z-50">
                                        {customers.filter(c => (c.dogName||'').includes(custSearch) || (c.ownerName||'').includes(custSearch)).slice(0,5).map(c => (
                                            <div key={c.id} onClick={() => selectCustomer(c)} className="p-3 hover:bg-indigo-50 cursor-pointer border-b last:border-0 flex justify-between items-center text-gray-900">
                                                <div>
                                                    <span className="font-bold text-indigo-700">{c.dogName}</span>
                                                    <span className="text-xs text-gray-500 ml-1">({c.breed})</span>
                                                </div>
                                                <div className="text-right text-xs text-gray-400">
                                                    <div>{c.ownerName}</div>
                                                    <div>{c.phone}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">보호자</label>
                                    <input type="text" value={formData.customerName} onChange={e=>setFormData({...formData, customerName: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm font-bold bg-white text-gray-900"/>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">반려견</label>
                                    <input type="text" value={formData.dogName} onChange={e=>setFormData({...formData, dogName: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm font-bold bg-white text-gray-900"/>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-xl border space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 mb-1 block">체크인</label>
                                        <input type="date" value={formData.startDate} onChange={e=>setFormData({...formData, startDate: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900"/>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 mb-1 block">체크아웃</label>
                                        <input type="date" value={formData.endDate} onChange={e=>setFormData({...formData, endDate: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900"/>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-gray-500 mb-1 block">객실</label>
                                        <select value={formData.room} onChange={e=>setFormData({...formData, room: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white text-gray-900 outline-none">
                                            {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs font-bold text-gray-500 mb-1 block">상태</label>
                                        <select value={formData.status} onChange={e=>setFormData({...formData, status: e.target.value})} className={`w-full border border-gray-300 p-2.5 rounded-lg text-sm font-bold outline-none bg-white ${formData.status==='상담중'?'text-yellow-600':'text-indigo-600'}`}>
                                            <option value="상담중">상담중</option>
                                            <option value="예약완료">예약완료</option>
                                            <option value="취소">취소</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 border p-3 rounded-xl">
                                <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-700">
                                    <input type="checkbox" checked={formData.pickDrop} onChange={e=>setFormData({...formData, pickDrop: e.target.checked})} className="w-4 h-4 text-indigo-600 rounded"/>
                                    <Car className="w-4 h-4 text-indigo-500"/> 픽업/드랍 신청
                                </label>
                            </div>

                            <textarea 
                                value={formData.memo} 
                                onChange={e=>setFormData({...formData, memo: e.target.value})} 
                                className="w-full h-20 border border-gray-300 p-3 rounded-xl text-sm resize-none bg-white text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 transition"
                                placeholder="메모 입력..."
                            />
                        </div>

                        <div className="p-4 bg-gray-50 border-t flex gap-3 shrink-0">
                            {formData.id && (
                                <button onClick={handleDelete} className="p-3 bg-white border border-red-200 text-red-500 rounded-xl hover:bg-red-50 transition">
                                    <Trash2 className="w-5 h-5"/>
                                </button>
                            )}
                            <button onClick={copyConsultationForm} className="flex-1 bg-white border border-gray-300 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-100 py-3">상담양식 복사</button>
                            <button onClick={copyCCTVInfo} className="flex-1 bg-white border border-gray-300 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-100 py-3">CCTV 안내</button>
                            <button onClick={handleSave} className="flex-[2] bg-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-700 transition transform active:scale-95">저장</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HotelTab;
