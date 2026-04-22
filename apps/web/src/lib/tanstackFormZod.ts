import type { z } from 'zod';

type SubmitErrorSetter = (message: string | null) => void;

function getFirstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? '入力内容を確認してください';
}

export function createTanStackFormZodHelpers<TSchema extends z.AnyZodObject>(
  schema: TSchema,
  setSubmitError: SubmitErrorSetter,
  fallbackSubmitErrorMessage: string,
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
