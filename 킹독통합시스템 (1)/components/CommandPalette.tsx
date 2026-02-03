
import React, { useState, useEffect, useRef } from 'react';
import { Search, Sparkles, Command, CornerDownLeft, Loader2, Zap, MessageSquare, ArrowRight, X, BookOpen } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { NAV_ITEMS, NavItem } from '../utils/navigationMap';

// --- 업무 매뉴얼 및 시스템 규칙 (AI Knowledge Base - Phase 5 Updated) ---
const APP_CONTEXT = `
[킹독 시스템 핵심 업무 규칙 v1.0]

1. 장부 및 결제 (Ledger):
   - 체크박스 의미: "서비스 완료"가 아니라 **"수금 완료(돈 받음)"**을 의미함.
   - 미수금 관리: 체크가 안 된 항목은 자동으로 미수금으로 집계됨. 고객이 나중에 한꺼번에 결제하면 [원클릭 완납(⚡)] 버튼 사용.
   - 잔액 동기화: 고객별 잔액이 이상하면 [장부] 탭 하단 요약바의 [동기화(↻)] 버튼을 눌러 전체 내역 재계산.

2. 예약 관리 (Reservation):
   - [중요] 상담 중 누락 방지: 상담이 시작되면 확정되지 않아도 무조건 **[상담중]** 상태로 등록부터 할 것. (기억에 의존 금지)
   - 호텔 매출: 예약 시점이 아니라 **아이 입실(Check-in) 시점**에 [장부] 탭에 수동 등록. (변동이 많으므로)
   - 미용 매출: [예약완료] 변경 시 장부에 자동 등록됨.
   - 노쇼(No-Show): 예약금은 환불하지 않고 **매출로 유지**함. (기술료 보상 차원)

3. 유치원 및 픽업 (Operations):
   - 픽업 리스트: 매일 작성하지 않음. [고객관리]에서 '고정 등원 요일'을 설정하면 자동으로 픽업 리스트에 뜸.
   - 생각 없는 운전: 픽업 기사님은 시스템에 뜬 명단만 보고 운행하면 됨 (Zero Mental Load).

4. 고객 소통:
   - 알림장: 카톡 전송용 '텍스트 복사'와 고급형 '링크 공유' 두 가지 모드 지원.

5. 문제 해결:
   - 뭔가 꼬였을 때: [관리자] > [데이터 관리] 탭의 마이그레이션 도구 확인.
   - 사용법 모를 때: 이 프롬프트 창에서 질문하거나 상단 [매뉴얼] 버튼 클릭.
`;

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (tabId: string) => void;
    onOpenManual: () => void;
}

interface AiResponse {
    explanation: string;
    targetId: string | null;
    actionLabel: string | null;
}

