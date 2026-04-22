import type { z } from 'zod';

type SubmitErrorSetter = (message: string | null) => void;
type GlobalFormValidationError<TFormData extends Record<string, unknown>> = {
  form?: string;
  fields: Partial<Record<Extract<keyof TFormData, string>, string>>;
};

function getFirstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? '入力内容を確認してください';
}

export function createTanStackFormZodHelpers<TSchema extends z.AnyZodObject>(
  schema: TSchema,
  setSubmitError: SubmitErrorSetter = () => undefined,
  fallbackSubmitErrorMessage = '入力内容を確認してください',
) {
  type FieldName = Extract<keyof z.input<TSchema>, string>;
  const shape = schema.shape;

  return {
    getFieldValidator<TName extends FieldName>(fieldName: TName) {
      const fieldSchema = shape[fieldName];

      return ({ value }: { value: z.input<TSchema>[TName] }) => {
        const parsed = fieldSchema.safeParse(value);
        return parsed.success ? undefined : getFirstIssueMessage(parsed.error);
      };
    },
    getChangeHandler<TValue>(handleChange: (value: TValue) => void) {
      return (value: TValue) => {
        setSubmitError(null);
        handleChange(value);
      };
    },
    clearSubmitError() {
      setSubmitError(null);
    },
    handleSubmitInvalid() {
      setSubmitError(null);
    },
    handleSubmitError(error: unknown) {
      setSubmitError(error instanceof Error ? error.message : fallbackSubmitErrorMessage);
    },
  };
}

export function toGlobalFormValidationError<TFormData extends Record<string, unknown>>(
  fieldErrors: Partial<Record<Extract<keyof TFormData, string>, string>>,
  formError?: string,
): GlobalFormValidationError<TFormData> | undefined {
  const fields = Object.fromEntries(
    Object.entries(fieldErrors).filter(([, message]) => Boolean(message)),
  ) as Partial<Record<Extract<keyof TFormData, string>, string>>;

  if (!formError && Object.keys(fields).length === 0) {
    return undefined;
  }

  return {
    ...(formError ? { form: formError } : {}),
    fields,
  } satisfies GlobalFormValidationError<TFormData>;
}
