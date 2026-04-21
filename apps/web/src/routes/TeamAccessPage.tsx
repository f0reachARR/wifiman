import { Alert, Button, Card, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuthActions } from '../lib/useAuthSession.js';

type TeamAccessFormValues = {
  token: string;
};

export function TeamAccessPage() {
  const navigate = useNavigate();
  const { signInWithTeamAccess } = useAuthActions();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const initialToken =
    typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(window.location.search).get('token') ?? '');
  const form = useForm({
    defaultValues: {
      token: initialToken,
    } satisfies TeamAccessFormValues,
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      await signInWithTeamAccess(value.token);
      await navigate({ to: '/app' });
    },
  });

  return (
    <Card className='form-card' padding='xl' radius='xl'>
      <Stack gap='lg'>
        <div>
          <Title order={2}>チームアクセス</Title>
          <Text c='dimmed'>
            64 文字トークンをサーバ検証し、role と teamAccessId を含む短期 session を開始します。
          </Text>
        </div>

        <Alert color='orange' variant='light'>
          role
          はトークンの発行内容からサーバ側で決定されます。クライアント側の選択では昇格できません。
        </Alert>

        {submitError ? (
          <Alert color='red' variant='light'>
            {submitError}
          </Alert>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit().catch((error: unknown) => {
              setSubmitError(error instanceof Error ? error.message : 'トークン検証に失敗しました');
            });
          }}
        >
          <Stack gap='md'>
            <form.Field
              name='token'
              validators={{
                onChange: ({ value }) =>
                  value.trim().length !== 64 ? 'トークンは 64 文字で入力してください' : undefined,
              }}
            >
              {(field) => (
                <TextInput
                  label='アクセス トークン'
                  placeholder='64 文字の編集リンクトークン'
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
                  color='orange'
                >
                  チーム画面を開く
                </Button>
              )}
            </form.Subscribe>
          </Stack>
        </form>
      </Stack>
    </Card>
  );
}
