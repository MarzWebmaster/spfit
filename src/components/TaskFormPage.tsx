import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApiData } from '../hooks/useApiData';
import { tasksApi, mainConsApi, taskSettingsApi, projectsApi, taskRemindersApi } from '../services/api';
import { Task, TaskStatus, Skill, MalaysianState, User, MainCon, Freelancer, Webhook, NotificationTemplate, Project } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Select } from './ui/Select';
import { ICONS } from './ui/icons';
import { SubmitTaskModal } from './SubmitTaskModal';
import { authService } from '../services/authService';
import { Badge } from './ui/Badge';
import { TaskOffersList } from './TaskOffersList';
import { AssignTechModal } from './AssignTechModal';

const MAX_FILE_SIZE_MB = 2;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function normalizeSupportTypeLabel(value: string): string {
    return String(value || '').trim().toLowerCase();
}

function isNonAssetSupportType(value: string): boolean {
    const normalized = normalizeSupportTypeLabel(value);
    return normalized.includes('deployment') || normalized.includes('preventive') || normalized.includes('preventif');
}

function isRequiredAssetSupportType(value: string): boolean {
    const normalized = normalizeSupportTypeLabel(value);
    const isAddHoc = normalized.includes('adhoc') || normalized.includes('ad-hoc') || (normalized.includes('add') && normalized.includes('hoc'));
    return normalized.includes('corrective') || isAddHoc;
}

interface TaskSettingOption {
    id: number;
    value: string;
}

interface TaskFormPageProps {
    freelancers?: Freelancer[];
    webhooks?: Webhook[];
    notificationTemplates?: NotificationTemplate[];
    onSendOffers?: (
        taskId: number,
        freelancerIds: number[],
        methods: Array<'E-mel' | 'Whatsapp'>,
        emailTemplateId?: number,
        whatsappTemplateId?: number
    ) => Promise<void>;
    canSubmitTaskForm?: boolean;
}

