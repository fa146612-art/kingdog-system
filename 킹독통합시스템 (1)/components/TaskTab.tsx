
import React, { useState, useEffect, useRef } from 'react';
import { CheckSquare, Plus, Trash2, Calendar, User, Flag, ArrowRight, Clock, ChevronDown, CheckCircle2, Undo, UserPlus, X, LayoutGrid, ListTodo, Star, Send, ListChecks, Settings2, GripVertical, ChevronRight, Save, Loader2 } from 'lucide-react';
import { Task, Staff, ChecklistSection, ChecklistItem } from '../types';
import { getNowDate, getLocalYMD } from '../utils/helpers';
import { updateDoc, doc, addDoc, collection, deleteDoc, onSnapshot, setDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db, appId } from '../services/firebase';

interface TaskTabProps {
    tasks: Task[];
    staff: Staff[];
    viewMode?: 'list' | 'matrix';
}

// ... (Existing TaskCard Component Code - Unchanged) ...
interface TaskCardProps {
    task: Task;
    colorClass: string;
    showEval?: boolean;
    actionMenuId: string | null;
    setActionMenuId: (id: string | null) => void;
    onToggleDone: (task: Task, status: boolean) => void;
    onDelegate: (task: Task) => void;
    onPostpone: (task: Task) => void;
    onDelete: (task: Task) => void;
    onEvaluate: (task: Task, grade: 'A'|'B'|'C'|'D') => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ 
    task, 
    colorClass, 
    showEval = false,
    actionMenuId,
    setActionMenuId,
    onToggleDone,
    onDelegate,
    onPostpone,
    onDelete,
    onEvaluate
}) => {
    const isCompleted = task.isDone;
    return (
        <div className={`bg-white p-3 rounded-xl border shadow-sm relative group hover:shadow-md transition-all ${isCompleted ? 'bg-gray-50 opacity-90 border-gray-200' : colorClass}`}>
            <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                    <div className={`font-bold text-sm ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                        {isCompleted && <span className="text-green-600 font-black mr-1">✓</span>}
                        {task.title}
                    </div>
                    {!isCompleted && task.content && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{task.content}</div>}
                </div>
                <div className="relative ml-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === task.id ? null : task.id); }}
                        className="w-6 h-6 rounded hover:bg-gray-100 flex items-center justify-center transition-colors"
                    >
                        <ChevronDown className="w-4 h-4 text-gray-400"/>
                    </button>
                    
                    {actionMenuId === task.id && (
                        <div 
                            className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 z-[100] w-36 overflow-hidden animate-in fade-in zoom-in-95"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {!isCompleted ? (
                                <>
                                    <button onClick={() => onToggleDone(task, true)} className="w-full text-left px-3 py-2.5 hover:bg-green-50 text-green-700 text-xs font-bold flex items-center"><CheckCircle2 className="w-3.5 h-3.5 mr-2"/> 완료</button>
                                    <button onClick={() => onDelegate(task)} className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center border-t border-gray-100"><UserPlus className="w-3.5 h-3.5 mr-2"/> 이관</button>
                                    <button onClick={() => onPostpone(task)} className="w-full text-left px-3 py-2.5 hover:bg-orange-50 text-orange-700 text-xs font-bold flex items-center border-t border-gray-100"><Clock className="w-3.5 h-3.5 mr-2"/> 연기</button>
                                </>
                            ) : (
                                <button onClick={() => onToggleDone(task, false)} className="w-full text-left px-3 py-2.5 hover:bg-blue-50 text-blue-700 text-xs font-bold flex items-center"><Undo className="w-3.5 h-3.5 mr-2"/> 복구</button>
                            )}
                            <button onClick={() => onDelete(task)} className="w-full text-left px-3 py-2.5 hover:bg-red-50 text-red-700 text-xs font-bold flex items-center border-t border-gray-100"><Trash2 className="w-3.5 h-3.5 mr-2"/> 삭제</button>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                <div className="flex gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center bg-gray-100 text-gray-500" title="담당자">
                        <User className="w-3 h-3 mr-1"/> {task.assignee}
                    </span>
                    {task.requester && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center bg-blue-50 text-blue-600 border border-blue-100" title="요청자">
                            <Send className="w-3 h-3 mr-1"/> {task.requester}
                        </span>
                    )}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center ${task.dueDate < getNowDate() && !isCompleted ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                        <Calendar className="w-3 h-3 mr-1"/> {task.dueDate}
                    </span>
                </div>
            </div>

            {/* Evaluation UI (Manager Only) */}
            {showEval && (
                <div className="mt-2 pt-2 border-t border-dashed flex items-center justify-start gap-3 bg-indigo-50/50 p-1.5 rounded-lg">
                    <span className="text-[10px] font-black text-indigo-800 shrink-0">업무 구분 (매니저용)</span>
                    <div className="flex gap-1">
                        {['A','B','C','D'].map((grade) => (
                            <button 
                                key={grade}
                                onClick={(e) => { e.stopPropagation(); onEvaluate(task, grade as any); }}
                                className={`w-6 h-6 rounded text-[10px] font-black transition-all ${task.evaluation === grade ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border text-gray-400 hover:bg-gray-50'}`}
                            >
                                {grade}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Routine Checklist Component ---
const RoutineChecklist = () => {
    const [sections, setSections] = useState<ChecklistSection[]>([]);
    const [dailyChecks, setDailyChecks] = useState<Record<string, boolean>>({});
    const [selectedDate, setSelectedDate] = useState(getNowDate());
    const [isEditMode, setIsEditMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    
    // Add Item Inputs
    const [newSectionTitle, setNewSectionTitle] = useState('');
    const [newTargetName, setNewTargetName] = useState<Record<string, string>>({}); // sectionId -> value
    const [newActionName, setNewActionName] = useState<Record<string, string>>({}); // sectionId -> value

    // 1. Fetch Template Structure
    useEffect(() => {
        setIsLoading(true);
        const q = collection(db, 'kingdog', appId, 'checklist_templates');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loaded = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChecklistSection));
            loaded.sort((a, b) => (a.order || 0) - (b.order || 0));
            setSections(loaded);
            setIsLoading(false);
        }, (error) => {
            console.error("Snapshot error:", error);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. Fetch Daily Checks
    useEffect(() => {
        const docRef = doc(db, 'kingdog', appId, 'checklist_logs', selectedDate);
        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                setDailyChecks(snap.data().checks || {});
            } else {
                setDailyChecks({});
            }
        });
        return () => unsubscribe();
    }, [selectedDate]);

    // Handlers
    const toggleCheck = async (sectionId: string, targetId: string, actionId: string) => {
        const key = `${sectionId}_${targetId}_${actionId}`;
        const newValue = !dailyChecks[key];
        
        // Optimistic update
        setDailyChecks(prev => ({ ...prev, [key]: newValue }));

        // Firestore Update
        try {
            const docRef = doc(db, 'kingdog', appId, 'checklist_logs', selectedDate);
            await setDoc(docRef, {
                checks: { [key]: newValue }
            }, { merge: true });
        } catch (e) {
            console.error("Check update failed", e);
        }
    };

    const addSection = async () => {
        if (!newSectionTitle.trim()) return;
        try {
            await addDoc(collection(db, 'kingdog', appId, 'checklist_templates'), {
                title: newSectionTitle,
                targets: [],
                actions: [],
                order: sections.length,
                createdAt: new Date().toISOString()
            });
            setNewSectionTitle('');
        } catch(e) { console.error(e); }
    };

    const deleteSection = async (id: string) => {
        if (!confirm('섹션과 모든 항목을 삭제하시겠습니까?')) return;
        await deleteDoc(doc(db, 'kingdog', appId, 'checklist_templates', id));
    };

    const addTarget = async (section: ChecklistSection) => {
        const name = newTargetName[section.id];
        if (!name?.trim()) return;
        const newItem: ChecklistItem = { id: `target_${Date.now()}`, label: name };
        
        await updateDoc(doc(db, 'kingdog', appId, 'checklist_templates', section.id), {
            targets: arrayUnion(newItem)
        });
        setNewTargetName(prev => ({ ...prev, [section.id]: '' }));
    };

    const deleteTarget = async (section: ChecklistSection, item: ChecklistItem) => {
        if (!confirm('삭제하시겠습니까?')) return;
        await updateDoc(doc(db, 'kingdog', appId, 'checklist_templates', section.id), {
            targets: arrayRemove(item)
        });
    };

    const addAction = async (section: ChecklistSection) => {
        const name = newActionName[section.id];
        if (!name?.trim()) return;
        const newItem: ChecklistItem = { id: `action_${Date.now()}`, label: name };
        
        await updateDoc(doc(db, 'kingdog', appId, 'checklist_templates', section.id), {
            actions: arrayUnion(newItem)
        });
        setNewActionName(prev => ({ ...prev, [section.id]: '' }));
    };

    const deleteAction = async (section: ChecklistSection, item: ChecklistItem) => {
        if (!confirm('삭제하시겠습니까?')) return;
        await updateDoc(doc(db, 'kingdog', appId, 'checklist_templates', section.id), {
            actions: arrayRemove(item)
        });
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-600"/>
                <p className="font-bold">체크리스트 로딩 중...</p>
            </div>
        );
    }

    return (
        <div className="h-full min-h-0 bg-gray-50 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="bg-white border-b p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={e => setSelectedDate(e.target.value)} 
                        className="bg-gray-100 border-none rounded-lg text-sm font-bold p-2 outline-none"
                    />
                    <div className="text-sm font-bold text-gray-500 hidden sm:block">
                        {selectedDate === getNowDate() ? '오늘의 체크리스트' : `${selectedDate} 기록`}
                    </div>
                </div>
                <button 
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isEditMode ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    <Settings2 className="w-4 h-4"/> {isEditMode ? '편집 완료' : '항목 편집'}
                </button>
            </div>

            {/* Sections Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                
                {sections?.map(section => (
                    <div key={section.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                        {/* Section Header */}
                        <div className="bg-indigo-50/50 p-4 border-b border-indigo-100 flex justify-between items-center">
                            <h3 className="font-black text-indigo-900 flex items-center text-lg">
                                <ListChecks className="w-5 h-5 mr-2 text-indigo-500"/> {section.title}
                            </h3>
                            {isEditMode && (
                                <button onClick={() => deleteSection(section.id)} className="text-red-400 hover:text-red-600 bg-white p-1.5 rounded shadow-sm border border-red-100 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4"/>
                                </button>
                            )}
                        </div>

                        {/* Matrix Table */}
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-sm text-left border-collapse min-w-[600px]">
                                <thead>
                                    <tr className="bg-gray-50 border-b">
                                        <th className="p-3 font-bold text-gray-500 min-w-[120px] sticky left-0 z-10 bg-gray-50 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                            대상 \ 업무
                                        </th>
                                        {(section.actions || []).map(action => (
                                            <th key={action.id} className="p-3 font-bold text-gray-700 text-center min-w-[80px] border-r last:border-0 relative group">
                                                {action.label}
                                                {isEditMode && (
                                                    <button 
                                                        onClick={() => deleteAction(section, action)}
                                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition shadow-sm z-20"
                                                    >
                                                        <X className="w-3 h-3"/>
                                                    </button>
                                                )}
                                            </th>
                                        ))}
                                        {isEditMode && (
                                            <th className="p-2 min-w-[100px]">
                                                <div className="flex gap-1">
                                                    <input 
                                                        type="text" 
                                                        value={newActionName[section.id] || ''}
                                                        onChange={e => setNewActionName({ ...newActionName, [section.id]: e.target.value })}
                                                        placeholder="업무 추가"
                                                        className="w-full text-xs border rounded p-1"
                                                        onKeyDown={e => e.key === 'Enter' && addAction(section)}
                                                    />
                                                    <button onClick={() => addAction(section)} className="bg-blue-500 text-white px-2 rounded text-xs">+</button>
                                                </div>
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(section.targets || []).map(target => (
                                        <tr key={target.id} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                                            <td className="p-3 font-bold text-gray-800 bg-white sticky left-0 z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] flex justify-between items-center group">
                                                <span className="truncate">{target.label}</span>
                                                {isEditMode && (
                                                    <button onClick={() => deleteTarget(section, target)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100">
                                                        <X className="w-3.5 h-3.5"/>
                                                    </button>
                                                )}
                                            </td>
                                            {(section.actions || []).map(action => {
                                                const key = `${section.id}_${target.id}_${action.id}`;
                                                const isChecked = dailyChecks[key] || false;
                                                return (
                                                    <td key={action.id} className="p-2 text-center border-r last:border-0">
                                                        <label className="inline-flex items-center justify-center cursor-pointer p-2 rounded-lg hover:bg-indigo-50/50 transition-colors w-full h-full min-h-[40px]">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={isChecked} 
                                                                onChange={() => toggleCheck(section.id, target.id, action.id)}
                                                                disabled={isEditMode}
                                                                className="appearance-none w-5 h-5 border-2 border-gray-300 rounded checked:bg-indigo-600 checked:border-indigo-600 checked:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22white%22%20stroke-width%3D%224%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22M5%2013l4%204L19%207%22%2F%3E%3C%2Fsvg%3E')] transition-all disabled:opacity-50"
                                                            />
                                                        </label>
                                                    </td>
                                                );
                                            })}
                                            {isEditMode && <td className="bg-gray-50/20"></td>}
                                        </tr>
                                    ))}
                                    {isEditMode && (
                                        <tr className="bg-gray-50/50">
                                            <td className="p-2 sticky left-0 z-10 bg-gray-50 border-r border-t shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                <div className="flex gap-1">
                                                    <input 
                                                        type="text" 
                                                        value={newTargetName[section.id] || ''}
                                                        onChange={e => setNewTargetName({ ...newTargetName, [section.id]: e.target.value })}
                                                        placeholder="대상 추가"
                                                        className="w-full text-xs border rounded p-1"
                                                        onKeyDown={e => e.key === 'Enter' && addTarget(section)}
                                                    />
                                                    <button onClick={() => addTarget(section)} className="bg-green-600 text-white px-2 rounded text-xs">+</button>
                                                </div>
                                            </td>
                                            <td colSpan={(section.actions?.length || 0) + 1} className="p-2 text-xs text-gray-400 text-center border-t">
                                                새로운 행 추가
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}

                {isEditMode && (
                    <div className="bg-white p-4 rounded-xl border border-dashed border-gray-300 flex items-center gap-2">
                        <input 
                            type="text" 
                            value={newSectionTitle} 
                            onChange={e => setNewSectionTitle(e.target.value)} 
                            placeholder="새로운 섹션 이름 (예: 청소 관리)" 
                            className="flex-1 border p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            onKeyDown={e => e.key === 'Enter' && addSection()}
                        />
                        <button onClick={addSection} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 whitespace-nowrap">
                            섹션 추가
                        </button>
                    </div>
                )}

                {sections.length === 0 && !isEditMode && (
                    <div className="text-center py-20 text-gray-400">
                        <ListChecks className="w-16 h-16 mx-auto mb-4 opacity-20"/>
                        <p className="font-bold">등록된 루틴 체크리스트가 없습니다.</p>
                        <p className="text-sm mt-2">상단의 [항목 편집]을 눌러 체크리스트를 만들어보세요.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Updated TaskTab Component ---
const TaskTab = ({ tasks, staff, viewMode }: TaskTabProps) => {
    // Tab State: 'general', 'matrix', 'routine'
    const [activeTab, setActiveTab] = useState<'general' | 'matrix' | 'routine'>(viewMode === 'matrix' ? 'matrix' : 'general');

    useEffect(() => {
        if (viewMode) {
            setActiveTab(viewMode === 'matrix' ? 'matrix' : 'general');
        }
    }, [viewMode]);

    // ... (Existing State & Logic for General/Matrix Tasks - Unchanged) ...
    // 6W1H Inputs
    const [title, setTitle] = useState(""); 
    const [requester, setRequester] = useState(""); 
    const [assignee, setAssignee] = useState("");   
    const [dueDate, setDueDate] = useState(getNowDate()); 
    const [content, setContent] = useState(""); 
    const [isImportant, setIsImportant] = useState(false); 
    const [isUrgent, setIsUrgent] = useState(false); 
    
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);

    // --- Modal States ---
    const [modalConfig, setModalConfig] = useState<{
        type: 'delete' | 'postpone' | 'delegate' | null;
        task: Task | null;
    }>({ type: null, task: null });
    
    // Temp states for modal inputs
    const [tempDate, setTempDate] = useState('');
    const [tempAssignee, setTempAssignee] = useState('');

    // Filtered lists
    const processTasks = (filterFn: (t: Task) => boolean) => {
        return tasks.filter(filterFn).sort((a, b) => {
            if (a.isDone && !b.isDone) return 1;
            if (!a.isDone && b.isDone) return -1;
            return a.dueDate.localeCompare(b.dueDate);
        });
    };
    
    // Data Logic
    const generalTasks = processTasks(t => t.type !== 'matrix'); // Default to general if undefined
    const matrixTasks = processTasks(t => t.type === 'matrix');

    const matrix = {
        do: matrixTasks.filter(t => !!t.importance && !!t.urgency), // Q1
        plan: matrixTasks.filter(t => !!t.importance && !t.urgency), // Q2
        delegate: matrixTasks.filter(t => !t.importance && !!t.urgency), // Q3
        eliminate: matrixTasks.filter(t => !t.importance && !t.urgency), // Q4
    };

    const addTask = async () => {
        if (!title.trim()) return alert("업무 제목을 입력해주세요.");
        try {
            await addDoc(collection(db, 'kingdog', appId, 'tasks'), {
                title,
                requester: requester || '관리자',
                assignee: assignee || '전체',
                dueDate,
                content,
                importance: isImportant,
                urgency: isUrgent,
                status: 'pending',
                priority: isImportant && isUrgent ? 'high' : 'medium',
                createdAt: new Date().toISOString(),
                isDone: false,
                type: activeTab === 'routine' ? 'general' : activeTab,
                history: [{ action: 'create', date: new Date().toISOString(), by: requester || '관리자' }]
            });
            setTitle(""); setContent("");
        } catch (e) {
            console.error(e);
        }
    };

    const openDeleteModal = (task: Task) => {
        setActionMenuId(null);
        setModalConfig({ type: 'delete', task });
    };

    const openPostponeModal = (task: Task) => {
        setActionMenuId(null);
        const d = new Date(task.dueDate);
        d.setDate(d.getDate() + 1);
        setTempDate(getLocalYMD(d));
        setModalConfig({ type: 'postpone', task });
    };

    const openDelegateModal = (task: Task) => {
        setActionMenuId(null);
        setTempAssignee(task.assignee); 
        setModalConfig({ type: 'delegate', task });
    };

    const closeModal = () => {
        setModalConfig({ type: null, task: null });
        setTempDate('');
        setTempAssignee('');
    };

    const executeDelete = async () => {
        if (!modalConfig.task) return;
        await deleteDoc(doc(db, 'kingdog', appId, 'tasks', modalConfig.task.id));
        closeModal();
    };

    const executePostpone = async () => {
        if (!modalConfig.task || !tempDate) return;
        const updateData: any = {
            dueDate: tempDate,
            history: [...(modalConfig.task.history || []), { action: 'postpone', date: new Date().toISOString(), by: '관리자', note: `연기: ${modalConfig.task.dueDate} -> ${tempDate}` }]
        };
        await updateDoc(doc(db, 'kingdog', appId, 'tasks', modalConfig.task.id), updateData);
        closeModal();
    };

    const executeDelegate = async () => {
        if (!modalConfig.task || !tempAssignee) return;
        const updateData: any = {
            assignee: tempAssignee,
            history: [...(modalConfig.task.history || []), { action: 'delegate', date: new Date().toISOString(), by: '관리자', note: `담당자 변경: ${modalConfig.task.assignee} -> ${tempAssignee}` }]
        };
        await updateDoc(doc(db, 'kingdog', appId, 'tasks', modalConfig.task.id), updateData);
        closeModal();
    };

    const handleToggleDone = async (task: Task, isDone: boolean) => {
        setActionMenuId(null);
        const updateData: any = {
            status: isDone ? 'done' : 'pending',
            isDone: isDone,
            history: [...(task.history || []), { action: isDone ? 'done' : 'undo', date: new Date().toISOString(), by: '관리자', note: isDone ? '완료 처리' : '완료 취소' }]
        };
        await updateDoc(doc(db, 'kingdog', appId, 'tasks', task.id), updateData);
    };

    const handleEvaluate = async (task: Task, grade: 'A'|'B'|'C'|'D') => {
        await updateDoc(doc(db, 'kingdog', appId, 'tasks', task.id), { evaluation: grade });
    };

    return (
        <div className="h-full bg-gray-50 flex flex-col overflow-hidden relative" onClick={() => setActionMenuId(null)}>
            
            {/* Modal Components - Unchanged */}
            {modalConfig.type && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                        {modalConfig.type === 'delete' && (
                            <div className="p-6 text-center">
                                <h3 className="text-lg font-black text-gray-900 mb-2">업무 삭제</h3>
                                <p className="text-sm text-gray-600 mb-6">"{modalConfig.task?.title}" 업무를 삭제하시겠습니까?</p>
                                <div className="flex gap-3">
                                    <button onClick={closeModal} className="flex-1 py-3 rounded-xl border font-bold text-gray-600">취소</button>
                                    <button onClick={executeDelete} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold">삭제</button>
                                </div>
                            </div>
                        )}
                        {modalConfig.type === 'postpone' && (
                            <div className="p-6">
                                <h3 className="text-lg font-black text-gray-900 mb-4">업무 연기</h3>
                                <input type="date" value={tempDate} onChange={e => setTempDate(e.target.value)} className="w-full border p-3 rounded-xl mb-4 bg-gray-50"/>
                                <button onClick={executePostpone} className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold">연기 확정</button>
                            </div>
                        )}
                        {modalConfig.type === 'delegate' && (
                            <div className="p-6">
                                <h3 className="text-lg font-black text-gray-900 mb-4">업무 이관</h3>
                                <select value={tempAssignee} onChange={e => setTempAssignee(e.target.value)} className="w-full border p-3 rounded-xl mb-4 bg-white">
                                    {staff.map(s => <option key={s.id} value={s.name}>{s.name} ({s.role})</option>)}
                                </select>
                                <button onClick={executeDelegate} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold">이관 확정</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tab Header (Added Routine Check) */}
            <div className="bg-white border-b px-6 py-2 flex items-center gap-4 shrink-0 overflow-x-auto whitespace-nowrap scrollbar-hide">
                <button 
                    onClick={() => setActiveTab('general')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'general' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    <ListTodo className="w-4 h-4"/> 일반 업무 (Daily)
                </button>
                <button 
                    onClick={() => setActiveTab('matrix')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'matrix' ? 'bg-indigo-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    <LayoutGrid className="w-4 h-4"/> 매니저 매트릭스
                </button>
                <button 
                    onClick={() => setActiveTab('routine')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'routine' ? 'bg-green-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    <ListChecks className="w-4 h-4"/> 루틴 체크
                </button>
            </div>

            {/* Render Content Based on Active Tab */}
            <div className="flex-1 overflow-hidden relative min-h-0">
                {activeTab === 'routine' ? (
                    <RoutineChecklist />
                ) : (
                    <div className="h-full flex flex-col overflow-hidden">
                        {/* Standard Task Input Form */}
                        <div className="bg-white border-b p-4 shrink-0 shadow-sm z-20">
                            <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-2 w-full">
                                    <input type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder="새로운 업무 입력..." className="col-span-2 border p-2.5 rounded-lg text-sm bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-indigo-500"/>
                                    {/* Requester Select */}
                                    <div className="relative">
                                        <label className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-bold text-indigo-500">요청자</label>
                                        <select value={requester} onChange={e=>setRequester(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm bg-white outline-none">
                                            <option value="">선택</option>
                                            {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    {/* Assignee Select */}
                                    <div className="relative">
                                        <label className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-bold text-gray-500">담당자</label>
                                        <select value={assignee} onChange={e=>setAssignee(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm bg-white outline-none">
                                            <option value="">전체</option>
                                            {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} className="border p-2.5 rounded-lg text-sm bg-white outline-none"/>
                                </div>
                                
                                <div className="flex gap-2 w-full lg:w-auto">
                                    {activeTab === 'matrix' && (
                                        <>
                                            <button onClick={()=>setIsImportant(!isImportant)} className={`px-3 py-2.5 rounded-lg text-xs font-bold border transition ${isImportant ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white text-gray-400'}`}>중요 🔥</button>
                                            <button onClick={()=>setIsUrgent(!isUrgent)} className={`px-3 py-2.5 rounded-lg text-xs font-bold border transition ${isUrgent ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-white text-gray-400'}`}>긴급 ⚡</button>
                                        </>
                                    )}
                                    <button onClick={addTask} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black shadow-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 whitespace-nowrap">
                                        <Plus className="w-4 h-4"/> 등록
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Task Lists Content */}
                        <div className="flex-1 overflow-hidden bg-gray-50">
                            {activeTab === 'general' ? (
                                <div className="h-full overflow-y-auto p-4 custom-scrollbar">
                                    <div className="space-y-3 max-w-4xl mx-auto">
                                        {generalTasks.length === 0 && <div className="text-center text-gray-400 py-10">등록된 업무가 없습니다.</div>}
                                        {generalTasks.map(t => (
                                            <TaskCard 
                                                key={t.id} 
                                                task={t} 
                                                colorClass="border-gray-200" 
                                                showEval={true}
                                                actionMenuId={actionMenuId}
                                                setActionMenuId={setActionMenuId}
                                                onToggleDone={handleToggleDone}
                                                onDelegate={openDelegateModal}
                                                onPostpone={openPostponeModal}
                                                onDelete={openDeleteModal}
                                                onEvaluate={handleEvaluate}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full p-4 grid grid-cols-2 grid-rows-2 gap-4">
                                    <div className="bg-red-50/30 border-2 border-red-100 rounded-2xl p-4 flex flex-col relative">
                                        <div className="absolute top-0 left-0 bg-red-100 text-red-700 px-3 py-1 rounded-br-xl text-xs font-black z-10">Do (즉시 실행)</div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar mt-6 space-y-3 p-1">
                                            {matrix.do.map(t => (
                                                <TaskCard 
                                                    key={t.id} 
                                                    task={t} 
                                                    colorClass="border-red-200" 
                                                    actionMenuId={actionMenuId}
                                                    setActionMenuId={setActionMenuId}
                                                    onToggleDone={handleToggleDone}
                                                    onDelegate={openDelegateModal}
                                                    onPostpone={openPostponeModal}
                                                    onDelete={openDeleteModal}
                                                    onEvaluate={handleEvaluate}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-blue-50/30 border-2 border-blue-100 rounded-2xl p-4 flex flex-col relative">
                                        <div className="absolute top-0 left-0 bg-blue-100 text-blue-700 px-3 py-1 rounded-br-xl text-xs font-black z-10">Plan (계획)</div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar mt-6 space-y-3 p-1">
                                            {matrix.plan.map(t => (
                                                <TaskCard 
                                                    key={t.id} 
                                                    task={t} 
                                                    colorClass="border-blue-200" 
                                                    actionMenuId={actionMenuId}
                                                    setActionMenuId={setActionMenuId}
                                                    onToggleDone={handleToggleDone}
                                                    onDelegate={openDelegateModal}
                                                    onPostpone={openPostponeModal}
                                                    onDelete={openDeleteModal}
                                                    onEvaluate={handleEvaluate}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-orange-50/30 border-2 border-orange-100 rounded-2xl p-4 flex flex-col relative">
                                        <div className="absolute top-0 left-0 bg-orange-100 text-orange-700 px-3 py-1 rounded-br-xl text-xs font-black z-10">Delegate (위임)</div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar mt-6 space-y-3 p-1">
                                            {matrix.delegate.map(t => (
                                                <TaskCard 
                                                    key={t.id} 
                                                    task={t} 
                                                    colorClass="border-orange-200" 
                                                    actionMenuId={actionMenuId}
                                                    setActionMenuId={setActionMenuId}
                                                    onToggleDone={handleToggleDone}
                                                    onDelegate={openDelegateModal}
                                                    onPostpone={openPostponeModal}
                                                    onDelete={openDeleteModal}
                                                    onEvaluate={handleEvaluate}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-gray-100/50 border-2 border-gray-200 rounded-2xl p-4 flex flex-col relative">
                                        <div className="absolute top-0 left-0 bg-gray-200 text-gray-600 px-3 py-1 rounded-br-xl text-xs font-black z-10">Eliminate (제거)</div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar mt-6 space-y-3 p-1">
                                            {matrix.eliminate.map(t => (
                                                <TaskCard 
                                                    key={t.id} 
                                                    task={t} 
                                                    colorClass="border-gray-300" 
                                                    actionMenuId={actionMenuId}
                                                    setActionMenuId={setActionMenuId}
                                                    onToggleDone={handleToggleDone}
                                                    onDelegate={openDelegateModal}
                                                    onPostpone={openPostponeModal}
                                                    onDelete={openDeleteModal}
                                                    onEvaluate={handleEvaluate}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskTab;
