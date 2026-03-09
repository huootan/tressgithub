import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Calendar,
  Clock,
  User,
  LayoutDashboard,
  History,
  PlusCircle,
  Search,
  Camera,
  CheckCircle,
  AlertCircle,
  Edit,
  Trash2,
  Save,
  X,
  Database,
  RefreshCw,
  Lock,
  Image as ImageIcon,
  ImageOff,
  KeyRound,
  Settings,
  Download,
  Upload,
  FileText,
  AlertTriangle,
  ClipboardList,
  CheckSquare,
  XCircle,
  BadgeAlert,
  ArrowRightLeft,
  Loader2,
  Info,
  Archive // New Icon
} from 'lucide-react';

// Firebase SDK Imports
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  writeBatch,
  getDoc
} from 'firebase/firestore';

// --- Firebase 初始化設定區 ---
const getFirebaseConfig = () => {
  if (typeof __firebase_config !== 'undefined') {
    return JSON.parse(__firebase_config);
  } else {
    // 🔴 請在這裡填入您的真實 Firebase 設定 🔴
    return {
      apiKey: 'AIzaSyA3szUkwzKS2fFsuF-_31FFwrCGa5qzpC4',
      authDomain: 'warehouse-system-c3ca1.firebaseapp.com',
      projectId: 'warehouse-system-c3ca1',
      storageBucket: 'warehouse-system-c3ca1.firebasestorage.app',
      messagingSenderId: '824787012597',
      appId: '1:824787012597:web:c599a8d6c03eb7d62e6ebc',
      measurementId: 'G-M72YYBL2N6',
    };
  }
};

