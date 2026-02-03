import React, { useState, useMemo } from 'react';
import { ClipboardList, Check, X, Send, Heart, Smile, AlertCircle } from 'lucide-react';
import { getNowDate, normalizeDate } from '../utils/helpers';
import { Transaction, DailyReport } from '../types';

const DailyReportTab = ({ transactions, customers }: { transactions: Transaction[], customers: any[] }) => {
    const [reports, setReports] = useState<Record<string, Partial<DailyReport>>>({});

    const activeDogs = useMemo(() => {
        const today = getNowDate();
        return transactions.filter(t => 
            t.isRunning && 
            ['유치원', '호텔', '놀이방'].includes(t.category) &&
            normalizeDate(t.startDate) <= today &&
            normalizeDate(t.endDate) >= today
        );
    }, [transactions]);

    const updateReport = (dogId: string, field: keyof DailyReport, value: any) => {
        setReports(prev => ({
            ...prev,
            [dogId]: { ...prev[dogId], [field]: value }
        }));
    };

    const copyToText = (t: Transaction) => {
        const r = reports[t.id] || {};
        const text = `🐾 ${t.dogName}의 오늘 소식입니다!\n\n📅 날짜: ${getNowDate()}\n🍴 식사: ${r.meal ? '완료' : '건너뜀'}\n💩 배변: ${r.poo ? '완료' : '안함'}\n🩺 상태: ${r.condition === 'good' ? '최고!' : r.condition === 'caution' ? '관찰필요' : '보통'}\n📝 내용: ${r.note || '즐겁게 잘 지내고 있습니다.'}\n\n오늘도 킹독을 믿고 맡겨주셔서 감사합니다! ❤️`;
        
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('알림장 내용이 복사되었습니다. 카톡 등에 붙여넣기 하세요!');
    };

    return (
        <div className="h-full flex flex-col bg-gray-50">
            <div className="p-4 bg-white border-b flex justify-between items-center shadow-sm">
                <h2 className="text-xl font-black text-indigo-900 flex items-center"><ClipboardList className="mr-2"/> 오늘의 알림장</h2>
                <span className="text-xs font-bold text-gray-400">총 {activeDogs.length}마리 입실 중</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {activeDogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                        <Smile className="w-16 h-16 mb-4"/>
                        <p className="font-bold">오늘은 등원한 강아지가 없습니다.</p>
                    </div>
                ) : (
                    activeDogs.map(t => {
                        const r = reports[t.id] || { meal: true, poo: true, condition: 'good', note: '' };
                        return (
                            <div key={t.id} className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-50 grid grid-cols-1 md:grid-cols-[200px_1fr_200px] gap-6 items-center">
                                <div>
                                    <div className="text-xs font-bold text-indigo-500 mb-1">{t.category}</div>
                                    <div className="text-xl font-black text-gray-900">{t.dogName}</div>
                                    <div className="text-xs text-gray-400">{t.customerName} 보호자님</div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400">식사</label>
                                        <div className="flex gap-2">
                                            <button onClick={() => updateReport(t.id, 'meal', true)} className={`flex-1 p-2 rounded-lg border transition ${r.meal ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white text-gray-400'}`}><Check className="w-4 h-4 mx-auto"/></button>
                                            <button onClick={() => updateReport(t.id, 'meal', false)} className={`flex-1 p-2 rounded-lg border transition ${r.meal === false ? 'bg-red-500 border-red-500 text-white' : 'bg-white text-gray-400'}`}><X className="w-4 h-4 mx-auto"/></button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400">배변</label>
                                        <div className="flex gap-2">
                                            <button onClick={() => updateReport(t.id, 'poo', true)} className={`flex-1 p-2 rounded-lg border transition ${r.poo ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white text-gray-400'}`}><Check className="w-4 h-4 mx-auto"/></button>
                                            <button onClick={() => updateReport(t.id, 'poo', false)} className={`flex-1 p-2 rounded-lg border transition ${r.poo === false ? 'bg-red-500 border-red-500 text-white' : 'bg-white text-gray-400'}`}><X className="w-4 h-4 mx-auto"/></button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400">컨디션</label>
                                        <div className="flex gap-1">
                                            <button onClick={() => updateReport(t.id, 'condition', 'good')} className={`flex-1 p-2 rounded-lg border ${r.condition === 'good' ? 'bg-green-500 border-green-500 text-white' : 'bg-white'}`}><Heart className="w-3 h-3 mx-auto"/></button>
                                            <button onClick={() => updateReport(t.id, 'condition', 'normal')} className={`flex-1 p-2 rounded-lg border ${r.condition === 'normal' ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white'}`}><Smile className="w-3 h-3 mx-auto"/></button>
                                            <button onClick={() => updateReport(t.id, 'condition', 'caution')} className={`flex-1 p-2 rounded-lg border ${r.condition === 'caution' ? 'bg-red-500 border-red-500 text-white' : 'bg-white'}`}><AlertCircle className="w-3 h-3 mx-auto"/></button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2 items-center">
                                    <input type="text" placeholder="메모를 입력하세요..." value={r.note || ''} onChange={e => updateReport(t.id, 'note', e.target.value)} className="flex-1 p-2 bg-gray-50 border-none rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"/>
                                    <button onClick={() => copyToText(t)} className="bg-indigo-700 text-white p-2.5 rounded-lg hover:bg-indigo-800 shadow-md transition transform active:scale-95"><Send className="w-4 h-4"/></button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default DailyReportTab;