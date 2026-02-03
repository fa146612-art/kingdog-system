
import React, { useState, useRef, useEffect } from 'react';
import { Database, Calculator, AlertTriangle, Save, RefreshCw, CheckCircle2, Search, Download, Terminal } from 'lucide-react';
import { collection, getDocs, query, where, writeBatch, doc, Timestamp } from 'firebase/firestore';
import { db, appId } from '../services/firebase';
import { formatCurrency, getNowDate } from '../utils/helpers';
import { Customer, Transaction } from '../types';
import { ConfirmModal } from './Modals';

// Helper to normalize strings for matching
const normalize = (str?: string) => str ? str.trim().replace(/\s+/g, '') : '';

const MigrationTool = () => {
    // --- State ---
    const [step, setStep] = useState(1); // 1: Ready, 2: Calculated, 3: Completed
    const [logs, setLogs] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
    
    // Modal State
    const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({
        isOpen: false, message: '', onConfirm: () => {}
    });

    // Data Containers
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [summary, setSummary] = useState({ totalCustomers: 0, totalReceivable: 0, totalCredit: 0, matchRate: 0 });

    // Scroll ref for logs
    const logEndRef = useRef<HTMLDivElement>(null);

    // --- Logger ---
    const addLog = (msg: string) => {
        const time = new Date().toLocaleTimeString('ko-KR');
        setLogs(prev => [...prev, `[${time}] ${msg}`]);
    };

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [logs]);

    // --- Phase 2 Core Logic: Calculate Balances ---
    const executeCalculate = async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsProcessing(true);
        setStep(1);
        setLogs([]);
        setPreviewData([]);
        addLog("=== Phase 2: Calculation Started ===");

        try {
            // 1. Fetch Customers
            addLog("Step 1: Fetching all customers...");
            const custSnap = await getDocs(collection(db, 'kingdog', appId, 'customers'));
            const customers = custSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
            addLog(`> Found ${customers.length} customers.`);

            // 2. Build Customer Lookup Maps (Prioritize ID > Phone > Name)
            const custMapById = new Map<string, Customer>();
            const custMapByPhone = new Map<string, Customer>(); // Key: dogName + phone
            const custMapByName = new Map<string, Customer>();  // Key: dogName + ownerName

            customers.forEach(c => {
                custMapById.set(c.id, c);
                if (c.dogName && c.phone) {
                    const phoneKey = `${normalize(c.dogName)}_${c.phone.replace(/[^0-9]/g, '')}`;
                    custMapByPhone.set(phoneKey, c);
                }
                if (c.dogName && c.ownerName) {
                    const nameKey = `${normalize(c.dogName)}_${normalize(c.ownerName)}`;
                    custMapByName.set(nameKey, c);
                }
            });

            // 3. Fetch Transactions (Income only, since 2022)
            addLog("Step 2: Fetching income transactions (2022-01-01 ~ )...");
            const transQuery = query(
                collection(db, 'kingdog', appId, 'transactions'),
                where('type', '==', '수입'),
                where('startDate', '>=', '2022-01-01')
            );
            const transSnap = await getDocs(transQuery);
            const transactions = transSnap.docs.map(d => d.data() as Transaction);
            addLog(`> Found ${transactions.length} transactions.`);

            // 4. Calculate Balances
            addLog("Step 3: Aggregating balances...");
            const balanceMap = new Map<string, number>(); // CustomerID -> Balance
            let matchedCount = 0;
            let unmatchedCount = 0;

            transactions.forEach(t => {
                let matchedCustomer: Customer | undefined;

                // Try Match 1: ID
                if (t.customerId) {
                    matchedCustomer = custMapById.get(t.customerId);
                }

                // Try Match 2: Dog + Phone
                if (!matchedCustomer && t.dogName && t.contact) {
                    const phoneKey = `${normalize(t.dogName)}_${t.contact.replace(/[^0-9]/g, '')}`;
                    matchedCustomer = custMapByPhone.get(phoneKey);
                }

                // Try Match 3: Dog + Owner Name
                if (!matchedCustomer && t.dogName && t.customerName) {
                    const nameKey = `${normalize(t.dogName)}_${normalize(t.customerName)}`;
                    matchedCustomer = custMapByName.get(nameKey);
                }

                if (matchedCustomer) {
                    matchedCount++;
                    const cid = matchedCustomer.id;
                    
                    // Calculation Logic (Identical to BalanceTab)
                    const unitPrice = (t.price || 0) + ((t.extraDogCount || 0) * 10000);
                    const base = unitPrice * (t.quantity || 1);
                    let discount = 0;
                    if (t.discountType === 'percent') discount = base * ((t.discountValue || 0) / 100);
                    else discount = t.discountValue || 0;
                    
                    const finalBilled = base - discount;
                    const paid = t.paidAmount || 0;
                    const diff = paid - finalBilled; // + Credit, - Debt

                    const current = balanceMap.get(cid) || 0;
                    balanceMap.set(cid, current + diff);
                } else {
                    unmatchedCount++;
                }
            });

            addLog(`> Matched Transactions: ${matchedCount}`);
            addLog(`> Unmatched Transactions: ${unmatchedCount} (Skipped)`);

            // 5. Prepare Preview Data
            addLog("Step 4: Generating preview report...");
            const previewList: any[] = [];
            let totalReceivable = 0;
            let totalCredit = 0;

            // Only include customers with non-zero balance
            for (const [cid, balance] of balanceMap.entries()) {
                if (Math.round(balance) === 0) continue; // Skip zero balance

                const customer = custMapById.get(cid);
                if (!customer) continue;

                if (balance < 0) totalReceivable += balance;
                else totalCredit += balance;

                previewList.push({
                    id: cid,
                    dogName: customer.dogName,
                    ownerName: customer.ownerName,
                    phone: customer.phone,
                    currentBalance: customer.balance || 0, // Previous stored balance
                    newBalance: Math.round(balance),
                    diff: Math.round(balance) - (customer.balance || 0)
                });
            }

            // Sort by absolute balance descending
            previewList.sort((a, b) => Math.abs(b.newBalance) - Math.abs(a.newBalance));

            setPreviewData(previewList);
            setSummary({
                totalCustomers: previewList.length,
                totalReceivable,
                totalCredit,
                matchRate: Math.round((matchedCount / transactions.length) * 100)
            });

            setStep(2); // Calculation Done
            addLog("=== Calculation Finished ===");
            addLog(`Total Targets: ${previewList.length} customers`);
            addLog(`Total Receivable: ${formatCurrency(totalReceivable)}`);
            addLog(`Total Credit: ${formatCurrency(totalCredit)}`);

        } catch (e: any) {
            console.error(e);
            addLog(`ERROR: ${e.message}`);
            alert("계산 중 오류가 발생했습니다.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCalculate = () => {
        setConfirmModal({
            isOpen: true,
            message: "전체 장부(2022~)를 분석하여 고객별 잔액을 계산하시겠습니까?\n(아직 DB에는 저장되지 않습니다)",
            onConfirm: executeCalculate
        });
    };

    // --- Phase 2 Core Logic: Batch Save ---
    const executeSaveToDb = async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsProcessing(true);
        addLog("=== Phase 2: Batch Update Started ===");
        
        try {
            const batchSize = 400; // Safe limit
            const chunks = [];
            for (let i = 0; i < previewData.length; i += batchSize) {
                chunks.push(previewData.slice(i, i + batchSize));
            }

            let processed = 0;
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const batch = writeBatch(db);
                
                chunk.forEach((item) => {
                    const ref = doc(db, 'kingdog', appId, 'customers', item.id);
                    batch.update(ref, {
                        balance: item.newBalance,
                        lastBalanceUpdate: new Date().toISOString()
                    });
                });

                await batch.commit();
                processed += chunk.length;
                setProgress({ current: processed, total: previewData.length, label: 'Updating...' });
                addLog(`> Batch ${i + 1}/${chunks.length} committed (${chunk.length} docs).`);
            }

            setStep(3); // Completed
            addLog("=== All Updates Completed Successfully ===");
            alert("모든 고객의 잔액 정보가 성공적으로 업데이트되었습니다.");

        } catch (e: any) {
            console.error(e);
            addLog(`CRITICAL ERROR during save: ${e.message}`);
            alert("저장 중 오류가 발생했습니다. 로그를 확인하세요.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveToDb = () => {
        setConfirmModal({
            isOpen: true,
            message: `총 ${previewData.length}명의 고객 정보를 업데이트하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
            onConfirm: executeSaveToDb
        });
    };

    return (
        <div className="h-full bg-gray-50 p-6 overflow-y-auto">
            <ConfirmModal 
                isOpen={confirmModal.isOpen} 
                message={confirmModal.message} 
                onConfirm={confirmModal.onConfirm} 
                onCancel={() => setConfirmModal(prev => ({...prev, isOpen: false}))} 
            />

            <div className="max-w-5xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-gray-800 flex items-center mb-2">
                            <Database className="w-6 h-6 mr-2 text-indigo-600"/> 데이터 마이그레이션 센터
                        </h2>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            시스템 성능 향상을 위한 데이터 구조 변경 및 일괄 업데이트 도구입니다.<br/>
                            <span className="text-indigo-600 font-bold">현재 단계: Phase 2 (데이터 계산 및 검증)</span>
                        </p>
                    </div>
                    {step === 2 && (
                        <div className="text-right">
                            <div className="text-xs font-bold text-gray-400">업데이트 대상</div>
                            <div className="text-2xl font-black text-indigo-600">{previewData.length}명</div>
                        </div>
                    )}
                </div>

                {/* Step Indicator */}
                <div className="flex gap-4">
                    <div className="flex-1 bg-white text-gray-400 p-4 rounded-xl border border-gray-200 opacity-60">
                        <div className="text-xs font-bold mb-1">PHASE 1</div>
                        <div className="font-black text-lg">구조 정의</div>
                        <div className="text-[10px] mt-1 text-green-600 font-bold flex items-center"><CheckCircle2 className="w-3 h-3 mr-1"/> 완료됨</div>
                    </div>
                    <div className="flex-1 bg-indigo-600 text-white p-4 rounded-xl shadow-md border-2 border-indigo-600 relative overflow-hidden">
                        <div className="text-xs font-bold opacity-80 mb-1">PHASE 2</div>
                        <div className="font-black text-lg">검증/계산</div>
                        {isProcessing && <div className="absolute top-2 right-2 animate-spin"><RefreshCw className="w-5 h-5"/></div>}
                        <div className="text-[10px] mt-2 bg-indigo-800 inline-block px-2 py-0.5 rounded">현재 작업 중</div>
                    </div>
                    <div className="flex-1 bg-white text-gray-400 p-4 rounded-xl border border-gray-200">
                        <div className="text-xs font-bold mb-1">PHASE 3</div>
                        <div className="font-black text-lg">동기화</div>
                    </div>
                    <div className="flex-1 bg-white text-gray-400 p-4 rounded-xl border border-gray-200">
                        <div className="text-xs font-bold mb-1">PHASE 4</div>
                        <div className="font-black text-lg">UI 적용</div>
                    </div>
                </div>

                {/* Control Panel */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left: Actions */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-lg text-gray-700 flex items-center mb-4">
                            <Calculator className="w-5 h-5 mr-2"/> 작업 실행
                        </h3>
                        <div className="space-y-4">
                            <button 
                                onClick={handleCalculate}
                                disabled={isProcessing}
                                className={`w-full py-4 rounded-xl font-black text-lg shadow-lg flex items-center justify-center transition-all ${step === 1 ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-[1.02]' : 'bg-gray-100 text-gray-400'}`}
                            >
                                {isProcessing && step === 1 ? '계산 중...' : '1. 잔액 계산 및 검증 실행'}
                            </button>
                            
                            <div className="flex items-center justify-center py-2">
                                <div className="h-8 w-0.5 bg-gray-200"></div>
                            </div>

                            <button 
                                onClick={handleSaveToDb}
                                disabled={step !== 2 || isProcessing}
                                className={`w-full py-4 rounded-xl font-black text-lg shadow-lg flex items-center justify-center transition-all ${step === 2 ? 'bg-green-600 text-white hover:bg-green-700 hover:scale-[1.02] animate-pulse' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                            >
                                {isProcessing && step !== 1 ? '저장 중...' : '2. 검증 완료 및 DB 저장'}
                            </button>
                        </div>
                    </div>

                    {/* Right: Summary Logs */}
                    <div className="bg-gray-900 text-green-400 p-4 rounded-2xl font-mono text-xs h-64 overflow-y-auto shadow-inner border border-gray-800 relative">
                        <div className="absolute top-2 right-2 text-gray-500 font-bold flex items-center"><Terminal className="w-3 h-3 mr-1"/> SYSTEM LOG</div>
                        <div className="space-y-1 mt-4">
                            {logs.length === 0 && <span className="opacity-50">대기 중... 작업을 실행하세요.</span>}
                            {logs.map((log, i) => (
                                <div key={i}>{log}</div>
                            ))}
                            <div ref={logEndRef} />
                        </div>
                    </div>
                </div>

                {/* Preview Table (Only visible after calculation) */}
                {step >= 2 && (
                    <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                        <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                            <h3 className="font-bold text-indigo-900 flex items-center">
                                <Search className="w-4 h-4 mr-2"/> 계산 결과 미리보기 (상위 100건)
                            </h3>
                            <div className="flex gap-4 text-xs font-bold">
                                <span className="text-red-600">총 미수금: {formatCurrency(Math.abs(summary.totalReceivable))}원</span>
                                <span className="text-green-600">총 적립금: {formatCurrency(summary.totalCredit)}원</span>
                            </div>
                        </div>
                        <div className="max-h-96 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white text-gray-500 font-bold sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="p-4">고객명</th>
                                        <th className="p-4">연락처</th>
                                        <th className="p-4 text-right bg-gray-50">기존 잔액</th>
                                        <th className="p-4 text-right bg-indigo-50 text-indigo-700">계산된 잔액 (New)</th>
                                        <th className="p-4 text-right">변동액</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {previewData.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-bold text-gray-800">
                                                {item.dogName} <span className="text-gray-400 font-normal">({item.ownerName})</span>
                                            </td>
                                            <td className="p-4 text-gray-500 text-xs font-mono">{item.phone}</td>
                                            <td className="p-4 text-right font-medium text-gray-400 bg-gray-50/50">{formatCurrency(item.currentBalance)}</td>
                                            <td className={`p-4 text-right font-black bg-indigo-50/30 ${item.newBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {formatCurrency(item.newBalance)}
                                            </td>
                                            <td className="p-4 text-right text-xs text-gray-400">
                                                {item.diff !== 0 && (item.diff > 0 ? `+${formatCurrency(item.diff)}` : formatCurrency(item.diff))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default MigrationTool;
