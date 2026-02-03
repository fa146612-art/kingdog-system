
import React, { useState } from 'react';
import { 
    BookOpen, X, Flag, CreditCard, CalendarCheck, 
    School, AlertTriangle, MessageSquare, Bot, 
    CheckSquare, MousePointer2, ChevronRight, Bed, Phone, 
    MessageCircle, ShieldAlert, DollarSign, Clock, Scissors
} from 'lucide-react';

const SystemManual = ({ onClose }: { onClose: () => void }) => {
    const [activeSection, setActiveSection] = useState('intro');

    const scrollTo = (id: string) => {
        setActiveSection(id);
        const el = document.getElementById(`manual-${id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const MenuItem = ({ id, label, icon: Icon }: any) => (
        <button 
            onClick={() => scrollTo(id)}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium transition-all rounded-xl mb-1 ${activeSection === id ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
        >
            <Icon className={`w-4 h-4 mr-3 ${activeSection === id ? 'text-white' : 'text-gray-400'}`}/>
            <span className="truncate">{label}</span>
            {activeSection === id && <ChevronRight className="w-3 h-3 ml-auto opacity-50"/>}
        </button>
    );

    return (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row relative">
                
                {/* Sidebar */}
                <div className="w-full md:w-72 bg-gray-50 border-r p-6 flex-shrink-0 overflow-y-auto hidden md:block">
                    <div className="flex items-center gap-2 mb-8 px-2 text-indigo-900 font-black text-xl">
                        <BookOpen className="w-6 h-6"/> KINGDOG SOP
                    </div>
                    
                    <div className="space-y-8">
                        <div>
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 px-4">Chapter 0. 서론</div>
                            <MenuItem id="intro" label="시스템 철학 & 원칙" icon={Flag} />
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 px-4">Chapter 1. 고객 응대</div>
                            <MenuItem id="inquiry" label="첫 문의 응대 (가격방어)" icon={Phone} />
                            <MenuItem id="hotel_script" label="호텔 상담 스크립트" icon={Bed} />
                            <MenuItem id="grooming_logic" label="미용 예약의 정석" icon={Scissors} />
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 px-4">Chapter 2. 예약 확정</div>
                            <MenuItem id="deposit" label="입금과 장부 기록" icon={DollarSign} />
                            <MenuItem id="maybe" label="가예약(보류) 처리법" icon={Clock} />
                            <MenuItem id="risk" label="특이견/진상 방어" icon={ShieldAlert} />
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 px-4">Chapter 3. 운영 관리</div>
                            <MenuItem id="kindergarten" label="유치원/픽업 자동화" icon={School} />
                            <MenuItem id="comm" label="알림장/소통" icon={MessageSquare} />
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white relative scroll-smooth">
                    {/* Mobile Header */}
                    <div className="sticky top-0 bg-white/90 backdrop-blur border-b p-4 flex justify-between items-center md:hidden z-10">
                        <span className="font-black text-gray-800 flex items-center"><BookOpen className="w-5 h-5 mr-2"/> 매뉴얼</span>
                        <button onClick={onClose} className="p-2 bg-gray-100 rounded-full"><X className="w-5 h-5"/></button>
                    </div>

                    {/* Desktop Close Button */}
                    <button 
                        onClick={onClose} 
                        className="hidden md:flex absolute top-6 right-6 p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition z-50 text-gray-500"
                        title="닫기 (ESC)"
                    >
                        <X className="w-6 h-6"/>
                    </button>

                    <div className="max-w-4xl mx-auto p-8 md:p-16 space-y-24">
                        
                        {/* Intro */}
                        <section id="manual-intro" className="space-y-6">
                            <div>
                                <span className="text-indigo-600 font-bold tracking-widest text-xs uppercase mb-2 block">Standard Operating Procedure</span>
                                <h1 className="text-4xl font-black text-gray-900 mb-6">킹독 표준 운영 절차 (SOP)</h1>
                                <p className="text-lg text-gray-600 leading-relaxed">
                                    이 매뉴얼은 단순한 기능 설명서가 아닙니다.<br/>
                                    <strong>"사장님이 현장에서 가장 편하게, 그리고 매출을 극대화하며 일하는 법"</strong>을 정의한 업무 지침서입니다.
                                </p>
                            </div>

                            <div className="bg-indigo-50 border-l-4 border-indigo-600 p-6 rounded-r-xl">
                                <h3 className="font-bold text-indigo-900 mb-2 text-lg">핵심 철학 : Zero Mental Load</h3>
                                <p className="text-indigo-800 text-sm leading-relaxed">
                                    운전대를 잡고 픽업을 돌 때, "오늘 누구 태워야 하지?"를 고민하지 마세요. 
                                    시스템에 규칙만 입력해두면, 컴퓨터가 알아서 오늘 할 일을 알려줍니다. 
                                    여러분의 뇌 용량은 오직 <strong>강아지를 케어하는 데에만</strong> 쓰세요.
                                </p>
                            </div>
                        </section>

                        {/* Inquiry General */}
                        <section id="manual-inquiry" className="space-y-6 pt-10 border-t">
                            <h2 className="text-2xl font-black text-gray-800 flex items-center"><Phone className="w-6 h-6 mr-2 text-indigo-600"/> 1. 첫 문의 응대 (가격 방어)</h2>
                            
                            <div className="bg-red-50 p-5 rounded-xl border border-red-100">
                                <h3 className="font-bold text-red-700 flex items-center mb-2"><AlertTriangle className="w-4 h-4 mr-2"/> 절대 금지 사항</h3>
                                <p className="text-sm text-gray-700">
                                    고객: "호텔 1박에 얼마에요?"<br/>
                                    직원: "5만원 입니다." (X) <span className="text-red-600 font-bold">→ 90% 확률로 "생각해보고 연락드릴게요" 하고 끊음.</span>
                                </p>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-gray-800">응대 원칙: 정보를 먼저 얻고, 가치를 판다.</h3>
                                <p className="text-gray-600 text-sm">고객이 가격만 듣고 끊지 않도록, 대화의 주도권을 가져와야 합니다.</p>
                                <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
                                    <li><strong>Step 1. 되묻기:</strong> "저희는 방 크기가 다양한데, 혹시 견종과 몸무게가 어떻게 되나요?"</li>
                                    <li><strong>Step 2. 맞춤 제안:</strong> (아래 호텔/미용 섹션 참조)</li>
                                    <li><strong>Step 3. 가격 안내:</strong> 서비스 가치를 충분히 설명한 후 마지막에 가격을 제시합니다.</li>
                                </ul>
                            </div>
                        </section>

                        {/* Hotel Script */}
                        <section id="manual-hotel_script" className="space-y-6 pt-10 border-t">
                            <h2 className="text-2xl font-black text-gray-800 flex items-center"><Bed className="w-6 h-6 mr-2 text-indigo-600"/> 2. 호텔 상담 스크립트</h2>
                            <p className="text-gray-600">고객의 강아지 정보에 따라 '맞춤식 케어'를 한다는 느낌을 주는 것이 핵심입니다.</p>

                            <div className="bg-gray-50 p-6 rounded-xl border space-y-4">
                                <h4 className="font-bold text-gray-800">🗣️ 모범 답안 스크립트</h4>
                                <div className="space-y-3 text-sm text-gray-700">
                                    <p>"아, {`{견종}`} 아이군요! 저희는 평소에는 넓은 놀이방에서 친구들과 뛰어놀다가, 잠잘 때만 개별 룸으로 들어갑니다."</p>
                                    <p>"방마다 <strong>개별 난방</strong>이 다 되어 있고요, 보호자님이 안심하실 수 있게 입실하면 <strong>CCTV 링크</strong>를 보내드려서 직접 확인하실 수도 있어요."</p>
                                    <p>"{`{아이이름}`}한테는 V2번 방 정도 크기가 딱 적당해 보이네요. 이 방은 1박에 OO원 입니다."</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 bg-blue-50 p-4 rounded-lg text-blue-800 text-sm font-bold">
                                <CheckSquare className="w-5 h-5"/>
                                <span>예약 확정 시: "신규 신청서"와 "호텔 안내문"을 카톡으로 전송합니다. (버튼 활용)</span>
                            </div>
                        </section>

                        {/* Grooming Logic */}
                        <section id="manual-grooming_logic" className="space-y-6 pt-10 border-t">
                            <h2 className="text-2xl font-black text-gray-800 flex items-center"><Scissors className="w-6 h-6 mr-2 text-indigo-600"/> 3. 미용 예약의 정석 (Algorithm)</h2>
                            <p className="text-gray-600">미용 예약은 시간 싸움입니다. 아래 순서를 반드시 지켜야 스케줄이 꼬이지 않습니다.</p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                                <div className="bg-indigo-600 text-white p-4 rounded-xl shadow-lg">
                                    <div className="text-2xl font-black mb-1">1단계</div>
                                    <div className="font-bold">스타일 확정</div>
                                    <div className="text-[10px] mt-2 opacity-80">얼마나 걸릴지 파악</div>
                                </div>
                                <div className="bg-indigo-500 text-white p-4 rounded-xl shadow-lg">
                                    <div className="text-2xl font-black mb-1">2단계</div>
                                    <div className="font-bold">시간 설정</div>
                                    <div className="text-[10px] mt-2 opacity-80">빈 시간 매칭</div>
                                </div>
                                <div className="bg-indigo-400 text-white p-4 rounded-xl shadow-lg">
                                    <div className="text-2xl font-black mb-1">3단계</div>
                                    <div className="font-bold">예약금 안내</div>
                                    <div className="text-[10px] mt-2 opacity-80">최종 확정</div>
                                </div>
                            </div>

                            <div className="bg-white border rounded-xl p-5 shadow-sm space-y-4">
                                <h3 className="font-bold text-gray-800">Q. "내일 미용 되나요?" 라고 물어보면?</h3>
                                <p className="text-sm text-gray-600">
                                    무작정 "네/아니오" 하지 말고, <strong>스케줄표의 빈 시간(예: 2시간)을 먼저 확인</strong>하세요.
                                </p>
                                <div className="bg-gray-100 p-4 rounded-lg text-sm space-y-2">
                                    <p><strong>상황:</strong> 내일 2시~4시(2시간)가 비어있음.</p>
                                    <p><strong>응대:</strong> "내일 오후 시간대가 비어있긴 한데, 어떤 미용을 원하시나요?"</p>
                                    <ul className="list-disc pl-5 text-gray-500 text-xs mt-2">
                                        <li>목욕/위생 (1시간 소요) → <strong>"네, 가능합니다!"</strong></li>
                                        <li>전체 가위컷 (4시간 소요) → <strong>"죄송하지만 그 스타일은 시간이 부족해서 다른 날로 잡아드릴까요?"</strong></li>
                                    </ul>
                                </div>
                                <p className="text-xs text-blue-600 font-bold">
                                    * 팁: 바빠서 통화가 어려우면 [미용상담 폼 복사] 버튼을 눌러 카톡으로 보내고 나중에 확인하세요.
                                </p>
                            </div>
                        </section>

                        {/* Reservation: Money & Maybe */}
                        <section id="manual-deposit" className="space-y-6 pt-10 border-t">
                            <h2 className="text-2xl font-black text-gray-800 flex items-center"><DollarSign className="w-6 h-6 mr-2 text-indigo-600"/> 4. 입금과 장부 기록</h2>
                            
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-gray-800">입금 확인 프로세스</h3>
                                <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-600">
                                    <li>고객에게 카톡으로 계좌번호를 전송합니다.</li>
                                    <li><strong>[입금확인 단톡방]</strong>에 사장님이 "OOO 입금 완료"라고 올립니다.</li>
                                    <li>직원은 즉시 시스템을 켜고 <strong>[장부] > [수입]</strong> 탭에 '예약금' 명목으로 등록합니다.</li>
                                    <li>이때, 해당 고객의 <strong>[잔액]이 (+)로 증가</strong>했는지 확인합니다.</li>
                                </ol>
                            </div>
                        </section>

                        <section id="manual-maybe" className="space-y-6 pt-10 border-t">
                            <div className="bg-orange-50 border-l-4 border-orange-500 p-6 rounded-r-xl">
                                <h2 className="text-xl font-black text-orange-800 flex items-center mb-2"><Clock className="w-6 h-6 mr-2"/> 5. "생각해보고 연락드릴게요" (가예약)</h2>
                                <p className="text-sm text-orange-900 font-bold mb-2">원칙: 시스템에 입력하지 않고 날립니다.</p>
                                <p className="text-sm text-orange-800 leading-relaxed">
                                    애매하게 예약 잡아두면 나중에 중복 예약 사고가 터집니다.<br/>
                                    반드시 <strong>"그럼 우선 예약은 잡아두지 않겠습니다. 결정되시면 다시 연락 부탁드려요."</strong>라고 명확히 안내하여 고객이 예약된 줄 착각하지 않게 하세요. (증거 남기기)
                                </p>
                            </div>
                        </section>

                        {/* Risk Management */}
                        <section id="manual-risk" className="space-y-6 pt-10 border-t">
                            <h2 className="text-2xl font-black text-gray-800 flex items-center"><ShieldAlert className="w-6 h-6 mr-2 text-indigo-600"/> 6. 특이견/진상 방어 (필터링)</h2>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                <div className="bg-white border rounded-xl p-5 shadow-sm">
                                    <h3 className="font-bold text-gray-800 mb-3">🚨 블랙리스트/주의견 표시</h3>
                                    <p className="text-sm text-gray-600 mb-4">
                                        모든 직원이 예약 단계에서부터 알 수 있어야 사고를 막습니다.<br/>
                                        <strong>[고객관리] > [메모]</strong> 란에 <span className="text-red-600 font-bold">🚨교육팀장 테스트 필수</span> 같은 키워드를 적어두세요.
                                    </p>
                                </div>
                                <div className="bg-white border rounded-xl p-5 shadow-sm">
                                    <h3 className="font-bold text-gray-800 mb-3">🐶 입실 거부 기준?</h3>
                                    <p className="text-sm text-gray-600 mb-4">
                                        크기만 적당하다면 무조건 거절하지 않습니다. 공간 분리 등 방법은 있습니다.<br/>
                                        단, <strong>"공격성이 심하면 분리된 공간에만 있을 수 있다"</strong>고 사전에 강력하게 고지해야 합니다.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <div className="text-center text-gray-300 text-xs py-10 border-t mt-20">
                            KINGDOG Management System v2.0 <br/>
                            Updated by AI Manager based on Boss's Protocol
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemManual;