const firebaseConfig = getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'warehouse-v7-title-fix';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('borrow'); // Admin Tabs
  const [userTab, setUserTab] = useState('borrow_form'); // User Tabs
  const [role, setRole] = useState('user');
  const [currentAdminPin, setCurrentAdminPin] = useState('8888');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    old: '',
    new: '',
    confirm: '',
  });
  
  // Data States
  const [inventory, setInventory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeLoans, setActiveLoans] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]); 
  
  // 搜尋與詳細資訊視窗狀態
  const [inventorySearch, setInventorySearch] = useState(''); // 新增搜尋關鍵字狀態
  const [viewDetailItem, setViewDetailItem] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);
  const [notification, setNotification] = useState(null);

  // 時間選擇器 Modal 狀態
  const [timePicker, setTimePicker] = useState({
    isOpen: false,
    field: null,
    tempHour: '12',
    tempMinute: '00',
    tempPeriod: 'PM',
  });

  // 刪除確認 Modal 狀態
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    itemId: null,
    itemName: '',
  });

  // 歸還 Modal 狀態
  const [returnModal, setReturnModal] = useState({
    isOpen: false,
    loan: null,
    returnQty: 1,
    isSubmitting: false
  });

  // 駁回確認 Modal 狀態
  const [rejectModal, setRejectModal] = useState({
    isOpen: false,
    request: null
  });

  const [borrowForm, setBorrowForm] = useState({
    itemId: '',
    quantity: 1,
    userName: '',
    borrowDate: '',
    borrowTime: '',
    expectedReturnDate: '',
    expectedReturnTime: '',
    photo: null,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editItemForm, setEditItemForm] = useState(null);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- Helper: Convert File to Base64 ---
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  // --- TSV 工具 ---
  const convertToTSV = (data) => {
    if (!data || !data.length) return '';
    const headers = Object.keys(data[0]);
    const headerRow = headers.join('\t');
    const rows = data.map((row) =>
      headers
        .map((fieldName) => {
          let val = row[fieldName];
          if (val === null || val === undefined) val = '';
          if (fieldName === 'imageUrl' && val.length > 100) return '[IMAGE]';
          return String(val).replace(/\t/g, ' ').replace(/\n/g, ' ');
        })
        .join('\t')
    );
    return [headerRow, ...rows].join('\n');
  };

  const parseTSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split('\t').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const values = line.split('\t');
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index]?.trim();
      });
      return obj;
    });
  };

  const exportToTxt = (data, fileName) => {
    try {
      if (data.length === 0) {
        showNotification('沒有資料可以匯出', 'error');
        return;
      }
      const textContent = convertToTSV(data);
      const blob = new Blob([textContent], {
        type: 'text/plain;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `${fileName}_${new Date().toISOString().slice(0, 10)}.txt`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('匯出成功！(內容為 Tab 分隔，可直接貼入 Excel)');
    } catch (error) {
      console.error('Export error:', error);
      showNotification('匯出失敗', 'error');
    }
  };

  // --- New Feature: Export All Data (JSON) ---
  const handleExportAllSystemData = () => {
    try {
      const fullBackup = {
        meta: {
          version: '1.0',
          exportedAt: new Date().toISOString(),
          appId: appId,
          exportedBy: user?.uid || 'anonymous'
        },
        data: {
          inventory,
          activeLoans,
          pendingRequests,
          logs
        }
      };

      const jsonString = JSON.stringify(fullBackup, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `warehouse_full_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('完整系統資料匯出成功 (JSON 格式)');
    } catch (error) {
      console.error('Export All Error:', error);
      showNotification('匯出失敗', 'error');
    }
  };

  // --- New Feature: Smart Import (Handles both TXT and JSON Backup) ---
  const handleSmartImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target.result;
        let jsonData;
        let isFullBackup = false;

        // 1. Try parsing as JSON (Full Backup)
        try {
          const parsed = JSON.parse(content);
          if (parsed.meta && parsed.data) {
            jsonData = parsed.data;
            isFullBackup = true;
          } else if (Array.isArray(parsed)) {
            // Simple JSON array (treat as inventory list)
            jsonData = parsed;
          } else {
            // Single object or unknown JSON
            jsonData = [parsed];
          }
        } catch (e) {
          // 2. Fallback to TSV/TXT parsing (Legacy Inventory Import)
          jsonData = parseTSV(content);
        }

        if (!jsonData) {
          showNotification('檔案格式錯誤或無資料', 'error');
          return;
        }

        // Helper to process chunks (Firestore batch limit is 500)
        const processBatch = async (collectionName, items) => {
          if (!items || items.length === 0) return 0;
          const chunkSize = 400; // Safe limit
          let processedCount = 0;
          
          for (let i = 0; i < items.length; i += chunkSize) {
            const batch = writeBatch(db);
            const chunk = items.slice(i, i + chunkSize);
            
            chunk.forEach(item => {
              // Use existing ID if present, otherwise generate new
              const docId = item.id || doc(collection(db, 'dummy')).id;
              // Clean item data (remove undefined/nulls that Firestore hates, and remove 'id' field from data)
              const { id, ...cleanItem } = item;
              
              // Ensure numeric fields are numbers
              if (cleanItem.total) cleanItem.total = Number(cleanItem.total);
              if (cleanItem.inStock) cleanItem.inStock = Number(cleanItem.inStock);
              if (cleanItem.quantity) cleanItem.quantity = Number(cleanItem.quantity);

              const docRef = doc(db, 'artifacts', appId, 'public', 'data', collectionName, docId);
              batch.set(docRef, cleanItem, { merge: true });
            });
            
            await batch.commit();
            processedCount += chunk.length;
          }
          return processedCount;
        };

        let totalCount = 0;

        if (isFullBackup) {
          // Restore All Collections
          if (jsonData.inventory) totalCount += await processBatch('inventory', jsonData.inventory);
          if (jsonData.activeLoans) totalCount += await processBatch('active_loans', jsonData.activeLoans);
          if (jsonData.pendingRequests) totalCount += await processBatch('pending_requests', jsonData.pendingRequests);
          if (jsonData.logs) totalCount += await processBatch('logs', jsonData.logs);
          
          showNotification(`系統還原成功！共處理 ${totalCount} 筆資料`);
        } else {
          // Legacy Inventory Import logic
          if (!Array.isArray(jsonData) || jsonData.length === 0) {
             showNotification('無法讀取資料', 'error');
             return;
          }
          
          const batch = writeBatch(db);
          let count = 0;
          
          jsonData.forEach((row) => {
            const nameZh = row['中文名稱'] || row['nameZh'];
            const nameEn = row['英文名稱'] || row['nameEn'] || '';
            const location = row['位置'] || row['location'] || '未分類';
            const total = parseInt(row['總數量'] || row['total'] || 0);

            if (nameZh && total > 0) {
              const docRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'inventory'));
              const inStock = row['在庫數量'] !== undefined ? parseInt(row['在庫數量']) : 
                              row['inStock'] !== undefined ? parseInt(row['inStock']) : total;

              batch.set(docRef, {
                nameZh,
                nameEn,
                location,
                total,
                inStock,
                imageUrl: '' 
              });
              count++;
            }
          });

          if (count > 0) {
            await batch.commit();
            showNotification(`成功匯入 ${count} 筆器材資料 (庫存)`);
          } else {
            showNotification('匯入失敗：無有效資料', 'error');
          }
        }

      } catch (error) {
        console.error('Import error:', error);
        showNotification('讀取檔案失敗，請確認格式', 'error');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleExportInventory = () => {
    const exportData = inventory.map((item) => ({
      中文名稱: item.nameZh,
      英文名稱: item.nameEn,
      位置: item.location,
      總數量: item.total,
      在庫數量: item.inStock,
    }));
    exportToTxt(exportData, '器材庫存清單');
  };

  const handleExportActiveLoans = () => {
    const exportData = activeLoans.map((item) => ({
      器材名稱: item.nameZh,
      借用人: item.borrower,
      借出數量: item.quantity,
      借出時間: item.borrowTime,
      預計歸還: item.expectedReturnTime,
      狀態: item.status,
    }));
    exportToTxt(exportData, '目前借出清單');
  };

  const handleExportLogs = () => {
    const exportData = logs.map((item) => ({
      時間: item.timestamp,
      動作: item.action,
      器材名稱: item.nameZh,
      數量: item.quantity,
      操作人: item.borrower,
      歸還時間: item.actualReturnTime || '-',
    }));
    exportToTxt(exportData, '借還歷史紀錄');
  };

  // --- Auth & System Logic ---
  const handleRoleSwitch = (targetRole) => {
    if (targetRole === 'admin') {
      if (role === 'admin') return;
      setLoginPassword('');
      setShowLoginModal(true);
    } else {
      setRole('user');
      setUserTab('borrow_form'); 
      showNotification('已切換為使用者模式');
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (loginPassword === currentAdminPin) {
      setRole('admin');
      setActiveTab('approval');
      showNotification('管理員登入成功');
      setShowLoginModal(false);
    } else {
      show