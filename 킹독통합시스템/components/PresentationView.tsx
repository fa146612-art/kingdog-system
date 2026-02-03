
import React from 'react';
import { X } from 'lucide-react';

export default function PresentationView({ onClose }: { onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[9999] bg-black animate-in fade-in duration-300">
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 z-50 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
                title="닫기"
            >
                <X className="w-6 h-6"/>
            </button>
            <iframe 
                src="/report_slides.html"
                className="w-full h-full border-none bg-white"
                title="Presentation Slides"
                allow="fullscreen"
            />
        </div>
    );
}
