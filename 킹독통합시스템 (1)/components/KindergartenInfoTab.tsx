
import React, { useState, useMemo, useEffect } from 'react';
import { Users, Dog, Clock, Upload, X, Save, Check, AlertTriangle, Info, Heart, Camera, Filter, MapPin, Phone, ShieldAlert, Hash, Utensils, Footprints, Moon, Sun, Briefcase, HelpCircle, CalendarRange, Ticket, AlertCircle, Car, PauseCircle, Calendar, Link, UserPlus, Search, Plus, SplitSquareHorizontal, ToggleLeft, ToggleRight, Link2 } from 'lucide-react';
import { Transaction, Customer, Staff, TicketLog, Dog as DogType } from '../types';
import { normalizeDate, getNowDate, getCustomerKey, calculateAge, getLocalYMD } from '../utils/helpers';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, appId, storage } from '../services/firebase';
import { TicketInitModal, DataMatchingModal } from './Modals';
import { useKindergarten } from '../contexts/KindergartenContext';

interface KindergartenDetailModalProps {
    customer: Customer; // The main document
    initialDogId?: string; // Which dog to focus on open
    allCustomers: Customer[];
    onClose: () => void;
    onUpdate: (updated: Customer) => void;
    staff: Staff[];
}

// Helper to remove undefined values for Firestore
const sanitizeData = (data: any) => JSON.parse(JSON.stringify(data));

