import { useState } from 'react';
import { TextInput, PasswordInput, Button, Text, Stack, Anchor } from '@mantine/core';
import { IconMail, IconLock, IconArrowLeft } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/config/supabase';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState('');

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError('Informe seu email');
      return;
    }

    setForgotLoading(true);
    setForgotError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/`,
      });

      if (error) {
        setForgotError(error.message || 'Erro ao enviar email de recuperação');
      } else {
        setForgotSuccess(true);
      }
    } catch (err: any) {
      setForgotError(err.message || 'Erro inesperado');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowForgot(false);
    setForgotEmail('');
    setForgotError('');
    setForgotSuccess(false);
  };

  // ─── Forgot Password View ───
  if (showForgot) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">
            <div className="login-logo-icon">LP</div>
            <span className="login-title">Leona Projetos</span>
          </div>

          {forgotSuccess ? (
            <>
              <div className="forgot-success-box">
                <div className="forgot-success-icon">✉️</div>
                <Text size="md" fw={600} c="var(--text-primary)" ta="center">
                  Email enviado!
                </Text>
                <Text size="sm" c="dimmed" ta="center" mt="xs">
                  Verifique sua caixa de entrada e clique no link para redefinir sua senha.
                </Text>
              </div>
              <Button
                fullWidth
                variant="subtle"
                color="violet"
                mt="md"
                leftSection={<IconArrowLeft size={16} />}
                onClick={handleBackToLogin}
              >
                Voltar ao login
              </Button>
            </>
          ) : (
            <>
              <p className="login-subtitle">
                Informe seu email para receber o link de recuperação
              </p>

              <form onSubmit={handleForgotPassword}>
                <Stack gap="md">
                  <TextInput
                    label="Email"
                    placeholder="seu@email.com"
                    leftSection={<IconMail size={16} />}
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.currentTarget.value)}
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

                  {forgotError && (
                    <Text size="sm" c="red" ta="center">
                      {forgotError}
                    </Text>
                  )}

                  <Button
                    type="submit"
                    fullWidth
                    size="md"
                    loading={forgotLoading}
                    mt="sm"
                    style={{
                      background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                      border: 'none',
                      fontWeight: 600,
                    }}
                  >
                    Enviar Link de Recuperação
                  </Button>

                  <Button
                    fullWidth
                    variant="subtle"
                    color="gray"
                    leftSection={<IconArrowLeft size={16} />}
                    onClick={handleBackToLogin}
                  >
                    Voltar ao login
                  </Button>
                </Stack>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── Login View ───
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

            <Anchor
              component="button"
              type="button"
              size="sm"
              ta="right"
              onClick={() => setShowForgot(true)}
              className="forgot-password-link"
            >
              Esqueci minha senha
            </Anchor>

            <Button
              type="submit"
              fullWidth
              size="md"
              loading={loading}
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