const CommandPalette = ({ isOpen, onClose, onNavigate, onOpenManual }: CommandPaletteProps) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<NavItem[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    
    // AI States
    const [mode, setMode] = useState<'search' | 'processing' | 'guide'>('search');
    const [aiResponse, setAiResponse] = useState<AiResponse | null>(null);
    
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset on Open
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            setQuery('');
            setResults([]);
            setSelectedIndex(0);
            setMode('search');
            setAiResponse(null);
        }
    }, [isOpen]);

    // Switch back to search mode on query change
    useEffect(() => {
        if (mode === 'guide') {
            setMode('search');
        }
        
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const lowerQuery = query.toLowerCase();
        const localMatches = NAV_ITEMS.filter(item => 
            item.label.toLowerCase().includes(lowerQuery) ||
            item.description.toLowerCase().includes(lowerQuery) ||
            item.keywords.some(k => k.toLowerCase().includes(lowerQuery))
        ).slice(0, 5);

        setResults(localMatches);
        setSelectedIndex(0);
    }, [query]);

    // Keyboard Navigation
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % results.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (mode === 'guide' && aiResponse?.targetId) {
                    onNavigate(aiResponse.targetId);
                    onClose();
                } else if (results.length > 0) {
                    handleSelect(results[selectedIndex]);
                } else if (query.trim()) {
                    executeAiSearch();
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, results, selectedIndex, query, mode, aiResponse]);

    const handleSelect = (item: NavItem) => {
        onNavigate(item.id);
        onClose();
    };

    const executeAiSearch = async () => {
        if (!query.trim() || mode === 'processing') return;
        
        // Safety Check for API Key
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            alert("AI 기능을 사용하려면 API 키 설정이 필요합니다.");
            return;
        }

        setMode('processing');

        try {
            const ai = new GoogleGenAI({ apiKey });
            
            // Simplified menu map for AI
            const menuMap = NAV_ITEMS.map(i => ({ id: i.id, label: i.label, desc: i.description }));
            
            const prompt = `
                Role: Smart Manager for 'Kingdog' Pet Shop System.
                
                System Rules & Manual Context:
                ${APP_CONTEXT}

                Available Menu Items:
                ${JSON.stringify(menuMap)}

                User Query: "${query}"
                
                Task:
                1. Understand the user's intent based on the Manual Context and Menu.
                2. Provide a polite and helpful explanation (Korean).
                3. Identify the most relevant Menu ID (targetId).
                4. Create a short label for the action button (actionLabel).

                Output JSON Format:
                {
                    "explanation": "string (Korean explanation about how to do the task)",
                    "targetId": "string (menu id from list, or null if general question)",
                    "actionLabel": "string (e.g., '호텔 예약으로 이동', or null)"
                }
            `;

            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview", 
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });

            const text = response.text;
            if (text) {
                const json = JSON.parse(text) as AiResponse;
                setAiResponse(json);
                setMode('guide');
            } else {
                throw new Error("Empty response");
            }
        } catch (error) {
            console.error("AI Search Error:", error);
            setAiResponse({
                explanation: "죄송합니다. AI 연결 상태가 좋지 않아 답변을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.",
                targetId: null,
                actionLabel: null
            });
            setMode('guide');
        }
    };

    const handleManualClick = () => {
        onOpenManual();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col relative transition-all duration-300 transform scale-100">
                
                {/* Search Input Area */}
                <div className="flex items-center px-5 py-5 border-b border-gray-100 bg-white z-10">
                    {mode === 'processing' ? (
                        <Loader2 className="w-6 h-6 mr-4 text-indigo-600 animate-spin" />
                    ) : (
                        <Search className={`w-6 h-6 mr-4 transition-colors ${mode === 'guide' ? 'text-indigo-600' : 'text-gray-400'}`} />
                    )}
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="무엇을 도와드릴까요? (예: 예약금 환불 규정, 호텔 매출 입력)"
                        className="flex-1 bg-transparent outline-none text-xl font-medium placeholder-gray-300 text-gray-900"
                        autoComplete="off"
                    />
                    <div className="flex items-center gap-2 ml-3">
                        <button 
                            onClick={handleManualClick}
                            className="hidden sm:flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md text-[10px] text-indigo-600 font-bold border border-indigo-200 transition-colors"
                            title="매뉴얼 보기"
                        >
                            <BookOpen className="w-3 h-3"/> 매뉴얼
                        </button>
                        <div className="hidden sm:flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-md text-[10px] text-gray-400 font-bold border border-gray-200">
                            <span>ESC</span> 닫기
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="bg-gray-50/50 min-h-[100px] max-h-[60vh] overflow-y-auto">
                    
                    {/* Mode 1: Search Results (Local) */}
                    {mode === 'search' && (
                        <div className="p-2">
                            {results.length > 0 ? (
                                <>
                                    <div className="text-[10px] font-bold text-gray-400 px-3 py-2">바로가기 추천</div>
                                    {results.map((item, index) => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleSelect(item)}
                                            className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between group transition-all ${
                                                index === selectedIndex ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'hover:bg-white text-gray-700 hover:shadow-sm'
                                            }`}
                                        >
                                            <div>
                                                <div className={`font-bold text-sm ${index === selectedIndex ? 'text-white' : 'text-gray-800'}`}>
                                                    {item.label}
                                                </div>
                                                <div className={`text-xs mt-0.5 truncate ${index === selectedIndex ? 'text-indigo-100' : 'text-gray-500'}`}>
                                                    {item.description}
                                                </div>
                                            </div>
                                            <CornerDownLeft className={`w-4 h-4 opacity-0 transition-opacity ${index === selectedIndex ? 'opacity-100 text-white' : 'group-hover:opacity-50'}`} />
                                        </button>
                                    ))}
                                </>
                            ) : (
                                <div className="py-16 text-center">
                                    {query ? (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Sparkles className="w-8 h-8"/>
                                            </div>
                                            <div>
                                                <p className="text-base font-bold text-gray-800">AI 매니저에게 물어보세요</p>
                                                <p className="text-sm text-gray-500 mt-1">"{query}"에 대해 설명해 드릴까요?</p>
                                            </div>
                                            <button 
                                                onClick={executeAiSearch}
                                                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-sm font-bold shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 mx-auto"
                                            >
                                                <Zap className="w-4 h-4 fill-current"/>
                                                AI 가이드 받기 (Enter)
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 opacity-60">
                                            <Command className="w-12 h-12 mx-auto text-gray-300 mb-2"/>
                                            <p className="text-sm font-medium text-gray-500">원하는 기능을 검색하거나 질문해보세요.</p>
                                            <p className="text-xs text-gray-400">"호텔 예약 어떻게 해?", "미수금 확인해줘"</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Mode 2: Processing */}
                    {mode === 'processing' && (
                        <div className="py-20 flex flex-col items-center justify-center text-center animate-pulse">
                            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                            <p className="text-sm font-bold text-indigo-800">AI 매니저가 매뉴얼을 확인 중입니다...</p>
                            <p className="text-xs text-indigo-400 mt-1">잠시만 기다려주세요.</p>
                        </div>
                    )}

                    {/* Mode 3: AI Guide Result */}
                    {mode === 'guide' && aiResponse && (
                        <div className="p-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-lg">
                                    <Sparkles className="w-5 h-5"/>
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div className="bg-white p-5 rounded-2xl rounded-tl-none shadow-sm border border-indigo-100 text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                                        <span className="block font-bold text-indigo-600 mb-2 text-xs uppercase tracking-wider">AI Manager Answer</span>
                                        {aiResponse.explanation}
                                    </div>
                                    
                                    {aiResponse.targetId && (
                                        <div className="flex justify-end">
                                            <button 
                                                onClick={() => { onNavigate(aiResponse.targetId!); onClose(); }}
                                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-md transition-transform hover:scale-105 active:scale-95"
                                            >
                                                <span>{aiResponse.actionLabel || "바로 이동하기"}</span>
                                                <ArrowRight className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                <div className="bg-white px-5 py-3 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400">
                    <div className="flex items-center gap-1.5">
                        <Zap className="w-3 h-3 text-yellow-500 fill-current"/>
                        <span className="font-medium">Powered by Google Gemini 3.0 Flash</span>
                    </div>
                    <div className="flex gap-4">
                        <span>Kingdog System Manual v1.0</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
