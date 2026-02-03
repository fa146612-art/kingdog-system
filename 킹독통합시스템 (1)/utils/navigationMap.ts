

export interface NavItem {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  parentGroup?: string; // The ID of the parent group if it's a sub-tab
}

export const NAV_ITEMS: NavItem[] = [
  // 1. 장부 (Single)
  { 
    id: 'ledger', 
    label: '장부', 
    description: '매출, 지출, 수입 내역을 관리하고 실시간 장부를 확인하는 메인 화면', 
    keywords: ['장부', '매출', '수입', '지출', '결제', '메인', '홈'] 
  },
  
  // 2. 유치원 Group
  { 
    id: 'kinder_info', 
    label: '유치원생 정보', 
    description: '유치원 등원 강아지들의 상세 정보, 알러지, 특이사항, 보호자 정보 관리', 
    keywords: ['유치원', '원생', '강아지정보', '프로필', '특이사항'], 
    parentGroup: 'kindergarten' 
  },
  { 
    id: 'dailyReport', 
    label: '알림장/생활기록', 
    description: '보호자에게 보낼 알림장 작성, 배변/식사 기록, 사진 업로드, 월간 생활기록부 관리', 
    keywords: ['알림장', '일지', '생활기록', '사진', '보호자공유', '월간리포트', '성장리포트'], 
    parentGroup: 'kindergarten' 
  },
  { 
    id: 'attendance', 
    label: '출석부', 
    description: '일일 출석 체크 및 주간 등원 계획표 관리', 
    keywords: ['출석', '등원', '하원', '결석', '주간계획', '스케줄'], 
    parentGroup: 'kindergarten' 
  },

  // 3. 운영관리 Group
  { 
    id: 'hotelRes', 
    label: '호텔예약', 
    description: '호텔 객실 예약 현황 확인, 신규 예약 등록, CCTV 정보 확인', 
    keywords: ['호텔', '예약', '객실', '숙박', '체크인', '체크아웃'], 
    parentGroup: 'ops' 
  },
  { 
    id: 'grooming', 
    label: '미용예약', 
    description: '미용 스케줄 관리, 예약 상담, 미용사 배정', 
    keywords: ['미용', '그루밍', '목욕', '컷', '스타일', '예약'], 
    parentGroup: 'ops' 
  },
  { 
    id: 'tasks', 
    label: '업무할당', 
    description: '직원별 업무 배정, 중요/긴급 업무 매트릭스 관리', 
    keywords: ['업무', '할당', '투두', 'Task', '매니저', '지시'], 
    parentGroup: 'ops' 
  },
  { 
    id: 'handover', 
    label: '인수인계', 
    description: '직원 간 전달사항, 특이사항, 사고 보고 등 인수인계 노트', 
    keywords: ['인수인계', '전달', '노트', '메모', '공지'], 
    parentGroup: 'ops' 
  },
  { 
    id: 'pickup', 
    label: '픽업관리', 
    description: '유치원, 호텔, 미용 픽업/드랍 차량 운행 스케줄 관리', 
    keywords: ['픽업', '드랍', '차량', '운행', '셔틀', '이동'], 
    parentGroup: 'ops' 
  },

  // 4. 매출/통계 Group
  { 
    id: 'analysis', 
    label: '경영분석', 
    description: '월별 매출 추이, 카테고리별 비중, 고객 랭킹 등 경영 데이터 분석', 
    keywords: ['분석', '통계', '그래프', '매출표', '순수익', '차트'], 
    parentGroup: 'finance' 
  },
  { 
    id: 'balance', 
    label: '미수/적립', 
    description: '고객별 미수금 및 적립금 현황 관리, 정산 내역 확인', 
    keywords: ['미수', '외상', '적립금', '선불', '잔액', '정산'], 
    parentGroup: 'finance' 
  },

  // 5. 고객/기초 Group
  { 
    id: 'customers', 
    label: '고객관리', 
    description: '전체 고객 명단 조회, 신규 등록, 정보 수정, 엑셀 업로드', 
    keywords: ['고객', '보호자', '명단', '검색', '등록', '엑셀'], 
    parentGroup: 'admin' 
  },
  { 
    id: 'staff', 
    label: '직원관리', 
    description: '직원 명단, 연락처, 역할 및 권한 관리', 
    keywords: ['직원', '스태프', '인사', '채용', '선생님'], 
    parentGroup: 'admin' 
  },
  { 
    id: 'consultations', 
    label: '상담관리', 
    description: '고객 상담 이력 관리 및 메모', 
    keywords: ['상담', '문의', '기록'], 
    parentGroup: 'admin' 
  },
  { 
    id: 'products', 
    label: '상품관리', 
    description: '서비스 품목 및 가격 설정 (호텔, 유치원 등)', 
    keywords: ['상품', '가격', '메뉴', '단가', '설정'], 
    parentGroup: 'admin' 
  },
  { 
    id: 'expenses', 
    label: '지출항목 관리', 
    description: '매장 운영 지출 카테고리 및 상세 항목 관리', 
    keywords: ['지출', '항목', '카테고리', '비용', '설정'], 
    parentGroup: 'admin' 
  },
  {
    id: 'migration',
    label: '데이터 관리',
    description: '시스템 데이터 구조 변경 및 마이그레이션 도구',
    keywords: ['설정', '데이터', '초기화', '관리자', '잔액'],
    parentGroup: 'admin'
  }
];