
import React, { useState, useMemo, useEffect } from 'react';
import { Appointment, Task, Customer, Transaction, Staff, Handover } from '../types';
import { getNowDate, getLocalYMD, normalizeDate, formatCurrency } from '../utils/helpers';
import { Bed, CheckSquare, AlertTriangle, X, Save, Camera, StickyNote, CalendarClock, Megaphone, BarChart3, ChevronRight, User, Calendar } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, appId, storage } from '../services/firebase';

const ROOMS = ['V1', 'V2', 'V3', 'A', 'B', 'C', 'D', 'E'];
const MAX_CAPACITY = 30; // 혼잡도 100% 기준

interface WeeklyCompassProps {
    appointments: Appointment[];
    tasks: Task[];
    customers: Customer[];
    transactions: Transaction[];
    staff: Staff[];
    handovers: Handover[];
    isMobileCollapsed: boolean;
    toggleMobile: () => void;
    setActiveTab: (tab: string) => void;
}

const WeeklyCompass = ({ 
    appointments, tasks, customers, transactions, staff, handovers, 
    isMobileCollapsed, toggleMobile, setActiveTab 
}: WeeklyCompassProps) => {
    const today = getNowDate();
    const tomorrow = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return getLocalYMD(d);
    }, []);

    const [selectedRoomApp, setSelectedRoomApp] = useState<Appointment | null>(null);
    const [careInfo, setCareInfo] = useState('');
    const [uploading, setUploading] = useState(false);

    // 1. Hotel Status Logic (Occupied vs Reserved vs Empty)
    const roomStatus = useMemo(() => {
        const status: Record<string, { app: Appointment | null, state: 'occupied' | 'reserved' | 'empty', label: string }> = {};
        ROOMS.forEach(r => status[r] = { app: null, state: 'empty', label: '-' });

        appointments.forEach(app => {
            if (app.category === '호텔' && app.room && app.status !== '취소') {
                const start = normalizeDate(app.startDate);
                const end = normalizeDate(app.endDate);
                
                // Case 1: Occupied Today (Start <= Today < End)
                if (today >= start && today < end) {
                    status[app.room] = { app, state: 'occupied', label: app.dogName };
                }
                // Case 2: Reserved for Tomorrow (Start == Tomorrow) - Only if not occupied
                else if (start === tomorrow && status[app.room].state === 'empty') {
                    status[app.room] = { app, state: 'reserved', label: app.dogName };
                }
            }
        });
        return status;
    }, [appointments, today, tomorrow]);

    // 2. Important Handovers Logic
    const importantHandovers = useMemo(() => {
        return handovers.filter(h => 
            h.isImportant && !h.isChecked
        ).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    }, [handovers]);

    // 3. Task Marquee Logic (Tasks due within 7 days)
    const upcomingTasks = useMemo(() => {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const nextWeekStr = getLocalYMD(nextWeek);

        return tasks.filter(t => 
            !t.isDone && 
            t.dueDate >= today && 
            t.dueDate <= nextWeekStr
        ).sort((a,b) => a.dueDate.localeCompare(b.dueDate));
    }, [tasks, today]);

    // 4. Occupancy Forecast Logic (Next 7 Days)
    const occupancyForecast = useMemo(() => {
        const forecast = [];
        const days = ['일', '월', '화', '수', '목', '금', '토'];

        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const dateStr = getLocalYMD(d);
            const dayName = days[d.getDay()];

            // A. Count Hotel Guests
            const hotelCount = appointments.filter(a => 
                a.category === '호텔' && a.status !== '취소' &&
                normalizeDate(a.startDate) <= dateStr && normalizeDate(a.endDate) > dateStr
            ).length;

            // B. Count Kindergarten (Fixed Days)
            const kinderCount = customers.filter(c => 
                c.kindergarten?.fixedDays?.includes(dayName) && !c.kindergarten?.isRecess
            ).length;

            const total = hotelCount + kinderCount;
            const percent = Math.min(100, Math.round((total / MAX_CAPACITY) * 100));
            
            // Add breakdown counts
            forecast.push({ day: dayName, total, percent, hotelCount, kinderCount });
        }
        return forecast;
    }, [appointments, customers, today]);

    // --- Interaction Handlers ---

    const handleRoomClick = (room: string) => {
        const data = roomStatus[room];
        if (data.app) {
            setSelectedRoomApp(data.app);
            setCareInfo(data.app.careInfo || '');
        }
    };

    const saveCareInfo = async () => {
        if (!selectedRoomApp) return;
        try {
            await updateDoc(doc(db, 'kingdog', appId, 'appointments', selectedRoomApp.id), { careInfo });
            setSelectedRoomApp(prev => prev ? ({ ...prev, careInfo }) : null);
            alert('케어 정보가 저장되었습니다.');
        } catch (e: any) {
            console.error(e);
            alert(`저장 오류: ${e.message}`);
        }
    };

    const handleBelongingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedRoomApp || !e.target.files?.[0]) return;
        setUploading(true);
        try {
            const file = e.target.files[0];
            const storageRef = ref(storage, `belongings/${selectedRoomApp.id}_${Date.now()}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            
            const newPhotos = [...(selectedRoomApp.belongingPhotos || []), { url, comment: '' }];
            await updateDoc(doc(db, 'kingdog', appId, 'appointments', selectedRoomApp.id), { belongingPhotos: newPhotos });
            
            setSelectedRoomApp(prev => prev ? ({ ...prev, belongingPhotos: newPhotos }) : null);
        } catch (e) {
            console.error(e);
            alert('업로드 실패');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className={`bg-slate-50 border-r border-slate-200 transition-all duration-300 flex flex-col shrink-0 ${isMobileCollapsed ? 'w-0 md:w-[300px] overflow-hidden' : 'w-full md:w-[300px] fixed inset-0 z-50 md:relative'}`}>
            <style>{`
                @keyframes marquee {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(-50%); }
                }
                .animate-marquee {
                    animation: marquee 15s linear infinite;
                }
                .animate-marquee:hover {
                    animation-play-state: paused;
                }
            `}</style>

            {/* Header */}
            <div className="p-4 bg-indigo-900 text-white flex justify-between items-center shadow-md z-10 shrink-0">
                <div>
                    <h2 className="font-black text-base tracking-tight flex items-center">
                        <StickyNote className="w-4 h-4 mr-2 text-yellow-400"/> Weekly Compass
                    </h2>
                    <p className="text-[10px] text-indigo-200 mt-0.5 font-medium">{today} 현황판</p>
                </div>
                <button onClick={toggleMobile} className="md:hidden p-1 bg-white/10 rounded-full"><X className="w-4 h-4"/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
                
                {/* 1. Hotel Status (Grid) - Compact */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-2 border-b flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-700 text-xs flex items-center"><Bed className="w-3.5 h-3.5 mr-1.5 text-indigo-600"/> 룸 현황</h3>
                        <div className="flex gap-1.5 text-[9px]">
                            <span className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1"></div>입실</span>
                            <span className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1"></div>예약</span>
                        </div>
                    </div>
                    <div className="p-2 grid grid-cols-4 gap-1.5">
                        {ROOMS.map(room => {
                            const info = roomStatus[room];
                            let btnClass = "aspect-square rounded-lg flex flex-col items-center justify-center p-0.5 transition-all border ";
                            
                            if (info.state === 'occupied') {
                                btnClass += "bg-green-100 border-green-200 text-green-800 shadow-sm font-bold";
                            } else if (info.state === 'reserved') {
                                btnClass += "bg-blue-50 border-blue-200 border-dashed text-blue-600";
                            } else {
                                btnClass += "bg-slate-50 border-slate-100 text-slate-300";
                            }

                            return (
                                <button 
                                    key={room}
                                    onClick={() => handleRoomClick(room)}
                                    disabled={info.state === 'empty'}
                                    className={btnClass}
                                    title={info.app ? `${info.app.dogName} (${info.app.startDate}~${info.app.endDate})` : '빈 방'}
                                >
                                    <span className="text-[8px] font-black opacity-70 mb-0.5">{room}</span>
                                    <span className="text-[9px] truncate w-full text-center tracking-tighter">{info.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 2. Important Handovers (Yellow Box) - Clickable & Compact & Scrollable */}
                {importantHandovers.length > 0 && (
                    <div 
                        onClick={() => setActiveTab('handover')}
                        className="bg-yellow-50 rounded-xl p-2.5 border border-yellow-200 shadow-sm animate-in slide-in-from-right duration-500 cursor-pointer hover:bg-yellow-100 transition-colors group"
                        title="클릭하여 인수인계 탭으로 이동"
                    >
                        <h3 className="font-black text-yellow-800 text-xs mb-2 flex items-center justify-between">
                            <span className="flex items-center"><Megaphone className="w-3.5 h-3.5 mr-1.5"/> 주요 전달사항</span>
                            <div className="flex items-center gap-1">
                                <span className="text-[9px] bg-yellow-200 px-1.5 py-0.5 rounded-full text-yellow-800">{importantHandovers.length}건</span>
                                <ChevronRight className="w-3 h-3 text-yellow-600 opacity-50 group-hover:opacity-100 transition-opacity"/>
                            </div>
                        </h3>
                        <div className="space-y-1.5">
                            {importantHandovers.map(h => (
                                <div 
                                    key={h.id} 
                                    className="bg-white/80 p-2 rounded border border-yellow-100 text-[10px] shadow-sm group-hover:bg-white transition-colors"
                                    title={`[${h.category}] 작성자: ${h.author}\n작성일: ${h.date}\n\n${h.content}`}
                                >
                                    <div className="flex justify-between items-center mb-1 pb-1 border-b border-yellow-50">
                                        <span className="font-bold text-yellow-700 bg-yellow-50 px-1 rounded">[{h.category}]</span>
                                        <div className="flex items-center text-[8px] text-yellow-600/70">
                                            <span className="mr-1">{h.date.slice(5)}</span>
                                            <span className="font-bold">{h.author}</span>
                                        </div>
                                    </div>
                                    <div className="text-yellow-900 leading-tight whitespace-pre-wrap break-words font-medium max-h-[65px] overflow-y-auto custom-scrollbar pr-1">
                                        {h.content}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. Upcoming Schedule (Marquee) - Compact */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="p-2 border-b bg-slate-50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 text-xs flex items-center"><CheckSquare className="w-3.5 h-3.5 mr-1.5 text-emerald-600"/> 주간 업무 일정</h3>
                    </div>
                    <div className="h-32 overflow-hidden relative bg-white">
                        {upcomingTasks.length > 0 ? (
                            <div className="absolute w-full animate-marquee hover:[animation-play-state:paused]">
                                {[...upcomingTasks, ...upcomingTasks].map((task, i) => (
                                    <div 
                                        key={`${task.id}-${i}`} 
                                        className="p-2 border-b border-slate-50 hover:bg-indigo-50 transition cursor-pointer flex items-start justify-between group"
                                        title={`[${task.priority === 'high' ? '긴급' : '일반'}] ${task.title}\n담당: ${task.assignee}\n기한: ${task.dueDate}`}
                                    >
                                        <div className="overflow-hidden flex-1 min-w-0">
                                            <div className="text-[10px] font-bold text-slate-700 truncate">{task.title}</div>
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                <div className="text-[9px] text-slate-400 flex items-center bg-slate-50 px-1 rounded">
                                                    <Calendar className="w-2 h-2 mr-1"/>{task.dueDate.slice(5)}
                                                </div>
                                                <div className="text-[9px] text-indigo-500 font-bold flex items-center bg-indigo-50 px-1 rounded">
                                                    <User className="w-2 h-2 mr-1"/>{task.assignee}
                                                </div>
                                            </div>
                                        </div>
                                        {task.priority === 'high' && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1" title="긴급/중요"></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-[10px] text-slate-400">예정된 업무가 없습니다.</div>
                        )}
                    </div>
                </div>

                {/* 4. Occupancy Forecast (Bar Chart) - Compact */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
                    <h3 className="font-bold text-slate-700 text-xs flex items-center mb-3"><BarChart3 className="w-3.5 h-3.5 mr-1.5 text-purple-600"/> 주간 혼잡도 예측</h3>
                    <div className="flex items-end justify-between h-16 gap-1">
                        {occupancyForecast.map((data, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                {/* Detailed Tooltip with Remaining Slots */}
                                <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[9px] p-2 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none flex flex-col gap-0.5">
                                    <div className="font-bold border-b border-gray-600 pb-0.5 mb-0.5">{data.day}요일 혼잡도</div>
                                    <div className="flex justify-between gap-3 text-orange-300"><span>호텔</span> <span>{data.hotelCount}</span></div>
                                    <div className="flex justify-between gap-3 text-yellow-300"><span>유치원</span> <span>{data.kinderCount}</span></div>
                                    <div className="border-t border-gray-600 pt-0.5 mt-0.5 flex justify-between font-bold"><span>합계</span> <span>{data.total}</span></div>
                                    <div className="text-green-400 font-bold text-center mt-0.5">잔여: {Math.max(0, MAX_CAPACITY - data.total)}</div>
                                </div>

                                <div 
                                    className={`w-full rounded-t-sm relative transition-all duration-500 ease-out ${
                                        data.percent >= 80 ? 'bg-red-400' : 
                                        data.percent >= 50 ? 'bg-orange-300' : 'bg-slate-200'
                                    }`}
                                    style={{ height: `${Math.max(10, data.percent)}%` }}
                                >
                                </div>
                                <div className={`text-[9px] mt-1 font-bold ${data.day === '일' || data.day === '토' ? 'text-red-400' : 'text-slate-500'}`}>
                                    {data.day}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 text-[9px] text-center text-slate-400 bg-slate-50 py-0.5 rounded">
                        호텔 + 유치원 (Max 30)
                    </div>
                </div>

            </div>

            {/* Room Detail Modal */}
            {selectedRoomApp && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4 animate-in fade-in" onClick={() => setSelectedRoomApp(null)}>
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="bg-indigo-900 p-4 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-lg">{selectedRoomApp.room}호 - {selectedRoomApp.dogName}</h3>
                                <p className="text-xs opacity-70">~ {selectedRoomApp.endDate} 퇴실</p>
                            </div>
                            <button onClick={() => setSelectedRoomApp(null)}><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1.5 block">케어 특이사항 (식사/약)</label>
                                <textarea 
                                    value={careInfo} 
                                    onChange={e => setCareInfo(e.target.value)} 
                                    className="w-full border p-3 rounded-xl text-sm bg-slate-50 h-28 resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="특이사항을 입력하세요..."
                                />
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-2 block flex justify-between">
                                    <span>소지품 사진</span>
                                    <span className="text-indigo-600 font-bold">{selectedRoomApp.belongingPhotos?.length || 0}장</span>
                                </label>
                                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                    <label className="w-16 h-16 bg-slate-100 rounded-xl flex flex-col items-center justify-center cursor-pointer border border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 text-slate-400 shrink-0 transition-colors">
                                        <Camera className="w-5 h-5 mb-1"/>
                                        <span className="text-[9px] font-bold">추가</span>
                                        <input type="file" accept="image/*" onChange={handleBelongingUpload} className="hidden" disabled={uploading}/>
                                    </label>
                                    {selectedRoomApp.belongingPhotos?.map((p, i) => (
                                        <div key={i} className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-slate-200 relative group shadow-sm">
                                            <img src={p.url} className="w-full h-full object-cover"/>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button onClick={saveCareInfo} className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                                <Save className="w-4 h-4"/> 저장하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WeeklyCompass;
