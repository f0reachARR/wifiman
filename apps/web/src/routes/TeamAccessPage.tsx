import { Button, Card, SegmentedControl, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import type { TeamAccessRole } from '@wifiman/shared';
import { useAuthActions } from '../lib/useAuthSession.js';

type TeamAccessFormValues = {
  token: string;
  role: TeamAccessRole;
};

export function TeamAccessPage() {
  const navigate = useNavigate();
  const { signInWithTeamAccess } = useAuthActions();
  const form = useForm({
    defaultValues: {
      token: '',
      role: 'editor' as TeamAccessRole,
    } satisfies TeamAccessFormValues,
    onSubmit: async ({ value }) => {
      signInWithTeamAccess(value.token, value.role);
      await navigate({ to: '/app' });
    },
  });

  return (
    <Card className='form-card' padding='xl' radius='xl'>
      <Stack gap='lg'>
        <div>
          <Title order={2}>チームアクセス</Title>
          <Text c='dimmed'>
            64 文字トークンを受け取り、編集者または閲覧者セッションを開始します。
          </Text>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
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

            <form.Field name='role'>
              {(field) => (
                <SegmentedControl
                  data={[
                    { label: '編集者', value: 'editor' },
                    { label: '閲覧者', value: 'viewer' },
                  ]}
                  value={field.state.value}
                  onChange={(value) => field.handleChange(() => value as TeamAccessRole)}
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
