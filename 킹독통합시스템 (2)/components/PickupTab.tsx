
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Polyline } from '@react-google-maps/api';
import { Car, MapPin, Navigation, Phone, ChevronLeft, ChevronRight, School, Scissors, Bed, Calendar, ExternalLink, Plus, RefreshCw, LocateFixed, Route, AlertCircle, AlertTriangle, Copy, X, Edit, Save, Settings } from 'lucide-react';
import { Transaction, Appointment, Customer, PickupHistoryItem } from '../types';
import { getNowDate, normalizeDate, getLocalYMD, copyToClipboardFallback } from '../utils/helpers';
import { GOOGLE_MAPS_API_KEY, db, appId } from '../services/firebase';
import { doc, updateDoc, arrayUnion, getDoc, setDoc } from 'firebase/firestore';

// --- Constants & Styles ---
const MAP_CONTAINER_STYLE = {
    width: '100%',
    height: '100%'
};

const DEFAULT_STORE_LOCATION = { lat: 37.5173, lng: 127.0474 }; 

interface PickupItem {
    id: string; // Group ID (CustomerID)
    source: 'kindergarten_fixed' | 'kindergarten_flex' | 'grooming' | 'hotel' | 'manual';
    sourceTypeLabel: string;
    dogs: string[]; // List of dog names
    customerName: string;
    address: string;
    phone: string;
    time?: string;
    notes?: string;
    isRare?: boolean;
    lat?: number;
    lng?: number;
    originalAddress?: string; // For reset
    hasTempAddress?: boolean; // If overridden today
}

