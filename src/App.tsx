import { useState, useEffect } from 'react';
import type { Campaign } from './types';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminPinAuth } from './components/AdminPinAuth';
import { UserRecorder } from './components/UserRecorder';
import { GenderModal } from './components/GenderModal';
import { getCampaigns } from './utils/dataService';
import { Folder, Search, X } from 'lucide-react';

export function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(
    sessionStorage.getItem('admin_auth_token') === 'true'
  );

  const [userGender, setUserGender] = useState<'male' | 'female' | ''>(
    () => (localStorage.getItem('voice_user_gender') as 'male' | 'female') || ''
  );
  const [showGenderModal, setShowGenderModal] = useState(false);

  // Filter & Search states
  const [genderFilter, setGenderFilter] = useState<'all' | 'all_target' | 'male' | 'female'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('voice_user_gender');
    if (!saved) {
      setShowGenderModal(true);
    }
  }, []);

  const handleSelectGender = (gender: 'male' | 'female') => {
    setUserGender(gender);
    localStorage.setItem('voice_user_gender', gender);
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
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1">
        {isAdminRoute ? (
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

                {/* Gender Tabs Filter */}
                <div className="flex items-center gap-1 self-start sm:self-auto text-xs">
                  <button
                    onClick={() => setGenderFilter('all')}
                    className={`px-2.5 py-1 rounded transition cursor-pointer ${
                      genderFilter === 'all'
                        ? 'bg-[#37352f] text-white font-medium'
                        : 'text-[#787774] hover:bg-[#f7f6f3]'
                    }`}
                  >
                    ทั้งหมด
                  </button>
                  <button
                    onClick={() => setGenderFilter('all_target')}
                    className={`px-2.5 py-1 rounded transition cursor-pointer ${
                      genderFilter === 'all_target'
                        ? 'bg-[#37352f] text-white font-medium'
                        : 'text-[#787774] hover:bg-[#f7f6f3]'
                    }`}
                  >
                    ทั้ง 2 เพศ
                  </button>
                  <button
                    onClick={() => setGenderFilter('male')}
                    className={`px-2.5 py-1 rounded transition cursor-pointer ${
                      genderFilter === 'male'
                        ? 'bg-[#37352f] text-white font-medium'
                        : 'text-[#787774] hover:bg-[#f7f6f3]'
                    }`}
                  >
                    เฉพาะชาย
                  </button>
                  <button
                    onClick={() => setGenderFilter('female')}
                    className={`px-2.5 py-1 rounded transition cursor-pointer ${
                      genderFilter === 'female'
                        ? 'bg-[#37352f] text-white font-medium'
                        : 'text-[#787774] hover:bg-[#f7f6f3]'
                    }`}
                  >
                    เฉพาะหญิง
                  </button>
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
                        <div className="flex items-start gap-3">
                          <Folder className="w-4 h-4 text-[#787774] mt-0.5 shrink-0" />
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <h2 className="text-sm font-semibold text-[#37352f]">
                                {camp.title}
                              </h2>
                              {target === 'male' && (
                                <span className="text-[10px] text-[#787774] px-1.5 py-0.2 rounded bg-[#f0f0ee] border border-[#e5e5e3]">
                                  รับเฉพาะเพศชาย
                                </span>
                              )}
                              {target === 'female' && (
                                <span className="text-[10px] text-[#787774] px-1.5 py-0.2 rounded bg-[#f0f0ee] border border-[#e5e5e3]">
                                  รับเฉพาะเพศหญิง
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#787774] line-clamp-1 mb-1">
                              "{camp.textToRead}"
                            </p>
                            {camp.description && (
                              <p className="text-[11px] text-[#9b9a97]">{camp.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="text-right text-xs text-[#787774] shrink-0 font-mono pl-4">
                          <div>{camp.recordingCount || 0} ไฟล์</div>
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
