
import React, { useState, useMemo, useEffect } from 'react';
import { Scale, Search, TrendingDown, TrendingUp, X, Calendar, ClipboardList, Copy, MousePointer2, Check, Loader2, RefreshCw } from 'lucide-react';
import { formatCurrency, normalizeDate, getNowDate, copyToClipboardFallback, getLocalYMD } from '../utils/helpers';
import { Transaction, Customer } from '../types';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, appId } from '../services/firebase';

// Note: `transactions` prop is mostly unused for main view to optimize performance, 
// but kept for interface compatibility. We use `customers` prop which has the cached `balance`.
const BalanceTab = ({ transactions: propTransactions, customers, dateRange, setDateRange }: { transactions: Transaction[], customers: Customer[], dateRange: {start: string, end: string}, setDateRange: (range: {start: string, end: string}) => void }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [exportRange, setExportRange] = useState({ start: '', end: getNowDate() });
    
    // Detail View State
    const [historyData, setHistoryData] = useState<Transaction[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Mobile View State (New for Phase 3)
    const [mobileTab, setMobileTab] = useState<'receivable' | 'credit'>('receivable');

    // 1. Data Source: Active Customers (Non-zero balance) from cached `customers` prop
    // This is instant, no fetching required.
    const balanceData = useMemo(() => {
        // Filter out customers with 0 balance or undefined balance
        const active = customers.filter(c => c.balance !== undefined && Math.round(c.balance) !== 0);
        
        // Search Filter
        const filtered = active.filter(c => 
            (c.dogName && c.dogName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (c.ownerName && c.ownerName.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        // Sort: Debt (Receivable) first, then Credit
        // Receivable: balance < 0 (sorted by magnitude desc)
        const receivable = filtered
            .filter(c => (c.balance || 0) < 0)
            .sort((a, b) => (a.balance || 0) - (b.balance || 0)); // Most negative first

        // Credits: balance > 0 (sorted by magnitude desc)
        const credits = filtered
            .filter(c => (c.balance || 0) > 0)
            .sort((a, b) => (b.balance || 0) - (a.balance || 0)); // Most positive first

        const totalReceivable = active.filter(c => (c.balance || 0) < 0).reduce((sum, c) => sum + (c.balance || 0), 0);
        const totalCredits = active.filter(c => (c.balance || 0) > 0).reduce((sum, c) => sum + (c.balance || 0), 0);

        return { receivable, credits, totalReceivable, totalCredits };
    }, [customers, searchTerm]);

    // 2. Fetch History on Detail Open
    useEffect(() => {
        if (!selectedCustomer) {
            setHistoryData([]);
            return;
        }

        const fetchHistory = async () => {
            setIsLoadingHistory(true);
            try {
                let q;
                const collectionRef = collection(db, 'kingdog', appId, 'transactions');

                // Improved Query Strategy:
                // 1. If phone exists, query by 'contact' (Most accurate)
                // 2. If no phone, fallback to 'dogName'
                
                if (selectedCustomer.phone && selectedCustomer.phone.length > 5) {
                    q = query(
                        collectionRef,
                        where('type', '==', '수입'),
                        where('contact', '==', selectedCustomer.phone)
                        // Note: orderBy might require composite index. We sort in memory to avoid index errors.
                    );
                } else {
                    q = query(
                        collectionRef,
                        where('type', '==', '수입'),
                        where('dogName', '==', selectedCustomer.dogName)
                    );
                }

                const snapshot = await getDocs(q);
                let raw = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Transaction));
                
                // In-memory filter for double safety (especially if queried by dogName)
                if (!selectedCustomer.phone || selectedCustomer.phone.length <= 5) {
                     raw = raw.filter(t => t.customerName === selectedCustomer.ownerName);
                }

                // In-memory Sort (Newest last for running balance calculation)
                raw.sort((a, b) => {
                    const dateA = normalizeDate(a.startDate);
                    const dateB = normalizeDate(b.startDate);
                    return dateA.localeCompare(dateB) || a.startTime.localeCompare(b.startTime);
                });
                
                setHistoryData(raw);
            } catch (e) {
                console.error("History fetch error:", e);
                setHistoryData([]);
            } finally {
                setIsLoadingHistory(false);
            }
        };

        fetchHistory();
    }, [selectedCustomer]);

    // 3. Calculation Helper
    const calculateRowTotals = (t: Transaction) => {
        const unitPrice = (t.price || 0) + ((t.extraDogCount || 0) * 10000);
        const base = unitPrice * (t.quantity || 1);
        let discount = 0;
        if (t.discountType === 'percent') discount = base * ((t.discountValue || 0) / 100);
        else discount = t.discountValue || 0;
        
        const finalBilled = base - discount; // 청구 금액
        const paid = t.paidAmount || 0;      // 실결제 금액
        
        return { finalBilled, paid };
    };

    // 4. Copy Text Function
    const copyToKakao = () => {
        if (!selectedCustomer) return;
        
        const filtered = historyData.filter(t => {
            if (exportRange.start && normalizeDate(t.startDate) < exportRange.start) return false;
            if (exportRange.end && normalizeDate(t.startDate) > exportRange.end) return false;
            return true;
        });

        if (filtered.length === 0) {
            alert("선택한 기간의 거래 내역이 없습니다.");
            return;
        }

        const header = `[킹독] ${selectedCustomer.dogName}(${selectedCustomer.ownerName}님) 거래내역\n`;
        const subHeader = `날짜             항목      청구액     결제액     잔액\n` + `-`.repeat(50) + `\n`;
        
        let runningTotal = 0;
        let body = ``;
        
        // Calculate previous balance (Before filter start)
        const preFilterData = historyData.filter(t => exportRange.start && normalizeDate(t.startDate) < exportRange.start);
        preFilterData.forEach(t => {
            const { finalBilled, paid } = calculateRowTotals(t);
            runningTotal += (paid - finalBilled);
        });

        if (preFilterData.length > 0) {
             body += `(이전 잔액)                                   ${(runningTotal < 0 ? `-${formatCurrency(Math.abs(runningTotal))}` : formatCurrency(runningTotal)).padStart(9, ' ')}\n`;
        }

        filtered.forEach(t => {
            const { finalBilled, paid } = calculateRowTotals(t);
            const diff = paid - finalBilled;
            runningTotal += diff;
            
            const dateStr = t.startDate.padEnd(12, ' ');
            const catStr = t.category.slice(0, 4).padEnd(6, ' ');
            const billedStr = formatCurrency(finalBilled).padStart(8, ' ');
            const paidStr = formatCurrency(paid).padStart(8, ' ');
            const balStr = (runningTotal < 0 ? `-${formatCurrency(Math.abs(runningTotal))}` : formatCurrency(runningTotal)).padStart(9, ' ');
            
            body += `${dateStr} ${catStr} ${billedStr} ${paidStr} ${balStr}\n`;
        });

        const footer = `-`.repeat(50) + `\n`;
        const totalLine = runningTotal < 0 
            ? `현재 총 미수금액: ${formatCurrency(Math.abs(runningTotal))}원\n`
            : `현재 총 적립금액: ${formatCurrency(runningTotal)}원\n`;
        const paymentLine = runningTotal < 0 
            ? `\n💰 납부하실 금액: ${formatCurrency(Math.abs(runningTotal))}원`
            : `\n✨ 남은 적립금: ${formatCurrency(runningTotal)}원`;

        const fullText = header + subHeader + body + footer + totalLine + paymentLine;
        
        copyToClipboardFallback(fullText);
        alert("카카오톡 전송용 내역이 복사되었습니다!");
    };

    const copyReceivablesSummary = () => {
        if (balanceData.receivable.length === 0) {
            alert("미수금 내역이 없습니다.");
            return;
        }
        const today = getNowDate();
        let text = `[킹독 미수금 현황 보고]\n기준일: ${today}\n\n`;
        balanceData.receivable.forEach((item, index) => {
            text += `${index + 1}. ${item.ownerName} (${item.dogName}) : ${formatCurrency(Math.abs(item.balance || 0))}원\n`;
        });
        text += `\n` + `-`.repeat(30) + `\n`;
        text += `총 미수 건수: ${balanceData.receivable.length}건\n`;
        text += `총 미수금 합계: ${formatCurrency(Math.abs(balanceData.totalReceivable))}원`;
        copyToClipboardFallback(text);
        alert("전체 미수금 현황이 복사되었습니다.");
    };

    return (
        <div className="flex flex-col h-full bg-gray-100 overflow-hidden text-gray-900">
            {/* Header Dashboard */}
            <div className="bg-white border-b px-6 py-4 shrink-0 shadow-sm z-10">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                        <div className="flex flex-col md:flex-row md:items-center gap-4 xl:gap-6">
                            <h2 className="text-2xl font-black text-gray-800 flex items-center">
                                <Scale className="mr-2 text-indigo-600"/> 미수/적립 현황
                            </h2>
                            <div className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full border">
                                실시간 동기화 (Phase 5)
                            </div>
                        </div>

                        {/* Search */}
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"/>
                            <input 
                                type="text" 
                                placeholder="고객명 또는 반려견..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            />
                        </div>
                    </div>

                    {/* Bottom Row: Summary Cards */}
                    <div className="flex gap-3">
                        <div className="flex-1 bg-red-50 px-5 py-2 rounded-2xl border border-red-100 flex items-center gap-3">
                            <TrendingDown className="w-5 h-5 text-red-500"/>
                            <div>
                                <div className="text-[10px] font-black text-red-400 uppercase">총 미수액</div>
                                <div className="text-lg font-black text-red-700">{formatCurrency(Math.abs(balanceData.totalReceivable))}원</div>
                            </div>
                        </div>
                        <div className="flex-1 bg-emerald-50 px-5 py-2 rounded-2xl border border-emerald-100 flex items-center gap-3">
                            <TrendingUp className="w-5 h-5 text-emerald-500"/>
                            <div>
                                <div className="text-[10px] font-black text-emerald-400 uppercase">총 적립액</div>
                                <div className="text-lg font-black text-emerald-700">{formatCurrency(balanceData.totalCredits)}원</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Tab Switcher (Visible only on mobile) */}
            <div className="md:hidden flex border-b bg-white shrink-0 shadow-sm z-30">
                <button 
                    onClick={() => setMobileTab('receivable')} 
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${mobileTab === 'receivable' ? 'border-red-600 text-red-600 bg-red-50' : 'border-transparent text-gray-500'}`}
                >
                    <TrendingDown className="w-4 h-4"/> 미수금 리스트
                </button>
                <button 
                    onClick={() => setMobileTab('credit')} 
                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${mobileTab === 'credit' ? 'border-emerald-600 text-emerald-600 bg-emerald-50' : 'border-transparent text-gray-500'}`}
                >
                    <TrendingUp className="w-4 h-4"/> 적립금 리스트
                </button>
            </div>

            {/* Split Layout: Responsive Column/Row */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row p-4 gap-4">
                
                {/* Left Column: Accounts Receivable (미수금) */}
                <div className={`flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden ${mobileTab === 'credit' ? 'hidden md:flex' : 'flex'}`}>
                    <div className="bg-red-600 px-4 py-3 flex justify-between items-center shrink-0">
                        <h3 className="font-black text-white flex items-center gap-2 text-sm md:text-base">
                            <TrendingDown className="w-4 h-4"/> 미수금 리스트
                        </h3>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={copyReceivablesSummary}
                                className="text-white/80 hover:text-white hover:bg-red-500/50 p-1.5 rounded-lg transition-colors"
                                title="미수 현황 전체 복사"
                            >
                                <Copy className="w-4 h-4"/>
                            </button>
                            <span className="bg-red-700 text-white px-2 py-0.5 rounded text-[10px] font-bold">{balanceData.receivable.length}명</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-50 text-gray-400 font-bold sticky top-0 border-b z-10">
                                <tr>
                                    <th className="p-3">고객 정보</th>
                                    <th className="p-3 text-right">최근변동</th>
                                    <th className="p-3 text-right">미수금액</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {balanceData.receivable.map(c => (
                                    <tr key={c.id} onClick={() => { setSelectedCustomer(c); setExportRange({ start: '', end: getNowDate() }); }} className="hover:bg-red-50 cursor-pointer group transition-colors">
                                        <td className="p-3">
                                            <div className="font-black text-gray-900 group-hover:text-red-700 transition-colors">{c.dogName}</div>
                                            <div className="text-[10px] text-gray-400">{c.ownerName} ({c.phone})</div>
                                        </td>
                                        <td className="p-3 text-right font-mono text-gray-400 text-[10px]">
                                            {c.lastBalanceUpdate ? normalizeDate(c.lastBalanceUpdate).slice(2) : '-'}
                                        </td>
                                        <td className="p-3 text-right font-black text-red-600">{formatCurrency(Math.abs(c.balance || 0))}원</td>
                                    </tr>
                                ))}
                                {balanceData.receivable.length === 0 && (
                                    <tr><td colSpan={3} className="p-10 text-center text-gray-300">미수 고객이 없습니다.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Column: Credits (적립금) */}
                <div className={`flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden ${mobileTab === 'receivable' ? 'hidden md:flex' : 'flex'}`}>
                    <div className="bg-emerald-600 px-4 py-3 flex justify-between items-center shrink-0">
                        <h3 className="font-black text-white flex items-center gap-2 text-sm md:text-base">
                            <TrendingUp className="w-4 h-4"/> 적립금 리스트
                        </h3>
                        <span className="bg-emerald-700 text-white px-2 py-0.5 rounded text-[10px] font-bold">{balanceData.credits.length}명</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-50 text-gray-400 font-bold sticky top-0 border-b z-10">
                                <tr>
                                    <th className="p-3">고객 정보</th>
                                    <th className="p-3 text-right">최근변동</th>
                                    <th className="p-3 text-right">적립금액</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {balanceData.credits.map(c => (
                                    <tr key={c.id} onClick={() => { setSelectedCustomer(c); setExportRange({ start: '', end: getNowDate() }); }} className="hover:bg-emerald-50 cursor-pointer group transition-colors">
                                        <td className="p-3">
                                            <div className="font-black text-gray-900 group-hover:text-emerald-700 transition-colors">{c.dogName}</div>
                                            <div className="text-[10px] text-gray-400">{c.ownerName} ({c.phone})</div>
                                        </td>
                                        <td className="p-3 text-right font-mono text-gray-400 text-[10px]">
                                            {c.lastBalanceUpdate ? normalizeDate(c.lastBalanceUpdate).slice(2) : '-'}
                                        </td>
                                        <td className="p-3 text-right font-black text-emerald-600">{formatCurrency(c.balance)}원</td>
                                    </tr>
                                ))}
                                {balanceData.credits.length === 0 && (
                                    <tr><td colSpan={3} className="p-10 text-center text-gray-300">적립 고객이 없습니다.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Drill-down: Transaction History Modal */}
            {selectedCustomer && (
                <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-5xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col shadow-indigo-200/50 border border-indigo-100">
                        {/* Modal Header */}
                        <div className="bg-indigo-900 p-6 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-indigo-700 rounded-2xl flex items-center justify-center font-black text-2xl border border-white/20 text-white shadow-inner">
                                    {selectedCustomer.dogName?.[0]}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black">{selectedCustomer.dogName} <span className="text-sm font-normal text-indigo-300">({selectedCustomer.ownerName} 보호자님)</span></h3>
                                    <div className="text-xs text-indigo-300 flex items-center gap-2 mt-1">
                                        <ClipboardList className="w-4 h-4"/> 킹독 누적 서비스 이용 내역
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X className="w-8 h-8"/></button>
                        </div>

                        {/* Modal Toolbar for Copy */}
                        <div className="bg-indigo-50 border-b px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <div className="bg-white px-3 py-1.5 rounded-lg border border-indigo-200 flex items-center gap-2 shadow-sm flex-1 md:flex-none">
                                    <Calendar className="w-4 h-4 text-indigo-500"/>
                                    <span className="text-xs font-bold text-gray-700">추출 시작일:</span>
                                    <span className="text-xs font-black text-indigo-700">{exportRange.start || '리스트에서 날짜를 클릭하세요'}</span>
                                    {exportRange.start && <button onClick={() => setExportRange({...exportRange, start: ''})} className="text-gray-400 hover:text-red-500 ml-1"><X className="w-3 h-3"/></button>}
                                </div>
                                <div className="text-[10px] text-indigo-400 font-bold hidden md:flex items-center">
                                    <MousePointer2 className="w-3 h-3 mr-1"/> 날짜를 클릭하면 해당 시점부터 복사됩니다.
                                </div>
                            </div>
                            <button onClick={copyToKakao} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg hover:bg-indigo-700 active:scale-95 transition-all w-full md:w-auto">
                                <Copy className="w-4 h-4"/> 카카오톡 전송용 복사
                            </button>
                        </div>

                        {/* Modal Content - Table with Running Balance */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white relative">
                            {isLoadingHistory ? (
                                <div className="flex h-full items-center justify-center">
                                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin"/>
                                    <span className="ml-3 text-indigo-600 font-bold">내역을 조회 중입니다...</span>
                                </div>
                            ) : (
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-gray-50 text-gray-500 font-black sticky top-0 border-b-2 border-indigo-100 z-10">
                                        <tr>
                                            <th className="p-4 w-32">날짜</th>
                                            <th className="p-4">항목</th>
                                            <th className="p-4">세부 서비스</th>
                                            <th className="p-4 text-right">청구액(매출)</th>
                                            <th className="p-4 text-right">결제액(입금)</th>
                                            <th className="p-4 text-right bg-indigo-50/50 text-indigo-600">누적 잔액</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {(() => {
                                            let runningBal = 0;
                                            return historyData.length === 0 ? (
                                                <tr><td colSpan={6} className="p-10 text-center text-gray-400">거래 내역이 없습니다.</td></tr>
                                            ) : historyData.map((t) => {
                                                const { finalBilled, paid } = calculateRowTotals(t);
                                                const rowDiff = paid - finalBilled;
                                                runningBal += rowDiff;
                                                const isSelectedStart = exportRange.start === normalizeDate(t.startDate);
                                                
                                                return (
                                                    <tr 
                                                        key={t.id} 
                                                        onClick={() => setExportRange({...exportRange, start: normalizeDate(t.startDate)})}
                                                        className={`group transition-colors cursor-pointer ${isSelectedStart ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-200' : 'hover:bg-gray-50'}`}
                                                    >
                                                        <td className="p-4">
                                                            <div className={`font-mono transition-colors flex items-center ${isSelectedStart ? 'text-indigo-700 font-bold' : 'text-gray-400 group-hover:text-indigo-600'}`}>
                                                                {isSelectedStart && <Check className="w-3 h-3 mr-1"/>}
                                                                {t.startDate}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 font-black text-gray-700">{t.category}</td>
                                                        <td className="p-4 text-gray-500 truncate max-w-[150px]">{t.serviceDetail}</td>
                                                        <td className="p-4 text-right font-bold text-gray-900">{formatCurrency(finalBilled)}</td>
                                                        <td className="p-4 text-right font-black text-indigo-600">{formatCurrency(paid)}</td>
                                                        <td className={`p-4 text-right font-black ${runningBal < 0 ? 'bg-red-50/30 text-red-600' : 'bg-emerald-50/30 text-emerald-600'}`}>
                                                            {runningBal < 0 ? `-${formatCurrency(Math.abs(runningBal))}` : formatCurrency(runningBal)}
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        
                        {/* Modal Footer Summary */}
                        <div className="p-6 bg-indigo-50 border-t flex flex-col md:flex-row items-center justify-between shrink-0 gap-4">
                            <div className="flex gap-4 md:gap-10 w-full md:w-auto justify-between md:justify-start">
                                {(() => {
                                    let totalBalance = selectedCustomer?.balance || 0;
                                    return (
                                        <>
                                            <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-indigo-100 flex-1 md:flex-none text-center md:text-left">
                                                <div className="text-[10px] font-black text-gray-400 mb-0.5">최종 미수금</div>
                                                <div className="text-xl font-black text-red-600">
                                                    {totalBalance < 0 ? formatCurrency(Math.abs(totalBalance)) : 0}원
                                                </div>
                                            </div>
                                            <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-indigo-100 flex-1 md:flex-none text-center md:text-left">
                                                <div className="text-[10px] font-black text-gray-400 mb-0.5">최종 적립금</div>
                                                <div className="text-xl font-black text-emerald-600">
                                                    {totalBalance > 0 ? formatCurrency(totalBalance) : 0}원
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                            <div className="text-center md:text-right w-full md:w-auto">
                                <div className="text-xs font-black text-indigo-400 mb-1">보호자님께 안내할 최종 정산액</div>
                                {(() => {
                                    let totalBalance = selectedCustomer?.balance || 0;
                                    return (
                                        <div className={`text-2xl md:text-4xl font-black ${totalBalance < 0 ? 'text-red-700' : 'text-indigo-900'}`}>
                                            {totalBalance < 0 ? `납부하실 금액: ${formatCurrency(Math.abs(totalBalance))}` : `남은 적립금: ${formatCurrency(totalBalance)}`}원
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BalanceTab;