const PickupTab = ({ 
    transactions, appointments, customers, setActiveTab 
}: { 
    transactions: Transaction[], appointments: Appointment[], customers: Customer[], setActiveTab: (tab: string) => void 
}) => {
    // --- State ---
    const [selectedDate, setSelectedDate] = useState(getNowDate());
    const [coordsCache, setCoordsCache] = useState<Record<string, {lat: number, lng: number}>>({});
    const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
    const [showPolyline, setShowPolyline] = useState(false);
    const [mapInstance, setMapInstance] = useState<any | null>(null);
    const [geocodingStatus, setGeocodingStatus] = useState<'idle' | 'processing' | 'done'>('idle');
    const [authError, setAuthError] = useState(false);
    
    // Store Location State
    const [storeLocation, setStoreLocation] = useState(DEFAULT_STORE_LOCATION);

    // Edit Modal State
    const [editItem, setEditItem] = useState<PickupItem | null>(null);
    const [tempAddress, setTempAddress] = useState('');
    const [tempNote, setTempNote] = useState('');

    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_API_KEY
    });

    useEffect(() => {
        (window as any).gm_authFailure = () => {
            console.error("Google Maps Authentication Failed");
            setAuthError(true);
        };
    }, []);

    // --- Fetch Store Location ---
    useEffect(() => {
        const fetchStoreLocation = async () => {
            try {
                const docRef = doc(db, 'kingdog', appId, 'settings', 'store_location');
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.lat && data.lng) {
                        setStoreLocation({ lat: data.lat, lng: data.lng });
                    }
                }
            } catch (e) {
                console.error("Failed to fetch store location", e);
            }
        };
        fetchStoreLocation();
    }, []);

    // --- Helpers ---
    const handleDateChange = (days: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(getLocalYMD(d));
    };

    const getDayLabel = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return days[date.getDay()];
    };

    // --- Data Processing (Grouped by Household) ---
    const pickupList = useMemo(() => {
        const groupMap = new Map<string, PickupItem>();
        const currentDayLabel = getDayLabel(selectedDate);

        // Helper to find customer
        const findCustomer = (dogName: string, ownerName: string) => {
            return customers.find(c => 
                (c.dogName === dogName && c.ownerName === ownerName) ||
                (c.dogs && c.dogs.some(d => d.dogName === dogName) && c.ownerName === ownerName)
            );
        };

        const addToGroup = (key: string, data: Partial<PickupItem>, dogName: string) => {
            if (groupMap.has(key)) {
                const existing = groupMap.get(key)!;
                if (!existing.dogs.includes(dogName)) {
                    existing.dogs.push(dogName);
                }
                // Merge notes if exists
                if (data.notes && !existing.notes?.includes(data.notes)) {
                    existing.notes = existing.notes ? `${existing.notes}, ${data.notes}` : data.notes;
                }
                // Prioritize 'Rare' sources (Hotel/Grooming) for label
                if (data.isRare) {
                    existing.source = data.source as any;
                    existing.sourceTypeLabel = data.sourceTypeLabel as string;
                    existing.isRare = true;
                }
            } else {
                groupMap.set(key, {
                    id: key,
                    dogs: [dogName],
                    ...data
                } as PickupItem);
            }
        };

        // 1. Hotel & Grooming
        appointments.forEach(a => {
            if (a.pickDrop && normalizeDate(a.date || a.startDate) === selectedDate) {
                const linkedCustomer = findCustomer(a.dogName, a.customerName);
                if (linkedCustomer) {
                    const key = linkedCustomer.id;
                    addToGroup(key, {
                        source: a.category === '호텔' ? 'hotel' : 'grooming',
                        sourceTypeLabel: a.category,
                        customerName: a.customerName,
                        address: linkedCustomer.address || '',
                        phone: a.contact,
                        time: a.startTime,
                        notes: a.serviceDetail || a.memo,
                        isRare: true
                    }, a.dogName);
                }
            }
        });

        // 2. Kindergarten (Fixed)
        customers.forEach(c => {
            // Check main dog
            const isMainFixed = c.kindergarten?.fixedDays?.includes(currentDayLabel);
            if (isMainFixed) {
                addToGroup(c.id, {
                    source: 'kindergarten_fixed',
                    sourceTypeLabel: '유치원(고정)',
                    customerName: c.ownerName,
                    address: c.address || '',
                    phone: c.phone,
                    time: '09:00',
                    isRare: false
                }, c.dogName);
            }
            // Check sub dogs
            c.dogs?.forEach(d => {
                if (d.kindergarten?.fixedDays?.includes(currentDayLabel)) {
                    addToGroup(c.id, {
                        source: 'kindergarten_fixed',
                        sourceTypeLabel: '유치원(고정)',
                        customerName: c.ownerName,
                        address: c.address || '',
                        phone: c.phone,
                        time: '09:00',
                        isRare: false
                    }, d.dogName);
                }
            });
        });

        // 3. Kindergarten (Flex)
        customers.forEach(c => {
            if (c.pickupDates?.includes(selectedDate)) {
                addToGroup(c.id, {
                    source: 'kindergarten_flex',
                    sourceTypeLabel: '유치원(변동)',
                    customerName: c.ownerName,
                    address: c.address || '',
                    phone: c.phone,
                    time: '09:00',
                    notes: '추가 등원',
                    isRare: false
                }, c.dogName); // Assuming main dog for simplicity in flex plan, ideally check specific dog plan
            }
        });

        // 4. Apply Temporary Address Overrides
        const list = Array.from(groupMap.values()).map(item => {
            const customer = customers.find(c => c.id === item.id);
            if (customer?.pickupHistory) {
                // Find entry for selectedDate
                const history = customer.pickupHistory.find(h => h.date === selectedDate);
                if (history) {
                    return {
                        ...item,
                        originalAddress: item.address,
                        address: history.address,
                        notes: history.note ? `[임시변경] ${history.note}` : item.notes,
                        hasTempAddress: true
                    };
                }
            }
            return item;
        });

        // Merge Coordinates & Sort
        return list
            .map(item => ({
                ...item,
                lat: coordsCache[item.address]?.lat,
                lng: coordsCache[item.address]?.lng
            }))
            .sort((a, b) => {
                if (a.isRare && !b.isRare) return -1;
                if (!a.isRare && b.isRare) return 1;
                return (a.time || '00:00').localeCompare(b.time || '00:00');
            });
    }, [appointments, customers, selectedDate, coordsCache]);

    // --- Geocoding Effect (Same as before) ---
    useEffect(() => {
        if (!isLoaded || pickupList.length === 0) return;
        if (!(window as any).google || !(window as any).google.maps) return;

        const processGeocoding = async () => {
            setGeocodingStatus('processing');
            try {
                const geocoder = new (window as any).google.maps.Geocoder();
                const newCache: Record<string, {lat: number, lng: number}> = {};
                let hasNew = false;

                for (const item of pickupList) {
                    if (item.address && !coordsCache[item.address] && !newCache[item.address]) {
                        if (item.address.length < 5) continue;
                        try {
                            const result = await new Promise<any[]>((resolve, reject) => {
                                geocoder.geocode({ address: item.address }, (results: any, status: any) => {
                                    if (status === 'OK' && results) resolve(results);
                                    else reject(status);
                                });
                            });
                            if (result[0]) {
                                const loc = result[0].geometry.location;
                                newCache[item.address] = { lat: loc.lat(), lng: loc.lng() };
                                hasNew = true;
                            }
                            await new Promise(r => setTimeout(r, 200)); 
                        } catch (e) {
                            console.error(`Geocoding failed for ${item.address}:`, e);
                        }
                    }
                }
                if (hasNew) setCoordsCache(prev => ({ ...prev, ...newCache }));
            } catch (err) { console.error(err); }
            setGeocodingStatus('done');
        };

        const needsGeocoding = pickupList.some(item => item.address && !coordsCache[item.address]);
        if (needsGeocoding && geocodingStatus !== 'processing') processGeocoding();
        else if (!needsGeocoding) setGeocodingStatus('done');

    }, [isLoaded, pickupList, coordsCache]); 

    // --- Actions ---
    const handleMapLoad = useCallback((map: any) => setMapInstance(map), []);
    const panToStore = () => { mapInstance?.panTo(storeLocation); mapInstance?.setZoom(14); };
    
    // Updated: Remove forced zoom on click
    const handleItemClick = (item: PickupItem) => {
        if (item.lat && item.lng) {
            mapInstance?.panTo({ lat: item.lat, lng: item.lng });
            // mapInstance?.setZoom(16); // Removed to prevent disorienting zoom (User Request)
            setSelectedMarkerId(item.id);
        } else {
            alert("좌표 정보가 없습니다. 주소를 확인해주세요.");
        }
    };

    // Updated: Return proper Icon object with labelOrigin
    const getMarkerIcon = (source: string) => {
        const google = (window as any).google;
        if (!google) return undefined;

        let url = 'http://maps.google.com/mapfiles/ms/icons/green-dot.png';
        if (source === 'grooming' || source === 'hotel') url = 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
        else if (source === 'kindergarten_fixed') url = 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';

        return {
            url: url,
            scaledSize: new google.maps.Size(32, 32),
            labelOrigin: new google.maps.Point(16, -10) // Position label above the marker
        };
    };

    const openNaverMap = (address: string) => {
        window.open(`https://map.naver.com/v5/search/${encodeURIComponent(address)}`, '_blank');
    };

    const polylinePath = useMemo(() => {
        if (!showPolyline) return [];
        const path = [{ ...storeLocation }];
        pickupList.forEach(item => { if (item.lat && item.lng) path.push({ lat: item.lat, lng: item.lng }); });
        path.push({ ...storeLocation });
        return path;
    }, [pickupList, showPolyline, storeLocation]);

    // --- Store Location Edit ---
    const changeStoreLocation = async () => {
        const newAddress = prompt("변경할 매장(홈) 주소를 입력해주세요:");
        if (!newAddress) return;

        if (!(window as any).google || !(window as any).google.maps) {
            alert("지도가 로드되지 않았습니다.");
            return;
        }

        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ address: newAddress }, async (results: any, status: any) => {
            if (status === 'OK' && results[0]) {
                const loc = results[0].geometry.location;
                const newLoc = { lat: loc.lat(), lng: loc.lng() };
                
                try {
                    await setDoc(doc(db, 'kingdog', appId, 'settings', 'store_location'), {
                        address: newAddress,
                        lat: newLoc.lat,
                        lng: newLoc.lng,
                        updatedAt: new Date().toISOString()
                    });
                    setStoreLocation(newLoc);
                    mapInstance?.panTo(newLoc);
                    alert(`매장 위치가 '${newAddress}'로 변경되었습니다.`);
                } catch (e) {
                    console.error(e);
                    alert("저장 실패");
                }
            } else {
                alert("해당 주소를 지도에서 찾을 수 없습니다. 정확한 도로명 주소를 입력해주세요.");
            }
        });
    };

    // --- Edit Address Logic ---
    const openEditModal = (item: PickupItem) => {
        setEditItem(item);
        setTempAddress(item.address);
        setTempNote('');
    };

    const saveTempAddress = async () => {
        if (!editItem) return;
        
        try {
            const customerRef = doc(db, 'kingdog', appId, 'customers', editItem.id);
            const historyItem: PickupHistoryItem = {
                date: selectedDate,
                address: tempAddress,
                note: tempNote || '', // Ensure no undefined value
                createdAt: new Date().toISOString()
            };

            await updateDoc(customerRef, {
                pickupHistory: arrayUnion(historyItem)
            });

            // Optimistic update handled by useMemo recalculation via customers update
            setEditItem(null);
            alert("임시 주소가 저장되었습니다.");
        } catch (e) {
            console.error(e);
            alert("저장 실패");
        }
    };

    if (loadError || authError) return <div className="p-8 text-center">지도 로드 실패</div>;

    return (
        <div className="h-full flex flex-col bg-gray-50 text-gray-900 overflow-hidden relative">
            {/* Edit Modal */}
            {editItem && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
                        <div className="bg-indigo-900 p-4 text-white flex justify-between items-center">
                            <h3 className="font-black text-lg">픽업 주소 임시 변경</h3>
                            <button onClick={() => setEditItem(null)}><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-600 bg-gray-100 p-3 rounded-lg">
                                <strong>{selectedDate}</strong> 하루만 적용되는 임시 주소입니다.<br/>
                                원래 주소는 변경되지 않습니다.
                            </p>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">변경할 주소</label>
                                <input 
                                    type="text" 
                                    value={tempAddress} 
                                    onChange={e => setTempAddress(e.target.value)} 
                                    className="w-full border p-3 rounded-xl text-sm font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">기사님 전달 메모</label>
                                <input 
                                    type="text" 
                                    value={tempNote} 
                                    onChange={e => setTempNote(e.target.value)} 
                                    placeholder="예: 미용실 앞에서 픽업" 
                                    className="w-full border p-3 rounded-xl text-sm"
                                />
                            </div>
                            <button onClick={saveTempAddress} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg">저장하기</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm shrink-0 z-10">
                <div className="flex items-center gap-4">
                    <h2 className="font-black text-lg flex items-center text-indigo-900"><Car className="mr-2"/> 픽업/드랍 관리</h2>
                    <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full border border-indigo-100">
                        {pickupList.length}가구
                    </span>
                </div>
                <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
                    <button onClick={() => handleDateChange(-1)} className="p-2 hover:bg-white rounded-md transition"><ChevronLeft className="w-4 h-4"/></button>
                    <div className="flex items-center px-4 font-black text-base text-gray-700 font-mono">
                        <Calendar className="w-4 h-4 mr-2 text-indigo-500"/> {selectedDate} <span className="ml-1 text-xs text-gray-400">({getDayLabel(selectedDate)})</span>
                    </div>
                    <button onClick={() => handleDateChange(1)} className="p-2 hover:bg-white rounded-md transition"><ChevronRight className="w-4 h-4"/></button>
                </div>
            </div>

            {/* Split Content */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                {/* Left: List View */}
                <div className="w-full md:w-[450px] bg-white border-r flex flex-col overflow-hidden z-20 shadow-xl md:shadow-none">
                    <div className="p-3 border-b bg-gray-50 flex justify-between items-center text-xs font-bold text-gray-500">
                        <span>운행 리스트 (가구 단위)</span>
                        {geocodingStatus === 'processing' && <span className="text-indigo-600 flex items-center animate-pulse"><RefreshCw className="w-3 h-3 mr-1 animate-spin"/> 위치 변환 중...</span>}
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                        {pickupList.length === 0 ? (
                            <div className="text-center text-gray-400 py-20"><Car className="w-12 h-12 mx-auto mb-3 opacity-20"/><p>픽업 일정이 없습니다.</p></div>
                        ) : (
                            pickupList.map(item => (
                                <div key={item.id} onClick={() => handleItemClick(item)} className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${selectedMarkerId === item.id ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300' : item.hasTempAddress ? 'border-orange-300 bg-orange-50' : 'border-gray-100 bg-white hover:border-gray-300'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded text-white ${item.source === 'grooming' ? 'bg-purple-500' : item.source === 'hotel' ? 'bg-red-500' : 'bg-blue-500'}`}>{item.sourceTypeLabel}</span>
                                            <span className="text-xs font-bold text-gray-400">{item.time}</span>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); openEditModal(item); }} className="text-gray-400 hover:text-indigo-600"><Edit className="w-4 h-4"/></button>
                                    </div>
                                    <div className="flex flex-col gap-1 mb-2">
                                        <div>
                                            <h3 className="font-black text-xl text-gray-900 leading-tight">
                                                {item.dogs.join(', ')}
                                            </h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                                                {item.customerName}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                총 {item.dogs.length}마리
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="text-xs text-gray-600 truncate mb-2 flex items-center">
                                        {item.hasTempAddress && <AlertTriangle className="w-3 h-3 text-orange-500 mr-1"/>}
                                        {item.address || '주소 미등록'}
                                    </div>
                                    
                                    {item.notes && (
                                        <div className="text-[10px] bg-yellow-50 text-yellow-800 p-2 rounded mb-2 border border-yellow-100 font-bold">
                                            <span className="mr-1">📢</span> {item.notes}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); openNaverMap(item.address); }} className="flex-1 py-1.5 rounded-lg border text-[10px] font-bold text-gray-600 hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition flex items-center justify-center gap-1"><Navigation className="w-3 h-3"/> 네비</button>
                                        <button className="flex-1 py-1.5 rounded-lg bg-gray-100 text-[10px] font-bold text-gray-600 hover:bg-gray-200 transition flex items-center justify-center gap-1"><Phone className="w-3 h-3"/> 전화</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right: Google Maps */}
                <div className="flex-1 relative bg-gray-200">
                    {!isLoaded ? <div className="absolute inset-0 flex items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-gray-300 border-t-indigo-600 rounded-full"/></div> : (
                        <GoogleMap mapContainerStyle={MAP_CONTAINER_STYLE} center={storeLocation} zoom={12} onLoad={handleMapLoad} options={{ disableDefaultUI: false, zoomControl: true }}>
                            <Marker position={storeLocation} icon={{ url: 'https://maps.google.com/mapfiles/kml/shapes/homegardenbusiness.png', scaledSize: new (window as any).google.maps.Size(30, 30) }} title="킹독 매장"/>
                            {showPolyline && <Polyline path={polylinePath} options={{ strokeColor: '#6366f1', strokeOpacity: 0.8, strokeWeight: 4, geodesic: true }}/>}
                            {pickupList.map(item => (
                                item.lat && item.lng && (
                                    <Marker 
                                        key={item.id} 
                                        position={{ lat: item.lat, lng: item.lng }} 
                                        icon={getMarkerIcon(item.source)} 
                                        label={{
                                            text: item.dogs.join(', '),
                                            className: 'map-marker-label',
                                            color: '#1e1b4b',
                                            fontSize: '12px',
                                            fontWeight: 'bold'
                                        }}
                                        onClick={() => setSelectedMarkerId(item.id)} 
                                        animation={selectedMarkerId === item.id ? (window as any).google.maps.Animation.BOUNCE : undefined}
                                    >
                                        {selectedMarkerId === item.id && (
                                            <InfoWindow onCloseClick={() => setSelectedMarkerId(null)}>
                                                <div className="p-2 min-w-[150px]">
                                                    <h3 className="font-bold text-sm mb-1">{item.customerName} <span className="text-xs font-normal">({item.dogs.join(', ')})</span></h3>
                                                    <p className="text-xs text-gray-600 mb-2">{item.address}</p>
                                                    <button onClick={() => openNaverMap(item.address)} className="bg-green-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-600 w-full">네비 연결</button>
                                                </div>
                                            </InfoWindow>
                                        )}
                                    </Marker>
                                )
                            ))}
                        </GoogleMap>
                    )}
                    <div className="absolute top-4 left-4 flex flex-col gap-2">
                        <button onClick={panToStore} className="bg-white p-3 rounded-full shadow-lg text-gray-700 hover:text-indigo-600 transition-transform active:scale-95 border border-gray-100" title="매장 위치로 복귀"><LocateFixed className="w-5 h-5"/></button>
                        <button onClick={() => setShowPolyline(!showPolyline)} className={`p-3 rounded-full shadow-lg transition-transform active:scale-95 border border-gray-100 ${showPolyline ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`} title="전체 경로 보기"><Route className="w-5 h-5"/></button>
                        <button onClick={changeStoreLocation} className="bg-white p-3 rounded-full shadow-lg text-gray-700 hover:text-indigo-600 transition-transform active:scale-95 border border-gray-100" title="매장 위치 변경"><Settings className="w-5 h-5"/></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PickupTab;
