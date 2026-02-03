
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useKindergarten } from '../contexts/KindergartenContext';
import { KindergartenDailyRecord, ParentPost, Comment, CurriculumItem, Customer, MediaItem, Appointment, MonthlyRecord } from '../types';
import { 
    Users, Camera, Activity, CheckCircle2, XCircle, 
    Image as ImageIcon, X, MessageSquare, Heart,
    Download, Send, Plus, StickyNote, Scale, Star, Edit3, Share2, Copy, Trash2, Video, Settings, Footprints, Sparkles, Home, PlayCircle, Ticket, FileBarChart, ChevronLeft, ChevronRight, Save, Calendar as CalendarIcon, Eye, PenTool, RotateCcw, Search
} from 'lucide-react';
import { doc, updateDoc, collection, query, where, onSnapshot, addDoc, getDoc, setDoc, getDocs } from 'firebase/firestore'; 
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, appId, storage } from '../services/firebase'; 
import { getNowDate, getNowTime, copyToClipboardFallback, normalizeDate } from '../utils/helpers';
import { GoogleGenAI } from "@google/genai";
import { ConfirmModal, TicketHistoryModal } from './Modals';
import MonthlyReport from './MonthlyReport';

// --- KINGDOG TRAINING PROTOCOL (AI KNOWLEDGE BASE) ---
const TRAINING_PROTOCOL = `
[킹독 훈련 철학]
1. 행동심리학 기반: 고전적 조건화(파블로프)와 조작적 조건화(스키너)를 활용합니다.
2. 3D 원칙: 지속 시간(Duration), 거리(Distance), 방해 요소(Distraction)를 조절하여 난이도를 높입니다.
3. 무강압 긍정 강화: 마커(클리커/예스)와 보상을 통해 자발적 행동을 유도합니다.

[9단계 훈련 커리큘럼 및 난이도 가이드]
1단계: 차징 (Charging) - 신호의 의미 학습
- 난이도 1: 조용한 방, 마커 즉시 보상
- 난이도 2: 눈 마주칠 때 마커 사용
- 난이도 3: 타이밍(0.5~1초) 유지
- 난이도 4: 약한 소음(TV 등) 환경
- 난이도 5: 야외/산책 준비 등 자극 환경

2단계: 아이컨택 (Eye Contact) - 주의 집중
- 난이도 1: 자발적 시선 맞춤 캡처링
- 난이도 2: "봐/주시" 명령어 도입
- 난이도 3: 손의 간식 무시하고 눈 볼 때 보상
- 난이도 4: 바닥 간식 먹고 다시 쳐다보기 (Up-down)
- 난이도 5: 타견/낯선 사람 있는 야외 환경

3단계: 앉아 (Sit) - 신체 통제
- 난이도 1: 루어링(Luring)으로 유도
- 난이도 2: 간식 없이 수신호만 사용
- 난이도 3: "앉아" 음성 신호만 사용
- 난이도 4: 1~2m 거리에서 수행
- 난이도 5: 놀이/식사 직전 등 고자극 상황

4단계: 이리와 (Come) - 리콜
- 난이도 1: 실내 리드줄 착용 후 호출
- 난이도 2: 두 사람이 번갈아 부르는 핑퐁 게임
- 난이도 3: 야외 5~10m 롱라인 사용
- 난이도 4: 장난감/냄새 등 낮은 유혹 환경
- 난이도 5: 공원 등 고자극 환경 (잭팟 보상)

5단계: 유혹물 무시 (Leave It) - 충동 조절
- 난이도 1: 손안의 간식 포기 시 보상
- 난이도 2: 펼친 손바닥의 간식 무시
- 난이도 3: 바닥 간식 가리고 "그만"
- 난이도 4: 움직이는 장난감/간식 무시
- 난이도 5: 산책 중 떨어진 음식/동물 무시

6단계: 기다려 (Wait/Stay) - 인내심
- 난이도 1: 3~5초 자세 유지 (Duration)
- 난이도 2: 한 걸음 물러났다 복귀 (Distance)
- 난이도 3: 문/켄넬 앞 멈춤 (Wait)
- 난이도 4: 공 튀기기 등 방해 요소 (Distraction)
- 난이도 5: 시야에서 사라져도 유지

7단계: 자리 (Place) - 지정 장소 이완
- 난이도 1: 매트 위 간식으로 유도
- 난이도 2: 수신호로 1~2m 거리 이동
- 난이도 3: 엎드려 1분 이상 유지
- 난이도 4: 주변 청소기/움직임에도 유지
- 난이도 5: 초인종/손님 방문 시 자리 이동

8단계: 하우스 (House) - 켄넬 적응
- 난이도 1: 문 열고 간식 넣어 스스로 진입
- 난이도 2: 신호에 진입, 문 닫고 2~3초
- 난이도 3: 문 닫힌 상태에서 틈으로 보상
- 난이도 4: 안에서 식사/장난감 10분 이상
- 난이도 5: 턱 괴고 눕는 등 완전한 이완

9단계: 종합 복습 (Gamification)
- 난이도 1: 숨바꼭질 (리콜 응용)
- 난이도 2: 무궁화 꽃이 피었습니다 (가다 서다)
- 난이도 3: 머핀 틀 노즈워크 ("찾아")
- 난이도 4: 리콜 릴레이 (가족 간 호출)
- 난이도 5: 장애물 코스 복합 명령 수행
`;

// --- STYLES ---
const GOOGLE_FONTS = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Noto+Sans+KR:wght@300;400;700;900&family=Nanum+Pen+Script&display=swap');
    .font-serif-display { font-family: 'Playfair Display', serif; }
    .font-sans-kr { font-family: 'Noto Sans KR', sans-serif; }
    .font-handwriting { font-family: 'Nanum Pen Script', cursive; }
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    .magazine-shadow { box-shadow: 0 20px 40px -10px rgba(0,0,0,0.3); }
`;

// --- SVG & UI COMPONENTS ---

const RadarChart = ({ data }: { data: KindergartenDailyRecord['health'] }) => {
    const size = 180;
    const center = size / 2;
    const radius = 70;
    const stats = [
        { key: 'skin', label: '피부' },
        { key: 'coat', label: '모질' },
        { key: 'defecation', label: '배변' },
        { key: 'teeth', label: '치아' },
        { key: 'hygiene', label: '위생' },
        { key: 'condition', label: '컨디션' }
    ];

    const points = stats.map((stat, i) => {
        const val = (data as any)[stat.key] || 3;
        const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        const r = (val / 5) * radius;
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="relative w-full aspect-square flex items-center justify-center">
            <svg width={size} height={size} className="overflow-visible">
                {/* Webs */}
                {[0.2, 0.4, 0.6, 0.8, 1].map(scale => (
                    <polygon 
                        key={scale}
                        points={stats.map((_, i) => {
                            const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                            const r = radius * scale;
                            return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
                        }).join(' ')}
                        fill="none" 
                        stroke="#e5e7eb" 
                        strokeWidth="1"
                    />
                ))}
                {/* Axes & Labels */}
                {stats.map((stat, i) => {
                    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                    const x = center + radius * Math.cos(angle);
                    const y = center + radius * Math.sin(angle);
                    const labelX = center + (radius + 20) * Math.cos(angle);
                    const labelY = center + (radius + 20) * Math.sin(angle);
                    return (
                        <g key={i}>
                            <line x1={center} y1={center} x2={x} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                            <text 
                                x={labelX} y={labelY} 
                                textAnchor="middle" 
                                dominantBaseline="middle" 
                                className="text-[10px] font-bold fill-gray-500 font-sans-kr"
                            >
                                {stat.label}
                            </text>
                        </g>
                    );
                })}
                {/* Data */}
                <polygon points={points} fill="rgba(99, 102, 241, 0.2)" stroke="#6366f1" strokeWidth="2" />
                {stats.map((stat, i) => {
                    const val = (data as any)[stat.key] || 3;
                    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                    const r = (val / 5) * radius;
                    const x = center + r * Math.cos(angle);
                    const y = center + r * Math.sin(angle);
                    return <circle key={i} cx={x} cy={y} r="3" fill="#4f46e5" />;
                })}
            </svg>
        </div>
    );
};

const StarRating = ({ score, onChange, readOnly = false }: { score: number, onChange?: (val: number) => void, readOnly?: boolean }) => (
    <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
            <button 
                key={i} 
                onClick={() => !readOnly && onChange?.(i)}
                disabled={readOnly}
                className={`transition-transform ${!readOnly && 'hover:scale-110 active:scale-95'}`}
            >
                <Star 
                    className={`w-3.5 h-3.5 ${i <= score ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} 
                />
            </button>
        ))}
    </div>
);