export const TaskFormPage: React.FC<TaskFormPageProps> = ({
    freelancers = [],
    webhooks = [],
    notificationTemplates = [],
    onSendOffers,
    canSubmitTaskForm = false,
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  const [loading, setLoading] = useState(false);
    const [markingArrival, setMarkingArrival] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEditMode);
  const [error, setError] = useState<string | null>(null);

  // Global state for user and lists
    const { tasks, refreshData } = useApiData();
    const currentUserId = (() => {
        try {
            const rawUser = localStorage.getItem('spfit_current_user');
            if (!rawUser) return undefined;
            const parsed = JSON.parse(rawUser);
            const idValue = Number(parsed?.id);
            return Number.isFinite(idValue) ? idValue : undefined;
        } catch {
            return undefined;
        }
    })();
    const currentUserRole = (() => {
        try {
            const rawUser = localStorage.getItem('spfit_current_user');
            if (!rawUser) return '';
            const parsed = JSON.parse(rawUser);
            return String(parsed?.role || parsed?.roleName || parsed?.role_name || '').toLowerCase();
        } catch {
            return '';
        }
    })();
    const canEditTaskByRole = currentUserRole.includes('admin') || currentUserRole.includes('staff');

  // Form State
  const [title, setTitle] = useState('');
  const [logNumber, setLogNumber] = useState('');
  const [description, setDescription] = useState('');
        const [supportType, setSupportType] = useState<string>(Skill.HARDWARE);
        const [supportTypeSettingId, setSupportTypeSettingId] = useState<number | null>(null);
  const [clientLocation, setClientLocation] = useState('');
        const [districtAddress, setDistrictAddress] = useState('');
  const [state, setState] = useState<string>(MalaysianState.KUALA_LUMPUR);
  const [deadline, setDeadline] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [requirementDate, setRequirementDate] = useState('');
  const [requirementTime, setRequirementTime] = useState('');
    const [serviceStartDate, setServiceStartDate] = useState('');
    const [serviceStartTime, setServiceStartTime] = useState('');
  const [offerPrice, setOfferPrice] = useState(0);
    const [taskStatus, setTaskStatus] = useState<TaskStatus>(TaskStatus.BARU);
    const [taskStatusSettingId, setTaskStatusSettingId] = useState<number | null>(null);
    const [assignedFreelancerId, setAssignedFreelancerId] = useState<number | ''>('');
  const [remarks, setRemarks] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [currentLink, setCurrentLink] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]); // For new files
    const [existingAttachments, setExistingAttachments] = useState<Array<{ id?: number; url: string }>>([]); // For existing files URLs

  // New Fields
  const [mainConId, setMainConId] = useState<number | ''>('');
  const [mainCons, setMainCons] = useState<MainCon[]>([]);
    const [projectId, setProjectId] = useState<number | ''>('');
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectSearch, setProjectSearch] = useState('');
    const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [picName, setPicName] = useState('');
  const [picPhone, setPicPhone] = useState('');
  const [clientName, setClientName] = useState('');
  const [assetTagId, setAssetTagId] = useState('');
  const [assetBrand, setAssetBrand] = useState('');
  const [assetModel, setAssetModel] = useState('');
  const [assetSerialNumber, setAssetSerialNumber] = useState('');
  const [branchName, setBranchName] = useState('');
  const [equipmentTypes, setEquipmentTypes] = useState<string[]>([]);

  // Task Details (Read-only or status related)
  const [task, setTask] = useState<Task | null>(null);
    const [isAssignModalOpen, setAssignModalOpen] = useState(false);
    const [isSubmitConfirmOpen, setSubmitConfirmOpen] = useState(false);
    const [submitModalTaskId, setSubmitModalTaskId] = useState<number | null>(null);
    const [deletingAttachmentId, setDeletingAttachmentId] = useState<number | null>(null);
        const [taskStatusOptions, setTaskStatusOptions] = useState<TaskSettingOption[]>(
            Object.values(TaskStatus).map((value, index) => ({ id: index + 1, value }))
        );
        const [supportTypeOptions, setSupportTypeOptions] = useState<TaskSettingOption[]>(
            Object.values(Skill).map((value, index) => ({ id: index + 1, value }))
        );
                const [equipmentCodeOptions, setEquipmentCodeOptions] = useState<TaskSettingOption[]>([
                    { id: 1, value: 'PC' },
                    { id: 2, value: 'NOTEBOOK' },
                    { id: 3, value: 'PRINTER' },
                    { id: 4, value: 'PROJECTOR' }
                ]);
                const [rawEquipmentSelection, setRawEquipmentSelection] = useState<Array<string | number>>([]);
    const isNoAssetMode = useMemo(() => isNonAssetSupportType(supportType), [supportType]);
    const requiresAssetInfo = useMemo(() => isRequiredAssetSupportType(supportType), [supportType]);
    const shouldShowAssetInfo = useMemo(() => !isNoAssetMode, [isNoAssetMode]);

    const manualAssignableFreelancers = (() => {
        const onlyFreelancers = freelancers.filter(f => {
            const roleName = String((f as any).role?.name ?? (f as any).role ?? '').toLowerCase();
            const hasFreelancerProfile = (Array.isArray((f as any).skills) && (f as any).skills.length > 0)
                || (Array.isArray((f as any).locations) && (f as any).locations.length > 0);
            return roleName.includes('freelance') || roleName.includes('freelancer') || hasFreelancerProfile;
        });
        return onlyFreelancers;
    })();

  // Fetch Main Cons
  useEffect(() => {
    const fetchMainCons = async () => {
        try {
            const response = await mainConsApi.getAll();
            if (response.success && response.data) {
                const normalizedMainCons = (response.data as any[]).map((item) => ({
                    id: item.id,
                    name: item.name,
                    contactPerson: item.contactPerson ?? item.contact_person ?? '',
                    contactNumber: item.contactNumber ?? item.contact_number ?? '',
                    email: item.email ?? '',
                    address: item.address ?? '',
                    isActive: item.isActive ?? item.is_active ?? false,
                }));
                setMainCons(normalizedMainCons);
            }
        } catch (err) {
            console.error('Error fetching Main Cons:', err);
        }
    };
    fetchMainCons();
    }, []);

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const response = await projectsApi.getAll(1, 100, { sortBy: 'name', sort: 'asc' });
                if (!response.success) {
                    console.error('Gagal memuatkan projek untuk borang tugasan:', response.error || response.message);
                    setProjects([]);
                    return;
                }

                const payload = response.data as any;
                const list = Array.isArray(payload?.projects) ? payload.projects : [];
                setProjects(list);
            } catch (err) {
                console.error('Error fetching projects:', err);
            }
        };

        fetchProjects();
    }, []);

    const filteredProjects = useMemo(() => {
        const keyword = projectSearch.trim().toLowerCase();
        if (!keyword) return projects;

        return projects.filter((project) => {
            const code = String(project.code || '').toLowerCase();
            const name = String(project.name || '').toLowerCase();
            const client = String(project.client_name || '').toLowerCase();
            return code.includes(keyword) || name.includes(keyword) || client.includes(keyword);
        });
    }, [projects, projectSearch]);

    const selectedProject = useMemo(
        () => projects.find(project => project.id === Number(projectId)),
        [projects, projectId]
    );

    useEffect(() => {
        if (isProjectDropdownOpen) return;

        if (selectedProject) {
            setProjectSearch(`${selectedProject.code} - ${selectedProject.name}`);
            return;
        }

        if (!projectId) {
            setProjectSearch('');
        }
    }, [selectedProject, projectId, isProjectDropdownOpen]);

    useEffect(() => {
        const loadTaskSettings = async () => {
            try {
                const response = await taskSettingsApi.getAll();
                const taskSettingsData: any = response?.data;
                const statusOptions = taskSettingsData?.statusOptions;
                const supportOptions = taskSettingsData?.supportTypeOptions;
                const equipmentOptions = taskSettingsData?.equipmentCodeOptions;

                if (Array.isArray(statusOptions) && statusOptions.length > 0) {
                    setTaskStatusOptions(statusOptions);
                    // Don't override task status if we're in edit mode and task data might be loaded
                    if (!isEditMode) {
                        setTaskStatusSettingId(statusOptions[0].id);
                        setTaskStatus(statusOptions[0].value as TaskStatus);
                    }
                }

                if (Array.isArray(supportOptions) && supportOptions.length > 0) {
                    setSupportTypeOptions(supportOptions);
                    // Don't override support type if we're in edit mode and task data might be loaded
                    if (!isEditMode) {
                        setSupportTypeSettingId(supportOptions[0].id);
                        setSupportType(supportOptions[0].value);
                    }
                }

                if (Array.isArray(equipmentOptions) && equipmentOptions.length > 0) {
                    setEquipmentCodeOptions(
                        equipmentOptions.map((item: any) => ({
                            id: Number(item.id),
                            value: String(item.value)
                        }))
                    );
                }
            } catch {
                // fallback defaults already set
            }
        };

        loadTaskSettings();
    }, []);

  // Fetch Task if Edit Mode
  useEffect(() => {
    if (isEditMode && id) {
        const fetchTask = async () => {
            setFetchLoading(true);
            try {
                const response = await tasksApi.getById(Number(id));
                if (response.success && response.data) {
                    const taskData = (response.data as any).task || response.data;
                    const normalizedTask: Task = {
                        ...taskData,
                        logNumber: taskData.logNumber ?? taskData.log_number ?? '',
                        supportType: taskData.supportType ?? taskData.support_type ?? Skill.HARDWARE,
                        supportTypeSettingId: taskData.supportTypeSettingId ?? taskData.support_type_id ?? taskData.support_type_setting_id ?? undefined,
                        clientLocation: taskData.clientLocation ?? taskData.client_location ?? '',
                        districtAddress: taskData.districtAddress ?? taskData.bandar_daerah ?? taskData.district_address ?? '',
                        offerPrice: taskData.offerPrice ?? taskData.offer_price ?? 0,
                        statusSettingId: taskData.statusSettingId ?? taskData.status_id ?? taskData.status_setting_id ?? undefined,
                        mainConId: taskData.mainConId ?? taskData.main_con_id ?? undefined,
                        projectId: taskData.projectId ?? taskData.project_id ?? taskData.project?.id ?? undefined,
                        serviceStartDate: taskData.serviceStartDate ?? taskData.service_start_date ?? undefined,
                        serviceStartTime: taskData.serviceStartTime ?? taskData.service_start_time ?? undefined,
                        assignedTo: taskData.assignedTo ?? taskData.assigned_to ?? taskData.assignee?.id ?? undefined,
                        arrivalConfirmedAt: taskData.arrivalConfirmedAt ?? taskData.arrival_confirmed_at ?? undefined,
                        arrivalLatitude: taskData.arrivalLatitude ?? taskData.arrival_latitude ?? undefined,
                        arrivalLongitude: taskData.arrivalLongitude ?? taskData.arrival_longitude ?? undefined,
                        arrivalAccuracyMeters: taskData.arrivalAccuracyMeters ?? taskData.arrival_accuracy_meters ?? undefined,
                    };
                    setTask(normalizedTask);
                    
                    // Populate Form
                    setTitle(taskData.title || '');
                    setLogNumber(taskData.logNumber ?? taskData.log_number ?? '');
                    setDescription(taskData.description || '');
                    setSupportType(taskData.supportType ?? taskData.support_type ?? Skill.HARDWARE);
                    setSupportTypeSettingId(taskData.supportTypeSettingId ?? taskData.support_type_id ?? taskData.support_type_setting_id ?? null);
                    setClientLocation(taskData.clientLocation ?? taskData.client_location ?? '');
                    setDistrictAddress(taskData.districtAddress ?? taskData.bandar_daerah ?? taskData.district_address ?? '');
                    setState(taskData.state);
                    const normalizedDeadline = taskData.deadline ? new Date(taskData.deadline).toISOString().split('T')[0] : '';
                    setDeadline(normalizedDeadline);
                    setDeadlineTime(taskData.deadlineTime ?? taskData.deadline_time ? String(taskData.deadlineTime ?? taskData.deadline_time).slice(0, 5) : '');
                    const normalizedRequirementDate = taskData.requirementDate ?? taskData.requirement_date ?? normalizedDeadline;
                    const normalizedRequirementTime = taskData.requirementTime ?? taskData.requirement_time ?? taskData.deadlineTime ?? taskData.deadline_time ?? '';
                    setRequirementDate(normalizedRequirementDate ? new Date(normalizedRequirementDate).toISOString().split('T')[0] : '');
                    setRequirementTime(normalizedRequirementTime ? String(normalizedRequirementTime).slice(0, 5) : '');
                    setServiceStartDate(taskData.serviceStartDate ?? taskData.service_start_date ? new Date(taskData.serviceStartDate ?? taskData.service_start_date).toISOString().split('T')[0] : '');
                    setServiceStartTime(taskData.serviceStartTime ?? taskData.service_start_time ? String(taskData.serviceStartTime ?? taskData.service_start_time).slice(0, 5) : '');
                    setOfferPrice(taskData.offerPrice ?? taskData.offer_price ?? 0);
                    setTaskStatus(taskData.status ?? TaskStatus.BARU);
                    setTaskStatusSettingId(taskData.statusSettingId ?? taskData.status_id ?? taskData.status_setting_id ?? null);
                    setAssignedFreelancerId(taskData.assignedTo ?? taskData.assigned_to ?? taskData.assignee?.id ?? '');
                    setRemarks(taskData.remarks || '');
                    setLinks((taskData.links || taskData.taskLinks || []).map((link: any) => typeof link === 'string' ? link : link.url).filter(Boolean));
                    setExistingAttachments((taskData.attachments || [])
                        .map((attachment: any) => {
                            if (typeof attachment === 'string') return { url: attachment };
                            return {
                                id: attachment.id,
                                url: attachment.file_path || attachment.url || ''
                            };
                        })
                        .filter((attachment: any) => Boolean(attachment.url)));
                    
                    setMainConId(taskData.mainConId ?? taskData.main_con_id ?? '');
                    setProjectId(taskData.projectId ?? taskData.project_id ?? taskData.project?.id ?? '');
                    setPicName(taskData.picName ?? taskData.pic_name ?? '');
                    setPicPhone(taskData.picPhone ?? taskData.pic_phone ?? '');
                    setClientName(taskData.clientName ?? taskData.client_name ?? '');
                    setAssetTagId(taskData.assetTagId ?? taskData.asset_tag_id ?? '');
                    setAssetBrand(taskData.assetBrand ?? taskData.asset_brand ?? '');
                    setAssetModel(taskData.assetModel ?? taskData.asset_model ?? '');
                    setAssetSerialNumber(taskData.assetSerialNumber ?? taskData.asset_serial_number ?? '');
                    setBranchName(taskData.branchName ?? taskData.branch_name ?? '');
                    setRawEquipmentSelection(taskData.equipmentTypes ?? taskData.equipment_types_id ?? taskData.equipment_types ?? []);
                } else {
                    setError((response as any).error || 'Task not found');
                }
            } catch (err) {
                console.error('Error fetching task:', err);
                setError('Failed to load task details');
            } finally {
                setFetchLoading(false);
            }
        };
        fetchTask();
    }
    }, [id, isEditMode]);

    useEffect(() => {
        const selectedCodes = (Array.isArray(rawEquipmentSelection) ? rawEquipmentSelection : [])
            .map((value) => {
                if (typeof value === 'number' || /^\d+$/.test(String(value))) {
                    const byId = equipmentCodeOptions.find(option => option.id === Number(value));
                    return byId?.value;
                }

                const normalizedCode = String(value || '').trim().toUpperCase();
                const byCode = equipmentCodeOptions.find(option => option.value.toUpperCase() === normalizedCode);
                return byCode?.value;
            })
            .filter((value): value is string => Boolean(value));

        setEquipmentTypes(selectedCodes.length > 0 ? [selectedCodes[0]] : []);
    }, [rawEquipmentSelection, equipmentCodeOptions]);

    useEffect(() => {
        if (!supportTypeSettingId && supportType) {
            const matchedSupportType = supportTypeOptions.find(option => option.value === supportType);
            if (matchedSupportType) {
                setSupportTypeSettingId(matchedSupportType.id);
            }
        }

        if (!taskStatusSettingId && taskStatus) {
            const matchedStatus = taskStatusOptions.find(option => option.value === taskStatus);
            if (matchedStatus) {
                setTaskStatusSettingId(matchedStatus.id);
            }
        }
    }, [supportType, taskStatus, supportTypeSettingId, taskStatusSettingId, supportTypeOptions, taskStatusOptions]);

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

    const removeExistingAttachment = async (attachmentId?: number) => {
        if (!id || !attachmentId) return;
        setDeletingAttachmentId(attachmentId);
        try {
            const response = await tasksApi.deleteAttachment(Number(id), attachmentId);
            if (!response.success) {
                throw new Error(response.error || 'Gagal memadam lampiran');
            }
            setExistingAttachments(prev => prev.filter(attachment => attachment.id !== attachmentId));
        } catch (err: any) {
            alert(err?.message || 'Gagal memadam lampiran.');
        } finally {
            setDeletingAttachmentId(null);
        }
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

    const sanitizedTitle = authService.sanitizeInput(title.trim());
    if (!sanitizedTitle) errors.push('Tajuk diperlukan');

    if (!mainConId) errors.push('Sila pilih Main-Con');

    const sanitizedDescription = authService.sanitizeInput(description.trim());
    if (!sanitizedDescription) errors.push('Deskripsi diperlukan');

    const sanitizedLocation = authService.sanitizeInput(clientLocation.trim());
    if (!sanitizedLocation || sanitizedLocation.length < 3) errors.push('Lokasi klien diperlukan');
    const sanitizedDistrictAddress = authService.sanitizeInput(districtAddress.trim());

        if (!requirementDate) {
            errors.push('Tarikh keperluan diperlukan');
        }

        if (!requirementTime) {
            errors.push('Masa keperluan diperlukan');
        }

    if (!offerPrice || offerPrice <= 0 || offerPrice > 100000) errors.push('Harga tawaran mestilah antara RM1 hingga RM100,000');

    const sanitizedAssetTagId = authService.sanitizeInput(assetTagId.trim());
    const sanitizedAssetBrand = authService.sanitizeInput(assetBrand.trim());
    const sanitizedAssetModel = authService.sanitizeInput(assetModel.trim());
    const sanitizedAssetSerialNumber = authService.sanitizeInput(assetSerialNumber.trim());
    const normalizedEquipmentTypes = shouldShowAssetInfo ? equipmentTypes : [];

    if (requiresAssetInfo && !sanitizedAssetTagId && !sanitizedAssetSerialNumber) {
        errors.push('Untuk jenis sokongan ini, sekurang-kurangnya Tag ID atau Serial Number aset perlu diisi');
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
      bandar_daerah: sanitizedDistrictAddress, // Explicit field for backend
      state,
      deadline: requirementDate,
      deadlineTime: requirementTime,
      requirementDate,
      requirementTime,
      offerPrice,
            status: taskStatus,
            statusSettingId: taskStatusSettingId || taskStatusOptions.find(option => option.value === taskStatus)?.id || null,
    createdBy: currentUserId,
      remarks: authService.sanitizeInput(remarks.trim()),
      links,
      attachments,
      mainConId: Number(mainConId),
    projectId: projectId ? Number(projectId) : undefined,
      picName,
      picPhone,
      clientName,
            assetTagId: shouldShowAssetInfo ? sanitizedAssetTagId : '',
            assetBrand: shouldShowAssetInfo ? sanitizedAssetBrand : '',
            assetModel: shouldShowAssetInfo ? sanitizedAssetModel : '',
            assetSerialNumber: shouldShowAssetInfo ? sanitizedAssetSerialNumber : '',
      branchName,
            equipmentTypes: normalizedEquipmentTypes,
    };
  };

  const handleSubmit = async () => {
        if (isEditMode && !canEditTaskByRole) {
                setError('Anda tidak dibenarkan mengedit tugasan. Hanya Admin atau Staff boleh mengedit tugasan.');
                return;
        }

    const validatedData = validateForm();
    if (!validatedData) return;

    setLoading(true);
    try {
        if (isEditMode && id) {
                 const updatePayload = {
                     title: validatedData.title,
                     description: validatedData.description,
                     support_type_id: validatedData.supportTypeSettingId,
                     support_type: validatedData.supportType,
                     client_location: validatedData.clientLocation,
                     bandar_daerah: validatedData.districtAddress,
                     status_id: validatedData.statusSettingId,
                     state: validatedData.state,
                     deadline: validatedData.deadline,
                     deadline_time: validatedData.deadlineTime || undefined,
                     requirement_date: validatedData.requirementDate,
                     requirement_time: validatedData.requirementTime,
                     offer_price: validatedData.offerPrice,
                     remarks: validatedData.remarks,
                     project_id: validatedData.projectId,
                     main_con_id: validatedData.mainConId,
                     pic_name: validatedData.picName,
                     pic_phone: validatedData.picPhone,
                     client_name: validatedData.clientName,
                     asset_tag_id: validatedData.assetTagId,
                     asset_brand: validatedData.assetBrand,
                     asset_model: validatedData.assetModel,
                     asset_serial_number: validatedData.assetSerialNumber,
                     branch_name: validatedData.branchName,
                     equipment_types_id: JSON.stringify(validatedData.equipmentTypes || []),
                 };

                 let payloadToSend: any = updatePayload;
                 if (attachments.length > 0) {
                    const formData = new FormData();
                    Object.entries(updatePayload).forEach(([key, value]) => {
                        if (value !== undefined && value !== null) {
                            formData.append(key, String(value));
                        }
                    });
                    attachments.forEach(file => formData.append('attachments', file));
                    payloadToSend = formData;
                 }

                 const updateResp = await tasksApi.update(Number(id), payloadToSend);
                 if (!updateResp.success) {
                    throw new Error(updateResp.error || 'Gagal kemaskini tugasan');
                 }

                 const currentAssignedId = Number(task?.assignedTo ?? (task as any)?.assigned_to ?? (task as any)?.assignee?.id ?? 0);
                 const isUnassigning = assignedFreelancerId === '';
                 const nextAssignedId = isUnassigning ? null : Number(assignedFreelancerId);
                 const hasAssignmentChange = nextAssignedId !== currentAssignedId;

                 if (hasAssignmentChange) {
                    if (isUnassigning) {
                        const unassignResp = await tasksApi.unassign(Number(id));
                        if (!unassignResp.success) {
                            throw new Error(unassignResp.error || 'Gagal buang assign freelancer');
                        }
                        setTask(prev => prev ? {
                            ...prev,
                            assignedTo: null,
                            assignee: null,
                        } : prev);
                    } else {
                        const assignResp = await tasksApi.assign(Number(id), nextAssignedId);
                        if (!assignResp.success) {
                            throw new Error(assignResp.error || 'Gagal assign freelancer');
                        }
                        const selectedFreelancer = freelancers.find(f => f.id === nextAssignedId);
                        setTask(prev => prev ? {
                            ...prev,
                            assignedTo: nextAssignedId,
                            assignee: selectedFreelancer ? { id: selectedFreelancer.id, name: selectedFreelancer.name } as any : (prev as any).assignee,
                        } : prev);
                    }
                 }

                 const statusAfterAssignment = hasAssignmentChange ? (isUnassigning ? TaskStatus.BARU : TaskStatus.TELAH_DIAMBIL) : (task?.status || TaskStatus.BARU);
                 if (taskStatus !== statusAfterAssignment) {
                     await tasksApi.updateStatus(Number(id), taskStatus);
                     setTask(prev => prev ? { ...prev, status: taskStatus } : prev);
                 }
             alert('Tugasan berjaya dikemaskini!');
        } else {
             const createPayload: any = {
                title: validatedData.title,
                description: validatedData.description,
                support_type: validatedData.supportType,
                client_location: validatedData.clientLocation,
                bandar_daerah: validatedData.districtAddress,
                state: validatedData.state,
                deadline: validatedData.deadline,
                deadline_time: validatedData.deadlineTime || undefined,
                requirement_date: validatedData.requirementDate,
                requirement_time: validatedData.requirementTime,
                offer_price: validatedData.offerPrice,
                status: validatedData.status,
                remarks: validatedData.remarks,
                project_id: validatedData.projectId,
                main_con_id: validatedData.mainConId,
                pic_name: validatedData.picName,
                pic_phone: validatedData.picPhone,
                client_name: validatedData.clientName,
                asset_tag_id: validatedData.assetTagId,
                asset_brand: validatedData.assetBrand,
                asset_model: validatedData.assetModel,
                asset_serial_number: validatedData.assetSerialNumber,
                branch_name: validatedData.branchName,
                equipment_types_id: JSON.stringify(validatedData.equipmentTypes || []),
             };

             if (validatedData.supportTypeSettingId) {
                createPayload.support_type_id = validatedData.supportTypeSettingId;
             }

                 if (validatedData.logNumber) {
                     createPayload.log_number = validatedData.logNumber;
                 }

             if (validatedData.statusSettingId) {
                createPayload.status_id = validatedData.statusSettingId;
             }

             const normalizedLinks = Array.isArray(validatedData.links)
                ? validatedData.links
                    .map(url => String(url || '').trim())
                    .filter(Boolean)
                    .map(url => ({ url }))
                : [];
             if (normalizedLinks.length > 0) {
                createPayload.links = normalizedLinks;
             }

             let payloadToSend: any = createPayload;
             if (attachments.length > 0) {
                const formData = new FormData();
                Object.entries(createPayload).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                        if (key === 'links') {
                            formData.append(key, JSON.stringify(value));
                        } else {
                            formData.append(key, String(value));
                        }
                    }
                });
                attachments.forEach(file => formData.append('attachments', file));
                payloadToSend = formData;
             }

             const createResp = await tasksApi.create(payloadToSend);
             if (!createResp.success) {
                 throw new Error(createResp.error || createResp.message || 'Gagal mencipta tugasan');
             }
             const createdTask = (createResp.data as any)?.task || createResp.data;
             if (!createdTask?.id) {
                 throw new Error('Respons pelayan tidak lengkap selepas simpan tugasan.');
             }
             alert('Tugasan berjaya dicipta!');
             navigate('/tasks');
        }
        refreshData();
    } catch (err: any) {
        console.error('Error saving task:', err);
        setError(err.message || 'Gagal menyimpan tugasan.');
    } finally {
        setLoading(false);
    }
  };

    const handleOpenAgihan = () => {
        if (!canEditTaskByRole) {
            setError('Anda tidak dibenarkan mengagihkan atau mengedit tugasan. Hanya Admin atau Staff dibenarkan.');
            return;
        }
        if (!isEditMode || !task) {
            alert('Sila simpan tugasan dahulu untuk akses Agihan.');
            return;
        }
        setAssignModalOpen(true);
    };

    const handleTulisTunaAnnounce = () => {
        if (!canSubmitTaskForm) {
            alert('Anda tidak dibenarkan mengakses borang Hantar Tugasan. Sila semak tetapan peranan.');
            return;
        }
        if (!isEditMode || !task) {
            alert('Sila simpan tugasan dahulu untuk hantar tugasan.');
            return;
        }
        setSubmitConfirmOpen(true);
    };

    const handleConfirmSubmit = () => {
        setSubmitConfirmOpen(false);
        if (id) {
            setSubmitModalTaskId(Number(id));
        }
    };

    const handleMarkBorangDisemak = async () => {
        if (!canEditTaskByRole) {
            setError('Anda tidak dibenarkan mengubah status tugasan. Hanya Admin atau Staff dibenarkan.');
            return;
        }
        if (!isEditMode || !id) return;
        setLoading(true);
        setError(null);
        try {
            const response = await tasksApi.updateStatus(Number(id), TaskStatus.BORANG_DISEMAK);
            if (!response.success) {
                throw new Error(response.error || 'Gagal menukar status kepada Borang Disemak');
            }
            setTaskStatus(TaskStatus.BORANG_DISEMAK);
            setTask(prev => prev ? { ...prev, status: TaskStatus.BORANG_DISEMAK } : prev);
            refreshData();
            alert('Status tugasan berjaya ditukar kepada Borang Disemak.');
        } catch (err: any) {
            setError(err?.message || 'Gagal menukar status tugasan.');
        } finally {
            setLoading(false);
        }
    };

    const handleManualArrival = async () => {
        if (!canEditTaskByRole) {
            setError('Anda tidak dibenarkan tandakan kehadiran. Hanya Admin atau Staff dibenarkan.');
            return;
        }
        if (!isEditMode || !id) return;

        const confirmMarkArrival = window.confirm('Tandakan freelancer atau technician ini sebagai sudah hadir ke lokasi? Ini akan menghentikan reminder kehadiran.');
        if (!confirmMarkArrival) return;

        setMarkingArrival(true);
        setError(null);
        try {
            const response = await taskRemindersApi.manuallyConfirmArrival(Number(id));
            if (!response.success) {
                throw new Error(response.error || response.message || 'Gagal menandakan kehadiran');
            }

            const updatedTask = (response.data as any)?.task;
            const confirmedAt = updatedTask?.arrivalConfirmedAt ?? updatedTask?.arrival_confirmed_at ?? new Date().toISOString();

            setTask(prev => prev ? {
                ...prev,
                arrivalConfirmedAt: confirmedAt,
                arrivalLatitude: updatedTask?.arrivalLatitude ?? updatedTask?.arrival_latitude ?? prev.arrivalLatitude,
                arrivalLongitude: updatedTask?.arrivalLongitude ?? updatedTask?.arrival_longitude ?? prev.arrivalLongitude,
                arrivalAccuracyMeters: updatedTask?.arrivalAccuracyMeters ?? updatedTask?.arrival_accuracy_meters ?? prev.arrivalAccuracyMeters,
            } : prev);
            refreshData();
            alert('Kehadiran berjaya ditandakan. Reminder kehadiran akan dihentikan.');
        } catch (err: any) {
            setError(err?.message || 'Gagal menandakan kehadiran.');
        } finally {
            setMarkingArrival(false);
        }
    };

    const shouldHideTopActions = isEditMode && [TaskStatus.SELESAI, TaskStatus.BORANG_DISEMAK].includes(taskStatus);
    const isBorangDisemakLocked = isEditMode && taskStatus === TaskStatus.BORANG_DISEMAK;
    const isEditLockedByRole = isEditMode && !canEditTaskByRole;
    const hasAssignedTechnician = Boolean(task?.assignedTo ?? assignedFreelancerId);
    const hasArrivalConfirmation = Boolean(task?.arrivalConfirmedAt);

  if (fetchLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-5xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
            {/* Header */}
            <div className="bg-white px-6 py-4 border-b flex justify-between items-center sticky top-0 z-10">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{isEditMode ? 'Butiran Tugasan' : 'Cipta Tugasan Baru'}</h1>
                    {isEditMode && <Badge status={taskStatus} />}
                </div>
                <div className="flex space-x-2">
                    <Button variant="secondary" onClick={() => navigate(-1)}>Kembali</Button>
                    {isEditMode && !shouldHideTopActions && canSubmitTaskForm && (
                        <Button variant="secondary" onClick={handleTulisTunaAnnounce}>Hantar Tugasan</Button>
                    )}
                    {isEditMode && !shouldHideTopActions && canEditTaskByRole && taskStatus !== TaskStatus.TELAH_DIAMBIL && (
                        <Button variant="secondary" onClick={handleOpenAgihan}>Agihan</Button>
                    )}
                    {isEditMode && !shouldHideTopActions && (
                        <Button variant="secondary" onClick={() => navigate(`/tasks/${id}/view`)}>Paparan Cetakan</Button>
                    )}
                    {isEditMode && canEditTaskByRole && hasAssignedTechnician && !hasArrivalConfirmation && (
                        <Button variant="secondary" onClick={handleManualArrival} disabled={markingArrival}>
                            {markingArrival ? 'Merekod Hadir...' : 'Hadir'}
                        </Button>
                    )}
                    {isEditMode && canEditTaskByRole && taskStatus === TaskStatus.SELESAI && (
                        <Button onClick={handleMarkBorangDisemak} disabled={loading}>Borang Disemak</Button>
                    )}
                    {!isBorangDisemakLocked && !isEditLockedByRole && (
                        <Button onClick={handleSubmit} disabled={loading}>
                            {loading ? 'Menyimpan...' : (isEditMode ? 'Simpan Perubahan' : 'Cipta Tugasan')}
                        </Button>
                    )}
                </div>
            </div>

            <div className="p-6 space-y-6">
                {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md whitespace-pre-line">{error}</p>}

                {isEditLockedByRole && (
                    <div className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 p-3 rounded-md">
                        Anda hanya boleh melihat butiran dan menggunakan fungsi hantar tugasan. Edit tugasan hanya dibenarkan untuk peranan Admin atau Staff.
                    </div>
                )}

                {task?.arrivalConfirmedAt && (
                    <div className="text-sm text-green-800 bg-green-50 border border-green-200 p-3 rounded-md">
                        Kehadiran telah direkodkan pada {new Date(task.arrivalConfirmedAt).toLocaleString('ms-MY')}. Reminder kehadiran tidak akan dihantar lagi.
                    </div>
                )}

                <fieldset disabled={isBorangDisemakLocked || isEditLockedByRole} className={(isBorangDisemakLocked || isEditLockedByRole) ? 'space-y-6 opacity-80' : 'space-y-6'}>

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
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Projek</label>
                            <div className="relative">
                                <input
                                    id="projectSearch"
                                    type="text"
                                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                    placeholder="Cari & pilih projek (kod / nama / klien)"
                                    value={projectSearch}
                                    onFocus={() => setIsProjectDropdownOpen(true)}
                                    onChange={(e) => {
                                        setProjectSearch(e.target.value);
                                        setIsProjectDropdownOpen(true);
                                    }}
                                    onBlur={() => {
                                        setTimeout(() => setIsProjectDropdownOpen(false), 150);
                                    }}
                                />

                                {isProjectDropdownOpen && (
                                    <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                                        <button
                                            type="button"
                                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 border-b border-gray-100"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => {
                                                setProjectId('');
                                                setProjectSearch('');
                                                setIsProjectDropdownOpen(false);
                                            }}
                                        >
                                            Pilih Projek (Opsyenal)
                                        </button>

                                        {filteredProjects.map(project => (
                                            <button
                                                key={project.id}
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => {
                                                    setProjectId(project.id);
                                                    if (project.main_con_id) {
                                                        setMainConId(project.main_con_id);
                                                    }
                                                    setProjectSearch(`${project.code} - ${project.name}`);
                                                    setIsProjectDropdownOpen(false);
                                                }}
                                            >
                                                <span className="font-medium">{project.code}</span>
                                                <span className="text-gray-700"> - {project.name}</span>
                                                {project.client_name && (
                                                    <span className="block text-xs text-gray-500">{project.client_name}</span>
                                                )}
                                            </button>
                                        ))}

                                        {filteredProjects.length === 0 && (
                                            <div className="px-3 py-2 text-xs text-gray-500">Tiada projek dijumpai untuk carian ini.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <Input label="No Log (Opsyenal)" id="logNumber" value={logNumber} onChange={e => setLogNumber(e.target.value)} placeholder="Kosongkan untuk auto: SPFIT-202603-0002" />
                        <Input label="Tajuk Tugasan" id="title" value={title} onChange={e => setTitle(e.target.value)} required />
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
                        <div className="md:col-span-2 rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
                            {requiresAssetInfo
                                ? 'Mode Aset Wajib: Add-Hoc/Corrective Maintenance perlukan sekurang-kurangnya Tag ID atau Serial Number.'
                                : isNoAssetMode
                                    ? 'Mode Tanpa Aset: Untuk Deployment/Preventive, maklumat aset tidak diperlukan.'
                                    : 'Mode Aset Opsyenal: Maklumat aset boleh diisi jika berkaitan, tetapi tidak diwajibkan untuk jenis sokongan ini.'}
                        </div>
                        {isEditMode && canEditTaskByRole && (
                            <Select label="Assign Freelancer (Manual)" id="assignedFreelancer" value={String(assignedFreelancerId)} onChange={e => setAssignedFreelancerId(e.target.value ? Number(e.target.value) : '')}>
                                <option value="">Pilih Freelancer (manual)</option>
                                {manualAssignableFreelancers.length === 0 && (
                                    <option value="" disabled>Tiada freelancer aktif ditemui</option>
                                )}
                                {manualAssignableFreelancers
                                    .slice()
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                            </Select>
                        )}
                        {isEditMode && canEditTaskByRole && (
                            <Select
                                label="Status Tugasan"
                                id="taskStatus"
                                value={taskStatus}
                                onChange={e => {
                                    const nextStatus = e.target.value as TaskStatus;
                                    setTaskStatus(nextStatus);
                                    const matched = taskStatusOptions.find(option => option.value === nextStatus);
                                    setTaskStatusSettingId(matched?.id ?? null);
                                }}
                            >
                                {taskStatusOptions.map(status => (
                                    <option key={status.id} value={status.value}>{status.value}</option>
                                ))}
                            </Select>
                        )}
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
                        <Input label="Branch Name" id="branchName" value={branchName} onChange={e => setBranchName(e.target.value)} />
                    </div>
                </div>

                {shouldShowAssetInfo && (
                    <>
                        {/* Other Information */}
                        <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm">
                            <h3 className="text-lg font-medium text-gray-900 mb-3 border-b pb-2">OTHER INFORMATION</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Tag ID" id="assetTagId" value={assetTagId} onChange={e => setAssetTagId(e.target.value)} placeholder="A/2024..." />
                                <Input label="Brand" id="assetBrand" value={assetBrand} onChange={e => setAssetBrand(e.target.value)} placeholder="HP" />
                                <Input label="Model" id="assetModel" value={assetModel} onChange={e => setAssetModel(e.target.value)} placeholder="Pro SFF 400 G9" />
                                <Input label="Serial Number" id="assetSerialNumber" value={assetSerialNumber} onChange={e => setAssetSerialNumber(e.target.value)} placeholder="4CE..." />
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
                                {equipmentCodeOptions.map(option => (
                                    <option key={option.id} value={option.value}>{option.value}</option>
                                ))}
                            </Select>
                        </div>
                    </>
                )}

                {/* Problem Description & Task Details */}
                <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-medium text-gray-900 mb-3 border-b pb-2">PROBLEM DESCRIPTION / TASK</h3>
                    <Textarea label="Deskripsi Masalah / Isu" id="description" value={description} onChange={e => setDescription(e.target.value)} required rows={4} />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <Input label="Tarikh Keperluan" id="requirementDate" type="date" value={requirementDate} onChange={e => setRequirementDate(e.target.value)} required />
                        <Input label="Masa Keperluan" id="requirementTime" type="time" value={requirementTime} onChange={e => setRequirementTime(e.target.value)} placeholder="HH:MM" required />
                        <Input label="Harga Tawaran (RM)" id="price" type="number" value={offerPrice} onChange={e => setOfferPrice(parseFloat(e.target.value))} required />
                    </div>

                    {isEditMode && (
                        <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                            <div className="font-medium text-gray-900">Kehadiran Freelancer</div>
                            <div className="mt-1">
                                {task?.arrivalConfirmedAt
                                    ? `Disahkan pada ${new Date(task.arrivalConfirmedAt).toLocaleString('ms-MY')}`
                                    : 'Belum disahkan'}
                            </div>
                            {task?.arrivalLatitude !== undefined && task?.arrivalLongitude !== undefined && (
                                <div className="mt-1">
                                    {`Lokasi: ${task.arrivalLatitude}, ${task.arrivalLongitude}${task.arrivalAccuracyMeters ? ` (±${task.arrivalAccuracyMeters}m)` : ''}`}
                                </div>
                            )}
                        </div>
                    )}
                    
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
                        {existingAttachments.length > 0 && (
                             <div className="mt-2 text-sm space-y-1">
                                <p className="font-semibold text-gray-600">Lampiran Sedia Ada:</p>
                                {existingAttachments.map((attachment, idx) => (
                                    <div key={attachment.id ?? idx} className="flex justify-between items-center p-1 pl-2 bg-gray-100 rounded-md">
                                        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="truncate text-blue-600 hover:underline">{attachment.url.split('/').pop()}</a>
                                        {attachment.id && (
                                            <button
                                                onClick={() => removeExistingAttachment(attachment.id)}
                                                className="ml-2 text-red-500 hover:text-red-700 flex-shrink-0 text-lg leading-none font-bold p-1"
                                                disabled={deletingAttachmentId === attachment.id}
                                                title="Padam lampiran"
                                            >
                                                &times;
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Task Offers & Actions (Only in Edit Mode) */}
                {isEditMode && task && (
                    <div id="agihan-section" className="mt-8 border-t pt-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Pengurusan Agihan & Laporan</h2>
                        
                        <TaskOffersList taskId={task.id} />
                        
                        {/* Reports Section */}
                         {task.report && (
                            <div className="mt-6">
                                <h5 className="font-semibold text-gray-600">Laporan Penyelesaian:</h5>
                                <div className="mt-1 p-2 border rounded-md bg-gray-50">
                                    <p className="text-gray-800">{task.report.notes}</p>
                                    <a href={task.report.fileUrl} className="text-indigo-600 hover:underline text-xs" target="_blank" rel="noopener noreferrer">Lihat Fail</a>
                                    <p className="text-xs text-gray-500 mt-1">Dihantar pada: {task.report.submittedAt}</p>
                                </div>
                            </div>
                        )}

                        {/* Additional Action Buttons can be placed here if we want them inline, 
                            but keeping them in the Modal logic or migrating them fully requires more refactoring of the 'Actions' logic.
                            For now, the 'Edit' mode acts as a comprehensive form. 
                            If we want specific actions like 'Assign', we might need to add buttons here that trigger modals or inline forms.
                        */}
                    </div>
                )}
                </fieldset>
            </div>
        </div>

        {task && (
            <AssignTechModal
                isOpen={isAssignModalOpen}
                onClose={() => setAssignModalOpen(false)}
                task={task}
                freelancers={freelancers}
                webhooks={webhooks}
                notificationTemplates={notificationTemplates}
                onSendOffers={async (taskId, freelancerIds, methods, emailTemplateId, whatsappTemplateId) => {
                    const sendOffersHandler = onSendOffers ?? (async () => {
                    alert('Fungsi penghantaran tawaran belum tersedia. Sila refresh semula sistem.');
                    });
                    await sendOffersHandler(taskId, freelancerIds, methods, emailTemplateId, whatsappTemplateId);
                    setAssignModalOpen(false);
                }}
            />
        )}

        {/* Hantar Tugasan Confirmation Modal */}
        {isSubmitConfirmOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 max-w-md">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Sahkan Hantar Tugasan</h3>
                    <p className="text-gray-600 mb-6">
                        Adakah anda pasti tugasan ini telah selesai dan siap untuk dihantar?
                    </p>
                    <p className="text-sm text-gray-500 mb-6">
                        Selepas klik Ya, sila isi maklumat penghantaran tugasan dengan lengkap.
                    </p>
                    <div className="flex justify-end space-x-3">
                        <Button
                            variant="secondary"
                            onClick={() => setSubmitConfirmOpen(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={handleConfirmSubmit}
                        >
                            Ya, Hantar
                        </Button>
                    </div>
                </div>
            </div>
        )}

        {/* Hantar Tugasan Form Modal */}
        {submitModalTaskId && canSubmitTaskForm && (
            <SubmitTaskModal
                isOpen={true}
                taskId={submitModalTaskId}
                onCancel={() => setSubmitModalTaskId(null)}
                onSubmit={(success) => {
                    if (success) {
                        navigate('/tasks/completed');
                    } else {
                        setSubmitModalTaskId(null);
                    }
                }}
            />
        )}
    </div>
  );
};