// --- 유치원생 수동 추가 모달 (기존 유지) ---
const AddStudentModal = ({ isOpen, onClose, customers }: { isOpen: boolean, onClose: () => void, customers: Customer[] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [classType, setClassType] = useState('종일반');

    if (!isOpen) return null;

    const filteredCustomers = customers.filter(c => 
        (c.dogName && c.dogName.includes(searchTerm)) || 
        (c.ownerName && c.ownerName.includes(searchTerm)) ||
        (c.phone && c.phone.includes(searchTerm))
    ).slice(0, 5);

    const handleRegister = async () => {
        if (!selectedCustomer) return alert('원생으로 등록할 강아지를 선택해주세요.');
        
        try {
            let updates: any = {};
            if (selectedCustomer.dogs && selectedCustomer.dogs.length > 0) {
                const updatedDogs = [...selectedCustomer.dogs];
                updatedDogs[0] = {
                    ...updatedDogs[0],
                    kindergarten: { ...(updatedDogs[0].kindergarten || {}), classType }
                };
                updates = { dogs: sanitizeData(updatedDogs) };
            } else {
                updates = {
                    kindergarten: {
                        ...(selectedCustomer.kindergarten || {}),
                        classType: classType
                    }
                };
            }
            await updateDoc(doc(db, 'kingdog', appId, 'customers', selectedCustomer.id), updates);
            alert(`${selectedCustomer.dogName}이(가) ${classType}으로 등록되었습니다.`);
            onClose();
        } catch (e) {
            console.error(e);
            alert('등록 실패');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4 backdrop-blur-sm animate-in zoom-in duration-200">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                    <h3 className="font-black text-lg flex items-center"><UserPlus className="mr-2 w-5 h-5"/> 유치원생 수동 등록</h3>
                    <button onClick={onClose}><X className="w-5 h-5"/></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="relative">
                        <label className="text-xs font-bold text-gray-500 mb-1 block">고객 검색</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"/>
                            <input type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedCustomer(null); }} placeholder="이름 또는 연락처" className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
                        </div>
                        {searchTerm && !selectedCustomer && (
                            <div className="absolute top-full left-0 right-0 bg-white border shadow-lg rounded-xl mt-1 z-10 max-h-40 overflow-y-auto">
                                {filteredCustomers.map(c => (
                                    <div key={c.id} onClick={() => { setSelectedCustomer(c); setSearchTerm(`${c.dogName} (${c.ownerName})`); }} className="p-3 hover:bg-indigo-50 cursor-pointer border-b last:border-0 text-sm">
                                        <span className="font-bold text-indigo-900">{c.dogName}</span> <span className="text-gray-500">({c.ownerName})</span>
                                    </div>
                                ))}
                                {filteredCustomers.length === 0 && <div className="p-3 text-center text-gray-400 text-xs">검색 결과 없음</div>}
                            </div>
                        )}
                    </div>
                    {selectedCustomer && (
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold">{selectedCustomer.dogName[0]}</div>
                            <div>
                                <div className="font-black text-gray-800">{selectedCustomer.dogName}</div>
                                <div className="text-xs text-gray-500">{selectedCustomer.breed} · {selectedCustomer.ownerName}</div>
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">등원 반 선택</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['종일반', '주간반', '야간반', '미분류'].map(type => (
                                <button key={type} onClick={() => setClassType(type)} className={`py-2 rounded-lg text-sm font-bold border transition-all ${classType === type ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{type}</button>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleRegister} disabled={!selectedCustomer} className={`w-full py-3 rounded-xl font-black text-white shadow-lg transition-all ${selectedCustomer ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95' : 'bg-gray-300 cursor-not-allowed'}`}>등록하기</button>
                </div>
            </div>
        </div>
    );
};

// --- KindergartenDetailModal (Refactored logic kept) ---
export const KindergartenDetailModal = ({ customer, initialDogId, allCustomers, onClose, onUpdate, staff }: KindergartenDetailModalProps) => {
    // ... (Modal Content remains same - no changes needed for this part as it works fine) ...
    // Note: Reusing the existing code logic for modal internal management
    const [activeDogIndex, setActiveDogIndex] = useState(() => {
        if (customer.dogs && initialDogId) {
            const idx = customer.dogs.findIndex(d => d.id === initialDogId);
            return idx >= 0 ? idx : 0;
        }
        return 0;
    });

    const hasDogs = customer.dogs && customer.dogs.length > 0;
    const currentDog = hasDogs ? customer.dogs![activeDogIndex] : customer; 

    const [activeTab, setActiveTab] = useState<'info' | 'kindergarten'>('kindergarten');
    const [showTicketModal, setShowTicketModal] = useState(false);
    
    const [isMigrating, setIsMigrating] = useState(false);
    const [migName1, setMigName1] = useState(customer.dogName || '');
    const [migName2, setMigName2] = useState('');

    const [form, setForm] = useState<any>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isToothbrushUploading, setIsToothbrushUploading] = useState(false);

    useEffect(() => {
        const base = (hasDogs ? (currentDog as DogType).kindergarten : customer.kindergarten) || {};
        setForm({
            classType: '종일반', foodType: '개인사료', hasToothbrush: false, mealAmount: '', walkingNotes: '',
            isFlexible: false, isRecess: false, toothbrushPhotoUrl: '', 
            ...base,
            fixedDays: base.fixedDays || [],
            mealTimes: Array.isArray(base.mealTimes) ? base.mealTimes : ['', '', '']
        });
    }, [currentDog, hasDogs, customer]);

    const handleTicketInit = async (data: any) => {
        const { count, startDate, expiryDate, staffName, reason } = data;
        const newTicket = {
            total: count, remaining: count, startDate, expiryDate, lastUpdated: new Date().toISOString(),
            history: [{ id: Date.now().toString(), date: new Date().toISOString(), type: 'init', amount: count, prevRemaining: 0, newRemaining: count, staffName, reason } as TicketLog]
        };
        try {
            await updateDoc(doc(db, 'kingdog', appId, 'customers', customer.id), { ticket: newTicket });
            onUpdate({ ...customer, ticket: newTicket });
            setShowTicketModal(false);
            alert("유치원 이용권이 시작되었습니다.");
        } catch (e) {
            console.error(e);
            alert("이용권 시작 실패");
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            let updatedCustomer = { ...customer };
            const cleanForm = sanitizeData(form); 

            if (hasDogs) {
                const newDogs = [...(customer.dogs || [])];
                newDogs[activeDogIndex] = { ...newDogs[activeDogIndex], kindergarten: cleanForm };
                updatedCustomer.dogs = newDogs;
                await updateDoc(doc(db, 'kingdog', appId, 'customers', customer.id), { dogs: sanitizeData(newDogs) });
            } else {
                updatedCustomer.kindergarten = cleanForm;
                await updateDoc(doc(db, 'kingdog', appId, 'customers', customer.id), { kindergarten: cleanForm });
            }
            onUpdate(updatedCustomer);
            alert('저장되었습니다.');
        } catch (e: any) {
            console.error(e);
            alert(`저장 실패: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleMigration = async () => {
        if (!migName1 || !migName2) return alert("이름을 입력해주세요.");
        try {
            const dog1: DogType = {
                id: Date.now().toString(), 
                dogName: migName1, 
                breed: customer.breed || '', 
                birthDate: customer.birthDate || '',
                gender: customer.gender || '수컷', 
                isNeutered: customer.isNeutered || false, 
                weight: customer.weight || '', 
                photoUrl: customer.photoUrl || '',
                kindergarten: customer.kindergarten || {}, 
                vaccinations: customer.vaccinations || {}, 
                allergies: customer.allergies || ''
            };
            const dog2: DogType = { 
                id: (Date.now() + 1).toString(), 
                dogName: migName2, 
                kindergarten: { classType: '미분류' } 
            };
            
            const newDogs = sanitizeData([dog1, dog2]);
            
            await updateDoc(doc(db, 'kingdog', appId, 'customers', customer.id), { dogs: newDogs });
            const updated = { ...customer, dogs: newDogs };
            onUpdate(updated);
            setIsMigrating(false);
            alert("가족 추가(분리)가 완료되었습니다.");
        } catch(e) {
            console.error(e);
            alert("처리 실패");
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const path = hasDogs ? `dogs/${customer.id}/${currentDog.id}_${Date.now()}` : `dogs/${customer.id}/${Date.now()}`;
            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(storageRef);
            if (hasDogs) {
                const newDogs = [...customer.dogs!];
                newDogs[activeDogIndex].photoUrl = downloadUrl;
                await updateDoc(doc(db, 'kingdog', appId, 'customers', customer.id), { dogs: sanitizeData(newDogs) });
                onUpdate({ ...customer, dogs: newDogs });
            } else {
                await updateDoc(doc(db, 'kingdog', appId, 'customers', customer.id), { photoUrl: downloadUrl });
                onUpdate({ ...customer, photoUrl: downloadUrl });
            }
        } catch (error: any) {
            console.error(error);
            alert('사진 업로드 실패');
        } finally {
            setIsUploading(false);
        }
    };

    const handleToothbrushUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsToothbrushUploading(true);
        try {
            const path = `dogs/${customer.id}/${hasDogs ? currentDog.id + '_' : ''}toothbrush_${Date.now()}`;
            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(storageRef);
            const newForm = { ...form, toothbrushPhotoUrl: downloadUrl };
            setForm(newForm);
            if (hasDogs) {
                const newDogs = [...customer.dogs!];
                newDogs[activeDogIndex].kindergarten = newForm;
                await updateDoc(doc(db, 'kingdog', appId, 'customers', customer.id), { dogs: sanitizeData(newDogs) });
                onUpdate({ ...customer, dogs: newDogs });
            } else {
                await updateDoc(doc(db, 'kingdog', appId, 'customers', customer.id), { kindergarten: newForm });
                onUpdate({ ...customer, kindergarten: newForm });
            }
            alert('양치 도구 사진이 등록되었습니다.');
        } catch (error: any) {
            console.error(error);
            alert('업로드 실패');
        } finally {
            setIsToothbrushUploading(false);
        }
    };

    const toggleFixedDay = (day: string) => {
        const current = form.fixedDays || [];
        const updated = current.includes(day) ? current.filter((d: string) => d !== day) : [...current, day];
        setForm({ ...form, fixedDays: updated });
    };

    const InfoRow = ({ label, value, full = false, icon }: { label: string, value: any, full?: boolean, icon?: any }) => (
        <div className={`flex flex-col ${full ? 'col-span-2' : ''}`}>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center">{icon && <span className="mr-1">{icon}</span>}{label}</span>
            <span className={`text-sm font-bold ${!value ? 'text-gray-300' : 'text-gray-800'}`}>{value || '-'}</span>
        </div>
    );

    const SelectButton = ({ label, selected, onClick, icon }: { label: string, selected: boolean, onClick: () => void, icon?: any }) => (
        <button onClick={onClick} className={`flex-1 py-3 px-2 rounded-xl border-2 font-bold text-sm transition-all flex items-center justify-center gap-2 ${selected ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-100 bg-white text-gray-400 hover:bg-gray-50'}`}>{icon} {label}</button>
    );

    const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

    return (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm text-gray-900">
            <TicketInitModal isOpen={showTicketModal} onClose={() => setShowTicketModal(false)} onConfirm={handleTicketInit} staffList={staff} />
            <div className="bg-white w-full h-full md:h-[90vh] md:max-w-5xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden relative animate-in fade-in zoom-in duration-200">
                <div className="bg-indigo-50 border-b px-6 py-2 flex items-center gap-2 overflow-x-auto whitespace-nowrap shrink-0">
                    <span className="text-[10px] font-black text-indigo-400 uppercase mr-2 tracking-wider sticky left-0 bg-indigo-50 pr-2">FAMILY</span>
                    {hasDogs ? (
                        customer.dogs!.map((d, idx) => (
                            <button key={d.id || idx} onClick={() => { setIsMigrating(false); setActiveDogIndex(idx); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${!isMigrating && activeDogIndex === idx ? 'bg-white border-indigo-600 text-indigo-700 shadow-sm' : 'bg-indigo-100 border-transparent text-indigo-400 hover:bg-white'}`}>{d.dogName}</button>
                        ))
                    ) : (
                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white border border-indigo-600 text-indigo-700 shadow-sm">{customer.dogName} (Main)</button>
                    )}
                    <button onClick={() => setIsMigrating(true)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${isMigrating ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`}><Plus className="w-3 h-3"/> 가족 추가</button>
                </div>

                {isMigrating ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-10 bg-gray-50">
                        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full border border-indigo-100 animate-in zoom-in-95">
                            <h3 className="text-xl font-black text-indigo-900 mb-2 flex items-center"><SplitSquareHorizontal className="w-6 h-6 mr-2"/> 다견 가정 분리/추가</h3>
                            <p className="text-sm text-gray-500 mb-6">현재 <strong>{customer.dogName}</strong>님의 정보에 새로운 아이를 추가하거나 분리합니다.<br/>기존 정보의 주인을 선택하고, 새 아이의 이름을 입력해주세요.</p>
                            <div className="space-y-4">
                                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100"><label className="text-xs font-bold text-indigo-800 mb-1 block">기존 정보 주인 이름</label><input type="text" value={migName1} onChange={e=>setMigName1(e.target.value)} className="w-full border p-2 rounded-lg bg-white font-bold"/></div>
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200"><label className="text-xs font-bold text-gray-600 mb-1 block">새로 추가할 아이 이름</label><input type="text" value={migName2} onChange={e=>setMigName2(e.target.value)} className="w-full border p-2 rounded-lg bg-white font-bold" placeholder="이름 입력"/></div>
                                <div className="pt-4 flex gap-3"><button onClick={()=>setIsMigrating(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-500">취소</button><button onClick={handleMigration} className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700">분리 및 추가</button></div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="bg-white p-6 border-b flex justify-between items-start shrink-0 z-10 sticky top-0">
                            {/* ... (Existing Modal Header Content) ... */}
                            <div className="flex items-center gap-6">
                                <div className="relative group cursor-pointer shrink-0 hidden md:block">
                                    <div className="w-28 h-28 bg-gray-100 rounded-2xl flex items-center justify-center border-2 border-indigo-100 shadow-sm overflow-hidden relative">
                                        {currentDog.photoUrl ? <img src={currentDog.photoUrl} alt={currentDog.dogName} className="w-full h-full object-cover"/> : <Dog className="w-12 h-12 text-gray-300"/>}
                                        {isUploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"/></div>}
                                    </div>
                                    <div className="absolute bottom-0 right-0 translate-x-1 translate-y-1 bg-white p-1.5 rounded-full shadow-md border border-gray-200 z-10 group-hover:scale-110 transition-transform"><div className="bg-indigo-600 text-white p-1.5 rounded-full"><Camera className="w-3.5 h-3.5"/></div></div>
                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-20" accept="image/*" onChange={handlePhotoUpload} disabled={isUploading} title="사진을 클릭하여 변경하세요"/>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h2 className="text-2xl md:text-3xl font-black text-gray-900">{currentDog.dogName}</h2>
                                        <span className="text-base md:text-lg font-medium text-gray-400">| {currentDog.breed || '견종미상'}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        <span className="bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-600">{currentDog.birthDate ? `${calculateAge(currentDog.birthDate)} (${currentDog.birthDate})` : '나이 미상'}</span>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${currentDog.gender === '수컷' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>{currentDog.gender}</span>
                                    </div>
                                    <div className="flex items-center">
                                        {customer.ticket && customer.ticket.startDate ? (
                                            <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg"><Ticket className="w-4 h-4 text-purple-600"/><span className="text-[10px] font-bold text-purple-600">이용권:</span><span className="font-black text-sm text-purple-800">{customer.ticket.remaining}회 잔여</span></div>
                                        ) : (
                                            <button onClick={(e) => { e.stopPropagation(); setShowTicketModal(true); }} className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm"><Ticket className="w-3.5 h-3.5"/> 유치원 이용권 시작</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button onClick={onClose} className="bg-gray-100 text-gray-500 p-2.5 rounded-xl hover:bg-gray-200 transition"><X/></button>
                        </div>
                        {/* ... (Rest of Modal Body) ... */}
                        <div className="flex border-b bg-gray-50 px-6 gap-2">
                            <button onClick={() => setActiveTab('kindergarten')} className={`flex-1 md:flex-none py-3 px-6 font-black text-sm border-b-2 transition-colors flex items-center justify-center md:justify-start gap-2 ${activeTab === 'kindergarten' ? 'border-indigo-600 text-indigo-800 bg-white rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><Heart className="w-4 h-4"/> 유치원 관리</button>
                            <button onClick={() => setActiveTab('info')} className={`flex-1 md:flex-none py-3 px-6 font-bold text-sm border-b-2 transition-colors ${activeTab === 'info' ? 'border-indigo-600 text-indigo-800 bg-white rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>기본 정보</button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50 p-6">
                            {/* Content Logic (Same as before) */}
                            {activeTab === 'info' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 col-span-1 md:col-span-2">
                                        <h3 className="font-black text-gray-800 mb-4 text-lg flex items-center"><Users className="w-5 h-5 mr-2 text-indigo-500"/> 기본 및 보호자 정보</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-4">
                                            <InfoRow label="고객번호" value={customer.customerNumber} icon={<Hash className="w-3 h-3"/>} />
                                            <InfoRow label="동물등록번호" value={currentDog.regNumber} icon={<Hash className="w-3 h-3"/>} />
                                            <InfoRow label="몸무게" value={currentDog.weight ? `${currentDog.weight}kg` : ''} />
                                            <InfoRow label="비상연락망" value={customer.emergencyContact} icon={<ShieldAlert className="w-3 h-3 text-red-400"/>} />
                                            <InfoRow label="주소" value={customer.address} full icon={<MapPin className="w-3 h-3"/>} />
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                        <h3 className="font-black text-gray-800 mb-4 text-lg">🏥 건강 정보</h3>
                                        <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                                            <InfoRow label="심장사상충 예방일" value={currentDog.parasitePreventionDate} />
                                            <InfoRow label="주거래 병원" value={`${currentDog.vetName || ''} ${currentDog.vetPhone ? `(${currentDog.vetPhone})` : ''}`} />
                                            <InfoRow label="알레르기" value={currentDog.allergies} full />
                                            <InfoRow label="질병/복용약" value={currentDog.diseases} full />
                                            <InfoRow label="수술 이력" value={currentDog.surgeryHistory} full />
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                        <h3 className="font-black text-gray-800 mb-4 text-lg">🧠 성향 및 행동</h3>
                                        <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                                            <InfoRow label="입질 이력" value={currentDog.biteHistory ? '있음 (주의)' : '없음'} />
                                            <InfoRow label="분리불안" value={currentDog.separationAnxiety ? '있음' : '없음'} />
                                            <InfoRow label="다른 개 반응" value={currentDog.dogReaction} full/>
                                            <InfoRow label="사람 반응" value={currentDog.peopleReaction} full/>
                                            <InfoRow label="짖음" value={currentDog.barking} full/>
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 col-span-1 md:col-span-2">
                                        <h3 className="font-black text-gray-800 mb-4 text-lg">📝 통합 메모</h3>
                                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{currentDog.notes || '메모 없음'}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="mb-4 bg-blue-50 text-blue-700 p-3 rounded-xl text-xs font-bold flex items-center shrink-0"><Info className="w-4 h-4 mr-2"/> [{currentDog.dogName}] 아이의 고정적인 등원 규칙과 케어 정보를 등록하는 곳입니다.</div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                        {/* ... (Kindergarten Settings Form - Same as before) ... */}
                                        <div className="space-y-6">
                                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100">
                                                <h3 className="font-black text-indigo-900 flex items-center mb-4 pb-2 border-b"><CalendarRange className="w-5 h-5 mr-2"/> 등원 및 픽업 설정</h3>
                                                <div className="mb-6">
                                                    <label className="text-xs font-bold text-gray-500 mb-3 block">고정 등원 요일 (픽업 자동 생성)</label>
                                                    <div className="flex justify-between gap-1 bg-gray-50 p-2 rounded-xl">
                                                        {DAYS.map(day => (
                                                            <button key={day} onClick={() => toggleFixedDay(day)} disabled={form.isRecess} className={`w-10 h-10 rounded-lg text-sm font-black transition-all ${form.fixedDays?.includes(day) ? 'bg-indigo-600 text-white shadow-md transform scale-105' : 'bg-white text-gray-400 border border-gray-200 hover:bg-gray-100'} ${form.isRecess ? 'opacity-50 cursor-not-allowed' : ''}`}>{day}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-2 ${form.isFlexible ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50 opacity-80'}`} onClick={() => setForm({...form, isFlexible: !form.isFlexible})}>
                                                        <div className="flex justify-between items-center"><span className={`font-black ${form.isFlexible ? 'text-green-700' : 'text-gray-500'}`}>비정기 등원 (Flex)</span>{form.isFlexible && <Check className="w-5 h-5 text-green-600"/>}</div>
                                                    </div>
                                                    <div className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-2 ${form.isRecess ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-gray-50 opacity-80'}`} onClick={() => setForm({...form, isRecess: !form.isRecess})}>
                                                        <div className="flex justify-between items-center"><span className={`font-black ${form.isRecess ? 'text-orange-700' : 'text-gray-500'}`}>잠시 휴원 중</span>{form.isRecess && <PauseCircle className="w-5 h-5 text-orange-600"/>}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* ... Other settings forms (Class Type, Toothbrush, Meal, etc) ... */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100">
                                                    <h3 className="font-black text-indigo-900 flex items-center mb-4"><Heart className="w-5 h-5 mr-2"/> 등원 반 선택</h3>
                                                    <div className="flex gap-2 mb-6">
                                                        <SelectButton label="종일반" icon={<Sun className="w-4 h-4"/>} selected={form.classType === '종일반'} onClick={() => setForm({...form, classType: '종일반'})} />
                                                        <SelectButton label="주간반" icon={<Briefcase className="w-4 h-4"/>} selected={form.classType === '주간반'} onClick={() => setForm({...form, classType: '주간반'})} />
                                                        <SelectButton label="야간반" icon={<Moon className="w-4 h-4"/>} selected={form.classType === '야간반'} onClick={() => setForm({...form, classType: '야간반'})} />
                                                    </div>
                                                </div>
                                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <h3 className="font-black text-indigo-900 flex items-center"><Check className="w-5 h-5 mr-2"/> 양치 도구 관리</h3>
                                                        <div className="flex bg-gray-100 rounded-lg p-1">
                                                            <button onClick={() => setForm({...form, hasToothbrush: true})} className={`px-3 py-1 text-xs font-bold rounded-md transition ${form.hasToothbrush ? 'bg-indigo-600 text-white shadow' : 'text-gray-500'}`}>있음</button>
                                                            <button onClick={() => setForm({...form, hasToothbrush: false})} className={`px-3 py-1 text-xs font-bold rounded-md transition ${!form.hasToothbrush ? 'bg-gray-500 text-white shadow' : 'text-gray-500'}`}>없음</button>
                                                        </div>
                                                    </div>
                                                    {form.hasToothbrush && (
                                                        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-center gap-4">
                                                            <div className="relative group w-20 h-20 bg-white rounded-xl border flex items-center justify-center overflow-hidden shrink-0">
                                                                {form.toothbrushPhotoUrl ? <img src={form.toothbrushPhotoUrl} alt="양치도구" className="w-full h-full object-cover"/> : <Camera className="w-6 h-6 text-gray-300"/>}
                                                                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleToothbrushUpload} disabled={isToothbrushUploading}/>
                                                                {isToothbrushUploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"/></div>}
                                                            </div>
                                                            <div className="flex-1"><p className="text-xs font-bold text-gray-700 mb-1">칫솔 사진 등록</p><p className="text-[10px] text-gray-400">사진을 클릭하여 등록하세요.</p></div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100">
                                                <h3 className="font-black text-indigo-900 flex items-center mb-4"><Utensils className="w-5 h-5 mr-2"/> 사료 및 식사 정보</h3>
                                                <div className="flex flex-col md:flex-row gap-6">
                                                    <div className="flex-1">
                                                        <div className="flex gap-2 mb-4">
                                                            <SelectButton label="개인사료 지참" selected={form.foodType === '개인사료'} onClick={() => setForm({...form, foodType: '개인사료'})} />
                                                            <SelectButton label="공용사료 급여" selected={form.foodType === '공용사료'} onClick={() => setForm({...form, foodType: '공용사료'})} />
                                                        </div>
                                                        <div className="space-y-1"><label className="text-xs font-bold text-gray-500">급여량</label><input type="text" placeholder="예: 종이컵 반 컵, 50g" value={form.mealAmount || ''} onChange={e => setForm({...form, mealAmount: e.target.value})} className="w-full border p-3 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                                                    </div>
                                                    <div className="flex-1 bg-gray-50 p-4 rounded-xl">
                                                        <label className="text-xs font-bold text-gray-500 mb-2 block">식사 시간 (최대 3회)</label>
                                                        <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map(idx => (<div key={idx} className="space-y-1"><span className="text-[10px] font-bold text-gray-400 block text-center">{idx + 1}회차</span><input type="time" value={form.mealTimes?.[idx] || ''} onChange={e => { const newTimes = [...(form.mealTimes || ['', '', ''])]; newTimes[idx] = e.target.value; setForm({...form, mealTimes: newTimes}); }} className="w-full border p-2 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-center"/></div>))}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 flex flex-col">
                                                <h3 className="font-black text-indigo-900 flex items-center mb-4"><Footprints className="w-5 h-5 mr-2"/> 등원 특이사항</h3>
                                                <textarea value={form.walkingNotes || ''} onChange={e => setForm({...form, walkingNotes: e.target.value})} className="w-full h-60 border p-4 rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-500 resize-y leading-relaxed" placeholder="아이의 유치원 생활에 필요한 모든 특이사항을 자유롭게 기록해주세요."/>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex justify-end shrink-0 pt-4 border-t">
                                        <button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-black text-lg shadow-lg flex items-center gap-2 transition transform active:scale-95 w-full md:w-auto justify-center">{isSaving ? '저장 중...' : <><Save className="w-5 h-5"/> 유치원 기본 정보 저장하기</>}</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// --- Updated DogCard (Removed Family Link Logic) ---
const DogCard: React.FC<{ dog: Customer; onClick: () => void; allDogs: Customer[] }> = ({ dog, onClick }) => {
    const { attendanceMap, markAttendance } = useKindergarten();
    const today = getNowDate();
    
    const dogId = (dog as any).dogId || dog.id;

    const attendance = attendanceMap[dogId];
    const isAttended = attendance?.status === 'present' || attendance?.status === 'home';
    const isHome = attendance?.status === 'home';

    const ticket = dog.ticket; 
    const count = ticket?.remaining || 0;
    
    const isLow = count < 3 && count > 0;
    const isZero = count <= 0;
    
    const todayObj = new Date();
    const expiryDate = ticket?.expiryDate ? new Date(ticket.expiryDate) : null;
    const diffDays = expiryDate ? Math.ceil((expiryDate.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const isExpiringSoon = diffDays <= 7 && diffDays >= 0;
    const isExpired = diffDays < 0;

    let borderClass = 'border-l-4 border-gray-300';
    if (isLow) borderClass = 'border-l-4 border-red-500';
    if (isExpiringSoon) borderClass = 'border-l-4 border-orange-400';
    if (isExpired || isZero) borderClass = 'border-l-4 border-gray-400 opacity-60 grayscale';
    if (isAttended) borderClass = 'border-l-4 border-green-500 bg-green-50/30';

    const handleAttendanceClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const targetStatus = isAttended ? 'absent' : 'present';
        // Only mark this specific dog
        await markAttendance(dog, targetStatus);
    };

    return (
        <div 
            onClick={onClick}
            className={`bg-white rounded-xl shadow-sm border p-2 flex items-center gap-3 cursor-pointer hover:shadow-md transition-all active:scale-95 group relative ${borderClass}`}
        >
            <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0 overflow-hidden border border-gray-200 relative">
                {dog.photoUrl ? (
                    <img src={dog.photoUrl} alt={dog.dogName} className="w-full h-full object-cover"/>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300"><Dog className="w-5 h-5"/></div>
                )}
            </div>
            
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                    <span className="font-black text-sm text-gray-900 truncate">{dog.dogName}</span>
                    {ticket ? (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isLow ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                            {count}회
                        </span>
                    ) : (
                        <span className="text-[9px] font-bold bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">-</span>
                    )}
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-500 truncate">{dog.ownerName}</span>
                    {isExpiringSoon && !isZero && !isExpired && (
                        <AlertCircle className="w-3 h-3 text-orange-500" title={`유효기간 임박 (D-${diffDays})`}/>
                    )}
                </div>
            </div>

            {/* Quick Attendance Button */}
            <button
                onClick={handleAttendanceClick}
                className={`absolute -top-1 -right-1 p-1 rounded-full shadow-sm border ${isAttended ? 'bg-green-500 text-white border-green-600' : 'bg-white text-gray-300 border-gray-200 hover:text-green-500'}`}
                title={isAttended ? "등원 취소" : "등원 처리"}
            >
                <Check className="w-3 h-3"/>
            </button>
            {isHome && <div className="absolute top-0 right-0 bg-gray-800 text-white text-[8px] px-1 rounded-bl-lg font-bold">하원</div>}
        </div>
    );
};

// --- 메인 탭 컴포넌트 ---
const KindergartenInfoTab = ({ customers, transactions, staff = [] }: { customers: Customer[], transactions: Transaction[], staff?: Staff[] }) => {
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [selectedDogId, setSelectedDogId] = useState<string | undefined>(undefined);
    const [filterOption, setFilterOption] = useState<'recent' | 'six_month' | 'all'>('recent');
    const [showMatchingModal, setShowMatchingModal] = useState(false); 
    const [showAddStudentModal, setShowAddStudentModal] = useState(false);
    
    // Removed Family Link State

    // 1. 활성 유치원생 추출 및 플래트닝 로직
    const activeDogs = useMemo(() => {
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        sixMonthsAgo.setHours(0, 0, 0, 0); 

        let targetCustomers = customers;

        if (filterOption === 'recent') {
            targetCustomers = customers.filter(c => 
                (c.kindergarten?.classType && ['종일반', '주간반', '야간반'].includes(c.kindergarten.classType)) ||
                (c.dogs && c.dogs.some(d => d.kindergarten?.classType && ['종일반', '주간반', '야간반'].includes(d.kindergarten.classType)))
            );
        }

        const flatList: Customer[] = [];

        targetCustomers.forEach(c => {
            if (c.dogs && c.dogs.length > 0) {
                c.dogs.forEach(d => {
                    flatList.push({
                        ...c,
                        ...d, 
                        id: c.id, 
                        dogId: d.id, 
                        ticket: c.ticket 
                    } as any);
                });
            } else {
                flatList.push({ ...c, dogId: c.id } as any);
            }
        });

        return flatList;
    }, [transactions, customers, filterOption]);

    // 2. 그룹핑 로직
    const groupedDogs = useMemo(() => {
        const groups: Record<string, Customer[]> = {
            '종일반': [],
            '주간반': [],
            '야간반': [],
            '미분류': []
        };

        activeDogs.forEach(dog => {
            const type = dog.kindergarten?.classType;
            if (type === '종일반' || type === '주간반' || type === '야간반') {
                groups[type].push(dog);
            } else {
                groups['미분류'].push(dog);
            }
        });
        return groups;
    }, [activeDogs]);

    const handleUpdateCustomer = (updated: Customer) => {
        setSelectedCustomer(updated);
    };

    const DogGroupSection = ({ title, dogs, colorClass }: { title: string, dogs: Customer[], colorClass: string }) => {
        if (dogs.length === 0) return null;
        return (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <h3 className={`text-sm font-black mb-4 px-3 py-1.5 rounded-lg inline-block ${colorClass}`}>{title} ({dogs.length}마리)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3">
                    {dogs.map((dog, idx) => (
                        <DogCard 
                            key={`${dog.id}_${(dog as any).dogId || idx}`} 
                            dog={dog} 
                            onClick={() => {
                                const originalCustomer = customers.find(c => c.id === dog.id);
                                if (originalCustomer) {
                                    setSelectedCustomer(originalCustomer);
                                    setSelectedDogId((dog as any).dogId);
                                }
                            }} 
                            isFamilyLinkEnabled={false} // Always false now
                            allDogs={activeDogs}
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full bg-gray-50 flex flex-col">
            <DataMatchingModal 
                isOpen={showMatchingModal} 
                onClose={() => setShowMatchingModal(false)}
                transactions={transactions}
                customers={customers}
            />

            <AddStudentModal 
                isOpen={showAddStudentModal}
                onClose={() => setShowAddStudentModal(false)}
                customers={customers}
            />

            {selectedCustomer && (
                <KindergartenDetailModal 
                    customer={selectedCustomer} 
                    initialDogId={selectedDogId}
                    allCustomers={customers} 
                    onClose={() => { setSelectedCustomer(null); setSelectedDogId(undefined); }}
                    onUpdate={handleUpdateCustomer}
                    staff={staff}
                />
            )}

            <div className="p-6 border-b bg-white flex flex-col md:flex-row justify-between items-center shadow-sm gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 flex items-center">
                        <Users className="mr-3 text-indigo-600"/> 유치원생 관리
                    </h2>
                    <div className="flex items-center gap-2 mt-1 ml-9">
                        <p className="text-xs text-gray-500 font-bold">
                            총 {activeDogs.length}마리
                        </p>
                    </div>
                </div>
                
                {/* Family Link Toggle Removed */}

                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setShowAddStudentModal(true)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition"
                    >
                        <UserPlus className="w-3 h-3"/> 원생 추가
                    </button>

                    <button 
                        onClick={() => setShowMatchingModal(true)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-white text-indigo-600 shadow-sm border border-indigo-100 hover:bg-indigo-50 transition mr-2"
                    >
                        <Link2 className="w-3 h-3"/> 데이터 매칭
                    </button>

                    <button 
                        onClick={() => setFilterOption('recent')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${filterOption === 'recent' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        최근
                    </button>
                    <button 
                        onClick={() => setFilterOption('all')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${filterOption === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        전체
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {activeDogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                        <Dog className="w-16 h-16 mb-4 opacity-20"/>
                        <p className="font-bold">표시할 유치원생이 없습니다.</p>
                    </div>
                ) : (
                    <div className="space-y-8 pb-10">
                        <DogGroupSection title="🌞 종일반" dogs={groupedDogs['종일반']} colorClass="text-orange-600 bg-orange-50 border border-orange-100" />
                        <DogGroupSection title="⛅ 주간반" dogs={groupedDogs['주간반']} colorClass="text-blue-600 bg-blue-50 border border-blue-100" />
                        <DogGroupSection title="🌙 야간반" dogs={groupedDogs['야간반']} colorClass="text-purple-600 bg-purple-50 border border-purple-100" />
                        <DogGroupSection title="❔ 미분류 (반 정보 없음)" dogs={groupedDogs['미분류']} colorClass="text-gray-500 bg-gray-100 border border-gray-200" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default KindergartenInfoTab;
