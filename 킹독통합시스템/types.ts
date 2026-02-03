
export interface Transaction {
  id: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  category: string;
  serviceDetail: string;
  dogName: string;
  customerName: string;
  contact: string;
  customerId?: string;
  dogBreed?: string;
  price: number;
  quantity: number;
  discountValue: number;
  discountType: 'amount' | 'percent';
  paidAmount: number;
  paymentMethod: string;
  extraDogCount?: number;
  isRunning?: boolean;
  type: string;
  memo?: string;
  isUploaded?: boolean;
  createdAt?: string;
  billed?: number;
  pickDrop?: boolean;
  isCompleted?: boolean;
  confirmer?: string; // 지출 장부용 확인자 (직원)
  ticketProcessed?: boolean; // 이용권 처리 여부 (Phase 2)
}

export interface WeightRecord {
  date: string;
  weight: number;
}

// Phase 1: Ticket System Types
export interface TicketLog {
  id: string;
  date: string;       // 발생 일시 (YYYY-MM-DD HH:mm)
  type: 'init' | 'charge' | 'use' | 'edit' | 'cancel' | 'restore'; // 초기화, 충전, 사용(차감), 수정, 취소, 복구
  amount: number;     // 변동 횟수 (예: +10, -1)
  prevRemaining: number; // 변경 전 잔여
  newRemaining: number;  // 변경 후 잔여
  staffName: string;  // 담당자 실명 (책임자)
  reason?: string;    // 사유
}

// [New] Pickup Change History
export interface PickupHistoryItem {
    date: string;       // YYYY-MM-DD
    address: string;    // Changed Address
    note?: string;      // Driver Note (e.g., "Only pick up Gong-i")
    createdAt: string;
}

// [New] Individual Dog Profile Interface
export interface Dog {
  id: string; // Internal UUID for the dog
  dogName: string;
  breed?: string;
  birthDate?: string;
  gender?: '수컷' | '암컷';
  isNeutered?: boolean;
  weight?: string;
  regNumber?: string;
  photoUrl?: string;
  
  // Health & Care
  vaccinations?: Customer['vaccinations'];
  parasitePreventionDate?: string;
  vetName?: string;
  vetPhone?: string;
  allergies?: string;
  diseases?: string;
  surgeryHistory?: string;

  // Behavior
  peopleReaction?: string;
  dogReaction?: string;
  biteHistory?: boolean;
  resourceGuarding?: boolean;
  separationAnxiety?: boolean;
  barking?: string;
  fears?: string;
  sensitiveAreas?: string;

  // Habits
  pottyHabits?: string;
  marking?: boolean;
  eatingHabits?: string;
  playStyle?: string;

  // Kindergarten specific
  kindergarten?: Customer['kindergarten'];
  ticket?: Customer['ticket']; // Ticket assigned to specific dog
  
  notes?: string; // Dog specific notes
  weightHistory?: WeightRecord[];
}

export interface Customer {
  id: string;
  // 1. 기본 정보 (Main Representative or Single Dog)
  customerNumber?: string;
  createdAt?: string;
  dogName: string;
  photoUrl?: string;
  breed?: string;
  birthDate?: string;
  gender?: '수컷' | '암컷';
  isNeutered?: boolean;
  regNumber?: string;
  weight?: string;
  weightHistory?: WeightRecord[]; 

  // [Phase 1] 캐싱된 잔액 필드 (가구 통합)
  balance?: number; 
  lastBalanceUpdate?: string; // 마지막 업데이트 시점

  // [Phase 1] 유치원 이용권 (Ticket) - Legacy support
  ticket?: {
    total: number;        // 총 횟수 (누적 충전량 아님, 현재 유효한 패키지의 총량 개념 or 단순 참고용)
    remaining: number;    // 현재 잔여 횟수
    startDate: string;    // 이용권 시작일 (YYYY-MM-DD)
    expiryDate: string;   // 유효기간 (YYYY-MM-DD)
    lastUpdated: string;
    history: TicketLog[]; // 로그 배열
  };

  // [New] Multi-dog Array (1 Household N Dogs)
  dogs?: Dog[];

  // [New] Pickup History (Address changes per date)
  pickupHistory?: PickupHistoryItem[];

  // 2. 건강 정보
  vaccinations?: {
    dhpp?: boolean;
    corona?: boolean;
    kennel?: boolean;
    flu?: boolean;
    rabies?: boolean;
  };
  parasitePreventionDate?: string;
  vetName?: string;
  vetPhone?: string;
  allergies?: string;
  diseases?: string;
  surgeryHistory?: string;

  // 3. 행동 및 성향
  peopleReaction?: string;
  dogReaction?: string;
  biteHistory?: boolean;
  resourceGuarding?: boolean;
  separationAnxiety?: boolean;
  barking?: string;
  fears?: string;
  sensitiveAreas?: string;

  // 4. 생활 습관
  pottyHabits?: string;
  marking?: boolean;
  eatingHabits?: string;
  playStyle?: string;

  // 5. 보호자 정보 (Common)
  ownerName: string;
  address?: string;
  phone: string;
  emergencyContact?: string;
  
  // 기타
  channel?: string;
  notes?: string;
  isDepositExempt?: boolean;