// --- STACK GALLERY & MODAL (VIDEO SUPPORT + COMMENTS) ---

const StackGallery = ({ photos, onUpdatePhotos, isReadOnly, dogId }: { photos: MediaItem[], onUpdatePhotos?: (photos: MediaItem[]) => void, isReadOnly?: boolean, dogId?: string }) => {
    const [detailIndex, setDetailIndex] = useState<number | null>(null);
    const [commentInput, setCommentInput] = useState('');

    const rotations = useMemo(() => photos.map(() => Math.random() * 10 - 5), [photos.length]);

    if (!photos || photos.length === 0) return <div className="h-40 flex items-center justify-center text-gray-300 text-xs border-2 border-dashed rounded-xl">사진 없음</div>;

    const handleAddComment = async (photoIndex: number) => {
        if (!commentInput.trim() || !onUpdatePhotos) return;
        const newPhotos = [...photos];
        const newComment: Comment = {
            id: Date.now().toString(),
            author: isReadOnly ? '학부모' : '선생님',
            role: isReadOnly ? 'parent' : 'teacher',
            text: commentInput,
            createdAt: getNowDate()
        };
        newPhotos[photoIndex].comments.push(newComment);
        onUpdatePhotos(newPhotos);
        
        // Notify Admin if Parent comments
        if (isReadOnly && dogId) {
             await addDoc(collection(db, 'kingdog', appId, 'notifications'), {
                type: 'comment',
                message: `[알림장] ${newComment.author}님이 사진에 댓글을 남겼습니다: "${newComment.text}"`,
                targetId: dogId,
                isRead: false,
                createdAt: new Date().toISOString()
            });
        }

        setCommentInput('');
    };

    const handleUpdateCaption = (photoIndex: number, caption: string) => {
        if (!onUpdatePhotos) return;
        const newPhotos = [...photos];
        newPhotos[photoIndex].caption = caption;
        onUpdatePhotos(newPhotos);
    };

    return (
        <>
            <div 
                className="relative w-full h-64 flex items-center justify-center cursor-pointer group my-4 perspective-1000"
                onClick={() => setDetailIndex(0)}
            >
                {photos.slice(0, 5).map((p, i) => (
                    <div 
                        key={p.id}
                        className="absolute w-40 h-40 md:w-48 md:h-48 rounded-2xl shadow-xl border-4 border-white transition-all duration-500 ease-out group-hover:scale-105 overflow-hidden bg-black"
                        style={{ 
                            transform: `rotate(${rotations[i]}deg) translate(${i * 4}px, ${i * -4}px)`,
                            zIndex: i 
                        }}
                    >
                        {p.type === 'video' ? (
                            <div className="w-full h-full flex items-center justify-center relative">
                                <video src={p.url} className="w-full h-full object-cover opacity-80"/>
                                <PlayCircle className="w-10 h-10 text-white absolute z-10 opacity-80"/>
                            </div>
                        ) : (
                            <img src={p.url} alt="stack" className="w-full h-full object-cover"/>
                        )}
                    </div>
                ))}
                <div className="absolute z-10 bottom-2 right-2 bg-black/70 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm flex items-center">
                    <ImageIcon className="w-3 h-3 mr-1"/> {photos.length}
                </div>
            </div>

            {/* Detail Slider Modal */}
            {detailIndex !== null && (
                <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col md:flex-row items-center justify-center p-4 md:p-10 animate-in fade-in duration-200">
                    <button className="absolute top-4 right-4 text-white p-2 z-50" onClick={() => setDetailIndex(null)}><X className="w-8 h-8"/></button>
                    
                    {/* Main Image Area */}
                    <div className="flex-1 flex items-center justify-center w-full h-full relative">
                        <button 
                            className="absolute left-2 text-white/50 hover:text-white p-2 z-50"
                            onClick={() => setDetailIndex(prev => (prev! > 0 ? prev! - 1 : photos.length - 1))}
                        >
                            <Edit3 className="w-8 h-8 rotate-180"/> 
                        </button>
                        
                        <div className="relative max-h-[80vh] w-full max-w-3xl flex justify-center items-center">
                            {photos[detailIndex].type === 'video' ? (
                                <video controls autoPlay src={photos[detailIndex].url} className="max-h-[80vh] max-w-full rounded-md shadow-2xl bg-black"/>
                            ) : (
                                <img src={photos[detailIndex].url} className="max-h-[80vh] max-w-full rounded-md shadow-2xl object-contain"/>
                            )}
                        </div>

                        <button 
                            className="absolute right-2 text-white/50 hover:text-white p-2 z-50"
                            onClick={() => setDetailIndex(prev => (prev! < photos.length - 1 ? prev! + 1 : 0))}
                        >
                            <Edit3 className="w-8 h-8"/>
                        </button>
                    </div>

                    {/* Sidebar: Comments & Caption (Bidirectional) */}
                    <div className="w-full md:w-80 bg-white md:h-[80vh] rounded-xl flex flex-col overflow-hidden mt-4 md:mt-0 md:ml-4 shadow-2xl">
                        <div className="p-4 border-b">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-sm text-gray-900">Media {detailIndex + 1}/{photos.length}</span>
                                {!isReadOnly && (
                                    <button 
                                        onClick={() => {
                                            if(confirm('이 미디어를 삭제하시겠습니까?')) {
                                                const newPhotos = photos.filter((_, i) => i !== detailIndex);
                                                onUpdatePhotos?.(newPhotos);
                                                if(newPhotos.length === 0) setDetailIndex(null);
                                                else setDetailIndex(0);
                                            }
                                        }} 
                                        className="text-red-500"
                                    ><Trash2 className="w-4 h-4"/></button>
                                )}
                            </div>
                            {isReadOnly ? (
                                <p className="text-sm text-gray-700 bg-gray-100 p-2 rounded">{photos[detailIndex].caption || '작성된 코멘트가 없습니다.'}</p>
                            ) : (
                                <textarea 
                                    className="w-full text-sm border p-2 rounded bg-gray-50 focus:bg-white resize-none"
                                    rows={2}
                                    placeholder="사진/영상 설명 입력..."
                                    value={photos[detailIndex].caption || ''}
                                    onChange={e => handleUpdateCaption(detailIndex, e.target.value)}
                                />
                            )}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                            {photos[detailIndex].comments?.length === 0 && <div className="text-xs text-gray-400 text-center py-4">첫 댓글을 남겨보세요!</div>}
                            {photos[detailIndex].comments?.map(c => (
                                <div key={c.id} className={`text-xs p-2 rounded-lg ${c.role==='teacher' ? 'bg-indigo-50 ml-4' : 'bg-white border mr-4'}`}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`font-bold ${c.role === 'teacher' ? 'text-indigo-600' : 'text-gray-800'}`}>{c.author}</span>
                                        <span className="text-[9px] text-gray-400">{c.createdAt.slice(5)}</span>
                                    </div>
                                    <span className="text-gray-600">{c.text}</span>
                                </div>
                            ))}
                        </div>

                        <div className="p-3 border-t bg-white flex gap-2">
                            <input 
                                type="text" 
                                className="flex-1 text-xs border rounded-full px-3 py-2 outline-none focus:border-indigo-500"
                                placeholder="댓글 달기..."
                                value={commentInput}
                                onChange={e => setCommentInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddComment(detailIndex)}
                            />
                            <button onClick={() => handleAddComment(detailIndex)} className="text-indigo-600 font-bold text-xs px-2">게시</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// --- MAGAZINE VIEW (For Parent) ---

const MagazinePost = ({ data, dogName, ticketInfo, onLike }: { data: KindergartenDailyRecord, dogName: string, ticketInfo?: Customer['ticket'], onLike: any }) => (
    <div className="bg-white rounded-[30px] magazine-shadow overflow-hidden mb-10 relative font-sans-kr">
        {/* Cover */}
        <div className="relative h-[400px]">
            <img src={data.coverPhotoUrl || data.photos?.[0]?.url || 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=800'} alt="Cover" className="w-full h-full object-cover"/>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"/>
            
            <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                <div className="flex justify-between items-end">
                    <div>
                        <div className="font-serif-display italic text-5xl mb-2">{data.date.split('-')[2]}</div>
                        <div className="text-sm font-bold tracking-widest uppercase mb-4 opacity-80">{data.date} Daily Issue</div>
                        <h1 className="text-4xl font-black leading-tight">{dogName}<span className="text-yellow-400">.</span></h1>
                    </div>
                </div>
            </div>
        </div>

        {/* Body - Single Column Layout for Better Readability */}
        <div className="p-4 md:p-8">
            <div className="flex flex-col gap-8">
                
                {/* 1. Main Text */}
                <div className="w-full">
                    <div className="prose text-sm text-gray-600 leading-relaxed font-serif-display text-justify mb-8 first-letter:text-5xl first-letter:font-serif-display first-letter:float-left first-letter:mr-3 first-letter:text-indigo-900">
                        {data.comment || "오늘 하루도 즐거운 시간을 보냈습니다."}
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 mb-6">
                        <h3 className="font-bold text-gray-400 text-xs tracking-widest uppercase mb-4">Daily Stats</h3>
                        <div className="flex justify-around items-center mb-6">
                            <div className="text-center">
                                <Footprints className={`w-6 h-6 mx-auto mb-1 ${data.walking ? 'text-green-500' : 'text-gray-300'}`}/>
                                <span className="text-xs font-bold text-gray-600">산책 {data.walking ? '완료' : '-'}</span>
                            </div>
                            <div className="text-center">
                                <RadarChart data={data.health} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Curriculum & Gallery */}
                <div className="w-full flex flex-col gap-8">
                    {/* Curriculum List */}
                    <div className="bg-[#FFFDF5] p-6 rounded-3xl border border-[#F3EFE0]">
                        <h3 className="font-bold text-stone-800 text-sm mb-4 border-b border-stone-200 pb-2">Today's Class</h3>
                        <div className="space-y-3">
                            {data.curriculum?.map((item, i) => (
                                <div key={i} className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-stone-600">{item.name}</span>
                                    <StarRating score={item.score} readOnly />
                                </div>
                            ))}
                            {(!data.curriculum || data.curriculum.length === 0) && <div className="text-xs text-gray-400 text-center">진행된 교육이 없습니다.</div>}
                        </div>
                    </div>

                    {/* Stack Gallery */}
                    <div>
                        <h3 className="font-bold text-gray-400 text-xs tracking-widest uppercase mb-2 text-center">Memory Gallery</h3>
                        <StackGallery photos={data.photos || []} isReadOnly={true} dogId={data.dogId} />
                    </div>
                </div>
            </div>

            {/* Ticket Info Section (New) */}
            {ticketInfo && (
                <div className="mt-8 bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 text-center">
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Membership Status</h3>
                    <div className="flex justify-center items-center gap-2 text-indigo-900">
                        <Ticket className="w-5 h-5"/>
                        <span className="font-black text-xl">{ticketInfo.remaining}회 남음</span>
                    </div>
                    <div className="text-[10px] text-indigo-400 mt-1">유효기간: ~{ticketInfo.expiryDate}</div>
                </div>
            )}

            {/* Footer Interaction */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center">
                <button onClick={onLike} className="flex items-center gap-2 text-gray-400 hover:text-pink-500 transition-colors">
                    <Heart className={`w-6 h-6 ${data.likes.includes('admin') ? 'fill-pink-500 text-pink-500' : ''}`}/>
                    <span className="font-bold text-sm">{data.likes.length}</span>
                </button>
            </div>
        </div>
    </div>
);

// --- MODAL COMPONENT (Replaces StickyNoteWidget) ---
const CheckPointModal = ({ customer, appointments, onClose }: { customer: Customer, appointments: Appointment[], onClose: () => void }) => {
    const upcoming = appointments
        .filter(a => a.dogName === customer.dogName && normalizeDate(a.startDate) >= getNowDate())
        .sort((a,b) => a.startDate.localeCompare(b.startDate))[0];

    return (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
            <div className="bg-yellow-50 w-full h-full md:h-auto md:max-w-sm md:rounded-2xl shadow-2xl border-2 border-yellow-200 overflow-hidden relative flex flex-col">
                <div className="p-5 border-b border-yellow-100 flex justify-between items-center bg-yellow-100/50 shrink-0">
                    <h3 className="font-black text-yellow-900 text-lg flex items-center">
                        <StickyNote className="w-6 h-6 mr-2 text-yellow-600 fill-yellow-200"/> Check Points
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-yellow-200 rounded-full text-yellow-800 transition"><X className="w-5 h-5"/></button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1">
                    <ul className="space-y-4">
                        <li className="bg-white p-3 rounded-xl border border-yellow-100 shadow-sm">
                            <span className="block text-xs font-bold text-gray-400 mb-1">알레르기</span>
                            <div className="font-bold text-gray-800 text-sm">{customer.allergies || '없음'}</div>
                        </li>
                        <li className="bg-white p-3 rounded-xl border border-yellow-100 shadow-sm">
                            <span className="block text-xs font-bold text-gray-400 mb-1">주의사항</span>
                            <div className="font-bold text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">{customer.kindergarten?.caution || '없음'}</div>
                        </li>
                        {upcoming ? (
                            <li className="bg-blue-50 p-3 rounded-xl border border-blue-100 shadow-sm">
                                <span className="block text-xs font-bold text-blue-400 mb-1">다음 예약</span>
                                <div className="font-bold text-blue-900 text-sm">
                                    {upcoming.category} ({upcoming.startDate} {upcoming.startTime})
                                </div>
                            </li>
                        ) : (
                            <li className="text-center text-xs text-gray-400 pt-2 border-t border-yellow-200/50">예정된 예약이 없습니다.</li>
                        )}
                    </ul>
                </div>
                
                <div className="p-4 bg-yellow-100/30 text-center border-t border-yellow-100 shrink-0">
                    <button onClick={onClose} className="bg-yellow-400 hover:bg-yellow-500 text-white text-sm font-bold px-8 py-2.5 rounded-xl shadow-sm transition transform active:scale-95 w-full md:w-auto">확인</button>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

const NotificationTab = () => {
    const { 
        students, dailyRecords, markAttendance, updateDailyRecord, getStudentStatus, globalCurriculum
    } = useKindergarten();

    // Internal Modal State
    const [confirmData, setConfirmData] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({
        isOpen: false, message: '', onConfirm: () => {}
    });

    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    
    // CheckPoint Modal State (New)
    const [showCheckPointModal, setShowCheckPointModal] = useState(false);

    // Use query param for Parent Mode
    const [isParentMode, setIsParentMode] = useState(false);
    const [parentDogId, setParentDogId] = useState<string | null>(null);

    // Editor States
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [weightInput, setWeightInput] = useState('');
    const [showWeightModal, setShowWeightModal] = useState(false);
    
    // Curriculum Management
    const [showCurrModal, setShowCurrModal] = useState(false);
    const [currInput, setCurrInput] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

    // Parent Record Modal
    const [showParentRecordModal, setShowParentRecordModal] = useState(false);
    const [parentRecordText, setParentRecordText] = useState('');
    const [parentMedia, setParentMedia] = useState<{file: File, type: 'image'|'video'} | null>(null);

    // Fetch Appointments
    const [appointments, setAppointments] = useState<Appointment[]>([]);

    // --- New States for Integration ---
    const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
    const [selectedMonth, setSelectedMonth] = useState(getNowDate().slice(0, 7)); // YYYY-MM
    const [monthlyRecords, setMonthlyRecords] = useState<KindergartenDailyRecord[]>([]);
    const [monthlyCommentData, setMonthlyCommentData] = useState<MonthlyRecord | undefined>(undefined);
    const [teacherMonthlyComment, setTeacherMonthlyComment] = useState('');

    // --- Student Selection State (Enhanced) ---
    const [studentSearch, setStudentSearch] = useState('');
    const [activeGroup, setActiveGroup] = useState('all');

    // --- Mobile View State (New for Phase 3) ---
    const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');

    useEffect(() => {
        const q = query(collection(db, 'kingdog', appId, 'appointments'), where('startDate', '>=', getNowDate()));
        const unsub = onSnapshot(q, snap => {
            setAppointments(snap.docs.map(d => ({...d.data(), id: d.id} as Appointment)));
        });
        return () => unsub();
    }, []);

    // Load from URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode');
        const dogId = params.get('dogId');
        if (mode === 'parent' && dogId) {
            setIsParentMode(true);
            setParentDogId(dogId);
            setSelectedStudentId(dogId); 
        } else if (students.length > 0 && !selectedStudentId) {
            setSelectedStudentId(students[0].id);
        }
    }, [students]);

    // Fetch Monthly Data
    useEffect(() => {
        if (!selectedStudentId) return;
        
        const fetchMonthlyData = async () => {
            // 1. Fetch Daily Records for the month
            const startStr = `${selectedMonth}-01`;
            const endStr = `${selectedMonth}-31`;
            const recordsQuery = query(
                collection(db, 'kingdog', appId, 'daily_records'),
                where('dogId', '==', selectedStudentId),
                where('date', '>=', startStr),
                where('date', '<=', endStr)
            );
            
            // 2. Fetch Monthly Comment
            const monthlyDocId = `${selectedMonth}_${selectedStudentId}`;
            const monthlyRef = doc(db, 'kingdog', appId, 'monthly_records', monthlyDocId);
            
            // Fetch both
            const [recordsSnap, monthlySnap] = await Promise.all([getDocs(recordsQuery), getDoc(monthlyRef)]);
            
            const records = recordsSnap.docs.map(d => d.data() as KindergartenDailyRecord);
            setMonthlyRecords(records);
            
            if (monthlySnap.exists()) {
                setMonthlyCommentData(monthlySnap.data() as MonthlyRecord);
                setTeacherMonthlyComment(monthlySnap.data().teacherComment || '');
            } else {
                setMonthlyCommentData(undefined);
                setTeacherMonthlyComment('');
            }
        };

        fetchMonthlyData();
    }, [selectedStudentId, selectedMonth]);

    const filteredStudents = useMemo(() => {
        let result = students;
        if (studentSearch.trim()) {
            const term = studentSearch.toLowerCase();
            result = result.filter(s => 
                s.dogName.toLowerCase().includes(term) ||
                s.ownerName?.toLowerCase().includes(term)
            );
        }
        if (activeGroup !== 'all') {
            result = result.filter(s => s.kindergarten?.classType === activeGroup);
        } else {
            const order: Record<string, number> = { '종일반': 1, '주간반': 2, '야간반': 3 };
            result = [...result].sort((a, b) => {
                const typeA = a.kindergarten?.classType || '기타';
                const typeB = b.kindergarten?.classType || '기타';
                const scoreA = order[typeA] || 4;
                const scoreB = order[typeB] || 4;
                if (scoreA !== scoreB) return scoreA - scoreB;
                return a.dogName.localeCompare(b.dogName);
            });
        }
        return result;
    }, [students, studentSearch, activeGroup]);

    const saveMonthlyComment = async () => {
        if (!selectedStudentId) return;
        const monthlyDocId = `${selectedMonth}_${selectedStudentId}`;
        const data: MonthlyRecord = {
            id: monthlyDocId,
            dogId: selectedStudentId,
            month: selectedMonth,
            teacherComment: teacherMonthlyComment,
            updatedAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'kingdog', appId, 'monthly_records', monthlyDocId), data, { merge: true });
        alert("월간 종합 코멘트가 저장되었습니다.");
        setMonthlyCommentData(data);
    };

    const selectedStudent = students.find(s => s.id === selectedStudentId);
    const currentRecord = (selectedStudentId && dailyRecords[selectedStudentId]) || {} as Partial<KindergartenDailyRecord>;
    const attendanceStatus = selectedStudentId ? getStudentStatus(selectedStudentId) : 'absent';
    const isAttended = attendanceStatus === 'present' || attendanceStatus === 'home';

    // Construct Record Data with Global Curriculum Merge
    const recordData: KindergartenDailyRecord = {
        id: currentRecord.id || '',
        date: currentRecord.date || getNowDate(),
        dogId: selectedStudentId || '',
        coverPhotoUrl: currentRecord.coverPhotoUrl,
        health: {
            skin: currentRecord.health?.skin || 3,
            coat: currentRecord.health?.coat || 3,
            defecation: currentRecord.health?.defecation || 3,
            teeth: currentRecord.health?.teeth || 3,
            hygiene: currentRecord.health?.hygiene || 3,
            condition: currentRecord.health?.condition || 3,
        },
        // Merge global curriculum with existing scores
        curriculum: globalCurriculum.map(name => {
            const existing = currentRecord.curriculum?.find(c => c.name === name);
            return existing || { id: `curr_${name}`, name, score: 0 };
        }),
        walking: currentRecord.walking || false,
        photos: currentRecord.photos || [], 
        likes: currentRecord.likes || [],
        comments: currentRecord.comments || [],
        meal: currentRecord.meal || { morning: false, afternoon: false, amount: '' },
        napTime: '', 
        comment: currentRecord.comment || '', 
        updatedAt: ''
    };

    // --- Actions ---

    // Modified to use Toggle
    const handleToggleAttendance = async () => {
        if (!selectedStudent) return;
        
        if (isAttended) {
            // ON -> OFF: 취소 (복구)
            await markAttendance(selectedStudent, 'absent');
        } else {
            // OFF -> ON: 등원 (차감 시도)
            const result = await markAttendance(selectedStudent, 'present');
            if (result === 'REQUIRE_CONFIRM') {
                const remaining = selectedStudent.ticket?.remaining || 0;
                setConfirmData({
                    isOpen: true,
                    message: `[이용권 부족] 현재 잔여 이용권이 ${remaining}회입니다.\n그래도 등원 처리하시겠습니까? (차감되어 음수가 됩니다)`,
                    onConfirm: async () => {
                        await markAttendance(selectedStudent, 'present', true);
                        setConfirmData(prev => ({ ...prev, isOpen: false }));
                    }
                });
            }
        }
    };

    const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>, isCover = false) => {
        if (!selectedStudent || !e.target.files) return;
        const files: File[] = Array.from(e.target.files);
        
        files.forEach(async (file) => {
            const id = Date.now().toString();
            try {
                const refPath = `daily/${selectedStudent.id}/${isCover ? 'cover_' : ''}${id}_${file.name}`;
                const storageRef = ref(storage, refPath);
                await uploadBytes(storageRef, file);
                const url = await getDownloadURL(storageRef);

                const type = file.type.startsWith('video') ? 'video' : 'image';

                if (isCover) {
                    updateDailyRecord(selectedStudent.id, { coverPhotoUrl: url });
                } else {
                    const snap = await getDoc(doc(db, 'kingdog', appId, 'daily_records', `${getNowDate()}_${selectedStudent.id}`));
                    const currentPhotos = snap.data()?.photos || [];
                    const newItem: MediaItem = { id, url, type, comments: [] };
                    updateDailyRecord(selectedStudent.id, { photos: [...currentPhotos, newItem] });
                }
            } catch (err) { console.error(err); }
        });
    };

    const generateAIComment = async () => {
        if (!selectedStudent) return;
        
        // Safety Check
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            alert("AI 기능을 사용하려면 API 키 설정이 필요합니다.");
            return;
        }

        setIsGeneratingAI(true);
        try {
            const ai = new GoogleGenAI({ apiKey });
            const prompt = `
                Role: Professional Dog Kindergarten Teacher at Kingdog.
                
                Knowledge Base (Training Protocol):
                ${TRAINING_PROTOCOL}

                Task: Write a daily report comment for a parent (Korean).
                Tone: Warm, professional, polite, educational.
                Length: 3-4 sentences.
                
                Input Data:
                - Dog Name: ${selectedStudent.dogName}
                - Health: Condition ${recordData.health.condition}/5, Skin ${recordData.health.skin}/5
                - Activities (Curriculum): ${recordData.curriculum.filter(c => c.score > 0).map(c => `${c.name}(Level ${c.score}/5)`).join(', ') || 'General Play'}
                - Walking: ${recordData.walking ? 'Yes' : 'No'}
                - Teacher's Draft Note: ${recordData.comment}
                
                Instructions:
                1. If a specific curriculum activity (e.g., '기다려', '하우스') was performed, explain it using the [Knowledge Base] logic. 
                   For example, "Today, we practiced 'Wait' at Level ${recordData.curriculum.find(c=>c.name.includes('기다려'))?.score || 1}, helping improve patience by adding distractions."
                2. If the score is high (4-5), praise the progress. If low (1-2), explain it's a foundation step.
                3. Mention general health and mood warmly.
            `;
            
            const result = await ai.models.generateContent({
                model: "gemini-3-flash-preview", 
                contents: prompt 
            });
            updateDailyRecord(selectedStudent.id, { comment: result.text.trim() });
        } catch (e) {
            alert("AI 생성 실패: " + e);
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const saveParentRecord = async () => {
        if (!selectedStudent || !parentRecordText) return alert("내용을 입력해주세요.");
        try {
            let mediaUrl = '';
            let mediaType = 'image';
            if (parentMedia) {
                const file = parentMedia.file;
                const storageRef = ref(storage, `home_records/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                mediaUrl = await getDownloadURL(storageRef);
                mediaType = parentMedia.type;
            }

            await addDoc(collection(db, 'kingdog', appId, 'home_records'), {
                dogId: selectedStudent.id,
                authorName: selectedStudent.ownerName,
                date: getNowDate(),
                createdAt: new Date().toISOString(),
                mediaUrl,
                mediaType,
                text: parentRecordText,
                comments: []
            });

            // Trigger Notification for Admin
            await addDoc(collection(db, 'kingdog', appId, 'notifications'), {
                type: 'home_record',
                message: `${selectedStudent.ownerName}님이 집에서의 기록을 남겼습니다.`,
                targetId: selectedStudent.id,
                isRead: false,
                createdAt: new Date().toISOString()
            });

            setShowParentRecordModal(false);
            setParentRecordText('');
            setParentMedia(null);
            alert("기록이 등록되었습니다!");
        } catch (e) {
            console.error(e);
            alert("업로드 실패");
        }
    };

    const handleCurriculumUpdate = async (newItems: string[]) => {
        await setDoc(doc(db, 'kingdog', appId, 'settings', 'curriculum'), { items: newItems });
        setShowCurrModal(false);
    };

    const copyLink = () => {
        if (!selectedStudent) return;
        const baseUrl = window.location.origin + window.location.pathname;
        const link = `${baseUrl}?mode=parent&dogId=${selectedStudent.id}`;
        copyToClipboardFallback(link);
        alert('학부모용 리포트 링크가 복사되었습니다.');
    };

    const saveWeight = async () => {
        if (!selectedStudent || !weightInput) return;
        const weight = parseFloat(weightInput);
        if (isNaN(weight)) return alert('올바른 숫자를 입력해주세요.');

        try {
            // Update customer record
            const today = getNowDate();
            const newHistory = [...(selectedStudent.weightHistory || []), { date: today, weight }];
            
            // Sort by date just in case
            newHistory.sort((a,b) => a.date.localeCompare(b.date));

            await updateDoc(doc(db, 'kingdog', appId, 'customers', selectedStudent.id), {
                weight: weightInput, // Current weight display string/number
                weightHistory: newHistory
            });
            
            setShowWeightModal(false);
            alert('체중이 기록되었습니다.');
        } catch (e) {
            console.error(e);
            alert('저장 실패');
        }
    };

    const handleMonthChange = (offset: number) => {
        const d = new Date(selectedMonth + "-01");
        d.setMonth(d.getMonth() + offset);
        setSelectedMonth(d.toISOString().slice(0, 7));
    };

    // --- RENDER ---

    if (isParentMode) {
        if (!selectedStudent) return <div className="p-10 text-center">정보를 불러오는 중...</div>;
        return (
            <div className="min-h-screen bg-gray-100 font-sans-kr relative pb-20">
                <style>{GOOGLE_FONTS}</style>
                
                {/* Header with Toggle */}
                <div className="bg-white sticky top-0 z-50 shadow-sm p-4 flex justify-center border-b border-gray-100">
                    <div className="bg-gray-100 p-1 rounded-xl flex shadow-inner">
                        <button 
                            onClick={() => setViewMode('daily')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'daily' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                        >
                            오늘의 소식
                        </button>
                        <button 
                            onClick={() => setViewMode('monthly')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'monthly' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
                        >
                            성장 리포트
                        </button>
                    </div>
                </div>

                <div className="max-w-2xl mx-auto p-4 md:p-8">
                    {viewMode === 'daily' ? (
                        <>
                            <MagazinePost 
                                data={recordData} 
                                dogName={selectedStudent.dogName} 
                                ticketInfo={selectedStudent.ticket}
                                onLike={() => {/* Like Logic */}} 
                            />
                            <div className="text-center text-xs text-gray-400 mt-8 pb-8">
                                Designed for Kingdog Premium
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col gap-6">
                            <div className="flex items-center justify-center gap-4 bg-white p-4 rounded-2xl shadow-sm">
                                <button onClick={() => handleMonthChange(-1)} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft className="w-5 h-5"/></button>
                                <span className="text-lg font-black text-gray-800">{selectedMonth}</span>
                                <button onClick={() => handleMonthChange(1)} className="p-2 hover:bg-gray-100 rounded-full"><ChevronRight className="w-5 h-5"/></button>
                            </div>
                            <MonthlyReport 
                                customer={selectedStudent} 
                                records={monthlyRecords} 
                                monthlyRecord={monthlyCommentData}
                                selectedMonth={selectedMonth}
                            />
                        </div>
                    )}
                </div>

                {/* Floating Action Button for Home Record */}
                <button 
                    onClick={() => setShowParentRecordModal(true)}
                    className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-2xl animate-bounce hover:bg-indigo-700 transition flex items-center justify-center z-50"
                >
                    <Home className="w-6 h-6"/>
                </button>

                {/* Parent Record Modal */}
                {showParentRecordModal && (
                    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-sm rounded-2xl p-6 space-y-4">
                            <h3 className="font-bold text-lg text-center">집에서의 기록 남기기</h3>
                            <textarea 
                                value={parentRecordText} 
                                onChange={e=>setParentRecordText(e.target.value)} 
                                className="w-full border p-3 rounded-xl h-32 resize-none text-sm" 
                                placeholder="집에서의 모습을 선생님께 공유해주세요!"
                            />
                            <div className="flex items-center gap-2">
                                <label className="flex-1 border p-3 rounded-xl text-center cursor-pointer hover:bg-gray-50 text-xs text-gray-500 flex flex-col items-center">
                                    <Camera className="w-5 h-5 mb-1"/>
                                    {parentMedia ? '변경하기' : '사진/영상 첨부'}
                                    <input type="file" accept="image/*,video/*" className="hidden" onChange={e => {
                                        if(e.target.files?.[0]) setParentMedia({file: e.target.files[0], type: e.target.files[0].type.startsWith('video')?'video':'image'});
                                    }}/>
                                </label>
                                {parentMedia && <span className="text-xs text-green-600 font-bold">1개 선택됨</span>}
                            </div>
                            <button onClick={saveParentRecord} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">등록하기</button>
                            <button onClick={() => setShowParentRecordModal(false)} className="w-full text-gray-400 text-xs">취소</button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col md:flex-row h-full bg-gray-100 overflow-hidden font-sans-kr relative">
            <style>{GOOGLE_FONTS}</style>
            
            <ConfirmModal 
                isOpen={confirmData.isOpen} 
                message={confirmData.message} 
                onConfirm={confirmData.onConfirm} 
                onCancel={() => setConfirmData(prev => ({ ...prev, isOpen: false }))} 
            />

            {/* Ticket History Modal */}
            {selectedStudent && (
                <TicketHistoryModal 
                    isOpen={showHistoryModal} 
                    onClose={() => setShowHistoryModal(false)}
                    customer={selectedStudent}
                    onUpdate={()=>{ /* Update is handled by realtime listener */ }}
                    staffList={[]} // Staff list not critical for display here
                />
            )}

            {/* Check Point Modal (New) */}
            {selectedStudent && showCheckPointModal && (
                <CheckPointModal 
                    customer={selectedStudent} 
                    appointments={appointments}
                    onClose={() => setShowCheckPointModal(false)}
                />
            )}

            {/* Mobile Tab Switcher (Visible only on mobile) */}
            <div className="md:hidden flex border-b bg-white shrink-0 shadow-sm z-30">
                <button 
                    onClick={() => setMobileTab('editor')} 
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${mobileTab === 'editor' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-gray-500'}`}
                >
                    <PenTool className="w-4 h-4"/> 작성하기
                </button>
                <button 
                    onClick={() => setMobileTab('preview')} 
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${mobileTab === 'preview' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-transparent text-gray-500'}`}
                >
                    <Eye className="w-4 h-4"/> 미리보기
                </button>
            </div>

            {/* Left: Editor (Visible if mobileTab is editor OR on desktop) */}
            <div className={`w-full md:w-1/2 flex flex-col border-r border-gray-200 bg-white shadow-xl z-20 relative ${mobileTab === 'preview' ? 'hidden md:flex' : 'flex'}`}>
                
                {/* 1. Student Bar (Enhanced) */}
                <div className="border-b bg-white shrink-0 flex flex-col shadow-sm z-10">
                    {/* Search & Filter Toolbar */}
                    <div className="p-3 flex items-center gap-2 border-b border-gray-100">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1.5 w-4 h-4 text-gray-400"/>
                            <input 
                                type="text" 
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                                placeholder="이름 검색" 
                                className="w-full pl-8 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                        </div>
                        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                            {['all', '종일반', '주간반', '야간반'].map(g => (
                                <button
                                    key={g}
                                    onClick={() => setActiveGroup(g)}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${
                                        activeGroup === g ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'
                                    }`}
                                >
                                    {g === 'all' ? '전체' : g.replace('반', '')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Scrollable Student List */}
                    <div className="p-3 overflow-x-auto whitespace-nowrap custom-scrollbar flex items-center gap-2">
                        {filteredStudents.length === 0 && <div className="text-xs text-gray-400 font-medium px-2">검색 결과가 없습니다.</div>}
                        {filteredStudents.map(s => (
                            <button 
                                key={s.id}
                                onClick={() => setSelectedStudentId(s.id)}
                                className={`group flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border ${selectedStudentId === s.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}
                            >
                                <div className={`w-6 h-6 rounded-full overflow-hidden border ${selectedStudentId === s.id ? 'border-white/30' : 'border-gray-100'}`}>
                                    {s.photoUrl ? <img src={s.photoUrl} className="w-full h-full object-cover"/> : <Users className="w-3 h-3 m-auto opacity-50"/>}
                                </div>
                                <span className="text-xs font-bold">{s.dogName}</span>
                                {/* Optional: Show class type indicator if showing 'all' */}
                                {activeGroup === 'all' && s.kindergarten?.classType && (
                                    <span className={`text-[8px] px-1 rounded ${
                                        s.kindergarten.classType === '종일반' ? 'bg-orange-100 text-orange-600' :
                                        s.kindergarten.classType === '주간반' ? 'bg-blue-100 text-blue-600' :
                                        s.kindergarten.classType === '야간반' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100'
                                    }`}>
                                        {s.kindergarten.classType[0]}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. Admin View Toggle */}
                {selectedStudent && (
                    <div className="p-3 bg-gray-50 border-b flex justify-center">
                        <div className="flex bg-white rounded-lg p-1 border shadow-sm">
                            <button 
                                onClick={() => setViewMode('daily')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'daily' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                일일 알림장
                            </button>
                            <button 
                                onClick={() => setViewMode('monthly')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'monthly' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                월간 생활기록
                            </button>
                        </div>
                    </div>
                )}

                {/* 3. Scrollable Editor */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {selectedStudent ? (
                        viewMode === 'daily' ? (
                            <>
                                {/* Attendance Toggle (Updated to single switch) */}
                                <div className="flex justify-center bg-gray-50 p-4 rounded-xl border mb-2">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            checked={isAttended}
                                            onChange={handleToggleAttendance}
                                        />
                                        <div className="w-16 h-8 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all peer-checked:bg-green-500"></div>
                                        <span className={`ml-4 text-base font-black ${isAttended ? 'text-green-600' : 'text-gray-400'}`}>
                                            {isAttended ? (attendanceStatus === 'home' ? '하원완료' : '등원완료') : '미등원'}
                                        </span>
                                    </label>
                                </div>

                                {/* Header Actions & Check Point Trigger */}
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50 p-4 rounded-2xl border gap-4">
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-800">{selectedStudent.dogName}</h2>
                                        <div className="text-xs text-gray-500 mt-1">{getNowDate()} 알림장 작성 중</div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                        {/* Check Point Button (Replaces Inline Widget) */}
                                        <button 
                                            onClick={() => setShowCheckPointModal(true)}
                                            className={`flex-1 md:flex-none flex items-center justify-center gap-1 text-xs font-bold px-3 py-2 rounded-lg transition-colors ${
                                                (selectedStudent.allergies || selectedStudent.kindergarten?.caution)
                                                ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse shadow-md'
                                                : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                            }`}
                                        >
                                            <StickyNote className="w-3.5 h-3.5"/> 
                                            {(selectedStudent.allergies || selectedStudent.kindergarten?.caution) ? '주의사항!' : '체크포인트'}
                                        </button>

                                        {/* Ticket Info Button */}
                                        {selectedStudent.ticket && (
                                            <button 
                                                onClick={() => setShowHistoryModal(true)}
                                                className="flex-1 md:flex-none flex items-center justify-center gap-1 text-xs font-bold bg-purple-50 border border-purple-200 text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-100"
                                            >
                                                <Ticket className="w-3.5 h-3.5"/> 
                                                {selectedStudent.ticket.remaining}회
                                            </button>
                                        )}
                                        <button onClick={() => setShowWeightModal(true)} className="flex-1 md:flex-none flex items-center justify-center gap-1 text-xs font-bold bg-white border text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50">
                                            <Scale className="w-3.5 h-3.5"/> 체중
                                        </button>
                                        <button onClick={copyLink} className="flex-1 md:flex-none flex items-center justify-center gap-1 text-xs font-bold bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 shadow-sm">
                                            <Share2 className="w-3.5 h-3.5"/> 공유
                                        </button>
                                    </div>
                                </div>

                                {/* Cover Photo */}
                                <div className="relative group h-40 bg-gray-100 rounded-2xl overflow-hidden border-2 border-dashed border-gray-300 hover:border-indigo-400 transition-colors flex items-center justify-center">
                                    {recordData.coverPhotoUrl ? (
                                        <img src={recordData.coverPhotoUrl} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center text-gray-400">
                                            <Camera className="w-8 h-8 mx-auto mb-2"/>
                                            <span className="text-xs">커버 사진 등록</span>
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" onChange={e => handleBackgroundUpload(e, true)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                </div>

                                {/* Health & Walking */}
                                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-sm text-gray-700 flex items-center"><Activity className="w-4 h-4 mr-2 text-indigo-500"/> 6대 건강 밸런스</h3>
                                        <label className="flex items-center text-xs font-bold text-gray-600 bg-green-50 px-2 py-1 rounded cursor-pointer border border-green-200">
                                            <input 
                                                type="checkbox" 
                                                checked={recordData.walking} 
                                                onChange={e => updateDailyRecord(selectedStudent.id, { walking: e.target.checked })} 
                                                className="mr-1.5"
                                            /> 
                                            산책 완료
                                        </label>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                        {Object.keys(recordData.health).map((k) => (
                                            ['skin', 'coat', 'defecation', 'teeth', 'hygiene', 'condition'].includes(k) && (
                                                <div key={k} className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-gray-500 w-12 capitalize translate-y-0.5">
                                                        {k === 'defecation' ? '배변' : k === 'skin' ? '피부' : k === 'coat' ? '모질' : k === 'teeth' ? '치아' : k === 'hygiene' ? '위생' : '컨디션'}
                                                    </span>
                                                    <input 
                                                        type="range" min="1" max="5" step="1"
                                                        value={(recordData.health as any)[k] || 3}
                                                        onChange={(e) => updateDailyRecord(selectedStudent.id, { health: { ...recordData.health, [k]: parseInt(e.target.value) } })}
                                                        className="flex-1 h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 ml-2"
                                                    />
                                                    <span className="text-xs font-black text-indigo-600 w-4 text-right">{(recordData.health as any)[k]}</span>
                                                </div>
                                            )
                                        ))}
                                    </div>
                                </div>

                                {/* Curriculum (Global + Local) */}
                                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-sm text-gray-700 flex items-center"><Star className="w-4 h-4 mr-2 text-yellow-500"/> 교육 커리큘럼</h3>
                                        <button onClick={() => setShowCurrModal(true)} className="text-xs flex items-center bg-gray-100 px-2 py-1 rounded text-gray-600 hover:bg-gray-200">
                                            <Settings className="w-3 h-3 mr-1"/> 관리
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {recordData.curriculum.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center group">
                                                <span className="text-xs font-bold text-gray-600">{item.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <StarRating 
                                                        score={item.score} 
                                                        onChange={(val) => {
                                                            const newCurr = [...recordData.curriculum];
                                                            newCurr[idx] = { ...newCurr[idx], score: val };
                                                            updateDailyRecord(selectedStudent.id, { curriculum: newCurr });
                                                        }} 
                                                    />
                                                    {item.score > 0 && (
                                                        <button 
                                                            onClick={() => {
                                                                const newCurr = [...recordData.curriculum];
                                                                newCurr[idx] = { ...newCurr[idx], score: 0 };
                                                                updateDailyRecord(selectedStudent.id, { curriculum: newCurr });
                                                            }}
                                                            className="p-1 rounded-full hover:bg-gray-100 text-gray-300 hover:text-red-400 transition-colors"
                                                            title="평가 초기화 (0점)"
                                                        >
                                                            <RotateCcw className="w-3 h-3"/>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Photos & Comment & AI */}
                                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <h3 className="font-bold text-sm text-gray-700">활동 사진/영상</h3>
                                            <label className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded cursor-pointer font-bold">
                                                + 추가
                                                <input type="file" multiple accept="image/*,video/*" onChange={handleBackgroundUpload} className="hidden" />
                                            </label>
                                        </div>
                                        <div className="flex gap-2 overflow-x-auto pb-2">
                                            {recordData.photos.map((p, i) => (
                                                <div key={p.id} className="w-20 h-20 shrink-0 rounded-lg overflow-hidden relative group bg-black">
                                                    {p.type === 'video' ? (
                                                        <video src={p.url} className="w-full h-full object-cover opacity-80"/>
                                                    ) : (
                                                        <img src={p.url} className="w-full h-full object-cover"/>
                                                    )}
                                                    <button 
                                                        onClick={() => {
                                                            const newPhotos = recordData.photos.filter((_, idx) => idx !== i);
                                                            updateDailyRecord(selectedStudent.id, { photos: newPhotos });
                                                        }}
                                                        className="absolute top-0 right-0 bg-red-600 text-white p-0.5 opacity-0 group-hover:opacity-100 transition"
                                                    >
                                                        <X className="w-3 h-3"/>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <hr className="border-gray-100"/>
                                    <div className="relative">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="font-bold text-sm text-gray-700">선생님 코멘트</h3>
                                            <button 
                                                onClick={generateAIComment}
                                                disabled={isGeneratingAI}
                                                className="text-xs flex items-center bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-3 py-1 rounded-full font-bold shadow-md hover:opacity-90 transition"
                                            >
                                                <Sparkles className="w-3 h-3 mr-1"/> {isGeneratingAI ? '작성 중...' : 'AI 자동 작성'}
                                            </button>
                                        </div>
                                        <textarea 
                                            value={recordData.comment} 
                                            onChange={(e) => updateDailyRecord(selectedStudent.id, { comment: e.target.value })}
                                            className="w-full h-24 p-3 bg-gray-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-indigo-200 resize-none"
                                            placeholder="오늘 아이의 하루는 어땠나요?"
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col gap-6">
                                <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="font-bold text-gray-800 flex items-center"><CalendarIcon className="w-5 h-5 mr-2 text-indigo-500"/> 월간 리포트 기간 설정</h3>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleMonthChange(-1)} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft className="w-4 h-4"/></button>
                                        <span className="font-black text-lg text-indigo-900">{selectedMonth}</span>
                                        <button onClick={() => handleMonthChange(1)} className="p-1 hover:bg-gray-100 rounded"><ChevronRight className="w-4 h-4"/></button>
                                    </div>
                                </div>

                                {/* Monthly Comment Editor */}
                                <div className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-bold text-sm text-indigo-900 flex items-center"><FileBarChart className="w-4 h-4 mr-2"/> 선생님 월간 총평</h3>
                                        <button onClick={saveMonthlyComment} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-1 shadow-sm">
                                            <Save className="w-3 h-3"/> 저장하기
                                        </button>
                                    </div>
                                    <textarea 
                                        value={teacherMonthlyComment}
                                        onChange={e => setTeacherMonthlyComment(e.target.value)}
                                        className="w-full h-32 p-3 bg-indigo-50/50 rounded-xl text-sm border border-indigo-100 focus:ring-2 focus:ring-indigo-200 resize-none outline-none"
                                        placeholder="한 달 동안의 아이 성장과 변화에 대해 적어주세요. (보호자 리포트에 노출됩니다)"
                                    />
                                </div>

                                <div className="opacity-70 pointer-events-none scale-90 origin-top">
                                    <MonthlyReport 
                                        customer={selectedStudent} 
                                        records={monthlyRecords} 
                                        monthlyRecord={monthlyCommentData}
                                        selectedMonth={selectedMonth}
                                    />
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="text-center text-gray-400 mt-20">원생을 선택해주세요.</div>
                    )}
                </div>
            </div>

            {/* Right: Preview (Magazine) - Hidden on mobile if editor tab is active */}
            <div className={`w-full md:w-1/2 bg-gray-200 flex flex-col items-center justify-center p-8 overflow-hidden relative ${mobileTab === 'editor' ? 'hidden md:flex' : 'flex'}`}>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
                <div className="w-full max-w-lg h-full overflow-y-auto scrollbar-hide pr-2">
                    {selectedStudent ? (
                        viewMode === 'daily' ? (
                            <MagazinePost 
                                data={recordData} 
                                dogName={selectedStudent.dogName} 
                                ticketInfo={selectedStudent.ticket}
                                onLike={()=>{}} 
                            />
                        ) : (
                            <MonthlyReport 
                                customer={selectedStudent} 
                                records={monthlyRecords} 
                                monthlyRecord={monthlyCommentData}
                                selectedMonth={selectedMonth}
                            />
                        )
                    ) : (
                        <div className="text-center text-gray-400 mt-40">원생을 선택해주세요.</div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {/* Weight Modal */}
            {showWeightModal && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-xs shadow-2xl animate-in zoom-in-95">
                        <h3 className="font-bold text-lg mb-4 text-center">체중 기록</h3>
                        <div className="flex gap-2 mb-4">
                            <input 
                                type="number" step="0.1" 
                                value={weightInput} onChange={e=>setWeightInput(e.target.value)} 
                                className="w-full border p-3 rounded-xl text-center text-xl font-bold" 
                                placeholder="0.0" 
                                autoFocus
                            />
                            <span className="self-center font-bold text-gray-500">kg</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={()=>setShowWeightModal(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-600">취소</button>
                            <button onClick={saveWeight} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">저장</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Curriculum Edit Modal */}
            {showCurrModal && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                        <h3 className="font-bold text-lg mb-4 text-center">커리큘럼 항목 관리 (전체 적용)</h3>
                        <div className="flex gap-2 mb-4">
                            <input 
                                type="text" 
                                value={currInput} 
                                onChange={e => setCurrInput(e.target.value)} 
                                className="flex-1 border p-2 rounded text-sm"
                                placeholder="새 항목 입력"
                            />
                            <button 
                                onClick={() => {
                                    if(currInput) {
                                        handleCurriculumUpdate([...globalCurriculum, currInput]);
                                        setCurrInput('');
                                    }
                                }}
                                className="bg-blue-600 text-white px-3 rounded text-xs font-bold"
                            >
                                추가
                            </button>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                            {globalCurriculum.map((item, i) => (
                                <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded border">
                                    <span className="text-sm">{item}</span>
                                    <button 
                                        onClick={() => {
                                            if(confirm('삭제하시겠습니까?')) {
                                                handleCurriculumUpdate(globalCurriculum.filter(x => x !== item));
                                            }
                                        }}
                                        className="text-red-500 hover:bg-red-100 p-1 rounded"
                                    >
                                        <X className="w-3 h-3"/>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button onClick={()=>setShowCurrModal(false)} className="w-full py-2 bg-gray-200 rounded font-bold text-gray-600">닫기</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationTab;
