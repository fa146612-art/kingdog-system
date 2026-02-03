import React from 'react';
import { MessageSquare } from 'lucide-react';

const ConsultationTab = () => (
    <div className="flex flex-col items-center justify-center h-full text-gray-400 animate-in fade-in zoom-in duration-300">
        <MessageSquare className="w-16 h-16 mb-4 opacity-20 text-blue-500"/>
        <h2 className="text-xl font-bold text-gray-500 mb-2">상담 관리</h2>
        <p className="text-sm">현재 기능 준비 중입니다.</p>
    </div>
);

export default ConsultationTab;