  // 6. 유치원 전용 관리 정보
  kindergarten?: {
      classType?: string;
      foodType?: string;
      hasPrivateFood?: boolean;
      hasToothbrush?: boolean;
      toothbrushPhotoUrl?: string;
      mealTime?: string;
      mealTimes?: string[];
      mealAmount?: string;
      walkingNotes?: string;
      likes?: string;
      dislikes?: string;
      caution?: string;
      dailyNotes?: string;
      fixedDays?: string[];
      isFlexible?: boolean; // 비정기 등원 여부
      isRecess?: boolean;   // 휴원 여부
  };
  
  plannedDates?: string[];
  pickupDates?: string[];
}

export interface Product {
  id: string;
  category: string;
  name: string;
  price: number;
  order?: number; // 순서 정렬용
}

export interface ExpenseCategory {
  id: string;
  category: string; // 대분류
  name: string; // 상세내역
  createdAt?: string;
  order?: number; // 순서 정렬용
}

export interface Appointment extends Transaction {
  groomingOptions?: {
    face: string;
    body: string;
    legs: string;
    spa: boolean;
    pack: boolean;
    boots: boolean;
  };
  status: '상담중' | '예약완료' | '취소';
  staffStart?: string;
  staffEnd?: string;
  depositAccount?: string;
  deposit?: number;
  duration: number;
  date?: string;
  room?: string;
  careInfo?: string; 
  belongingPhotos?: { url: string; comment: string }[]; 
}

export interface Task {
  id: string;
  title: string;
  requester?: string; 
  assignee: string; 
  dueDate: string;
  status: 'pending' | 'done' | 'postponed' | 'delegated' | 'cancelled'; 
  history?: { action: string, date: string, by: string, note?: string }[]; 
  priority: 'high' | 'medium' | 'low';
  content?: string; 
  importance?: boolean; 
  urgency?: boolean; 
  type?: 'general' | 'matrix'; 
  evaluation?: 'A' | 'B' | 'C' | 'D'; 
  createdAt: string;
  isDone?: boolean; 
}

// [New] Routine Checklist Types
export interface ChecklistItem {
    id: string;
    label: string;
}

export interface ChecklistSection {
    id: string;
    title: string;
    targets: ChecklistItem[]; // Rows (Names)
    actions: ChecklistItem[]; // Columns (Tasks)
    order: number;
    createdAt?: string;
}

export interface Staff {
  id: string;
  name: string;
  role: string; 
  color: string; 
  phone?: string;
  isActive: boolean;
  joinedAt: string;
}

export interface Handover {
  id: string;
  date: string;
  author: string;
  category: string; 
  content: string;
  isImportant: boolean;
  isChecked: boolean;
  createdAt: string;
  photos?: { url: string; comment: string }[];
}

export type AttendanceStatus = 'absent' | 'present' | 'pickup_ready' | 'home';

export interface AttendanceLog {
  id: string; 
  date: string;
  dogId: string;
  dogName: string;
  status: AttendanceStatus;
  arrivalTime?: string;
  pickupTime?: string;
  updatedAt: string;
}

// Updated Comment Interface
export interface Comment {
  id: string;
  author: string; 
  text: string;
  createdAt: string;
  role: 'teacher' | 'parent'; 
}

// Updated MediaItem
export interface MediaItem {
    id: string;
    url: string;
    type: 'image' | 'video'; // Video support
    caption?: string; 
    comments: Comment[]; // Bidirectional comments
}

export interface CurriculumItem {
    id: string;
    name: string; 
    score: number; // 1-5
}

// Updated KindergartenDailyRecord
export interface KindergartenDailyRecord {
  id: string; 
  date: string;
  dogId: string;
  
  coverPhotoUrl?: string;

  health: {
    skin: number;
    coat: number;
    defecation: number;
    teeth: number;
    hygiene: number;
    condition: number;
    stress?: number;
    energy?: number;
    appetite?: number;
  };

  curriculum: CurriculumItem[];
  walking?: boolean; // New: 산책 여부

  activity?: {
    socialization: number; 
    agility: number; 
    nosework: number; 
    obedience: number; 
  };

  meal: {
    morning: boolean;
    afternoon: boolean;
    amount: string; 
  };
  
  napTime: string; 
  comment: string; 
  
  photos: MediaItem[]; // Updated structure
  
  updatedAt: string;
  likes: string[]; 
  comments: Comment[]; 
}

export interface ParentPost {
  id: string;
  dogId: string;
  date: string;
  authorName: string;
  photoUrl: string;
  content: string;
  likes: string[];
  comments: Comment[];
  createdAt: string;
}

export interface UploadTask {
    id: string;
    file: File;
    dogId: string;
    type: 'daily' | 'cover';
    status: 'pending' | 'uploading' | 'completed' | 'error';
    progress: number;
}

export interface DailyReport {
  meal: boolean;
  poo: boolean;
  condition: 'good' | 'normal' | 'caution';
  note: string;
}

// New Types for Premium Features
export interface Notification {
    id: string;
    type: 'comment' | 'home_record' | 'system';
    message: string;
    targetId: string; // dogId or recordId
    isRead: boolean;
    createdAt: string;
    link?: string;
}

export interface HomeRecord {
    id: string;
    dogId: string;
    authorName: string;
    date: string;
    createdAt: string;
    mediaUrl: string;
    mediaType: 'image' | 'video';
    text: string;
    comments: Comment[];
}

export interface CurriculumSetting {
    items: string[];
}

export interface MonthlyRecord {
    id: string;
    dogId: string;
    month: string; // YYYY-MM
    teacherComment: string;
    updatedAt: string;
}
