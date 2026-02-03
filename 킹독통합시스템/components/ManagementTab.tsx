
import React, { useState, useMemo, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, Tag, DollarSign, Search, FolderOpen, Wallet, CheckSquare, Square, GripVertical, X, LayoutList } from 'lucide-react';
import { Product, ExpenseCategory } from '../types';
import { collection, addDoc, updateDoc, deleteDoc, doc, writeBatch, onSnapshot, setDoc } from 'firebase/firestore';
import { db, appId } from '../services/firebase';
import { formatCurrency } from '../utils/helpers';
import { ConfirmModal } from './Modals';

interface ManagementTabProps {
    mode: 'product' | 'expense';
    data: (Product | ExpenseCategory)[];
}

const ManagementTab = ({ mode, data }: ManagementTabProps) => {
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    
    // Category Order State
    const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
    const [draggedCategory, setDraggedCategory] = useState<string | null>(null);

    // Selection & Delete State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deleteConfig, setDeleteConfig] = useState<{ type: 'single' | 'batch', id?: string } | null>(null);

    // Item Drag & Drop State
    const [draggedItem, setDraggedItem] = useState<Product | ExpenseCategory | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Product | ExpenseCategory>>({
        category: '',
        name: '',
        ...(mode === 'product' ? { price: 0 } : {})
    });

    const collectionName = mode === 'product' ? 'products' : 'expense_categories';
    const settingsDocId = `${mode}_category_order`;
    const title = mode === 'product' ? '상품 관리' : '지출 항목 관리';
    const itemLabel = mode === 'product' ? '상품' : '지출 항목';

    // 1. Fetch Category Order from Firestore
    useEffect(() => {
        const docRef = doc(db, 'kingdog', appId, 'settings', settingsDocId);
        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                setCategoryOrder(snap.data().order || []);
            }
        });
        return () => unsubscribe();
    }, [mode, settingsDocId]);

    // 2. Derive Sorted Categories
    const categories = useMemo(() => {
        // Extract unique categories from actual data
        const uniqueCats = Array.from(new Set(data.map(item => item.category).filter(Boolean)));
        
        // Sort based on saved order
        const sorted = [...uniqueCats].sort((a, b) => {
            const idxA = categoryOrder.indexOf(a);
            const idxB = categoryOrder.indexOf(b);
            
            // If both are in the order list, sort by index
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            // If only A is in order list, A comes first
            if (idxA !== -1) return -1;
            // If only B is in order list, B comes first
            if (idxB !== -1) return 1;
            // If neither, sort alphabetically
            return a.localeCompare(b);
        });

        return sorted;
    }, [data, categoryOrder]);

    // 3. Filtered & Sorted Items
    const filteredData = useMemo(() => {
        let filtered = [...data];
        
        if (selectedCategory !== 'All') {
            filtered = filtered.filter(item => item.category === selectedCategory);
        }

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(item => 
                item.name.toLowerCase().includes(lower) || 
                item.category.toLowerCase().includes(lower)
            );
        }

        return filtered.sort((a, b) => {
            // 1. Sort by Category Order
            if (a.category !== b.category) {
                const idxA = categories.indexOf(a.category);
                const idxB = categories.indexOf(b.category);
                return idxA - idxB;
            }
            
            // 2. Sort by Item Order (within category)
            const orderA = a.order ?? 999999;
            const orderB = b.order ?? 999999;
            if (orderA !== orderB) return orderA - orderB;

            // 3. Fallback to Name
            return a.name.localeCompare(b.name);
        });
    }, [data, selectedCategory, searchTerm, categories]);

    // --- Category Drag & Drop ---
    const handleCategoryDragStart = (e: React.DragEvent, cat: string) => {
        setDraggedCategory(cat);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleCategoryDrop = async (e: React.DragEvent, targetCat: string) => {
        e.preventDefault();
        if (!draggedCategory || draggedCategory === targetCat) return;

        const currentOrder = [...categories];
        const oldIdx = currentOrder.indexOf(draggedCategory);
        const newIdx = currentOrder.indexOf(targetCat);

        if (oldIdx === -1 || newIdx === -1) return;

        // Reorder
        currentOrder.splice(oldIdx, 1);
        currentOrder.splice(newIdx, 0, draggedCategory);

        // Optimistic update
        setCategoryOrder(currentOrder);

        // Save to Firestore
        try {
            await setDoc(doc(db, 'kingdog', appId, 'settings', settingsDocId), { order: currentOrder });
        } catch (err) {
            console.error('Failed to save category order:', err);
            alert('카테고리 순서 저장 실패');
        }
        setDraggedCategory(null);
    };

    // --- Item Drag & Drop ---
    const handleDragStart = (e: React.DragEvent, item: Product | ExpenseCategory) => {
        if (searchTerm) {
            e.preventDefault();
            return;
        }
        setDraggedItem(item);
        e.dataTransfer.effectAllowed = "move";
        e.currentTarget.classList.add('opacity-50');
    };

    const handleDragEnd = (e: React.DragEvent) => {
        e.currentTarget.classList.remove('opacity-50');
        setDraggedItem(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e: React.DragEvent, targetItem: Product | ExpenseCategory) => {
        e.preventDefault();
        if (!draggedItem || draggedItem.id === targetItem.id) return;
        
        // Ensure same category
        if (draggedItem.category !== targetItem.category) {
            alert("같은 카테고리 내에서만 순서를 변경할 수 있습니다.");
            return;
        }

        // Filter items of the same category and sort them by current order
        const categoryItems = data
            .filter(d => d.category === draggedItem.category)
            .sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999) || a.name.localeCompare(b.name));

        const oldIndex = categoryItems.findIndex(i => i.id === draggedItem.id);
        const newIndex = categoryItems.findIndex(i => i.id === targetItem.id);

        if (oldIndex === -1 || newIndex === -1) return;

        const newOrderList = [...categoryItems];
        newOrderList.splice(oldIndex, 1);
        newOrderList.splice(newIndex, 0, draggedItem);

        const batch = writeBatch(db);
        newOrderList.forEach((item, idx) => {
            if (item.order !== idx) {
                batch.update(doc(db, 'kingdog', appId, collectionName, item.id), { order: idx });
            }
        });

        try {
            await batch.commit();
        } catch (e) {
            console.error("순서 변경 실패", e);
            alert("순서 저장 중 오류가 발생했습니다.");
        }
    };

    // Checkbox Handlers
    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredData.length && filteredData.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredData.map(d => d.id)));
        }
    };

    // CRUD Handlers
    const handleAdd = () => {
        setFormData({ 
            category: selectedCategory !== 'All' ? selectedCategory : '', 
            name: '', 
            ...(mode === 'product' ? { price: 0 } : {}) 
        });
        setShowModal(true);
    };

    const handleEdit = (item: Product | ExpenseCategory) => {
        setFormData({ ...item });
        setShowModal(true);
    };

    const confirmSingleDelete = (id: string) => {
        setDeleteConfig({ type: 'single', id });
    };

    const confirmBatchDelete = () => {
        setDeleteConfig({ type: 'batch' });
    };

    const executeDelete = async () => {
        if (!deleteConfig) return;

        try {
            if (deleteConfig.type === 'single' && deleteConfig.id) {
                await deleteDoc(doc(db, 'kingdog', appId, collectionName, deleteConfig.id));
                if (selectedIds.has(deleteConfig.id)) {
                    const newSet = new Set(selectedIds);
                    newSet.delete(deleteConfig.id);
                    setSelectedIds(newSet);
                }
            } else if (deleteConfig.type === 'batch') {
                const batch = writeBatch(db);
                selectedIds.forEach(id => {
                    batch.delete(doc(db, 'kingdog', appId, collectionName, id));
                });
                await batch.commit();
                setSelectedIds(new Set());
            }
        } catch (e) {
            console.error(e);
            alert('삭제 중 오류가 발생했습니다.');
        } finally {
            setDeleteConfig(null);
        }
    };

    const handleSave = async () => {
        if (!formData.category || !formData.name) return alert('분류와 상세 내역을 모두 입력해주세요.');
        
        try {
            const payload: any = {
                ...formData,
                ...(mode === 'product' ? { price: Number((formData as Product).price) || 0 } : {}),
                updatedAt: new Date().toISOString()
            };

            if (formData.id) {
                await updateDoc(doc(db, 'kingdog', appId, collectionName, formData.id), payload);
            } else {
                // Assign new item to end of its category
                const sameCategoryItems = data.filter(d => d.category === formData.category);
                const maxOrder = sameCategoryItems.reduce((max, item) => Math.max(max, item.order ?? 0), -1);
                
                await addDoc(collection(db, 'kingdog', appId, collectionName), {
                    ...payload,
                    order: maxOrder + 1,
                    createdAt: new Date().toISOString()
                });
            }
            setShowModal(false);
        } catch (e) {
            console.error(e);
            alert('저장 실패');
        }
    };

    const checkboxClass = "appearance-none w-5 h-5 border-2 border-gray-300 rounded bg-white checked:bg-indigo-600 checked:border-indigo-600 checked:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22white%22%20stroke-width%3D%224%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22M5%2013l4%204L19%207%22%2F%3E%3C%2Fsvg%3E')] cursor-pointer transition-colors";

    return (
        <div className="flex h-full bg-gray-50 overflow-hidden relative">
            
            <ConfirmModal 
                isOpen={!!deleteConfig} 
                message={deleteConfig?.type === 'single' ? `정말 이 ${itemLabel}을(를) 삭제하시겠습니까?` : `선택한 ${selectedIds.size}개의 항목을 모두 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.`} 
                onConfirm={executeDelete} 
                onCancel={() => setDeleteConfig(null)} 
            />

            {/* Left Sidebar: Categories (Draggable) */}
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm z-10">
                <div className="p-5 border-b border-gray-100">
                    <h2 className="text-lg font-black text-gray-800 flex items-center">
                        {mode === 'product' ? <Package className="w-5 h-5 mr-2 text-indigo-600"/> : <Wallet className="w-5 h-5 mr-2 text-red-600"/>}
                        {title}
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">드래그하여 카테고리 순서를 변경하세요.</p>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                    <button 
                        onClick={() => setSelectedCategory('All')}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between transition-all ${selectedCategory === 'All' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <span className="flex items-center"><LayoutList className="w-4 h-4 mr-2"/> 전체 보기</span>
                        <span className="text-xs bg-white px-2 py-0.5 rounded-full border shadow-sm">{data.length}</span>
                    </button>
                    {categories.map(cat => (
                        <div 
                            key={cat}
                            draggable
                            onDragStart={(e) => handleCategoryDragStart(e, cat)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleCategoryDrop(e, cat)}
                            onClick={() => setSelectedCategory(cat)}
                            className={`w-full px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between transition-all cursor-pointer group relative ${selectedCategory === cat ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <span className="flex items-center">
                                <GripVertical className="w-3 h-3 mr-2 text-gray-300 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"/>
                                {cat}
                            </span>
                            <span className="text-xs text-gray-400">{data.filter(d => d.category === cat).length}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Items */}
            <div className="flex-1 flex flex-col h-full bg-white relative">
                {/* Header Toolbar */}
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white z-20">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                            <input 
                                type="text" 
                                placeholder={`${itemLabel} 검색...`}
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none w-64 transition-all"
                            />
                        </div>
                        {selectedIds.size > 0 && (
                            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2">
                                <span className="text-sm font-bold text-indigo-600">{selectedIds.size}개 선택됨</span>
                                <button onClick={confirmBatchDelete} className="text-red-500 text-xs font-bold hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 transition">선택 삭제</button>
                            </div>
                        )}
                    </div>
                    <button onClick={handleAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2 transition transform active:scale-95">
                        <Plus className="w-4 h-4"/> {itemLabel} 등록
                    </button>
                </div>

                {/* Content Grid */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-gray-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                        {filteredData.map(item => (
                            <div 
                                key={item.id}
                                draggable={!searchTerm}
                                onDragStart={(e) => handleDragStart(e, item)}
                                onDragEnd={handleDragEnd}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, item)}
                                className={`bg-white p-4 rounded-xl border transition-all relative group hover:shadow-md ${selectedIds.has(item.id) ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/10' : 'border-gray-200 hover:border-indigo-300'}`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedIds.has(item.id)} 
                                            onChange={() => toggleSelect(item.id)}
                                            className={checkboxClass}
                                        />
                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md truncate max-w-[100px]">{item.category}</span>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEdit(item)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Edit className="w-3.5 h-3.5"/></button>
                                        <button onClick={() => confirmSingleDelete(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5"/></button>
                                        {!searchTerm && <div className="p-1.5 cursor-grab text-gray-300 hover:text-gray-600"><GripVertical className="w-3.5 h-3.5"/></div>}
                                    </div>
                                </div>
                                
                                <h3 className="font-bold text-gray-800 text-lg mb-1 truncate">{item.name}</h3>
                                {mode === 'product' && (
                                    <div className="text-right mt-2 font-black text-indigo-600 text-lg">
                                        {formatCurrency((item as Product).price)}원
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    {filteredData.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <FolderOpen className="w-16 h-16 mb-4 opacity-20"/>
                            <p className="font-bold text-lg">데이터가 없습니다.</p>
                            <p className="text-sm">새로운 {itemLabel}을 등록해보세요.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 overflow-hidden">
                        <div className="bg-indigo-600 p-4 flex justify-between items-center text-white">
                            <h3 className="font-black text-lg">{formData.id ? `${itemLabel} 수정` : `새 ${itemLabel} 등록`}</h3>
                            <button onClick={() => setShowModal(false)}><X className="w-5 h-5 opacity-80 hover:opacity-100"/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">분류 (카테고리)</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        list="category-options" 
                                        value={formData.category} 
                                        onChange={e => setFormData({...formData, category: e.target.value})} 
                                        className="w-full border p-3 rounded-xl text-sm font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-indigo-500"
                                        placeholder="직접 입력하거나 선택"
                                    />
                                    <datalist id="category-options">
                                        {categories.map(c => <option key={c} value={c}/>)}
                                    </datalist>
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">상세 내역 (이름)</label>
                                <input 
                                    type="text" 
                                    value={formData.name} 
                                    onChange={e => setFormData({...formData, name: e.target.value})} 
                                    className="w-full border p-3 rounded-xl text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder={`예: ${mode==='product' ? '호텔 1박' : '간식비'}`}
                                />
                            </div>

                            {mode === 'product' && (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">단가 (원)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                                        <input 
                                            type="number" 
                                            value={(formData as Product).price} 
                                            onChange={e => setFormData({...formData, price: parseInt(e.target.value) || 0})} 
                                            className="w-full border p-3 pl-9 rounded-xl text-sm font-black bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            )}

                            <button 
                                onClick={handleSave} 
                                className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-black text-lg shadow-lg hover:bg-indigo-700 transition transform active:scale-95 flex items-center justify-center gap-2 mt-4"
                            >
                                <CheckSquare className="w-5 h-5"/> 저장하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagementTab;
