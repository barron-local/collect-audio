import { useState, useEffect } from 'react';
import type { Campaign } from './types';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminPinAuth } from './components/AdminPinAuth';
import { UserRecorder } from './components/UserRecorder';
import { GenderModal } from './components/GenderModal';
import { getCampaigns } from './utils/dataService';
import { Folder, Search, X, ArrowLeft } from 'lucide-react';
import { saveVerifiedGender, verifyGenderIntegrity } from './utils/genderIntegrity';
import { fetchServerGenderChangeCount, incrementServerGenderChangeCount, MAX_GENDER_CHANGES_PER_DAY } from './utils/deviceGenderLimit';

export function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(
    sessionStorage.getItem('admin_auth_token') === 'true'
  );

  // กลับไปใช้ค่า voice_user_gender จาก localStorage ตามเดิม
  const [userGender, setUserGender] = useState<'male' | 'female' | ''>(
    () => (localStorage.getItem('voice_user_gender') as 'male' | 'female') || ''
  );
  const [showGenderModal, setShowGenderModal] = useState(false);

  // Filter & Search states
  const [genderFilter, setGenderFilter] = useState<'all' | 'all_target' | 'male' | 'female'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tamperWarning, setTamperWarning] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  // Server-backed Gender Change Quota
  const [serverChangeCount, setServerChangeCount] = useState(0);
  const remainingGenderChanges = Math.max(0, MAX_GENDER_CHANGES_PER_DAY - serverChangeCount);

  const refreshQuota = async () => {
    const count = await fetchServerGenderChangeCount();
    setServerChangeCount(count);
  };

  useEffect(() => {
    refreshQuota();
  }, [showGenderModal]);

  // ตรวจสอบความถูกต้องของเพศเมื่อโหลดเข้าเว็บ (Anti-Tamper & Warning Message)
  useEffect(() => {
    const checkTampering = async () => {
      const saved = localStorage.getItem('voice_user_gender');
      const hasEverSelected = localStorage.getItem('voice_user_ever_selected') === 'true';

      // กรณีที่ 1: เคยเลือกเพศแล้ว แต่ไปแอบลบค่าใน localStorage
      if (!saved && hasEverSelected) {
        setTamperWarning('ตรวจพบการพยายามลบข้อมูลเพศในระบบ ระบบรับรู้การกระทำทั้งหมดและคืนค่าเดิมให้เรียบร้อย');
        setUserGender('male');
        await saveVerifiedGender('male');
        return;
      }

      if (!saved) {
        setShowGenderModal(true);
        return;
      }

      // กรณีที่ 2: มีค่า แต่ Signature ไม่ตรง (แอบพิมพ์แก้ค่าใน DevTools)
      const isValid = await verifyGenderIntegrity(saved);
      if (!isValid) {
        setTamperWarning(`ตรวจพบการแก้ไขข้อมูลเพศใน LocalStorage โดยไม่ผ่านระบบ ระบบรับรู้การกระทำทั้งหมดและคืนค่าเดิมให้เรียบร้อย`);
        const restoredGender = saved === 'female' ? 'male' : 'female';
        setUserGender(restoredGender);
        await saveVerifiedGender(restoredGender);
      } else {
        setUserGender(saved as 'male' | 'female');
      }
    };

    checkTampering();
  }, []);

  const handleSelectGender = async (gender: 'male' | 'female') => {
    // ถ้าเคยเลือกเพศอยู่แล้วและกดสลับเพศ ให้ตรวจและหักโควตาในฐานข้อมูล Supabase
    if (userGender && userGender !== gender) {
      const currentCount = await fetchServerGenderChangeCount();
      if (currentCount >= MAX_GENDER_CHANGES_PER_DAY) {
        setServerChangeCount(currentCount);
        return;
      }
      const newCount = await incrementServerGenderChangeCount();
      setServerChangeCount(newCount);
    }

    setUserGender(gender);
    localStorage.setItem('voice_user_ever_selected', 'true');
    await saveVerifiedGender(gender);
    setShowGenderModal(false);
  };

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    setSelectedCampaign(null);
  };

  const fetchCampaigns = async () => {
    try {
      const data = await getCampaigns();
      setCampaigns(data);
    } catch (err) {
      console.error('Failed to fetch campaigns', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [currentPath]);

  // Real-time polling every 1 second
  useEffect(() => {
    const interval = setInterval(() => {
      getCampaigns().then((data) => {
        setCampaigns(data);
      }).catch((err) => {
        console.error('Silent refresh failed', err);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleAdminLogout = () => {
    sessionStorage.removeItem('admin_auth_token');
    setIsAdminAuthenticated(false);
    navigateTo('/');
  };

  const isAdminRoute = currentPath === '/admin' || currentPath.startsWith('/admin/');
  const isHomeRoute = currentPath === '/' || currentPath === '';
  const isNotFoundRoute = !isAdminRoute && !isHomeRoute;

  // Filter campaigns by search & gender target
  const filteredCampaigns = campaigns.filter((camp) => {
    // 1. Search filter (title, textToRead, description)
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || 
      camp.title.toLowerCase().includes(q) || 
      camp.textToRead.toLowerCase().includes(q) || 
      (camp.description && camp.description.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    // 2. Gender target filter
    const target = camp.targetGender || 'all';
    if (genderFilter === 'all') return true;
    if (genderFilter === 'all_target') return target === 'all';
    if (genderFilter === 'male') return target === 'male';
    if (genderFilter === 'female') return target === 'female';

    return true;
  });

  return (
    <div className="min-h-screen bg-white text-[#37352f] flex flex-col font-sans">
      {/* Top Bar */}
      <header className="h-12 border-b border-[#e9e9e7] px-6 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-xs z-40">
        <div 
          onClick={() => {
            if (isAdminRoute) navigateTo('/admin');
            else { setSelectedCampaign(null); navigateTo('/'); }
          }}
          className="text-sm font-semibold tracking-tight text-[#37352f] cursor-pointer flex items-center gap-2 hover:opacity-80 transition"
        >
          <span>Voice Collector</span>
        </div>

        <div className="flex items-center gap-3">
          {!isAdminRoute && (
            <button
              onClick={() => setShowGenderModal(true)}
              className="text-xs text-[#787774] hover:text-[#37352f] flex items-center gap-1.5 py-1 px-2 rounded border border-[#e9e9e7] hover:bg-[#f7f6f3] transition cursor-pointer"
              title="คลิกเพื่อเปลี่ยนเพศ"
            >
              <span>เพศ:</span>
              <span className="font-medium text-[#37352f]">
                {userGender === 'male' ? 'ชาย' : userGender === 'female' ? 'หญิง' : 'ยังไม่เลือก'}
              </span>
            </button>
          )}

          {isAdminRoute && isAdminAuthenticated && (
            <button
              onClick={handleAdminLogout}
              className="text-xs text-[#787774] hover:text-[#eb5757] transition cursor-pointer"
            >
              Log out
            </button>
          )}
        </div>
      </header>

      {/* Gender Selection Dialog */}
      {showGenderModal && (
        <GenderModal
          currentGender={userGender}
          onSelect={handleSelectGender}
          onClose={userGender ? () => setShowGenderModal(false) : undefined}
          remainingChanges={remainingGenderChanges}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {isNotFoundRoute ? (
          <div className="min-h-[75vh] flex items-center justify-center px-4">
            <div className="w-full max-w-md border border-[#e9e9e7] rounded-xl p-8 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] text-center relative overflow-hidden">
              {/* Subtle accent top border */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#eb5757] via-[#2383e2] to-[#37352f]" />

              {/* Big Modern 404 Headline with subtle styling */}
              <div className="my-2">
                <span className="font-mono text-6xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-[#37352f] to-[#9b9a97] select-none">
                  404
                </span>
              </div>

              <h1 className="text-lg font-semibold text-[#37352f] tracking-tight mb-6">
                ไม่พบหน้าที่คุณต้องการ
              </h1>

              <div className="pt-5 border-t border-[#e9e9e7] flex justify-center">
                <button
                  onClick={() => navigateTo('/')}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-[#37352f] hover:bg-[#201f1d] text-white text-xs font-medium rounded-md transition cursor-pointer shadow-sm active:scale-95"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> กลับสู่หน้าหลัก
                </button>
              </div>
            </div>
          </div>
        ) : isAdminRoute ? (
          !isAdminAuthenticated ? (
            <AdminPinAuth
              onSuccess={() => setIsAdminAuthenticated(true)}
              onCancel={() => navigateTo('/')}
            />
          ) : (
            <AdminDashboard
              campaigns={campaigns}
              onRefresh={fetchCampaigns}
            />
          )
        ) : (
          selectedCampaign ? (
            <UserRecorder
              campaign={selectedCampaign}
              gender={userGender || 'male'}
              onBack={() => {
                setSelectedCampaign(null);
                fetchCampaigns();
              }}
              onRecordingSuccess={() => {
                fetchCampaigns();
              }}
            />
          ) : (
            <div className="max-w-4xl mx-auto px-6 py-12">
              {/* Tamper Warning Banner (สไตล์ Notion Alert) */}
              {tamperWarning && (
                <div className="mb-6 p-4 rounded-lg bg-[#fdf5f5] border border-[#f7d7d7] text-xs text-[#eb5757] flex items-start justify-between gap-3 shadow-xs">
                  <div className="leading-relaxed">
                    <span className="font-semibold block mb-0.5 text-sm">⚠️ ตรวจพบการพยายามแก้ไขข้อมูล</span>
                    {tamperWarning}
                  </div>
                  <button
                    onClick={() => setTamperWarning(null)}
                    className="text-[#eb5757] hover:text-[#c53b3b] font-medium text-xs cursor-pointer shrink-0"
                  >
                    รับทราบ
                  </button>
                </div>
              )}

              <div className="mb-6 pb-4 border-b border-[#e9e9e7]">
                <h1 className="text-xl font-bold tracking-tight text-[#37352f]">
                  เลือกรายการที่ต้องการอัดเสียง
                </h1>
                <p className="text-xs text-[#787774] mt-1">
                  กดเลือกเพื่อเริ่มอัดเสียง
                </p>
              </div>

              {/* Search & Gender Filter Bar (Notion Style) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
                {/* Search Input */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-[#787774] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อรายการหรือข้อความ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-7 py-1 text-xs bg-white border border-[#e9e9e7] rounded outline-none focus:border-[#2383e2] text-[#37352f]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#787774] hover:text-[#37352f]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Gender Dropdown Filter (Notion Style) */}
                <div className="self-end sm:self-auto">
                  <select
                    value={genderFilter}
                    onChange={(e) => setGenderFilter(e.target.value as any)}
                    className="py-1 px-2.5 text-xs bg-white border border-[#e9e9e7] rounded outline-none focus:border-[#2383e2] text-[#37352f] cursor-pointer hover:bg-[#f7f6f3] transition"
                  >
                    <option value="all">ทั้งหมด</option>
                    <option value="all_target">ทั้ง 2 เพศ</option>
                    <option value="male">เฉพาะชาย</option>
                    <option value="female">เฉพาะหญิง</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-[#787774]">กำลังโหลดข้อมูล...</div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#787774] border border-[#e9e9e7] rounded-lg">
                  {searchQuery || genderFilter !== 'all' ? 'ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา' : 'ไม่มีรายการประกาศ'}
                </div>
              ) : (
                <div className="border border-[#e9e9e7] rounded-lg divide-y divide-[#e9e9e7] bg-white">
                  {filteredCampaigns.map((camp) => {
                    const target = camp.targetGender || 'all';

                    return (
                      <div
                        key={camp.id}
                        onClick={() => {
                          if (!userGender) {
                            setShowGenderModal(true);
                            return;
                          }
                          setSelectedCampaign(camp);
                        }}
                        className="p-4 hover:bg-[#f7f6f3] transition cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0 pr-4">
                          <Folder className="w-4 h-4 text-[#787774] mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h2 className="text-sm font-semibold text-[#37352f] truncate">
                                {camp.title}
                              </h2>
                              {target === 'male' && (
                                <span className="text-[10px] text-[#787774] px-1.5 py-0.2 rounded bg-[#f0f0ee] border border-[#e5e5e3] shrink-0">
                                  รับเฉพาะเพศชาย
                                </span>
                              )}
                              {target === 'female' && (
                                <span className="text-[10px] text-[#787774] px-1.5 py-0.2 rounded bg-[#f0f0ee] border border-[#e5e5e3] shrink-0">
                                  รับเฉพาะเพศหญิง
                                </span>
                              )}
                            </div>

                            {/* 1. คำอธิบายเพิ่มเติม (แสดงใต้ชื่อหัวข้อ) */}
                            {camp.description && (
                              <p className="text-xs text-[#787774] line-clamp-1 mb-2 leading-relaxed">
                                {camp.description}
                              </p>
                            )}

                            {/* 2. กรอบข้อความคำที่ต้องพูดอย่างชัดเจน */}
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#f7f6f3] border border-[#e9e9e7] max-w-full">
                              <span className="text-[10px] uppercase font-semibold text-[#9b9a97] tracking-wider shrink-0">
                                ข้อความที่ต้องพูด:
                              </span>
                              <span className="text-xs text-[#37352f] font-medium truncate">
                                "{camp.textToRead}"
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right text-xs text-[#787774] shrink-0 font-normal pl-4">
                          <div><span className="font-mono">{camp.recordingCount || 0}</span> ไฟล์ที่อัดเข้ามาแล้ว</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )
        )}
      </main>
    </div>
  );
}
export default App;
