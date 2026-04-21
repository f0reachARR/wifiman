import { Alert, Button, Card, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useAuthActions } from '../lib/useAuthSession.js';

type LoginFormValues = {
  displayName: string;
  passphrase: string;
};

export function LoginPage() {
  const navigate = useNavigate();
  const { signInAsOperator } = useAuthActions();
  const form = useForm({
    defaultValues: {
      displayName: '',
      passphrase: '',
    } satisfies LoginFormValues,
    onSubmit: async ({ value }) => {
      signInAsOperator(value.displayName);
      await navigate({ to: '/app' });
    },
  });

  return (
    <Card className='form-card' padding='xl' radius='xl'>
      <Stack gap='lg'>
        <div>
          <Title order={2}>運営ログイン</Title>
          <Text c='dimmed'>基盤セットアップ段階ではローカルセッションとして保持します。</Text>
        </div>

        <Alert color='orange' variant='light'>
          認証 API 連携は後続 Issue
          で差し替え可能なように、フックとルート保護だけ先に固定しています。
        </Alert>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <Stack gap='md'>
            <form.Field
              name='displayName'
              validators={{
                onChange: ({ value }) =>
                  value.trim().length === 0 ? '表示名を入力してください' : undefined,
              }}
            >
              {(field) => (
                <TextInput
                  label='表示名'
                  placeholder='Operator 1'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.currentTarget.value)}
                  error={field.state.meta.errors[0]}
                />
              )}
            </form.Field>

            <form.Field
              name='passphrase'
              validators={{
                onChange: ({ value }) =>
                  value.trim().length < 8
                    ? '8 文字以上のパスフレーズを入力してください'
                    : undefined,
              }}
            >
              {(field) => (
                <PasswordInput
                  label='パスフレーズ'
                  placeholder='local-dev-passphrase'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.currentTarget.value)}
                  error={field.state.meta.errors[0]}
                />
              )}
            </form.Field>

            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button
                  type='submit'
                  disabled={!canSubmit}
                  loading={Boolean(isSubmitting)}
                  color='teal'
                >
                  ダッシュボードへ進む
                </Button>
              )}
            </form.Subscribe>
          </Stack>
        </form>
      </Stack>
    </Card>
  );
}
