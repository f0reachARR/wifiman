import { Alert, Button, Card, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  BetterAuthLoginSchema,
  DevOperatorLoginSchema,
  getLoginMode,
  getPostLoginRedirectPath,
  parseBetterAuthLoginInput,
  parseDevOperatorLoginInput,
} from '../lib/auth.js';
import { createTanStackFormZodHelpers } from '../lib/tanstackFormZod.js';
import { useAuthActions } from '../lib/useAuthSession.js';

type LoginFormValues = {
  email: string;
  password: string;
  displayName: string;
  passphrase: string;
};

export function LoginPage() {
  const navigate = useNavigate();
  const { signInAsOperator } = useAuthActions();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const postLoginRedirectPath = getPostLoginRedirectPath(
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('next'),
  );
  const loginMode = getLoginMode();
  const usesDevOperatorLogin = loginMode === 'dev-operator';
  const betterAuthZodForm = createTanStackFormZodHelpers(
    BetterAuthLoginSchema,
    setSubmitError,
    'ログインに失敗しました',
  );
  const devOperatorZodForm = createTanStackFormZodHelpers(
    DevOperatorLoginSchema,
    setSubmitError,
    'ログインに失敗しました',
  );
  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      displayName: '',
      passphrase: '',
    } satisfies LoginFormValues,
    onSubmitInvalid: () => {
      setSubmitError(null);
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      if (usesDevOperatorLogin) {
        const parsed = parseDevOperatorLoginInput({
          displayName: value.displayName,
          passphrase: value.passphrase,
        });

        await signInAsOperator({
          email: value.email,
          password: value.password,
          displayName: parsed.displayName,
          passphrase: value.passphrase,
        });
      } else {
        const parsed = parseBetterAuthLoginInput({
          email: value.email,
          password: value.password,
        });

        await signInAsOperator({
          email: parsed.email,
          password: value.password,
          displayName: value.displayName,
          passphrase: value.passphrase,
        });
      }

      await navigate({ href: postLoginRedirectPath });
    },
  });

  return (
    <Card className='form-card' padding='xl' radius='xl'>
      <Stack gap='lg'>
        <div>
          <Title order={2}>運営ログイン</Title>
          <Text c='dimmed'>運営権限は常にサーバ検証済み session のみを利用します。</Text>
        </div>

        {usesDevOperatorLogin ? (
          <Alert color='orange' variant='light'>
            開発中のみ、サーバ側の検証 API 経由で仮の運営 session を発行できます。
          </Alert>
        ) : (
          <Alert color='blue' variant='light'>
            通常構成では Better Auth の email/password ログインを使います。
          </Alert>
        )}

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
              setSubmitError(error instanceof Error ? error.message : 'ログインに失敗しました');
            });
          }}
        >
          <Stack gap='md'>
            {usesDevOperatorLogin ? (
              <>
                <form.Field
                  name='displayName'
                  validators={{
                    onChange: devOperatorZodForm.getFieldValidator('displayName'),
                  }}
                >
                  {(field) => (
                    <TextInput
                      label='表示名'
                      placeholder='Operator 1'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        devOperatorZodForm.getChangeHandler(field.handleChange)(
                          event.currentTarget.value,
                        )
                      }
                      error={field.state.meta.errors[0]}
                    />
                  )}
                </form.Field>

                <form.Field
                  name='passphrase'
                  validators={{
                    onChange: devOperatorZodForm.getFieldValidator('passphrase'),
                  }}
                >
                  {(field) => (
                    <PasswordInput
                      label='パスフレーズ'
                      placeholder='local-dev-passphrase'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        devOperatorZodForm.getChangeHandler(field.handleChange)(
                          event.currentTarget.value,
                        )
                      }
                      error={field.state.meta.errors[0]}
                    />
                  )}
                </form.Field>
              </>
            ) : (
              <>
                <form.Field
                  name='email'
                  validators={{
                    onChange: betterAuthZodForm.getFieldValidator('email'),
                  }}
                >
                  {(field) => (
                    <TextInput
                      label='メールアドレス'
                      placeholder='operator@example.com'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        betterAuthZodForm.getChangeHandler(field.handleChange)(
                          event.currentTarget.value,
                        )
                      }
                      error={field.state.meta.errors[0]}
                    />
                  )}
                </form.Field>

                <form.Field
                  name='password'
                  validators={{
                    onChange: betterAuthZodForm.getFieldValidator('password'),
                  }}
                >
                  {(field) => (
                    <PasswordInput
                      label='パスワード'
                      placeholder='password'
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        betterAuthZodForm.getChangeHandler(field.handleChange)(
                          event.currentTarget.value,
                        )
                      }
                      error={field.state.meta.errors[0]}
                    />
                  )}
                </form.Field>
              </>
            )}

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
