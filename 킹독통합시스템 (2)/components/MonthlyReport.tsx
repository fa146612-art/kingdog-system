

import React, { useMemo } from 'react';
import { Customer, KindergartenDailyRecord, MonthlyRecord } from '../types';
import { BarChart3, TrendingUp, Calendar, Download, Trophy, Dumbbell } from 'lucide-react';
import { getNowDate } from '../utils/helpers';

// Simple SVG Chart Components since we can't add recharts library
const SimpleLineChart = ({ data }: { data: { label: string, value: number }[] }) => {
    if (data.length < 2) return <div className="text-xs text-gray-400 text-center py-10">데이터가 충분하지 않습니다.</div>;
    
    const height = 200;
    const width = 500;
    const padding = 30;
    
    const maxVal = Math.max(...data.map(d => d.value)) * 1.1;
    const minVal = Math.min(...data.map(d => d.value)) * 0.9;
    
    const points = data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * (width - padding * 2);
        const y = height - padding - ((d.value - minVal) / (maxVal - minVal)) * (height - padding * 2);
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-white rounded-xl border border-gray-100 p-2">
            {/* Grid */}
            <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding} stroke="#e5e7eb" strokeWidth="1" />
            
            <polyline fill="none" stroke="#6366f1" strokeWidth="3" points={points} strokeLinecap="round" strokeLinejoin="round" />
            
            {data.map((d, i) => {
                const x = padding + (i / (data.length - 1)) * (width - padding * 2);
                const y = height - padding - ((d.value - minVal) / (maxVal - minVal)) * (height - padding * 2);
                return (
                    <g key={i} className="group">
                        <circle cx={x} cy={y} r="4" fill="#4f46e5" stroke="white" strokeWidth="2" className="transition-all group-hover:r-6" />
                        <text x={x} y={y - 15} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#374151" className="opacity-0 group-hover:opacity-100 transition-opacity">{d.value}kg</text>
                        <text x={x} y={height - 10} textAnchor="middle" fontSize="10" fill="#9ca3af">{d.label.slice(5)}</text>
                    </g>
                );
            })}
        </svg>
    );
};

const SimpleBarChart = ({ data }: { data: { label: string, value: number }[] }) => {
    if (data.length === 0) return <div className="text-xs text-gray-400 text-center py-10">데이터가 없습니다.</div>;
    
    return (
        <div className="flex items-end justify-between h-[200px] gap-2 pt-6 pb-2">
            {data.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                    <div className="text-[10px] font-bold text-indigo-600 mb-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-4">{d.value.toFixed(1)}</div>
                    <div 
                        className="w-full bg-indigo-100 rounded-t-lg relative group-hover:bg-indigo-200 transition-all duration-500 ease-out"
                        style={{ height: `${(d.value / 5) * 100}%` }}
                    >
                        <div className="absolute bottom-0 left-0 right-0 bg-indigo-500 h-1 opacity-20"></div>
                    </div>
                    <div className="text-[9px] text-gray-500 mt-2 font-medium truncate w-full text-center">{d.label}</div>
                </div>
            ))}
        </div>
    );
};

interface MonthlyReportProps {
    customer: Customer;
    records: KindergartenDailyRecord[]; // Data for this month
    monthlyRecord?: MonthlyRecord;
    selectedMonth: string;
}

