import { useState, useEffect } from 'react';
import { Button, TextInput, PasswordInput, Select, Modal, Badge, Text, Group, Stack, ActionIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconPencil, IconUserOff, IconUserCheck, IconPhone, IconMail } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import * as memberService from '@/services/memberService';
import type { Profile } from '@/types';

export default function MembersPage() {
  const { isAdmin } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure();
  const [editingMember, setEditingMember] = useState<Profile | null>(null);

  // Form
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cargo, setCargo] = useState('');
  const [role, setRole] = useState<string>('operacao');
  const [saving, setSaving] = useState(false);

  const loadMembers = async () => {
    try {
      const data = await memberService.getMembers();
      setMembers(data);
    } catch (err) {
      console.error('[Members] Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMembers(); }, []);

  const resetForm = () => {
    setFullName(''); setEmail(''); setPassword(''); setWhatsapp(''); setCargo(''); setRole('operacao');
    setEditingMember(null);
  };

  const handleOpenCreate = () => { resetForm(); openModal(); };

  const handleOpenEdit = (member: Profile) => {
    setEditingMember(member);
    setFullName(member.full_name);
    setEmail(member.email);
    setWhatsapp(member.whatsapp || '');
    setCargo(member.cargo || '');
    setRole(member.role);
    setPassword('');
    openModal();
  };

  const handleSave = async () => {
    if (!fullName.trim()) { notifications.show({ title: 'Erro', message: 'Nome é obrigatório', color: 'red' }); return; }
    setSaving(true);
    try {
      if (editingMember) {
        await memberService.updateMember(editingMember.id, { full_name: fullName.trim(), whatsapp: whatsapp || null, cargo: cargo || null, role: role as 'admin' | 'operacao' });
      } else {
        if (!email.trim() || !password) { notifications.show({ title: 'Erro', message: 'Email e senha são obrigatórios', color: 'red' }); setSaving(false); return; }
        await memberService.createMember({ email: email.trim(), password, full_name: fullName.trim(), whatsapp: whatsapp || undefined, cargo: cargo || undefined, role: role as 'admin' | 'operacao' });
      }
      await loadMembers();
      closeModal();
      resetForm();
      notifications.show({ title: 'Sucesso', message: editingMember ? 'Membro atualizado' : 'Membro criado', color: 'green' });
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err.message || 'Erro ao salvar', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (member: Profile) => {
    try {
      if (member.is_active) { await memberService.deactivateMember(member.id); } else { await memberService.reactivateMember(member.id); }
      await loadMembers();
      notifications.show({ title: 'Sucesso', message: member.is_active ? 'Membro desativado' : 'Membro reativado', color: 'green' });
    } catch (err) {
      notifications.show({ title: 'Erro', message: 'Erro ao alterar status', color: 'red' });
    }
  };

  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="members-page">
      <Group justify="space-between" mb="lg">
        <div>
          <Text size="xl" fw={700} c="var(--text-primary)">Membros da Equipe</Text>
          <Text size="sm" c="dimmed">{members.filter((m) => m.is_active).length} membros ativos</Text>
        </div>
        {isAdmin && (
          <Button leftSection={<IconPlus size={16} />} color="violet" onClick={handleOpenCreate}>Novo Membro</Button>
        )}
      </Group>

      {loading ? (
        <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-title">Carregando...</div></div>
      ) : (
        <div className="members-grid">
          {members.map((member) => (
            <div key={member.id} className="member-card" style={{ opacity: member.is_active ? 1 : 0.5 }}>
              <Group justify="space-between" mb="md">
                <Group gap="sm">
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-violet), #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 14 }}>
                    {getInitials(member.full_name)}
                  </div>
                  <div>
                    <Text size="sm" fw={600} c="var(--text-primary)">{member.full_name}</Text>
                    <Text size="xs" c="dimmed">{member.cargo || 'Sem cargo'}</Text>
                  </div>
                </Group>
                <Badge size="sm" variant="light" color={member.role === 'admin' ? 'violet' : 'gray'}>
                  {member.role === 'admin' ? 'Admin' : 'Operação'}
                </Badge>
              </Group>

              <Stack gap={4} mb="md">
                <Group gap="xs"><IconMail size={13} color="var(--text-muted)" /><Text size="xs" c="dimmed">{member.email}</Text></Group>
                {member.whatsapp && (<Group gap="xs"><IconPhone size={13} color="var(--text-muted)" /><Text size="xs" c="dimmed">{member.whatsapp}</Text></Group>)}
              </Stack>

              {isAdmin && (
                <Group gap="xs">
                  <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => handleOpenEdit(member)} title="Editar"><IconPencil size={14} /></ActionIcon>
                  <ActionIcon variant="subtle" color={member.is_active ? 'red' : 'green'} size="sm" onClick={() => handleToggleActive(member)} title={member.is_active ? 'Desativar' : 'Reativar'}>
                    {member.is_active ? <IconUserOff size={14} /> : <IconUserCheck size={14} />}
                  </ActionIcon>
                </Group>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Create/Edit */}
      <Modal opened={modalOpened} onClose={closeModal} title={editingMember ? 'Editar Membro' : 'Novo Membro'} size="md">
        <Stack gap="md">
          <TextInput label="Nome completo" placeholder="João Silva" value={fullName} onChange={(e) => setFullName(e.currentTarget.value)} required />
          <TextInput label="Email" placeholder="joao@email.com" value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            required={!editingMember}
            disabled={!!editingMember}
            description={editingMember ? 'O email não pode ser alterado' : undefined}
          />
          {!editingMember && (
            <PasswordInput label="Senha" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.currentTarget.value)} required />
          )}
          <TextInput label="WhatsApp" placeholder="5511999999999" value={whatsapp} onChange={(e) => setWhatsapp(e.currentTarget.value)} />
          <TextInput label="Cargo" placeholder="Desenvolvedor, Designer..." value={cargo} onChange={(e) => setCargo(e.currentTarget.value)} />
          <Select label="Nível" data={[{ value: 'admin', label: 'Administrador' }, { value: 'operacao', label: 'Operação' }]} value={role} onChange={(val) => setRole(val || 'operacao')} />
          <Button fullWidth onClick={handleSave} loading={saving} color="violet">{editingMember ? 'Salvar Alterações' : 'Criar Membro'}</Button>
        </Stack>
      </Modal>
    </div>
  );
}
