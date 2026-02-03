import React, { useState, useEffect } from 'react';
import { FileInput, AlertTriangle, Plus, Check, MessageSquare, Briefcase, Wallet, Trash2, Camera, X, Tag } from 'lucide-react';
import { Handover } from '../types';
import { getNowDate } from '../utils/helpers';
import { collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, appId, storage } from '../services/firebase';

const HandoverTab = ({ handovers }: { handovers: Handover[] }) => {
    // Default categories used for initialization
    const DEFAULT_CATEGORIES = [
        { id: 'health', label: '건강/컨디션', color: 'text-red-600', bg: 'bg-red-50' },
        { id: 'request', label: '보호자 요청', color: 'text-blue-600', bg: 'bg-blue-50' },
        { id: 'facility', label: '시설/비품', color: 'text-orange-600', bg: 'bg-orange-50' },
        { id: 'money', label: '금전/결제', color: 'text-green-600', bg: 'bg-green-50' },
    ];

    const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
    const [newCatName, setNewCatName] = useState('');
    const [showCatInput, setShowCatInput] = useState(false);

    // Form States
    const [activeCategory, setActiveCategory] = useState<string>('health');
    const [content, setContent] = useState('');
    const [uploading, setUploading] = useState(false);
    const [attachedPhotos, setAttachedPhotos] = useState<{url: string, comment: string}[]>([]);

    // Delete Confirmation State
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // --- Firestore Sync for Categories ---
    useEffect(() => {
        const settingsRef = doc(db, 'kingdog', appId, 'settings', 'handover_categories');
        const unsubscribe = onSnapshot(settingsRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.list && Array.isArray(data.list) && data.list.length > 0) {
                    setCategories(data.list);
                    // Ensure active category is valid
                    setActiveCategory(prev => {
                        const exists = data.list.find((c: any) => c.id === prev);
                        return exists ? prev : data.list[0].id;
                    });
                }
            } else {
                // Initialize if document doesn't exist
                setDoc(settingsRef, { list: DEFAULT_CATEGORIES });
            }
        });
        return () => unsubscribe();
    }, []);

    const handleAddCategory = async () => {
        if (!newCatName.trim()) return;
        const id = `custom_${Date.now()}`;
        const newCat = { id, label: newCatName, color: 'text-indigo-600', bg: 'bg-indigo-50' };
        const updatedList = [...categories, newCat];
        
        // Optimistic Update is not strictly needed as onSnapshot is fast, 
        // but updating DB is the source of truth.
        try {
            await setDoc(doc(db, 'kingdog', appId, 'settings', 'handover_categories'), { list: updatedList });
            setNewCatName('');
            setShowCatInput(false);
        } catch (e) {
            console.error("Error adding category: ", e);
            alert("카테고리 저장 실패");
        }
    };

    const confirmDeleteCategory = async () => {
        if (!deleteConfirmId) return;
        
        const updatedList = categories.filter(c => c.id !== deleteConfirmId);
        
        try {
            await setDoc(doc(db, 'kingdog', appId, 'settings', 'handover_categories'), { list: updatedList });
            
            // Handle active category switch
            if (activeCategory === deleteConfirmId) {
                if (updatedList.length > 0) {
                    setActiveCategory(updatedList[0].id);
                } else {
                    setActiveCategory(''); 
                }
            }
        } catch (e) {
            console.error("Error deleting category: ", e);
            alert("카테고리 삭제 실패");
        } finally {
            setDeleteConfirmId(null);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const storageRef = ref(storage, `handovers/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            setAttachedPhotos(prev => [...prev, { url, comment: '' }]);
        } catch (e) {
            alert('사진 업로드 실패');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async () => {
        if (!content.trim() && attachedPhotos.length === 0) return alert('내용을 입력하세요.');

        const selectedCat = categories.find(c => c.id === activeCategory);
        const categoryLabel = selectedCat ? selectedCat.label : activeCategory;

        try {
            await addDoc(collection(db, 'kingdog', appId, 'handovers'), {
                date: getNowDate(),
                createdAt: new Date().toISOString(),
                category: categoryLabel, // Save Label for readability in other components
                content,
                photos: attachedPhotos,
                isImportant: true,
                isChecked: false,
                author: '관리자'
            });
            setContent('');
            setAttachedPhotos([]);
            alert('등록되었습니다.');
        } catch (e) {
            console.error(e);
        }
    };

    const toggleCheck = async (h: Handover) => {
        await updateDoc(doc(db, 'kingdog', appId, 'handovers', h.id), {
            isChecked: !h.isChecked
        });
    };

    return (
        <div className="h-full bg-gray-50 flex flex-col p-6 overflow-hidden relative">
            {/* Internal Modal for Category Deletion - High Z-Index */}
            {deleteConfirmId && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">카테고리 삭제</h3>
                        <p className="text-sm text-gray-600 mb-6">
                            선택한 카테고리 태그를 삭제하시겠습니까?
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 py-2.5 rounded-lg border text-gray-600 font-bold hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button 
                                onClick={confirmDeleteCategory}
                                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700"
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-gray-800 flex items-center">
                    <FileInput className="mr-2 text-indigo-600"/> 인수인계 노트
                </h2>
                <div className="flex gap-2">
                    {showCatInput ? (
                        <div className="flex gap-1 animate-in fade-in">
                            <input 
                                type="text" 
                                value={newCatName} 
                                onChange={e => setNewCatName(e.target.value)} 
                                placeholder="카테고리명" 
                                className="border rounded px-2 py-1 text-xs"
                                onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                            />
                            <button onClick={handleAddCategory} className="bg-indigo-600 text-white px-2 rounded text-xs">추가</button>
                            <button onClick={() => setShowCatInput(false)} className="bg-gray-200 text-gray-600 px-2 rounded text-xs">취소</button>
                        </div>
                    ) : (
                        <button onClick={() => setShowCatInput(true)} className="bg-white border text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-50 flex items-center">
                            <Plus className="w-3 h-3 mr-1"/> 태그 추가
                        </button>
                    )}
                </div>
            </div>

            <div className="flex gap-6 h-full overflow-hidden">
                {/* Left: Input Form */}
                <div className="w-1/3 flex flex-col gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-2 block">카테고리 선택</label>
                        <div className="flex flex-wrap gap-2">
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1 relative ${activeCategory === cat.id ? `${cat.bg} ${cat.color} border-${cat.color.split('-')[1]}-200 pr-8` : 'bg-white text-gray-400 border-gray-200'}`}
                                >
                                    {cat.label}
                                    {/* Trigger Modal on Click - Only show delete for active category */}
                                    {activeCategory === cat.id && (
                                        <span 
                                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 rounded-full cursor-pointer"
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setDeleteConfirmId(cat.id);
                                            }} 
                                        >
                                            <Trash2 className="w-3 h-3 opacity-50 hover:opacity-100"/>
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col">
                        <textarea 
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            className="flex-1 w-full p-4 bg-gray-50 border-none rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-100 mb-4"
                            placeholder="인수인계 내용을 입력하세요..."
                        />
                        
                        {/* Photo Attachments */}
                        {attachedPhotos.length > 0 && (
                            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                                {attachedPhotos.map((p, i) => (
                                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border shrink-0">
                                        <img src={p.url} alt="att" className="w-full h-full object-cover"/>
                                        <button onClick={() => setAttachedPhotos(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0 right-0 bg-red-600 text-white p-0.5"><X className="w-3 h-3"/></button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-between items-center">
                            <label className="flex items-center gap-2 cursor-pointer text-gray-500 hover:text-indigo-600 transition">
                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                    <Camera className="w-4 h-4"/>
                                </div>
                                <span className="text-xs font-bold">{uploading ? '업로드 중...' : '사진 첨부'}</span>
                                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading}/>
                            </label>
                            <button 
                                onClick={handleSubmit}
                                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-md transition transform active:scale-95"
                            >
                                등록하기
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right: List */}
                <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 font-bold text-gray-700 text-sm">최근 인수인계 내역</div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                        {handovers.map(h => {
                            // Find category style by matching label if saved as label, or id if saved as id
                            // Fallback to label if no match
                            const cat = categories.find(c => c.id === h.category || c.label === h.category) || { label: h.category, color: 'text-gray-600', bg: 'bg-gray-100' };
                            return (
                                <div key={h.id} className={`p-4 rounded-xl border transition-all ${h.isChecked ? 'opacity-60 bg-gray-50' : 'bg-white shadow-sm border-gray-100'}`}>
                                    <div className="flex items-start gap-4">
                                        <button 
                                            onClick={() => toggleCheck(h)}
                                            className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition ${h.isChecked ? 'bg-gray-400 border-gray-400 text-white' : 'border-gray-300 hover:border-indigo-500'}`}
                                        >
                                            {h.isChecked && <Check className="w-3 h-3"/>}
                                        </button>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cat.bg} ${cat.color}`}>
                                                    {cat.label}
                                                </span>
                                                <span className="text-xs text-gray-400">{h.createdAt.slice(0, 10)} {h.createdAt.slice(11, 16)}</span>
                                            </div>
                                            <p className={`text-sm whitespace-pre-wrap ${h.isChecked ? 'line-through text-gray-400' : 'text-gray-800'}`}>{h.content}</p>
                                            
                                            {/* Photos Display */}
                                            {h.photos && h.photos.length > 0 && (
                                                <div className="flex gap-2 mt-3">
                                                    {h.photos.map((p, i) => (
                                                        <div key={i} className="w-20 h-20 rounded-lg overflow-hidden border">
                                                            <a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt="att" className="w-full h-full object-cover"/></a>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => deleteDoc(doc(db, 'kingdog', appId, 'handovers', h.id))}
                                            className="text-gray-300 hover:text-red-500"
                                        >
                                            <Trash2 className="w-4 h-4"/>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {handovers.length === 0 && (
                            <div className="text-center text-gray-400 py-20">등록된 인수인계 사항이 없습니다.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HandoverTab;