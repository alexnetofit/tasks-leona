import { useState } from 'react';
import { TextInput, PasswordInput, Button, Text, Stack } from '@mantine/core';
import { IconMail, IconLock } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Preencha todos os campos');
      return;
    }

    setLoading(true);
    setError('');

    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError('Email ou senha inválidos');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">LP</div>
          <span className="login-title">Leona Projetos</span>
        </div>
        <p className="login-subtitle">
          Gestão inteligente de tarefas e projetos
        </p>

        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="Email"
              placeholder="seu@email.com"
              leftSection={<IconMail size={16} />}
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              size="md"
              styles={{
                input: {
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                  '&:focus': { borderColor: 'var(--accent-violet)' },
                },
                label: { color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '4px' },
              }}
            />

            <PasswordInput
              label="Senha"
              placeholder="••••••••"
              leftSection={<IconLock size={16} />}
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              size="md"
              styles={{
                input: {
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
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
              Entrar
            </Button>
          </Stack>
        </form>

        <Text size="xs" c="dimmed" ta="center" mt="lg">
          Acesso restrito à equipe interna
        </Text>
      </div>
    </div>
  );
}
