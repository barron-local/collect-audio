import React, { useState } from 'react';
import type { Campaign } from '../types';
import { createCampaign, updateCampaign, deleteCampaign, getCampaignDetails, deleteRecording } from '../utils/dataService';
import { exportCampaignZip } from '../utils/zipExporter';
import { 
  Pencil,
  Trash2, 
  Download, 
  RefreshCw,
  Folder,
  X,
  AlertTriangle
} from 'lucide-react';

interface Props {
  campaigns: Campaign[];
  onRefresh: () => void;
}

export const AdminDashboard: React.FC<Props> = ({ 
  campaigns, 
  onRefresh 
}) => {
  // Modal State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string; type: 'topic' | 'audio'; filename?: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [textToRead, setTextToRead] = useState('');
  const [targetGender, setTargetGender] = useState<'all' | 'male' | 'female'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Selected Campaign Details Drawer/Modal
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignDetails, setCampaignDetails] = useState<Campaign | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [isExportingZip, setIsExportingZip] = useState(false);

  const openCreateModal = () => {
    setEditingCampaignId(null);
    setTitle('');
    setDescription('');
    setTextToRead('');
    setTargetGender('all');
    setFormError(null);
    setShowFormModal(true);
  };

  const openEditModal = (camp: Campaign, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCampaignId(camp.id);
    setTitle(camp.title);
    setDescription(camp.description || '');
    setTextToRead(camp.textToRead);
    setTargetGender(camp.targetGender || 'all');
    setFormError(null);
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !textToRead.trim()) {
      setFormError('กรุณากรอกหัวข้อและประโยคที่ต้องการให้อ่าน');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingCampaignId) {
        await updateCampaign(editingCampaignId, {
          title,
          description,
          textToRead,
          targetGender
        });
      } else {
        await createCampaign(title, description, textToRead, targetGender);
      }
      setShowFormModal(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'ไม่สามารถบันทึกได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerDeleteTopic = (camp: Campaign, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget({
      id: camp.id,
      title: camp.title,
      type: 'topic'
    });
  };

  const triggerDeleteAudio = (recId: string, speakerName: string, filename?: string) => {
    setDeleteTarget({
      id: recId,
      title: `ไฟล์เสียงของ ${speakerName}`,
      type: 'audio',
      filename
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      if (deleteTarget.type === 'topic') {
        await deleteCampaign(deleteTarget.id);
        onRefresh();
        if (selectedCampaign?.id === deleteTarget.id) {
          setSelectedCampaign(null);
          setCampaignDetails(null);
        }
      } else if (deleteTarget.type === 'audio') {
        await deleteRecording(deleteTarget.id, deleteTarget.filename);
        if (selectedCampaign) {
          handleOpenFolder(selectedCampaign);
        }
        onRefresh();
      }
      setDeleteTarget(null);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการลบ: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenFolder = async (camp: Campaign) => {
    setSelectedCampaign(camp);
    setLoadingDetails(true);
    try {
      const data = await getCampaignDetails(camp.id);
      setCampaignDetails(data);
    } catch (err: any) {
      alert('โหลดข้อมูลไม่สำเร็จ: ' + err.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDownloadZip = async (filter: 'all' | 'male' | 'female') => {
    if (!campaignDetails) return;
    setIsExportingZip(true);
    try {
      await exportCampaignZip(campaignDetails, campaignDetails.records || [], filter);
    } catch (err: any) {
      alert('ดาวน์โหลดไม่สำเร็จ: ' + err.message);
    } finally {
      setIsExportingZip(false);
    }
  };

  const filteredRecords = (campaignDetails?.records || []).filter(rec => {
    if (genderFilter === 'all') return true;
    return rec.gender === genderFilter;
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Action Header */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#e9e9e7]">
        <div>
          <h1 className="text-xl font-bold text-[#37352f] tracking-tight">หัวข้อบันทึกเสียง</h1>
          <p className="text-xs text-[#787774] mt-0.5">จัดการรายการและชุดข้อมูลเสียง</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-1.5 text-[#787774] hover:text-[#37352f] hover:bg-[#f7f6f3] rounded transition cursor-pointer"
            title="รีเฟรช"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-3 py-1.5 text-xs bg-[#37352f] hover:bg-[#201f1d] text-white font-medium rounded transition cursor-pointer"
          >
            เพิ่มหัวข้อใหม่
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal (Highest z-index z-60) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-60 bg-[#37352f]/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white border border-[#e9e9e7] rounded-lg max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded bg-[#eb5757]/10 text-[#eb5757] shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#37352f]">
                  {deleteTarget.type === 'topic' ? 'ยืนยันลบหัวข้อนี้?' : 'ยืนยันลบไฟล์เสียง?'}
                </h3>
                <p className="text-xs text-[#787774] mt-1 leading-relaxed">
                  {deleteTarget.type === 'topic' ? (
                    <>คุณต้องการลบ <strong>"{deleteTarget.title}"</strong> และไฟล์เสียงทั้งหมดข้างในใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้</>
                  ) : (
                    <>คุณต้องการลบ <strong>"{deleteTarget.title}"</strong> ออกจากระบบใช่หรือไม่?</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#e9e9e7]">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 text-xs text-[#787774] hover:bg-[#f7f6f3] rounded transition cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs bg-[#eb5757] hover:bg-[#d84a4a] text-white rounded font-medium transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Campaign Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 bg-[#37352f]/30 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white border border-[#e9e9e7] rounded-lg max-w-lg w-full p-6 shadow-md">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#e9e9e7]">
              <h2 className="text-base font-semibold text-[#37352f]">
                {editingCampaignId ? 'แก้ไขหัวข้อ' : 'สร้างหัวข้อใหม่'}
              </h2>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="text-[#787774] hover:text-[#37352f] p-1 rounded hover:bg-[#f7f6f3] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#787774] mb-1">หัวข้อประกาศ *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="เช่น ชุดประโยคทดสอบ 1"
                    className="w-full px-3 py-1.5 text-sm bg-white border border-[#e9e9e7] rounded outline-none focus:border-[#2383e2] text-[#37352f]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#787774] mb-1">คำอธิบายเพิ่มเติม</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="บริบทหรือคำแนะนำ"
                    className="w-full px-3 py-1.5 text-sm bg-white border border-[#e9e9e7] rounded outline-none focus:border-[#2383e2] text-[#37352f]"
                  />
                </div>
              </div>

              {/* Target Gender Selection */}
              <div>
                <label className="block text-xs text-[#787774] mb-1.5">เพศเป้าหมายที่ต้องการรับเสียง</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetGender('all')}
                    className={`py-1.5 px-2 text-xs rounded border transition cursor-pointer text-center ${
                      targetGender === 'all'
                        ? 'border-[#37352f] bg-[#f7f6f3] text-[#37352f] font-medium'
                        : 'border-[#e9e9e7] text-[#787774] hover:bg-[#f7f6f3]'
                    }`}
                  >
                    ทั้ง 2 เพศ
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetGender('male')}
                    className={`py-1.5 px-2 text-xs rounded border transition cursor-pointer text-center ${
                      targetGender === 'male'
                        ? 'border-[#37352f] bg-[#f7f6f3] text-[#37352f] font-medium'
                        : 'border-[#e9e9e7] text-[#787774] hover:bg-[#f7f6f3]'
                    }`}
                  >
                    เฉพาะเพศชาย
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetGender('female')}
                    className={`py-1.5 px-2 text-xs rounded border transition cursor-pointer text-center ${
                      targetGender === 'female'
                        ? 'border-[#37352f] bg-[#f7f6f3] text-[#37352f] font-medium'
                        : 'border-[#e9e9e7] text-[#787774] hover:bg-[#f7f6f3]'
                    }`}
                  >
                    เฉพาะเพศหญิง
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#787774] mb-1">ประโยคที่ต้องพูด *</label>
                <textarea
                  required
                  rows={3}
                  value={textToRead}
                  onChange={(e) => setTextToRead(e.target.value)}
                  placeholder="พิมพ์ประโยคที่ต้องการให้อัดเสียง..."
                  className="w-full px-3 py-1.5 text-sm bg-white border border-[#e9e9e7] rounded outline-none focus:border-[#2383e2] text-[#37352f]"
                />
              </div>

              {formError && <p className="text-xs text-[#eb5757]">{formError}</p>}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#e9e9e7]">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-3 py-1.5 text-xs text-[#787774] hover:bg-[#f7f6f3] rounded transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs bg-[#37352f] hover:bg-[#201f1d] text-white rounded font-medium transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : editingCampaignId ? 'บันทึกการแก้ไข' : 'สร้าง'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notion Database Table View */}
      <div className="border border-[#e9e9e7] rounded-lg overflow-hidden bg-white">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#e9e9e7] bg-[#fbfbfa] text-[#787774]">
              <th className="py-2.5 px-4 font-normal">ชื่อโฟลเดอร์</th>
              <th className="py-2.5 px-4 font-normal">เป้าหมาย</th>
              <th className="py-2.5 px-4 font-normal">ประโยค</th>
              <th className="py-2.5 px-4 font-normal w-24 text-right">จำนวนไฟล์</th>
              <th className="py-2.5 px-4 font-normal w-24 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e9e9e7]">
            {campaigns.map((camp) => (
              <tr 
                key={camp.id} 
                onClick={() => handleOpenFolder(camp)}
                className="hover:bg-[#f7f6f3] transition cursor-pointer group"
              >
                <td className="py-3 px-4 font-medium text-[#37352f] flex items-center gap-2">
                  <Folder className="w-3.5 h-3.5 text-[#787774] shrink-0" />
                  <span className="line-clamp-1">{camp.title}</span>
                </td>
                <td className="py-3 px-4 text-[#787774] whitespace-nowrap">
                  {camp.targetGender === 'male' ? (
                    <span className="px-1.5 py-0.5 rounded bg-[#f7f6f3] border border-[#e9e9e7] text-[11px]">เฉพาะชาย</span>
                  ) : camp.targetGender === 'female' ? (
                    <span className="px-1.5 py-0.5 rounded bg-[#f7f6f3] border border-[#e9e9e7] text-[11px]">เฉพาะหญิง</span>
                  ) : (
                    <span className="text-[#9b9a97] text-[11px]">ทั้ง 2 เพศ</span>
                  )}
                </td>
                <td className="py-3 px-4 text-[#787774]">
                  <span className="line-clamp-1">"{camp.textToRead}"</span>
                </td>
                <td className="py-3 px-4 text-right font-mono text-[#37352f]">
                  {camp.recordingCount || 0}
                </td>
                <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={(e) => openEditModal(camp, e)}
                      className="text-[#787774] hover:text-[#37352f] p-1 rounded hover:bg-[#eae9e5] transition cursor-pointer"
                      title="แก้ไขหัวข้อ"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => triggerDeleteTopic(camp, e)}
                      className="text-[#787774] hover:text-[#eb5757] p-1 rounded hover:bg-[#eae9e5] transition cursor-pointer"
                      title="ลบ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {campaigns.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#787774]">
                  ยังไม่มีข้อมูลประกาศคำ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Campaign Details Drawer/Modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 bg-[#37352f]/20 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e9e9e7] rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col shadow-lg overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#e9e9e7] flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#37352f] flex items-center gap-2">
                  <Folder className="w-4 h-4 text-[#787774]" />
                  {selectedCampaign.title}
                </h2>
                <p className="text-xs text-[#787774] mt-0.5">"{selectedCampaign.textToRead}"</p>
              </div>

              <button
                onClick={() => {
                  setSelectedCampaign(null);
                  setCampaignDetails(null);
                }}
                className="text-[#787774] hover:text-[#37352f] p-1 rounded hover:bg-[#f7f6f3] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Actions Bar */}
            <div className="px-6 py-2.5 bg-[#fbfbfa] border-b border-[#e9e9e7] flex items-center justify-between text-xs">
              <div className="flex gap-2">
                <button
                  onClick={() => setGenderFilter('all')}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    genderFilter === 'all' ? 'bg-[#37352f] text-white font-medium' : 'text-[#787774] hover:bg-[#eae9e5]'
                  }`}
                >
                  ทั้งหมด ({campaignDetails?.records?.length || 0})
                </button>
                <button
                  onClick={() => setGenderFilter('male')}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    genderFilter === 'male' ? 'bg-[#37352f] text-white font-medium' : 'text-[#787774] hover:bg-[#eae9e5]'
                  }`}
                >
                  ชาย ({campaignDetails?.records?.filter(r => r.gender === 'male').length || 0})
                </button>
                <button
                  onClick={() => setGenderFilter('female')}
                  className={`px-2 py-1 rounded transition cursor-pointer ${
                    genderFilter === 'female' ? 'bg-[#37352f] text-white font-medium' : 'text-[#787774] hover:bg-[#eae9e5]'
                  }`}
                >
                  หญิง ({campaignDetails?.records?.filter(r => r.gender === 'female').length || 0})
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleDownloadZip(genderFilter)}
                  disabled={isExportingZip || (filteredRecords.length === 0)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-[#e9e9e7] hover:bg-white bg-[#f7f6f3] text-[#37352f] rounded transition cursor-pointer disabled:opacity-40"
                >
                  <Download className="w-3 h-3" /> {isExportingZip ? 'กำลังโหลด...' : 'Download ZIP'}
                </button>
              </div>
            </div>

            {/* Audio Files List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#e9e9e7]">
              {loadingDetails ? (
                <div className="py-12 text-center text-xs text-[#787774]">Loading...</div>
              ) : filteredRecords.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#787774]">ไม่มีไฟล์เสียงในหมวดนี้</div>
              ) : (
                filteredRecords.map((rec) => (
                  <div key={rec.id} className="px-6 py-3 flex items-center justify-between text-xs hover:bg-[#fbfbfa]">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#37352f]">{rec.speakerName || 'ไม่ระบุชื่อ'}</span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${
                            rec.gender === 'female' 
                              ? 'bg-rose-50/60 border-rose-200/80 text-rose-700' 
                              : 'bg-blue-50/60 border-blue-200/80 text-blue-700'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${rec.gender === 'female' ? 'bg-rose-500' : 'bg-blue-500'}`} />
                            {rec.gender === 'female' ? 'เสียงหญิง' : 'เสียงชาย'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[#9b9a97] mt-0.5">
                          <span className="font-mono text-[#787774]">{rec.durationSeconds} วินาที</span>
                          <span className="text-[#d3d2cf]">|</span>
                          <span>{new Date(rec.recordedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <audio controls src={rec.fileUrl || ''} className="h-7 w-48" />

                      {rec.fileUrl && (
                        <a
                          href={rec.fileUrl}
                          download={`${rec.gender}_${rec.speakerName}_${rec.id}.mp3`}
                          className="text-[#787774] hover:text-[#37352f] p-1 rounded hover:bg-[#f7f6f3]"
                          title="ดาวน์โหลดไฟล์เดียว"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}

                      <button
                        onClick={() => triggerDeleteAudio(rec.id, rec.speakerName, rec.filename)}
                        className="text-[#787774] hover:text-[#eb5757] p-1 rounded hover:bg-[#f7f6f3] cursor-pointer"
                        title="ลบ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
