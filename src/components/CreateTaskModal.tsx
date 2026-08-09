import React, { useState, useEffect } from 'react';
import type { Task, User, MainCon } from '../types';
import { Skill, TaskStatus, MalaysianState } from '../types';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { authService } from '../services/authService';
import { mainConsApi, taskSettingsApi } from '../services/api';

interface TaskSettingOption {
  id: number;
  value: string;
}

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: any) => void;
  currentUser: User;
}

const MAX_FILE_SIZE_MB = 2;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, onClose, onSave, currentUser }) => {
  // Original Fields
  const [title, setTitle] = useState('');
  const [logNumber, setLogNumber] = useState('');
  const [description, setDescription] = useState('');
  const [supportType, setSupportType] = useState<string>(Skill.HARDWARE);
  const [supportTypeSettingId, setSupportTypeSettingId] = useState<number | null>(null);
  const [clientLocation, setClientLocation] = useState('');
  const [districtAddress, setDistrictAddress] = useState('');
  const [state, setState] = useState<string>(MalaysianState.KUALA_LUMPUR);
  const [deadline, setDeadline] = useState('');
  const [serviceStartDate, setServiceStartDate] = useState('');
  const [serviceStartTime, setServiceStartTime] = useState('');
  const [offerPrice, setOfferPrice] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [currentLink, setCurrentLink] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [error, setError] = useState('');

  // New Fields
  const [mainConId, setMainConId] = useState<number | ''>('');
  const [mainCons, setMainCons] = useState<MainCon[]>([]);
  const [picName, setPicName] = useState('');
  const [picPhone, setPicPhone] = useState('');
  const [clientName, setClientName] = useState('');
  const [assetTagId, setAssetTagId] = useState('');
  const [assetBrand, setAssetBrand] = useState('');
  const [assetModel, setAssetModel] = useState('');
  const [assetSerialNumber, setAssetSerialNumber] = useState('');
  const [branchName, setBranchName] = useState('');
  const [equipmentTypes, setEquipmentTypes] = useState<string[]>([]);
  const [requirementDate, setRequirementDate] = useState('');
  const [requirementTime, setRequirementTime] = useState('');
  const [supportTypeOptions, setSupportTypeOptions] = useState<TaskSettingOption[]>(
    Object.values(Skill).map((value, index) => ({ id: index + 1, value }))
  );
  const [equipmentCodeOptions, setEquipmentCodeOptions] = useState<string[]>(['PC', 'NOTEBOOK', 'PRINTER', 'PROJECTOR']);
  const [statusOptions, setStatusOptions] = useState<TaskSettingOption[]>(
    Object.values(TaskStatus).map((value, index) => ({ id: index + 1, value }))
  );

  // Fetch Main Cons on mount
  useEffect(() => {
    if (isOpen) {
        const fetchMainCons = async () => {
            try {
                const response = await mainConsApi.getAll();
                if (response.success && response.data) {
              setMainCons(response.data as MainCon[]);
                }
            } catch (err) {
                console.error('Error fetching Main Cons:', err);
            }
        };
        fetchMainCons();

        const fetchTaskSettings = async () => {
          try {
            const response = await taskSettingsApi.getAll();
            const data: any = response?.data;
            const supportOptions = data?.supportTypeOptions;
            const taskStatusOptions = data?.statusOptions;

            if (Array.isArray(supportOptions) && supportOptions.length > 0) {
              setSupportTypeOptions(supportOptions);
              setSupportType(supportOptions[0].value);
              setSupportTypeSettingId(supportOptions[0].id);
            }

            if (Array.isArray(taskStatusOptions) && taskStatusOptions.length > 0) {
              setStatusOptions(taskStatusOptions);
            }

            if (Array.isArray(data?.equipmentCodeOptions) && data.equipmentCodeOptions.length > 0) {
              setEquipmentCodeOptions(data.equipmentCodeOptions.map((item: any) => String(item.value)));
            }
          } catch (err) {
            console.error('Error fetching task settings:', err);
          }
        };

        fetchTaskSettings();
    }
  }, [isOpen]);

  const handleEquipmentChange = (value: string) => {
    setEquipmentTypes(value ? [value] : []);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      let cumulativeSize = attachments.reduce((acc, file) => acc + file.size, 0);
      const validFiles = [];

      for (const file of newFiles) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          setError(`Fail "${file.name}" melebihi had saiz ${MAX_FILE_SIZE_MB}MB.`);
          continue; // Skip this file
        }
        cumulativeSize += file.size;
        validFiles.push(file);
      }
      setAttachments(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (fileName: string) => {
    setAttachments(prev => prev.filter(file => file.name !== fileName));
  };

  const handleAddLink = () => {
      if (currentLink && !links.includes(currentLink)) {
          try {
              new URL(currentLink); // Basic URL validation
              setLinks(prev => [...prev, currentLink]);
              setCurrentLink('');
          } catch (_) {
              alert('Sila masukkan URL yang sah.');
          }
      }
  };

  const removeLink = (indexToRemove: number) => {
      setLinks(prev => prev.filter((_, index) => index !== indexToRemove));
  };


  const validateForm = () => {
    const errors: string[] = [];

    // Sanitize and validate title (no length restriction)
    const sanitizedTitle = authService.sanitizeInput(title.trim());
    if (!sanitizedTitle) {
      errors.push('Tajuk diperlukan');
    }

    // Validate Main Con (Mandatory)
    if (!mainConId) {
        errors.push('Sila pilih Main-Con');
    }

    // Sanitize and validate description (no length restriction)
    const sanitizedDescription = authService.sanitizeInput(description.trim());
    if (!sanitizedDescription) {
      errors.push('Deskripsi diperlukan');
    }

    // Validate client location
    const sanitizedLocation = authService.sanitizeInput(clientLocation.trim());
    if (!sanitizedLocation || sanitizedLocation.length < 3) {
      errors.push('Lokasi klien diperlukan');
    }
    const sanitizedDistrictAddress = authService.sanitizeInput(districtAddress.trim());

    if (!requirementDate) {
      errors.push('Tarikh keperluan diperlukan');
    }

    if (!requirementTime) {
      errors.push('Masa keperluan diperlukan');
    }

    // Validate offer price
    if (!offerPrice || offerPrice <= 0 || offerPrice > 100000) {
      errors.push('Harga tawaran mestilah antara RM1 hingga RM100,000');
    }

    // Validate links
    const validLinks = links.filter(link => {
      try {
        new URL(link);
        return true;
      } catch {
        return false;
      }
    });

    if (validLinks.length !== links.length) {
      errors.push('Sila pastikan semua pautan adalah sah');
    }

    // Validate file attachments
    const validFiles = attachments.filter(file => {
      const validation = authService.validateFile(file, 2);
      return validation.valid;
    });

    if (validFiles.length !== attachments.length) {
      errors.push('Sila pastikan semua lampiran adalah dalam format yang dibenarkan (PNG, JPG, PDF) dan tidak melebihi 2MB');
    }

    if (errors.length > 0) {
      setError(errors.join('\n'));
      return null;
    }

    return {
      title: sanitizedTitle,
      logNumber: logNumber.trim(),
      description: sanitizedDescription,
      supportType,
      supportTypeSettingId: supportTypeSettingId || supportTypeOptions.find(option => option.value === supportType)?.id || null,
      clientLocation: sanitizedLocation,
      districtAddress: sanitizedDistrictAddress,
      state,
      deadline: requirementDate,
      requirementDate,
      requirementTime,
      offerPrice,
      status: TaskStatus.BARU,
      statusSettingId: statusOptions.find(option => option.value === TaskStatus.BARU)?.id || null,
      createdBy: currentUser.id,
      remarks: authService.sanitizeInput(remarks.trim()),
      links: validLinks,
      attachments: validFiles,
      // New Fields
      mainConId: Number(mainConId),
      picName,
      picPhone,
      clientName,
      assetTagId,
      assetBrand,
      assetModel,
      assetSerialNumber,
      branchName,
      equipmentTypes,
    };
  };

  const handleSubmit = () => {
    const validatedData = validateForm();
    if (!validatedData) {
      return;
    }

    onSave(validatedData);
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Cipta Tugasan Baru"
      footer={
        <div className="flex flex-wrap justify-end gap-2 w-full">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={handleSubmit}>Simpan Tugasan</Button>
        </div>
      }
    >
       <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
        {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md whitespace-pre-line">{error}</p>}
        
        {/* Main Con Section */}
        <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
             <h3 className="text-lg font-medium text-gray-900 mb-3">Maklumat Utama</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Main-Con <span className="text-red-500">*</span></label>
                    <select 
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        value={mainConId}
                        onChange={e => setMainConId(e.target.value ? Number(e.target.value) : '')}
                    >
                        <option value="">Sila Pilih Main-Con</option>
                        {mainCons.map(mc => (
                            <option key={mc.id} value={mc.id}>{mc.name}</option>
                        ))}
                    </select>
                 </div>
                 <Input label="No Log (Opsyenal)" id="logNumber" value={logNumber} onChange={e => setLogNumber(e.target.value)} placeholder="Kosongkan untuk auto: SPFIT-202603-0002" />
                 <Input label="Tajuk Tugasan" id="title" value={title} onChange={e => setTitle(e.target.value)} required className="md:col-span-2" />
             </div>
        </div>

        {/* User Information */}
        <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm">
             <h3 className="text-lg font-medium text-gray-900 mb-3 border-b pb-2">USER INFORMATION</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Input label="Username (PIC)" id="picName" value={picName} onChange={e => setPicName(e.target.value)} placeholder="Pn. Zurainah (PIC)" />
                 <Input label="Contact Number" id="picPhone" value={picPhone} onChange={e => setPicPhone(e.target.value)} placeholder="018..." />
                 <Input label="Client Name" id="clientName" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="LHDN Sandakan" />
                 <Input label="Location (Address)" id="clientLocation" value={clientLocation} onChange={e => setClientLocation(e.target.value)} required placeholder="Alamat penuh..." />
                 <Input label="Bandar / Daerah" id="districtAddress" value={districtAddress} onChange={e => setDistrictAddress(e.target.value)} placeholder="Contoh: Bandar Kinabalu" />
                 <Select label="Negeri" id="state" value={state} onChange={e => setState(e.target.value)}>
                    {Object.values(MalaysianState).map(s => <option key={s} value={s}>{s}</option>)}
                 </Select>
             </div>
        </div>

        {/* Other Information */}
        <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm">
             <h3 className="text-lg font-medium text-gray-900 mb-3 border-b pb-2">OTHER INFORMATION</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <Input label="Tag ID" id="assetTagId" value={assetTagId} onChange={e => setAssetTagId(e.target.value)} placeholder="A/2024..." />
                 <Input label="Brand" id="assetBrand" value={assetBrand} onChange={e => setAssetBrand(e.target.value)} placeholder="HP" />
                 <Input label="Model" id="assetModel" value={assetModel} onChange={e => setAssetModel(e.target.value)} placeholder="Pro SFF 400 G9" />
                 <Input label="Serial Number" id="assetSerialNumber" value={assetSerialNumber} onChange={e => setAssetSerialNumber(e.target.value)} placeholder="4CE..." />
                 <Input label="Branch Name" id="branchName" value={branchName} onChange={e => setBranchName(e.target.value)} />
             </div>
        </div>

        {/* Asset */}
        <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm">
           <h3 className="text-lg font-medium text-gray-900 mb-3 border-b pb-2">ASSET</h3>
           <Select
            label="Jenis Asset"
            id="assetEquipmentCode"
            value={equipmentTypes[0] ?? ''}
            onChange={e => handleEquipmentChange(e.target.value)}
           >
            <option value="">-- Pilih Jenis Asset --</option>
            {equipmentCodeOptions.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
           </Select>
        </div>

        {/* Problem Description & Task Details */}
        <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm">
            <h3 className="text-lg font-medium text-gray-900 mb-3 border-b pb-2">PROBLEM DESCRIPTION / TASK</h3>
            <Textarea label="Deskripsi Masalah / Isu" id="description" value={description} onChange={e => setDescription(e.target.value)} required rows={4} />
            

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Select
                  label="Jenis Sokongan"
                  id="supportType"
                  value={supportType}
                  onChange={e => {
                    const nextType = e.target.value;
                    setSupportType(nextType);
                    const matched = supportTypeOptions.find(option => option.value === nextType);
                    setSupportTypeSettingId(matched?.id ?? null);
                  }}
                >
                  {supportTypeOptions.map(skill => <option key={skill.id} value={skill.value}>{skill.value}</option>)}
                </Select>
                <Input label="Tarikh Keperluan" id="requirementDate" type="date" value={requirementDate ?? ''} onChange={e => setRequirementDate(e.target.value)} required />
                <Input label="Masa Keperluan" id="requirementTime" type="time" value={requirementTime ?? ''} onChange={e => setRequirementTime(e.target.value)} placeholder="HH:MM" required />
                <Input label="Harga Tawaran (RM)" id="price" type="number" value={offerPrice} onChange={e => setOfferPrice(parseFloat(e.target.value))} required />
            </div>
            
             <div className="mt-4">
                <Textarea label="Catatan / Remarks" id="remarks" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="cth: Sila hubungi pengurus cawangan sebelum hadir."/>
             </div>
        </div>
        
        {/* Attachments & Links */}
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Pautan Berkaitan / Links</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                    <input
                        type="url"
                        value={currentLink}
                        onChange={(e) => setCurrentLink(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLink())}
                        className="focus:ring-indigo-500 focus:border-indigo-500 flex-1 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300"
                        placeholder="https://documentation.example.com"
                    />
                    <button
                        type="button"
                        onClick={handleAddLink}
                        className="-ml-px relative inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        Tambah
                    </button>
                </div>
                {links.length > 0 && (
                    <div className="mt-2 space-y-1">
                        {links.map((link, index) => (
                            <div key={index} className="flex justify-between items-center p-1 pl-2 bg-gray-100 rounded-md text-sm">
                                <a href={link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate">{link}</a>
                                <button onClick={() => removeLink(index)} className="ml-2 text-red-500 hover:text-red-700 flex-shrink-0 text-lg leading-none font-bold p-1">&times;</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700">Lampiran</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <div className="flex text-sm text-gray-600">
                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                <span>Muat naik fail</span>
                                <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple onChange={handleFileChange} />
                            </label>
                            <p className="pl-1">atau seret dan lepas</p>
                        </div>
                        <p className="text-xs text-gray-500">PNG, JPG, PDF sehingga {MAX_FILE_SIZE_MB}MB setiap fail</p>
                    </div>
                </div>
                 {attachments.length > 0 && (
                    <div className="mt-2 text-sm space-y-1">
                        {attachments.map(file => (
                            <div key={file.name} className="flex justify-between items-center p-1 pl-2 bg-gray-100 rounded-md">
                                <span className="truncate">{file.name}</span>
                                <button onClick={() => removeFile(file.name)} className="ml-2 text-red-500 hover:text-red-700 flex-shrink-0 text-lg leading-none font-bold p-1">&times;</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

      </div>
    </Modal>
  );
};
