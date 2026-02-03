
import React, { useState, useMemo } from 'react';
import { CalendarCheck, CheckCircle2, LayoutGrid, Car, Ticket, ChevronLeft, ChevronRight, Edit2, Dog, Check, X } from 'lucide-react';
import { Customer, AttendanceLog } from '../types';
import { getNowDate, getLocalYMD } from '../utils/helpers';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, appId } from '../services/firebase';
import { useKindergarten } from '../contexts/KindergartenContext';
import { ConfirmModal } from './Modals';
import { KindergartenDetailModal } from './KindergartenInfoTab';

const AttendanceTab = ({ customers }: { customers: Customer[] }) => {
    const [viewMode, setViewMode] = useState<'daily' | 'planner'>('daily');
    const { attendanceMap, markAttendance } = useKindergarten();
    const today = getNowDate();

    // Internal Modal State
    const [confirmData, setConfirmData] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({
        isOpen: false, message: '', onConfirm: () => {}
    });

    // Customer Detail Modal State
    const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);

    // --- Weekly Planner Logic ---
    const [weekStart, setWeekStart] = useState(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
        return new Date(d.setDate(diff));
    });

    const moveWeek = (offset: number) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + (offset * 7));
        setWeekStart(d);
    };

    const weekDates = useMemo(() => {
        return Array.from({length: 5}, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            return getLocalYMD(d);
        });
    }, [weekStart]);

    // Filter Students: Has any kindergarten setting (Fixed or Flexible)
    const activeStudents = useMemo(() => customers.filter(c => 
        (c.kindergarten?.fixedDays && c.kindergarten.fixedDays.length > 0) || 
        c.kindergarten?.isFlexible ||
        (c.dogs && c.dogs.some(d => d.kindergarten?.fixedDays?.length || d.kindergarten?.isFlexible))
    ), [customers]);

    // Helper: Check if a specific dog is planned for a date
    const isDogPlanned = (customer: Customer, dogId: string, date: string, type: 'attendance' | 'pickup') => {
        const list = type === 'attendance' ? (customer.plannedDates || []) : (customer.pickupDates || []);
        // Legacy: Just date string (Main dog or All)
        if (list.includes(date)) return true;
        // New: Date_DogID string
        return list.includes(`${date}_${dogId}`);
    };

    const togglePlan = async (customer: Customer, dogId: string, date: string, type: 'attendance' | 'pickup') => {
        const key = `${date}_${dogId}`;
        const field = type === 'attendance' ? 'plannedDates' : 'pickupDates';
        const currentList = type === 'attendance' ? (customer.plannedDates || []) : (customer.pickupDates || []);
        
        // Remove legacy exact date match if exists to convert to specific dog format
        let newList = currentList.filter(d => d !== date); 

        if (newList.includes(key)) {
            newList = newList.filter(d => d !== key);
        } else {
            newList.push(key);
        }

        await updateDoc(doc(db, 'kingdog', appId, 'customers', customer.id), { [field]: newList });
    };

    // --- Daily Attendance Logic ---
    const expectedTodayCustomers = useMemo(() => {
        return activeStudents.filter(c => {
            // Logic: Show customer if ANY dog is planned OR ANY dog is already here
            const dogs = c.dogs && c.dogs.length > 0 ? c.dogs : [c as any]; // Normalize
            
            return dogs.some(d => {
                const dogId = d.id || c.id;
                const isPlanned = isDogPlanned(c, dogId, today, 'attendance');
                const hasRecord = attendanceMap[dogId] !== undefined;
                return isPlanned || hasRecord;
            });
        });
    }, [activeStudents, today, attendanceMap]);

    const handleAttendanceToggle = async (customer: Customer, dogData: any) => {
        // Construct a proper Customer-like object for the specific dog to pass to markAttendance
        // If it's a sub-dog, we need to merge properties carefully
        const targetDogObj: Customer = {
            ...customer,
            id: dogData.id || customer.id, // CRITICAL: Use Dog ID for attendance log
            dogName: dogData.dogName,
            // Inherit ticket from parent (shared ticket logic)
            ticket: customer.ticket 
        };

        const record = attendanceMap[targetDogObj.id];
        const currentStatus = record?.status;
        const isAttended = currentStatus === 'present' || currentStatus === 'home';

        if (isAttended) {
            // Cancel Attendance: Pass customer.id as mainCustomerId
            await markAttendance(targetDogObj, 'absent', false, customer.id);
        } else {
            // Mark Present: Pass customer.id as mainCustomerId
            const result = await markAttendance(targetDogObj, 'present', false, customer.id);
            
            if (result === 'REQUIRE_CONFIRM') {
                const remaining = customer.ticket?.remaining || 0;
                setConfirmData({
                    isOpen: true,
                    message: `[이용권 부족] ${customer.ownerName}님의 잔여 이용권이 ${remaining}회입니다.\n${targetDogObj.dogName}를 등원 처리하시겠습니까? (차감되어 음수가 됩니다)`,
                    onConfirm: async () => {
                        // Force True, Pass customer.id as mainCustomerId
                        await markAttendance(targetDogObj, 'present', true, customer.id);
                        setConfirmData(prev => ({ ...prev, isOpen: false }));
                    }
                });
            }
        }
    };

    const getStatusBadges = (c: Customer, dogData: any) => {
        const badges = [];
        const kData = dogData.kindergarten || c.kindergarten;
        
        if (kData?.isRecess) {
            badges.push(<span key="recess" className="text-[9px] bg-gray-500 text-white px-1.5 py-0.5 rounded font-bold">휴원</span>);
        } else {
            if (kData?.fixedDays && kData.fixedDays.length > 0) {
                badges.push(<span key="fixed" className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">고정</span>);
            }
            if (kData?.isFlexible) {
                badges.push(<span key="flex" className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">변동</span>);
            }
        }
        return badges;
    };

    return (
        <div className="h-full bg-gray-50 flex flex-col relative">
            {detailCustomer && (
                <KindergartenDetailModal 
                    customer={detailCustomer} 
                    allCustomers={customers}
                    onClose={() => setDetailCustomer(null)}
                    onUpdate={() => {}}
                    staff={[]} 
                />
            )}

            <ConfirmModal 
                isOpen={confirmData.isOpen} 
                message={confirmData.message} 
                onConfirm={confirmData.onConfirm} 
                onCancel={() => setConfirmData(prev => ({ ...prev, isOpen: false }))} 
            />

            <div className="p-4 bg-white border-b flex justify-between items-center text-gray-900 shadow-sm z-10">
                <h2 className="text-xl font-black flex items-center">
                    <CalendarCheck className="mr-2 text-indigo-600"/> 
                    {viewMode === 'daily' ? '오늘의 출석부' : '주간 등원 계획표'}
                </h2>
                <div className="flex bg-gray-100 rounded-lg p-1">
                    <button 
                        onClick={() => setViewMode('daily')}
                        className={`px-4 py-2 rounded-md text-xs font-bold transition ${viewMode === 'daily' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        <CheckCircle2 className="w-4 h-4 inline mr-1"/> 출석 체크
                    </button>
                    <button 
                        onClick={() => setViewMode('planner')}
                        className={`px-4 py-2 rounded-md text-xs font-bold transition ${viewMode === 'planner' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        <LayoutGrid className="w-4 h-4 inline mr-1"/> 주간 계획
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-gray-50">
                {viewMode === 'daily' ? (
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-white rounded-2xl shadow-sm border border-indigo-50 p-6 mb-6 text-center">
                            <h3 className="text-lg font-bold text-gray-800 mb-2">{today} 등원 관리</h3>
                            <div className="flex justify-center items-center gap-2">
                                <span className="text-3xl font-black text-indigo-600">
                                    {Object.values(attendanceMap).filter((a: any) => a.status === 'present' || a.status === 'home').length}
                                </span>
                                <span className="text-gray-400 text-lg">/ {expectedTodayCustomers.reduce((acc, c) => acc + (c.dogs?.length || 1), 0)}마리 (예정)</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-2 font-bold">주간 계획표 기반 + 현장 추가</p>
                        </div>
                        
                        <div className="space-y-4">
                            {expectedTodayCustomers.map(c => {
                                const remaining = c.ticket?.remaining || 0;
                                const isLow = remaining < 3;
                                // Determine dogs: flatten if necessary, or use single
                                const dogs = c.dogs && c.dogs.length > 0 ? c.dogs : [c as any];

                                return (
                                    <div key={c.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                                        {/* Family Header */}
                                        <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-700 text-sm">{c.ownerName} 보호자님</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-bold ${isLow ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                                    <Ticket className="w-3 h-3"/> {remaining}회 잔여 (통합)
                                                </span>
                                            </div>
                                            {/* Edit Shortcut */}
                                            <button 
                                                onClick={() => setDetailCustomer(c)}
                                                className="text-gray-400 hover:text-indigo-600 p-1"
                                            >
                                                <Edit2 className="w-3.5 h-3.5"/>
                                            </button>
                                        </div>

                                        {/* Dogs List */}
                                        <div className="divide-y">
                                            {dogs.map((d: any) => {
                                                const dogId = d.id || c.id;
                                                const log = attendanceMap[dogId] as any;
                                                const isAttended = log?.status === 'present' || log?.status === 'home';
                                                
                                                return (
                                                    <div key={dogId} className={`p-4 flex justify-between items-center transition-colors ${isAttended ? 'bg-green-50/30' : 'bg-white'}`}>
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border ${isAttended ? 'border-green-200 bg-white' : 'border-gray-200 bg-gray-100'}`}>
                                                                {d.photoUrl ? (
                                                                    <img src={d.photoUrl} className="w-full h-full object-cover rounded-full"/>
                                                                ) : <Dog className="w-5 h-5 text-gray-400"/>}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-black text-gray-900 text-base">{d.dogName}</span>
                                                                    <div className="flex gap-1">
                                                                        {getStatusBadges(c, d)}
                                                                    </div>
                                                                </div>
                                                                {isAttended && log?.arrivalTime && (
                                                                    <span className="text-[10px] text-green-600 font-bold mt-0.5 block">
                                                                        {log.arrivalTime} 등원함
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Toggle Button */}
                                                        <button 
                                                            onClick={() => handleAttendanceToggle(c, d)}
                                                            className={`flex items-center px-4 py-2 rounded-xl border transition-all active:scale-95 ${
                                                                isAttended 
                                                                ? 'bg-green-500 border-green-600 text-white shadow-md' 
                                                                : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            {isAttended ? <Check className="w-5 h-5 mr-1"/> : <X className="w-5 h-5 mr-1"/>}
                                                            <span className="font-black text-sm">{isAttended ? '등원완료' : '미등원'}</span>
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {expectedTodayCustomers.length === 0 && (
                                <div className="text-center text-gray-400 py-10 font-bold bg-white rounded-2xl border border-dashed">
                                    오늘 등원 예정인 친구가 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
                        {/* Weekly Nav */}
                        <div className="p-4 border-b bg-gray-50 flex items-center justify-center gap-4">
                            <button onClick={() => moveWeek(-1)} className="p-2 hover:bg-white rounded-full transition"><ChevronLeft/></button>
                            <span className="font-black text-lg text-gray-800">
                                {weekDates[0]} ~ {weekDates[4]}
                            </span>
                            <button onClick={() => moveWeek(1)} className="p-2 hover:bg-white rounded-full transition"><ChevronRight/></button>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <table className="w-full text-sm text-center">
                                <thead className="bg-indigo-50 text-indigo-900 font-bold border-b border-indigo-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4 text-left min-w-[150px] bg-indigo-50">원생 정보</th>
                                        {weekDates.map(d => (
                                            <th key={d} className="p-4 min-w-[120px] bg-indigo-50">
                                                <div className="text-xs opacity-60 font-medium">{d.slice(5)}</div>
                                                <div className="text-lg">{['일','월','화','수','목','금','토'][new Date(d).getDay()]}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {activeStudents.map(c => {
                                        // Flatten dogs for rows? No, keep family row but split cells
                                        const dogs = c.dogs && c.dogs.length > 0 ? c.dogs : [c as any];
                                        
                                        return (
                                            <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-4 text-left align-top">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <div className="font-bold text-gray-500 text-xs mb-1">{c.ownerName}</div>
                                                            {dogs.map((d: any) => (
                                                                <div key={d.id || c.id} className="font-black text-gray-900 mb-1 flex items-center gap-1">
                                                                    {d.dogName}
                                                                    {/* Simple badge for Planner View */}
                                                                    {d.kindergarten?.classType && <span className="text-[8px] bg-gray-100 px-1 rounded text-gray-500 font-normal">{d.kindergarten.classType[0]}</span>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <button 
                                                            onClick={() => setDetailCustomer(c)}
                                                            className="text-gray-400 hover:text-indigo-600 p-1 rounded hover:bg-indigo-50"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5"/>
                                                        </button>
                                                    </div>
                                                </td>
                                                {weekDates.map(date => {
                                                    const dayName = ['일','월','화','수','목','금','토'][new Date(date).getDay()];
                                                    
                                                    return (
                                                        <td key={date} className="p-2 align-top">
                                                            <div className="flex flex-col gap-2">
                                                                {dogs.map((d: any) => {
                                                                    const dogId = d.id || c.id;
                                                                    const isAttendance = isDogPlanned(c, dogId, date, 'attendance');
                                                                    const isPickup = isDogPlanned(c, dogId, date, 'pickup');
                                                                    const isFixedDay = (d.kindergarten || c.kindergarten)?.fixedDays?.includes(dayName);

                                                                    return (
                                                                        <div key={dogId} className={`p-2 rounded-lg border text-left ${isFixedDay && !isAttendance ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                                                                            <div className="text-[10px] font-bold text-gray-700 mb-1.5 truncate">{d.dogName}</div>
                                                                            <div className="flex gap-1">
                                                                                <label className={`flex-1 flex items-center justify-center p-1 rounded cursor-pointer border ${isAttendance ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-300 border-gray-200 hover:border-indigo-200'}`} title="등원 예정">
                                                                                    <input 
                                                                                        type="checkbox" 
                                                                                        checked={isAttendance} 
                                                                                        onChange={() => togglePlan(c, dogId, date, 'attendance')}
                                                                                        className="hidden"
                                                                                    />
                                                                                    <span className="text-[9px] font-bold">출</span>
                                                                                </label>
                                                                                <label className={`flex-1 flex items-center justify-center p-1 rounded cursor-pointer border ${isPickup ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-300 border-gray-200 hover:border-green-200'}`} title="픽업 예정">
                                                                                    <input 
                                                                                        type="checkbox" 
                                                                                        checked={isPickup} 
                                                                                        onChange={() => togglePlan(c, dogId, date, 'pickup')}
                                                                                        className="hidden"
                                                                                    />
                                                                                    <Car className="w-3 h-3"/>
                                                                                </label>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AttendanceTab;
