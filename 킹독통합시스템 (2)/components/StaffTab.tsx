import React, { useState, useMemo } from 'react';
import { UserCog, Plus, Trash2, Edit, Award, Briefcase, ChevronDown } from 'lucide-react';
import { Staff, Task } from '../types';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, appId } from '../services/firebase';
import { getNowDate } from '../utils/helpers';

interface StaffTabProps {
    staff: Staff[];
    tasks: Task[];
}

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1'];

const StaffTab = ({ staff, tasks }: StaffTabProps) => {
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState<Partial<Staff>>({
        name: '', role: '직원', color: COLORS[0], phone: '', isActive: true
    });
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);

    const handleSave = async () => {
        if (!formData.name) return alert('이름을 입력해주세요.');
        try {
            if (formData.id) {
                await updateDoc(doc(db, 'kingdog', appId, 'staff', formData.id), formData);
            } else {
                await addDoc(collection(db, 'kingdog', appId, 'staff'), {
                    ...formData,
                    joinedAt: getNowDate(),
                    isActive: true
                });
            }
            setShowModal(false);
            setFormData({ name: '', role: '직원', color: COLORS[0], phone: '', isActive: true });
        } catch (e) {
            alert('저장 실패');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        await deleteDoc(doc(db, 'kingdog', appId, 'staff', id));
        setSelectedStaff(null);
    };

    // Performance Analytics
    const performance = useMemo(() => {
        if (!selectedStaff) return null;
        
        // This month
        const now = new Date();
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        
        const myTasks = tasks.filter(t => t.assignee === selectedStaff.name && t.dueDate.startsWith(thisMonth));
        
        const completed = myTasks.filter(t => t.status === 'done').length;
        const total = myTasks.length;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        const delegatedToMe = tasks.filter(t => 
            t.assignee === selectedStaff.name && 
            t.history?.some(h => h.action === 'delegate' && h.note?.includes(selectedStaff.name))
        ).length;

        const delegatedByMe = tasks.filter(t => 
             t.history?.some(h => h.action === 'delegate' && h.by === selectedStaff.name)
        ).length;

        return { completed, total, rate, delegatedToMe, delegatedByMe };
    }, [selectedStaff, tasks]);

    return (
        <div className="h-full bg-gray-50 flex p-6 gap-6">
            {/* Left: List */}
            <div className="w-1/3 bg-white rounded-2xl shadow-sm border flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-lg font-black text-gray-800 flex items-center">
                        <UserCog className="mr-2 w-5 h-5 text-indigo-600"/> 직원 목록
                    </h2>
                    <button onClick={() => { setFormData({}); setSelectedStaff(null); setShowModal(true); }} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700">
                        <Plus className="w-4 h-4"/>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {staff.map(s => (
                        <div 
                            key={s.id} 
                            onClick={() => setSelectedStaff(s)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${selectedStaff?.id === s.id ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white border-gray-100 hover:border-indigo-200'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm" style={{ backgroundColor: s.color }}>
                                    {s.name[0]}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-800">{s.name}</div>
                                    <div className="text-xs text-gray-500">{s.role}</div>
                                </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setFormData(s); setShowModal(true); }} className="p-2 text-gray-400 hover:text-indigo-600">
                                <Edit className="w-4 h-4"/>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Details & Stats */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border p-6 flex flex-col justify-center items-center text-center">
                {selectedStaff ? (
                    <div className="w-full max-w-lg">
                        <div className="w-24 h-24 rounded-full mx-auto flex items-center justify-center text-4xl font-black text-white shadow-lg mb-4" style={{ backgroundColor: selectedStaff.color }}>
                            {selectedStaff.name[0]}
                        </div>
                        <h2 className="text-2xl font-black text-gray-900">{selectedStaff.name}</h2>
                        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold mt-2 inline-block">{selectedStaff.role}</span>
                        
                        <div className="mt-8 grid grid-cols-2 gap-4">
                            <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                                <div className="text-green-600 font-black text-3xl">{performance?.rate}%</div>
                                <div className="text-xs font-bold text-green-700 mt-1">이번 달 업무 달성률</div>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                <div className="text-blue-600 font-black text-3xl">{performance?.completed}건</div>
                                <div className="text-xs font-bold text-blue-700 mt-1">완료한 업무</div>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                                <div className="text-purple-600 font-black text-3xl">{performance?.delegatedToMe}건</div>
                                <div className="text-xs font-bold text-purple-700 mt-1">이관 받은 업무</div>
                            </div>
                            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                                <div className="text-orange-600 font-black text-3xl">{performance?.delegatedByMe}건</div>
                                <div className="text-xs font-bold text-orange-700 mt-1">이관 보낸 업무</div>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t">
                            <button onClick={() => handleDelete(selectedStaff.id)} className="text-red-500 text-sm font-bold flex items-center justify-center hover:bg-red-50 py-2 px-4 rounded-lg transition mx-auto">
                                <Trash2 className="w-4 h-4 mr-2"/> 직원 삭제
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-gray-400">
                        <UserCog className="w-16 h-16 mx-auto mb-4 opacity-20"/>
                        <p>직원을 선택하여 상세 정보를 확인하세요.</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
                    <div className="bg-white p-6 rounded-2xl w-96 shadow-2xl">
                        <h3 className="font-bold text-lg mb-4">{formData.id ? '직원 수정' : '직원 등록'}</h3>
                        <div className="space-y-3">
                            <input type="text" placeholder="이름" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border p-2 rounded"/>
                            <input type="text" placeholder="직급 (예: 원장, 실장)" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full border p-2 rounded"/>
                            <input type="text" placeholder="연락처" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border p-2 rounded"/>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">색상 선택</label>
                                <div className="flex gap-2">
                                    {COLORS.map(c => (
                                        <button key={c} onClick={() => setFormData({...formData, color: c})} className={`w-6 h-6 rounded-full ${formData.color === c ? 'ring-2 ring-offset-2 ring-black' : ''}`} style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-2 bg-gray-100 rounded font-bold">취소</button>
                            <button onClick={handleSave} className="flex-1 py-2 bg-indigo-600 text-white rounded font-bold">저장</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffTab;