
export const formatCurrency = (amount: number | string | undefined) => new Intl.NumberFormat('ko-KR').format(Number(amount) || 0);

export const getLocalYMD = (d?: Date | null) => {
    if (!d) d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const getNowDate = () => getLocalYMD(new Date());
export const getNowTime = () => new Date().toTimeString().slice(0, 5);

export const normalizeDate = (dateStr: any) => {
    if (!dateStr) return getNowDate();
    let str = dateStr;
    if (typeof str !== 'string') str = String(str);
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const numbers = str.match(/\d+/g);
    if (!numbers || numbers.length < 3) return str;
    const year = numbers[0];
    const month = String(numbers[1]).padStart(2, '0');
    const day = String(numbers[2]).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const calculateAge = (birthDate?: string) => {
    if (!birthDate) return '';
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? `${age}세` : '';
};

export const getCustomerKey = (t: any) => {
    if (t.customerId) return t.customerId; 
    const name = (t.dogName || '').trim().replace(/\s+/g, '');
    const phone = (t.contact || '').trim().replace(/[^0-9]/g, ''); 
    const owner = (t.customerName || '').trim();
    if (name && phone) return `${name}_${phone}`;
    if (name && owner) return `${name}_${owner}`;
    return name || 'unknown';
};

// Phase 3: 잔액 변동분 계산 (입금액 - 청구액)
// +값: 초과 입금 (적립금 증가)
// -값: 미납 (미수금 증가)
export const calculateTransactionDiff = (t: any) => {
    if (t.type !== '수입') return 0;
    
    // 청구액 계산
    const unitPrice = (t.price || 0) + ((t.extraDogCount || 0) * 10000);
    const base = unitPrice * (t.quantity || 1);
    let discount = 0;
    if (t.discountType === 'percent') {
        discount = base * ((t.discountValue || 0) / 100);
    } else {
        discount = t.discountValue || 0;
    }
    const billed = base - discount;
    
    // 입금액
    const paid = t.paidAmount || 0;
    
    return paid - billed;
};

export const copyToClipboardFallback = (text: string) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const successful = document.execCommand('copy');
    if (successful) return true;
  } catch (err) {
    console.error('Fallback 복사 실패:', err);
  } finally {
    document.body.removeChild(textArea);
  }
  return false;
};

export const readCSVFile = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const readerKR = new FileReader();
    readerKR.onload = (e) => {
      const textKR = e.target?.result as string;
      const keywords = ['이름', '고객', '견종', '전화', '단가', '상품', '날짜', '금액', '성함', '분류', '상세내역'];
      const isKR = keywords.some(k => textKR.includes(k));
      if (isKR) resolve(textKR);
      else {
        const readerUTF = new FileReader();
        readerUTF.onload = (evt) => resolve(evt.target?.result as string);
        readerUTF.readAsText(file, 'UTF-8');
      }
    };
    readerKR.readAsText(file, 'EUC-KR');
  });
};

export const parseCSV = (text: string) => {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  let headerIndex = 0;
  const keywords = ['이름', '견명', '반려견', '보호자', '견주', '전화번호', '휴대폰', '단가', '상품명', '고객번호', '성함', '날짜', '분류'];
  for(let i=0; i<Math.min(lines.length, 20); i++) {
      const line = lines[i];
      if (keywords.some(k => line.includes(k))) {
          headerIndex = i;
          break;
      }
  }
  const headers = lines[headerIndex].split(',').map(h => h.trim());
  return lines.slice(headerIndex + 1).map(line => {
    const values: string[] = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuote = !inQuote;
      else if (char === ',' && !inQuote) {
        values.push(current.trim());
        current = '';
      } else current += char;
    }
    values.push(current.trim());
    const obj: any = {};
    headers.forEach((h, i) => {
      // 키 생성 시 특수문자 제거 후 매칭을 위해 단순화
      const key = h.replace(/\s/g, '').replace(/[^\w가-힣]/g, ''); 
      obj[key] = values[i] || '';
    });
    return obj;
  });
};

export const downloadCSV = (headers: string[], data: any[], filename: string) => {
  const headerLine = headers.join(',');
  const rows = data.map(row => 
    headers.map(header => {
      const val = row[header] ? String(row[header]).replace(/"/g, '""') : '';
      return `"${val}"`;
    }).join(',')
  ).join('\n');
  const blob = new Blob([`\uFEFF${headerLine}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
};

// --- Customer Upload Helpers ---

// 1. 헤더와 데이터 필드 매핑 정의 (양식 다운로드 및 업로드 공용)
export const CUSTOMER_CSV_MAP = [
    // 기본정보
    { header: '고객번호', key: 'customerNumber' },
    { header: '작성일', key: 'createdAt' },
    { header: '강아지이름', key: 'dogName' },
    { header: '견종', key: 'breed' },
    { header: '생년월일', key: 'birthDate' }, // YYYY-MM-DD
    { header: '성별', key: 'gender' },
    { header: '중성화여부', key: 'isNeutered', type: 'boolean' },
    { header: '동물등록번호', key: 'regNumber' },
    { header: '몸무게', key: 'weight' },
    // 건강 (중첩)
    { header: '종합백신', key: 'vaccinations.dhpp', type: 'boolean' },
    { header: '코로나', key: 'vaccinations.corona', type: 'boolean' },
    { header: '켄넬코프', key: 'vaccinations.kennel', type: 'boolean' },
    { header: '인플루엔자', key: 'vaccinations.flu', type: 'boolean' },
    { header: '광견병', key: 'vaccinations.rabies', type: 'boolean' },
    { header: '심장사상충날짜', key: 'parasitePreventionDate' },
    { header: '주거래병원', key: 'vetName' },
    { header: '병원연락처', key: 'vetPhone' },
    { header: '알레르기', key: 'allergies' },
    { header: '질병', key: 'diseases' },
    { header: '수술이력', key: 'surgeryHistory' },
    // 행동
    { header: '사람반응', key: 'peopleReaction' },
    { header: '다른개반응', key: 'dogReaction' },
    { header: '입질이력', key: 'biteHistory', type: 'boolean' },
    { header: '자원방어', key: 'resourceGuarding', type: 'boolean' },
    { header: '분리불안', key: 'separationAnxiety', type: 'boolean' },
    { header: '짖음', key: 'barking' },
    { header: '두려움', key: 'fears' },
    { header: '예민부위', key: 'sensitiveAreas' },
    // 습관
    { header: '배변습관', key: 'pottyHabits' },
    { header: '마킹여부', key: 'marking', type: 'boolean' },
    { header: '식습관', key: 'eatingHabits' },
    { header: '놀이스타일', key: 'playStyle' },
    // 보호자
    { header: '보호자성함', key: 'ownerName' },
    { header: '연락처', key: 'phone' },
    { header: '주소', key: 'address' },
    { header: '비상연락망', key: 'emergencyContact' },
    { header: '메모', key: 'notes' },
];

const parseBool = (val: string) => {
    if(!val) return false;
    const v = val.trim().toUpperCase();
    return ['O', 'Y', 'YES', '예', 'TRUE', '1'].includes(v);
};

// 2. CSV 데이터를 Customer 객체로 변환
export const processCustomerUpload = (rawData: any[]) => {
    return rawData.map(row => {
        const customer: any = { vaccinations: {} };
        
        CUSTOMER_CSV_MAP.forEach(field => {
            // parseCSV는 헤더에서 공백/특수문자를 제거한 키를 생성하므로, 매핑 키도 동일하게 처리하여 찾음
            const lookupKey = field.header.replace(/\s/g, '').replace(/[^\w가-힣]/g, '');
            const rawVal = row[lookupKey];
            
            let val: any = rawVal;
            if (field.type === 'boolean') {
                val = parseBool(rawVal);
            }

            if (field.key.includes('.')) {
                // 중첩 객체 처리 (예: vaccinations.dhpp)
                const [parent, child] = field.key.split('.');
                if (!customer[parent]) customer[parent] = {};
                customer[parent][child] = val;
            } else {
                customer[field.key] = val;
            }
        });

        // 필수값 보정
        if (!customer.createdAt) customer.createdAt = getNowDate();
        
        return customer;
    }).filter(c => c.dogName && c.ownerName); // 최소한의 유효성 검사
};

// --- Transaction Upload Helpers ---

export const TRANSACTION_CSV_MAP = [
    { header: '날짜', key: 'startDate' }, // YYYY-MM-DD
    { header: '시간', key: 'startTime' }, // HH:mm
    { header: '종료날짜', key: 'endDate' }, 
    { header: '종료시간', key: 'endTime' },
    { header: '분류', key: 'category' }, // e.g. 유치원, 호텔
    { header: '상세내역', key: 'serviceDetail' },
    { header: '반려견명', key: 'dogName' },
    { header: '보호자명', key: 'customerName' },
    { header: '연락처', key: 'contact' },
    { header: '단가', key: 'price', type: 'number' },
    { header: '수량', key: 'quantity', type: 'number' },
    { header: '할인액', key: 'discountValue', type: 'number' },
    { header: '실결제액', key: 'paidAmount', type: 'number' },
    { header: '결제수단', key: 'paymentMethod' }, // 카드, 현금...
    { header: '메모', key: 'memo' },
];

// 지출 장부용 CSV 매핑
export const EXPENSE_CSV_MAP = [
    { header: '날짜', key: 'startDate' },
    { header: '시간', key: 'startTime' },
    { header: '분류', key: 'category' },
    { header: '상세내역', key: 'serviceDetail' },
    { header: '확인자', key: 'confirmer' },
    { header: '실결제액', key: 'paidAmount', type: 'number' },
    { header: '메모', key: 'memo' },
];

export const processTransactionUpload = (rawData: any[], type: string) => {
    return rawData.map(row => {
        const t: any = { 
            type, // Force current type (수입 or 지출)
            discountType: 'amount', // Default
            isRunning: false,
            extraDogCount: 0,
            isUploaded: true
        };
        
        const mapToUse = type === '지출' ? EXPENSE_CSV_MAP : TRANSACTION_CSV_MAP;

        mapToUse.forEach(field => {
            const lookupKey = field.header.replace(/\s/g, '').replace(/[^\w가-힣]/g, '');
            let val = row[lookupKey];

            if (field.type === 'number') {
                // Use parseFloat to preserve decimals (e.g. 0.5)
                val = parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
            }
            
            t[field.key] = val;
        });

        // Discount Logic (Income Only): if 0 < val <= 1, treat as percent (e.g. 0.5 -> 50%)
        if (type === '수입') {
            if (t.discountValue > 0 && t.discountValue <= 1) {
                t.discountType = 'percent';
                t.discountValue = t.discountValue * 100;
            } else {
                t.discountType = 'amount';
            }
        }

        // Normalize Dates (CSV format 2026.1.13 -> 2026-01-13)
        if (t.startDate) t.startDate = normalizeDate(t.startDate);
        if (t.endDate) t.endDate = normalizeDate(t.endDate);

        // Defaults and fallbacks
        if (!t.startDate) t.startDate = getNowDate();
        if (!t.startTime) t.startTime = "00:00";
        if (!t.endDate) t.endDate = t.startDate;
        if (!t.endTime) t.endTime = t.startTime;
        if (!t.quantity) t.quantity = 1;
        
        // Sanitize strings
        t.dogName = t.dogName || '';
        t.customerName = t.customerName || '';
        
        return t;
    }).filter(t => t.category && (t.price > 0 || t.paidAmount > 0)); // Basic validation
};
