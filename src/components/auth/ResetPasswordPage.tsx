import { useState } from 'react';
import { PasswordInput, Button, Text, Stack } from '@mantine/core';
import { IconLock, IconCheck } from '@tabler/icons-react';
import { supabase } from '@/config/supabase';

interface ResetPasswordPageProps {
  onComplete: () => void;
}

export default function ResetPasswordPage({ onComplete }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || !confirmPassword) {
      setError('Preencha todos os campos');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não conferem');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message || 'Erro ao atualizar a senha');
      } else {
        setSuccess(true);
        setTimeout(() => {
          onComplete();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">LP</div>
          <span className="login-title">Leona Projetos</span>
        </div>

        {success ? (
          <div className="reset-success">
            <div className="reset-success-icon">
              <IconCheck size={32} />
            </div>
            <Text size="lg" fw={600} c="var(--text-primary)" ta="center" mt="md">
              Senha atualizada!
            </Text>
            <Text size="sm" c="dimmed" ta="center" mt="xs">
              Redirecionando para a plataforma...
            </Text>
          </div>
        ) : (
          <>
            <p className="login-subtitle">
              Defina sua nova senha de acesso
            </p>

            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <PasswordInput
                  label="Nova Senha"
                  placeholder="Mínimo 6 caracteres"
                  leftSection={<IconLock size={16} />}
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  size="md"
                  styles={{
                    input: {
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                      '&:focus': { borderColor: 'var(--accent-violet)' },
                    },
                    label: { color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '4px' },
                    innerInput: { color: 'var(--text-primary)' },
                  }}
                />

                <PasswordInput
                  label="Confirmar Nova Senha"
                  placeholder="Repita a senha"
                  leftSection={<IconLock size={16} />}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                  size="md"
                  styles={{
                    input: {
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                      '&:focus': { borderColor: 'var(--accent-violet)' },
                    },
                    label: { color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '4px' },
                    innerInput: { color: 'var(--text-primary)' },
                  }}
                />

                {error && (
                  <Text size="sm" c="red" ta="center">
                    {error}
                  </Text>
                )}

                <Button
                  type="submit"
                  fullWidth
                  size="md"
                  loading={loading}
                  mt="sm"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                    border: 'none',
                    fontWeight: 600,
                  }}
                >
                  Salvar Nova Senha
                </Button>
              </Stack>
            </form>
          </>
        )}

        <Text size="xs" c="dimmed" ta="center" mt="lg">
          Leona Projetos — Gestão inteligente
        </Text>
      </div>
    </div>
  );
}