const MonthlyReport = ({ customer, records, monthlyRecord, selectedMonth }: MonthlyReportProps) => {
    // 1. Weight Trend (Last 6 months ideally, but using weightHistory)
    const weightData = useMemo(() => {
        if (!customer.weightHistory || customer.weightHistory.length === 0) return [];
        // Sort by date
        return [...customer.weightHistory]
            .sort((a,b) => a.date.localeCompare(b.date))
            .slice(-10) // Last 10 records
            .map(w => ({ label: w.date, value: w.weight }));
    }, [customer.weightHistory]);

    // 2. Curriculum Averages
    const curriculumData = useMemo(() => {
        const stats: Record<string, { sum: number, count: number }> = {};
        records.forEach(r => {
            r.curriculum?.forEach(c => {
                if (!stats[c.name]) stats[c.name] = { sum: 0, count: 0 };
                stats[c.name].sum += c.score;
                stats[c.name].count += 1;
            });
        });
        return Object.entries(stats)
            .map(([name, val]) => ({
                label: name,
                value: val.sum / val.count
            }))
            .sort((a,b) => b.value - a.value); // Best first
    }, [records]);

    // 3. Best Activity
    const bestActivity = curriculumData.length > 0 ? curriculumData[0] : null;

    return (
        <div className="bg-white max-w-4xl mx-auto p-4 md:p-10 min-h-screen font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-end border-b-4 border-black pb-6 mb-10">
                <div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-[0.3em] mb-1">Monthly Report</div>
                    <h1 className="text-5xl font-black font-serif uppercase tracking-tighter text-gray-900">{selectedMonth}</h1>
                    <p className="text-xl font-bold text-indigo-600 mt-2">{customer.dogName} <span className="text-sm font-normal text-gray-400 text-base">({customer.breed})</span></p>
                </div>
                <div className="mt-4 md:mt-0 text-right">
                    <div className="inline-block bg-black text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-wider">KINGDOG PREMIUM</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                
                {/* Highlights */}
                <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-indigo-50 rounded-3xl p-6 flex flex-col justify-center items-center text-center border border-indigo-100">
                        <Calendar className="w-8 h-8 text-indigo-600 mb-2"/>
                        <div className="text-4xl font-black text-indigo-900">{records.length}일</div>
                        <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">출석 일수</div>
                    </div>
                    <div className="bg-orange-50 rounded-3xl p-6 flex flex-col justify-center items-center text-center border border-orange-100">
                        <Trophy className="w-8 h-8 text-orange-500 mb-2"/>
                        <div className="text-xl font-black text-orange-900 line-clamp-1">{bestActivity?.label || '-'}</div>
                        <div className="text-xs font-bold text-orange-400 uppercase tracking-wider">이달의 베스트 활동</div>
                    </div>
                    <div className="bg-green-50 rounded-3xl p-6 flex flex-col justify-center items-center text-center border border-green-100">
                        <Dumbbell className="w-8 h-8 text-green-600 mb-2"/>
                        <div className="text-4xl font-black text-green-900">{weightData[weightData.length-1]?.value || '-'}kg</div>
                        <div className="text-xs font-bold text-green-500 uppercase tracking-wider">현재 체중</div>
                    </div>
                </div>

                {/* Section 1: Weight */}
                <div>
                    <h3 className="text-lg font-black flex items-center mb-6 text-gray-800"><TrendingUp className="w-5 h-5 mr-2 text-blue-500"/> 체중 변화 그래프</h3>
                    <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
                        <SimpleLineChart data={weightData} />
                    </div>
                </div>

                {/* Section 2: Attendance / Note */}
                <div className="flex flex-col">
                    <h3 className="text-lg font-black flex items-center mb-6 text-gray-800"><Calendar className="w-5 h-5 mr-2 text-indigo-500"/> 종합 코멘트</h3>
                    <div className="bg-[#FFFDF5] border border-[#F3EFE0] p-8 rounded-3xl relative flex-1">
                        <div className="absolute -top-3 left-8 bg-[#EBE5D5] px-4 py-1 text-[10px] font-bold text-stone-600 rounded-full uppercase tracking-wider">Teacher's Note</div>
                        <div className="h-full flex items-center justify-center">
                            <p className="text-stone-700 leading-relaxed font-serif italic text-lg text-center whitespace-pre-wrap">
                                {monthlyRecord?.teacherComment || "등록된 월간 코멘트가 없습니다."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Section 3: Curriculum Achievement */}
                <div className="col-span-1 md:col-span-2">
                    <h3 className="text-lg font-black flex items-center mb-6 text-gray-800"><BarChart3 className="w-5 h-5 mr-2 text-purple-500"/> 교육 성취도 분석 (평균)</h3>
                    <div className="bg-gray-50 p-8 rounded-3xl border border-gray-100">
                        <SimpleBarChart data={curriculumData} />
                    </div>
                </div>
            </div>

            <div className="mt-16 text-center">
                <button 
                    onClick={() => window.print()}
                    className="bg-black text-white px-8 py-3 rounded-full font-bold text-sm inline-flex items-center justify-center gap-2 hover:bg-gray-800 transition shadow-lg"
                >
                    <Download className="w-4 h-4"/> 리포트 저장 / 인쇄
                </button>
            </div>
        </div>
    );
};

export default MonthlyReport;