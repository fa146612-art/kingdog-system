
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    PieChart, Calendar, TrendingUp, TrendingDown, DollarSign, 
    Award, BarChart3, List, Wallet, ChevronLeft, ChevronRight, Users, Trophy, RefreshCw, Info
} from 'lucide-react';
import { formatCurrency, normalizeDate, getLocalYMD, getNowDate } from '../utils/helpers';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, appId } from '../services/firebase';
import { Transaction, Customer } from '../types';

// --- Constants & Helper Types ---
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6', '#64748B'];

interface ChartData {
    label: string; // YYYY-MM
    totalRevenue: number; // 청구액 (Sales)
    totalIncome: number;  // 입금액 (Paid)
    totalExpense: number;
    netProfit: number; // Income - Expense (Cash Flow)
    details: { [category: string]: number }; // Revenue breakdown by category
}

interface ProcessedTransaction extends Transaction {
    billedAmount: number;
    paidAmount: number;
    isVirtual?: boolean;
}

interface AnalysisStats {
    totalIncome: number;
    totalRevenue: number;
    totalExpense: number;
    netProfit: number;
    categoryData: Record<string, number>;
    trendData: ChartData[];
    ranking: any[];
    totalUniqueCustomers: number;
}

// --- Trend Chart Component (Stacked Bar + Detailed Tooltip) ---
const TrendChart = ({ data, categories }: { data: ChartData[], categories: string[] }) => {
    // Data check
    const hasData = data.some(d => d.totalIncome > 0 || d.totalExpense > 0 || d.totalRevenue > 0);
    
    // Interaction State
    const [hoveredData, setHoveredData] = useState<ChartData | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Dimensions
    const height = 400;
    const width = 1000;
    const padding = { top: 60, bottom: 40, left: 60, right: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    if (!hasData) return (
        <div className="h-96 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <BarChart3 className="w-12 h-12 mb-3 opacity-20"/>
            <p>표시할 데이터가 없습니다.</p>
        </div>
    );

    // Scales
    const maxVal = Math.max(
        ...data.map(d => d.totalRevenue),
        ...data.map(d => d.totalIncome), 
        ...data.map(d => d.totalExpense)
    ) || 1000000;
    
    const domainMax = maxVal * 1.1;

    const slotWidth = chartWidth / data.length;
    // Main bar width (Revenue)
    const barWidth = Math.max(10, Math.min(60, slotWidth * 0.6)); 

    const getX = (idx: number) => padding.left + (idx * slotWidth) + (slotWidth / 2);
    const getY = (val: number) => padding.top + chartHeight - ((Math.max(0, val) / domainMax) * chartHeight);

    // Color Map for Consistency
    const colorMap: Record<string, string> = {};
    categories.forEach((cat, i) => {
        colorMap[cat] = COLORS[i % COLORS.length];
    });

    const handleMouseMove = (e: React.MouseEvent, d: ChartData) => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setTooltipPos({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
            setHoveredData(d);
        }
    };

    return (
        <div className="w-full overflow-x-auto bg-white rounded-xl shadow-sm border p-4 relative" ref={containerRef}>
            <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center shrink-0">
                    <BarChart3 className="w-5 h-5 mr-2 text-blue-600"/> 
                    기간별 매출 추세 분석 (청구액 기준)
                </h3>
                {/* Legend - Responsive */}
                <div className="flex flex-wrap gap-2 md:gap-4 text-xs font-bold text-gray-600 justify-start md:justify-end items-center">
                    <div className="flex flex-wrap items-center gap-2">
                        {categories.map(cat => (
                            <div key={cat} className="flex items-center">
                                <span className="w-2 h-2 mr-1 rounded-sm" style={{ backgroundColor: colorMap[cat] }}></span>
                                {cat}
                            </div>
                        ))}
                    </div>
                    <div className="hidden md:block h-4 w-px bg-gray-300 mx-2"></div>
                    <div className="flex items-center">
                        <span className="w-3 h-3 rounded-full bg-green-500 mr-1"></span>
                        입금액
                    </div>
                    <div className="flex items-center">
                        <span className="w-3 h-3 rounded-full border-2 border-red-500 bg-white mr-1"></span>
                        지출
                    </div>
                </div>
            </div>

            <div className="min-w-[800px] relative">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" style={{ overflow: 'visible' }}>
                    {/* Grid Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                        const y = padding.top + (chartHeight * t);
                        const val = domainMax * (1 - t);
                        return (
                            <g key={t}>
                                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#f3f4f6" strokeDasharray="4 4" />
                                <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af" fontWeight="bold">
                                    {val >= 10000 ? `${Math.round(val/10000)}만` : Math.round(val)}
                                </text>
                            </g>
                        );
                    })}

                    {/* X Axis Labels */}
                    {data.map((d, i) => {
                        const showLabel = data.length <= 12 || i % Math.ceil(data.length / 12) === 0;
                        return showLabel ? (
                            <text key={i} x={getX(i)} y={height - 10} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#6b7280">
                                {d.label}
                            </text>
                        ) : null;
                    })}

                    {/* Stacked Bars & Lines */}
                    {data.map((d, i) => {
                        // Stack Calculation
                        let accumulatedHeight = 0;
                        const sortedCats = Object.keys(d.details).sort((a,b) => (Number(d.details[b]) || 0) - (Number(d.details[a]) || 0)); // 큰 항목이 아래로

                        return (
                            <g 
                                key={`group-${i}`} 
                                className="group cursor-crosshair"
                                onMouseMove={(e) => handleMouseMove(e, d)}
                                onMouseLeave={() => setHoveredData(null)}
                            >
                                {/* Invisible Hit Area for better hover UX */}
                                <rect 
                                    x={getX(i) - slotWidth/2} 
                                    y={padding.top} 
                                    width={slotWidth} 
                                    height={chartHeight} 
                                    fill="transparent" 
                                />

                                {/* Stacked Revenue Bars */}
                                {sortedCats.map(cat => {
                                    const val = d.details[cat] || 0;
                                    if (val <= 0) return null;
                                    
                                    const h = (val / domainMax) * chartHeight;
                                    const y = padding.top + chartHeight - accumulatedHeight - h;
                                    
                                    const rect = (
                                        <rect
                                            key={cat}
                                            x={getX(i) - barWidth/2}
                                            y={y}
                                            width={barWidth}
                                            height={h}
                                            fill={colorMap[cat]}
                                            stroke="white"
                                            strokeWidth="0.5"
                                            className="transition-opacity group-hover:opacity-90"
                                        />
                                    );
                                    accumulatedHeight += h;
                                    return rect;
                                })}

                                {/* Income Point (Green Dot) */}
                                <circle cx={getX(i)} cy={getY(d.totalIncome)} r={4} fill="#10B981" stroke="white" strokeWidth="2" className="drop-shadow-sm" />
                            </g>
                        );
                    })}

                    {/* Line: Total Income (Green) */}
                    <polyline
                        points={data.map((d, i) => `${getX(i)},${getY(d.totalIncome)}`).join(' ')}
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.8}
                        pointerEvents="none"
                    />

                    {/* Line: Total Expense (Red Dashed) */}
                    <polyline
                        points={data.map((d, i) => `${getX(i)},${getY(d.totalExpense)}`).join(' ')}
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        pointerEvents="none"
                    />
                    {data.map((d, i) => (
                        <circle key={`exp-${i}`} cx={getX(i)} cy={getY(d.totalExpense)} r={3} fill="#EF4444" stroke="white" strokeWidth="1" pointerEvents="none"/>
                    ))}
                </svg>

                {/* --- Enhanced Tooltip --- */}
                {hoveredData && (
                    <div 
                        className="absolute z-50 bg-gray-900/95 text-white p-3 rounded-xl shadow-2xl pointer-events-none backdrop-blur-sm border border-gray-700 min-w-[200px]"
                        style={{ 
                            top: tooltipPos.y - 10, // Slightly offset
                            left: tooltipPos.x + 20, 
                            transform: tooltipPos.x > width * 0.7 ? 'translateX(-100%)' : 'none' // Prevent overflow on right side
                        }}
                    >
                        <div className="font-bold border-b border-gray-700 pb-2 mb-2 flex justify-between items-center">
                            <span>📅 {hoveredData.label}</span>
                            <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-400">월간요약</span>
                        </div>
                        
                        {/* Revenue Breakdown */}
                        <div className="mb-3 space-y-1">
                            {Object.entries(hoveredData.details)
                                .sort((a,b) => (Number(b[1]) || 0) - (Number(a[1]) || 0)) // Sort desc by value
                                .map(([cat, amount]) => {
                                    const val = Number(amount) || 0;
                                    const percent = hoveredData.totalRevenue > 0 ? (val / hoveredData.totalRevenue) * 100 : 0;
                                    return (
                                        <div key={cat} className="flex justify-between items-center text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorMap[cat] }}></div>
                                                <span className="text-gray-300">{cat}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-gray-500 font-mono text-[10px] w-8 text-right">{Math.round(percent)}%</span>
                                                <span className="font-bold font-mono">{formatCurrency(val)}</span>
                                            </div>
                                        </div>
                                    );
                                })
                            }
                        </div>

                        {/* Summary Footer */}
                        <div className="border-t border-gray-700 pt-2 space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-blue-400 font-bold">총 청구액(매출)</span>
                                <span className="font-black font-mono text-blue-400">{formatCurrency(hoveredData.totalRevenue)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-green-400 font-bold">실 입금액</span>
                                <span className="font-black font-mono text-green-400">{formatCurrency(hoveredData.totalIncome)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-red-400 font-bold">총 지출</span>
                                <span className="font-black font-mono text-red-400">{formatCurrency(hoveredData.totalExpense)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm mt-2 pt-2 border-t border-gray-700">
                                <span className="text-yellow-400 font-black">순수익 (Cash)</span>
                                <span className={`font-black font-mono ${hoveredData.netProfit >= 0 ? 'text-yellow-400' : 'text-red-500'}`}>
                                    {formatCurrency(hoveredData.netProfit)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// NOTE: AnalysisTab ignores the 'transactions' prop to fetch its own complete dataset.
const AnalysisTab = ({ transactions: propTransactions, customers }: { transactions: any[], customers: Customer[] }) => {
    // State for View Mode
    const [viewMode, setViewMode] = useState<'period' | 'year'>('period');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    
    // State for Period Mode
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return getLocalYMD(d);
    });
    const [endDate, setEndDate] = useState(getNowDate());

    // Data Fetching State
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 1. Fetch ALL relevant data (Since 2022 to cover reasonable history)
    useEffect(() => {
        setIsLoading(true);
        // Fetch all transactions since 2022 to support switching modes without refetch
        const q = query(
            collection(db, 'kingdog', appId, 'transactions'),
            where('startDate', '>=', '2022-01-01')
        );
        
        const unsubscribe = onSnapshot(q, (snap) => {
            const fetched = snap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction));
            setAllTransactions(fetched);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 2. Data Processing & Filtering (Hybrid Logic)
    const { filteredTransactions, monthsInPeriod } = useMemo<{ filteredTransactions: ProcessedTransaction[], monthsInPeriod: string[] }>(() => {
        // A. Generate list of months for the x-axis
        const months: string[] = [];
        if (viewMode === 'year') {
            for(let i=1; i<=12; i++) months.push(`${selectedYear}-${String(i).padStart(2,'0')}`);
        } else {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const curr = new Date(start.getFullYear(), start.getMonth(), 1);
            while (curr <= end) {
                const y = curr.getFullYear();
                const m = String(curr.getMonth() + 1).padStart(2, '0');
                months.push(`${y}-${m}`);
                curr.setMonth(curr.getMonth() + 1);
            }
        }

        // B. Process Transactions (Hybrid Logic: Hotel Daily Splitting vs Others Immediate)
        // Explicit typing to avoid implicit 'any' issues
        const processed: ProcessedTransaction[] = [];
        
        allTransactions.forEach((t: Transaction) => {
            // Safer property access
            const tPrice = Number(t.price ?? 0);
            const tExtra = Number(t.extraDogCount ?? 0);
            const tQty = Number(t.quantity ?? 1);
            const tDiscountValue = Number(t.discountValue ?? 0);
            const tPaidAmount = Number(t.paidAmount ?? 0);

            // Logic 1: Hotel Splitting (Billed Amount)
            if (t.category === '호텔' && t.type === '수입' && t.startDate && t.endDate && t.startDate !== t.endDate) {
                const startMs = new Date(t.startDate).getTime();
                const endMs = new Date(t.endDate).getTime();
                const diffTime = Math.abs(endMs - startMs);
                const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                
                // Calculate Total Billed Amount
                const unitPrice = tPrice + (tExtra * 10000);
                const totalBilled = (unitPrice * tQty) - tDiscountValue; 
                
                const dailyBilled = totalBilled / nights;
                const dailyPaid = tPaidAmount / nights; // Only relevant for cash flow analysis

                for (let i = 0; i < nights; i++) {
                    const current = new Date(startMs);
                    current.setDate(current.getDate() + i);
                    processed.push({
                        ...t,
                        isVirtual: true,
                        startDate: getLocalYMD(current),
                        billedAmount: Math.round(dailyBilled),
                        paidAmount: Math.round(dailyPaid)
                    });
                }
            } 
            // Logic 2: All Other Income (Immediate Recognition on Start Date)
            else if (t.type === '수입') {
                const unitPrice = tPrice + (tExtra * 10000);
                const base = unitPrice * tQty;
                
                let discount = 0;
                
                if (t.discountType === 'percent') {
                    discount = base * (tDiscountValue / 100);
                } else {
                    discount = tDiscountValue;
                }
                
                const billed = base - discount;
                
                processed.push({ 
                    ...t, 
                    billedAmount: billed, 
                    paidAmount: tPaidAmount 
                });
            }
            // Logic 3: Expenses (Cash Basis)
            else if (t.type === '지출') {
                processed.push({ 
                    ...t, 
                    billedAmount: 0, 
                    paidAmount: tPaidAmount 
                });
            }
        });

        // C. Filter by Date
        const filtered = processed.filter(t => {
            const d = normalizeDate(t.startDate);
            if (viewMode === 'year') {
                return d.startsWith(String(selectedYear));
            } else {
                return d >= startDate && d <= endDate;
            }
        });

        return { filteredTransactions: filtered, monthsInPeriod: months };
    }, [allTransactions, viewMode, startDate, endDate, selectedYear]);


    // 3. Statistics Calculation
    const stats: AnalysisStats = useMemo(() => {
        // A. Totals
        const totalRevenue = filteredTransactions.filter(t => t.type === '수입').reduce((sum: number, t) => sum + Number(t.billedAmount || 0), 0);
        const totalIncome = filteredTransactions.filter(t => t.type === '수입').reduce((sum: number, t) => sum + Number(t.paidAmount || 0), 0);
        const totalExpense = filteredTransactions.filter(t => t.type === '지출').reduce((sum: number, t) => sum + Number(t.paidAmount || 0), 0);
        const netProfit = totalIncome - totalExpense; // Cash Flow Profit

        // B. Category Breakdown (Using Billed Amount / Sales)
        const categoryData: { [key: string]: number } = {};
        filteredTransactions.filter(t => t.type === '수입').forEach(t => {
            const cat = t.category || '기타';
            categoryData[cat] = (categoryData[cat] || 0) + Number(t.billedAmount || 0);
        });

        // C. Monthly/Period Data (Bar Chart)
        const trendMap: { [key: string]: ChartData } = {};
        monthsInPeriod.forEach(m => {
            trendMap[m] = { label: m, totalRevenue: 0, totalIncome: 0, totalExpense: 0, netProfit: 0, details: {} };
        });

        filteredTransactions.forEach(t => {
            const monthKey = normalizeDate(t.startDate).substring(0, 7); // YYYY-MM
            if (trendMap[monthKey]) {
                const paid = Number(t.paidAmount || 0);
                const billed = Number(t.billedAmount || 0);

                if (t.type === '수입') {
                    trendMap[monthKey].totalRevenue += billed;
                    trendMap[monthKey].totalIncome += paid;
                    const cat = t.category || '기타';
                    trendMap[monthKey].details[cat] = (trendMap[monthKey].details[cat] || 0) + billed;
                } else if (t.type === '지출') {
                    trendMap[monthKey].totalExpense += paid;
                }
            }
        });

        Object.values(trendMap).forEach(d => d.netProfit = d.totalIncome - d.totalExpense);
        const trendData = Object.values(trendMap).sort((a,b) => a.label.localeCompare(b.label));

        // D. Top 100 Customers (Sales Basis)
        const customerStats: Record<string, { id?: string, name: string, dog: string, count: number, totalBilled: number, totalPaid: number }> = {};
        filteredTransactions.filter(t => t.type === '수입').forEach(t => {
            // Use customerId if available, fallback to composite key
            const key = t.customerId || (t.dogName && t.contact ? `${t.dogName}_${t.contact}` : `${t.dogName}_${t.customerName}`);
            if (!key) return;

            let entry = customerStats[key];
            if (!entry) {
                entry = { 
                    id: t.customerId,
                    name: t.customerName || '미등록', 
                    dog: t.dogName || '미등록', 
                    count: 0, 
                    totalBilled: 0,
                    totalPaid: 0
                };
                customerStats[key] = entry;
            }
            // For virtual hotel transactions, count is fractional, so maybe just count 1 per unique transaction ID? 
            // Simplified: increment count for non-virtual, or fractional for virtual.
            if (!t.isVirtual) entry.count += 1;
            
            entry.totalBilled += Number(t.billedAmount || 0);
            entry.totalPaid += Number(t.paidAmount || 0);
        });

        const ranking = Object.values(customerStats)
            .sort((a, b) => b.totalBilled - a.totalBilled)
            .slice(0, 100)
            .map(stat => {
                // Attach Current Balance from Customers Collection
                let balance = 0;
                if (stat.id) {
                    const c = customers.find(cust => cust.id === stat.id);
                    if (c) balance = c.balance || 0;
                } else {
                    // Fallback search
                    const c = customers.find(cust => cust.dogName === stat.dog && cust.ownerName === stat.name);
                    if (c) balance = c.balance || 0;
                }
                return { ...stat, currentBalance: balance };
            });

        return { 
            totalIncome, totalRevenue, totalExpense, netProfit, 
            categoryData, trendData, ranking, 
            totalUniqueCustomers: Object.keys(customerStats).length 
        };
    }, [filteredTransactions, monthsInPeriod, customers]);

    // Pie Chart Slices
    const pieSlices = useMemo(() => {
        // Explicitly cast and process data to ensure types
        const rawData = (stats.categoryData || {}) as Record<string, number>;
        
        // Fix: Explicitly type the entries array to ensure 'amount' is treated as number
        const entries: [string, number][] = Object.entries(rawData).map(([k, v]) => [k, Number(v) || 0]);
        
        // Ensure total is a number
        const total = entries.reduce((acc, [, val]) => acc + val, 0);
        
        if (total === 0) return [];
        
        let currentAngle = 0;
        return entries
            .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0)) // Explicit sort to prevent arithmetic error
            .map(([cat, amount], i) => {
                // explicit typing for amount just in case, though inferred from entries should work
                const val = Number(amount) || 0;
                const percentage: number = total > 0 ? val / total : 0;
                const angle: number = percentage * 360;
                
                const startAngle = currentAngle;
                
                const x1 = 50 + 40 * Math.cos(Math.PI * (startAngle - 90) / 180);
                const y1 = 50 + 40 * Math.sin(Math.PI * (startAngle - 90) / 180);
                
                const endAngle = startAngle + angle;
                const x2 = 50 + 40 * Math.cos(Math.PI * (endAngle - 90) / 180);
                const y2 = 50 + 40 * Math.sin(Math.PI * (endAngle - 90) / 180);
                
                const largeArc = angle > 180 ? 1 : 0;
                const pathData = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
                
                currentAngle += angle;
                return { path: pathData, color: COLORS[i % COLORS.length], cat, amount: val, percentage };
            });
    }, [stats.categoryData]);

    return (
        <div className="flex flex-col h-full bg-gray-50 overflow-y-auto custom-scrollbar relative">
            
            {isLoading && (
                <div className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center">
                    <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mb-4"/>
                    <p className="font-bold text-gray-600">전체 매출 데이터를 분석 중입니다...</p>
                </div>
            )}

            {/* Header Section */}
            <div className="bg-white border-b sticky top-0 z-20 shadow-sm px-6 py-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-black text-gray-800 flex items-center">
                            <PieChart className="mr-2 text-indigo-600"/> 경영 분석
                        </h2>
                        <div className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm border border-indigo-100 flex items-center">
                            <Calendar className="w-4 h-4 mr-2 opacity-70"/>
                            {viewMode === 'year' 
                                ? `${selectedYear}년`
                                : `${startDate} ~ ${endDate}`
                            }
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-lg">
                        <div className="flex gap-1">
                            <button onClick={() => setViewMode('period')} className={`px-4 py-2 rounded-md text-sm font-bold transition ${viewMode === 'period' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}>기간별</button>
                            <button onClick={() => setViewMode('year')} className={`px-4 py-2 rounded-md text-sm font-bold transition ${viewMode === 'year' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}>연도별</button>
                        </div>
                        <div className="w-px h-6 bg-gray-300 mx-1"></div>
                        
                        {viewMode === 'year' ? (
                            <div className="flex items-center gap-2 px-2">
                                <button onClick={() => setSelectedYear(y => y - 1)} className="p-1 hover:bg-gray-200 rounded"><ChevronLeft className="w-4 h-4"/></button>
                                <span className="font-black text-lg text-gray-800">{selectedYear}년</span>
                                <button onClick={() => setSelectedYear(y => y + 1)} className="p-1 hover:bg-gray-200 rounded"><ChevronRight className="w-4 h-4"/></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                {[1, 3, 6].map(m => (
                                    <button 
                                        key={m}
                                        onClick={() => {
                                            const d = new Date(); d.setMonth(d.getMonth() - m);
                                            setStartDate(getLocalYMD(d)); setEndDate(getNowDate());
                                        }}
                                        className="px-2 py-1 text-xs font-bold text-gray-600 hover:bg-white hover:shadow-sm rounded transition"
                                    >
                                        {m}개월
                                    </button>
                                ))}
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white border rounded px-2 py-1 text-xs outline-none"/>
                                <span className="text-gray-400">~</span>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white border rounded px-2 py-1 text-xs outline-none"/>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Info Box: Hybrid Logic Explanation */}
            <div className="px-6 pt-6">
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg shadow-sm flex items-start">
                    <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5 shrink-0"/>
                    <div className="text-sm text-blue-900">
                        <p className="font-bold mb-1">📊 매출 분석 기준 안내 (Hybrid Revenue)</p>
                        <p className="leading-relaxed opacity-90">
                            모든 그래프와 통계는 <span className="font-black underline">청구액(매출) 기준</span>으로 표시됩니다.
                            <br/>
                            • <b>호텔:</b> 숙박 기간에 따라 매출이 일할 계산되어 분배됩니다. (예: 3박 4일 → 3일에 나눠서 집계)
                            <br/>
                            • <b>유치원/미용 등:</b> 예약(거래) 시작일에 전액 매출로 잡힙니다.
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="p-6 max-w-[1600px] mx-auto w-full space-y-6">
                
                {/* 1. Key Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-50 relative overflow-hidden group">
                        <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><DollarSign className="w-24 h-24 text-blue-600"/></div>
                        <div className="flex items-center mb-2 text-blue-600 font-bold text-sm"><TrendingUp className="w-4 h-4 mr-1"/> 총 매출 (청구액)</div>
                        <div className="text-3xl font-black text-gray-900">{formatCurrency(stats.totalRevenue)}<span className="text-lg font-medium text-gray-400 ml-1">원</span></div>
                        <div className="text-xs text-gray-400 mt-1">실입금: {formatCurrency(stats.totalIncome)}원</div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-50 relative overflow-hidden group">
                        <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Wallet className="w-24 h-24 text-red-600"/></div>
                        <div className="flex items-center mb-2 text-red-500 font-bold text-sm"><TrendingDown className="w-4 h-4 mr-1"/> 총 지출 (Expense)</div>
                        <div className="text-3xl font-black text-gray-900">{formatCurrency(stats.totalExpense)}<span className="text-lg font-medium text-gray-400 ml-1">원</span></div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-50 relative overflow-hidden group">
                        <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Award className="w-24 h-24 text-green-600"/></div>
                        <div className="flex items-center mb-2 text-green-600 font-bold text-sm"><Award className="w-4 h-4 mr-1"/> 순수익 (Cash Flow)</div>
                        <div className={`text-3xl font-black ${stats.netProfit >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                            {formatCurrency(stats.netProfit)}<span className="text-lg font-medium text-gray-400 ml-1">원</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">입금액 - 지출액 기준</div>
                    </div>

                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-purple-50 relative overflow-hidden group">
                        <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Users className="w-24 h-24 text-purple-600"/></div>
                        <div className="flex items-center mb-2 text-purple-600 font-bold text-sm"><Users className="w-4 h-4 mr-1"/> 이용 고객수 (Visitors)</div>
                        <div className="text-3xl font-black text-gray-900">{stats.totalUniqueCustomers}<span className="text-lg font-medium text-gray-400 ml-1">명</span></div>
                    </div>
                </div>

                {/* 2. Charts Section */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Left: Pie Chart */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border flex flex-col min-h-[400px]">
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center"><PieChart className="w-5 h-5 mr-2 text-purple-500"/> 카테고리별 매출 비중 (청구액 기준)</h3>
                        {stats.totalRevenue > 0 ? (
                            <div className="flex flex-col md:flex-row items-center justify-center gap-8 flex-1">
                                <div className="relative w-56 h-56 shrink-0">
                                    <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                                        {pieSlices.map((slice, i) => (
                                            <path key={i} d={slice.path} fill={slice.color} stroke="white" strokeWidth="2"/>
                                        ))}
                                        <circle cx="50" cy="50" r="25" fill="white"/>
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center font-bold text-gray-400 text-xs">Total</div>
                                </div>
                                <div className="space-y-3 w-full max-w-xs">
                                    {pieSlices.map((slice, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs border-b pb-1 last:border-0">
                                            <div className="flex items-center">
                                                <span className="w-3 h-3 rounded-sm mr-2" style={{ backgroundColor: slice.color }}></span>
                                                <span className="font-bold text-gray-700">{slice.cat}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-mono text-gray-500">{Math.round(slice.percentage * 100)}%</span>
                                                <span className="font-bold text-gray-900 w-20 text-right">{formatCurrency(slice.amount)}원</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400">데이터가 없습니다.</div>
                        )}
                    </div>

                    {/* Right: Ranking Table */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border flex flex-col">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center justify-between">
                            <div className="flex items-center"><Trophy className="w-5 h-5 mr-2 text-yellow-500"/> 매출 상위 100위 (VIP)</div>
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">기간내 청구액 순</span>
                        </h3>
                        {/* Fixed height container for approx 10 rows (approx 40px each + headers/padding) */}
                        <div className="overflow-y-auto custom-scrollbar border rounded-xl h-[400px]">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-bold text-xs sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-3 text-center w-12">순위</th>
                                        <th className="p-3">고객명</th>
                                        <th className="p-3 text-right text-blue-700">매출(청구)</th>
                                        <th className="p-3 text-right text-gray-600">실결제</th>
                                        <th className="p-3 text-right">현재잔고</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-xs">
                                    {stats.ranking.map((row, i) => (
                                        <tr key={i} className={`hover:bg-indigo-50/50 ${i < 3 ? 'bg-yellow-50/30' : ''}`}>
                                            <td className="p-3 text-center font-bold text-gray-400">
                                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                                            </td>
                                            <td className="p-3 font-medium text-gray-800">
                                                {row.name} <span className="text-gray-400">({row.dog})</span>
                                                <div className="text-[9px] text-gray-400">{row.count > 0 ? `${row.count}회 이용` : '기간 내 이용'}</div>
                                            </td>
                                            <td className="p-3 text-right font-black text-blue-600">{formatCurrency(row.totalBilled)}</td>
                                            <td className="p-3 text-right font-medium text-gray-500">{formatCurrency(row.totalPaid)}</td>
                                            <td className={`p-3 text-right font-bold ${row.currentBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {formatCurrency(row.currentBalance)}
                                            </td>
                                        </tr>
                                    ))}
                                    {stats.ranking.length === 0 && (
                                        <tr><td colSpan={5} className="p-8 text-center text-gray-400">데이터가 없습니다.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* 3. Trend Chart (Full Width) */}
                <TrendChart data={stats.trendData} categories={Object.keys(stats.categoryData)} />

                {/* 4. Bottom Data Table */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 font-bold text-gray-700 flex items-center">
                        <List className="w-4 h-4 mr-2"/> 월별 상세 데이터 (집계표)
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left whitespace-nowrap">
                            <thead className="bg-gray-100 text-gray-600 font-bold">
                                <tr>
                                    <th className="p-3 border-r">기간</th>
                                    <th className="p-3 border-r text-right text-gray-900 bg-gray-50">매출액 (청구)</th>
                                    <th className="p-3 border-r text-right text-blue-700 bg-blue-50">입금액 (실결제)</th>
                                    <th className="p-3 border-r text-right text-orange-600">미수발생 (청구-입금)</th>
                                    <th className="p-3 border-r text-right text-red-600 bg-red-50">총 지출</th>
                                    <th className="p-3 border-r text-right text-emerald-700 bg-emerald-50">순수익 (입금-지출)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {stats.trendData.map(d => (
                                    <tr key={d.label} className="hover:bg-gray-50">
                                        <td className="p-3 border-r font-bold text-gray-700">{d.label}</td>
                                        <td className="p-3 border-r text-right font-black text-gray-900 bg-gray-50/50">{formatCurrency(d.totalRevenue)}</td>
                                        <td className="p-3 border-r text-right font-bold text-blue-700 bg-blue-50/30">{formatCurrency(d.totalIncome)}</td>
                                        <td className="p-3 border-r text-right font-medium text-orange-600">{formatCurrency(d.totalRevenue - d.totalIncome)}</td>
                                        <td className="p-3 border-r text-right font-bold text-red-600 bg-red-50/30">{formatCurrency(d.totalExpense)}</td>
                                        <td className="p-3 border-r text-right font-black text-emerald-700 bg-emerald-50/30">{formatCurrency(d.netProfit)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100 font-black text-gray-800 border-t-2 border-gray-200">
                                <tr>
                                    <td className="p-3 border-r">합계</td>
                                    <td className="p-3 border-r text-right text-gray-900">{formatCurrency(stats.totalRevenue)}</td>
                                    <td className="p-3 border-r text-right text-blue-800">{formatCurrency(stats.totalIncome)}</td>
                                    <td className="p-3 border-r text-right text-orange-700">{formatCurrency(stats.totalRevenue - stats.totalIncome)}</td>
                                    <td className="p-3 border-r text-right text-red-700">{formatCurrency(stats.totalExpense)}</td>
                                    <td className="p-3 border-r text-right text-emerald-800">{formatCurrency(stats.netProfit)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AnalysisTab;