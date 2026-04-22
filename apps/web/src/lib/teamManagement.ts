import {
  BANDS,
  type BestPractice,
  CHANNEL_WIDTHS,
  CreateDeviceSpecSchema,
  CreateObservedWifiSchema,
  CreateTeamSchema,
  CreateWifiConfigSchema,
  canActivateWifiConfig,
  canAddWifiConfig,
  isValidChannel,
  isValidChannelWidth,
  MAX_ACTIVE_WIFI_CONFIGS,
  PURPOSES,
  type Purpose,
  type UpdateTeam,
  UpdateTeamSchema,
  type WifiConfig,
} from '@wifiman/shared';
import type { z } from 'zod';

const TeamEditorSchema = CreateTeamSchema.omit({ tournamentId: true });
const WifiConfigEditorSchema = CreateWifiConfigSchema.omit({ teamId: true });
const DeviceSpecEditorSchema = CreateDeviceSpecSchema.omit({ teamId: true });

export type TeamFormValues = {
  name: string;
  organization: string;
  pitId: string;
  contactEmail: string;
  displayContactName: string;
  notes: string;
};

export type WifiConfigFormValues = {
  name: string;
  purpose: z.infer<typeof WifiConfigEditorSchema>['purpose'];
  band: z.infer<typeof WifiConfigEditorSchema>['band'];
  channel: string;
  channelWidthMHz: string;
  role: z.infer<typeof WifiConfigEditorSchema>['role'];
  status: z.infer<typeof WifiConfigEditorSchema>['status'];
  apDeviceId: string;
  clientDeviceId: string;
  expectedDistanceCategory:
    | ''
    | NonNullable<z.infer<typeof WifiConfigEditorSchema>['expectedDistanceCategory']>;
  pingTargetIp: string;
  notes: string;
};

export type DeviceSpecFormValues = {
  vendor: string;
  model: string;
  kind: z.infer<typeof DeviceSpecEditorSchema>['kind'];
  supportedBands: Array<z.infer<typeof DeviceSpecEditorSchema>['supportedBands'][number]>;
  notes: string;
  knownIssues: string;
};

export type FormErrors<T extends string> = Partial<Record<T, string>>;

type TeamFormSource = {
  name: string;
  organization?: string | null;
  pitId?: string | null;
  contactEmail?: string | null;
  displayContactName?: string | null;
  notes?: string | null;
};

type WifiConfigFormSource = {
  name: string;
  purpose: WifiConfigFormValues['purpose'];
  band: WifiConfigFormValues['band'];
  channel: number;
  channelWidthMHz: number;
  role: WifiConfigFormValues['role'];
  status: WifiConfigFormValues['status'];
  apDeviceId?: string | null;
  clientDeviceId?: string | null;
  expectedDistanceCategory?: WifiConfigFormValues['expectedDistanceCategory'] | null;
  pingTargetIp?: string | null;
  notes?: string | null;
};

type DeviceSpecFormSource = {
  vendor?: string | null;
  model: string;
  kind: DeviceSpecFormValues['kind'];
  supportedBands: DeviceSpecFormValues['supportedBands'];
  notes?: string | null;
  knownIssues?: string | null;
};

function normalizeOptionalString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildTeamFormValues(team: TeamFormSource | UpdateTeam): TeamFormValues {
  return {
    name: team.name ?? '',
    organization: team.organization ?? '',
    pitId: team.pitId ?? '',
    contactEmail: team.contactEmail ?? '',
    displayContactName: team.displayContactName ?? '',
    notes: team.notes ?? '',
  };
}

export function parseTeamFormValues(values: TeamFormValues): {
  data?: UpdateTeam;
  errors: FormErrors<keyof TeamFormValues>;
} {
  const candidate = {
    name: values.name.trim(),
    organization: normalizeOptionalString(values.organization),
    pitId: normalizeOptionalString(values.pitId),
    contactEmail: normalizeOptionalString(values.contactEmail),
    displayContactName: normalizeOptionalString(values.displayContactName),
    notes: normalizeOptionalString(values.notes),
  } satisfies z.input<typeof TeamEditorSchema>;

  const parsed = TeamEditorSchema.safeParse(candidate);
  if (parsed.success) {
    return { data: UpdateTeamSchema.parse(parsed.data), errors: {} };
  }

  const errors: FormErrors<keyof TeamFormValues> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in errors)) {
      errors[field as keyof TeamFormValues] = issue.message;
    }
  }
  return { errors };
}

export function buildWifiConfigFormValues(config?: WifiConfigFormSource): WifiConfigFormValues {
  return {
    name: config?.name ?? '',
    purpose: config?.purpose ?? 'control',
    band: config?.band ?? '5GHz',
    channel: config ? String(config.channel) : '36',
    channelWidthMHz: config ? String(config.channelWidthMHz) : '80',
    role: config?.role ?? 'primary',
    status: config?.status ?? 'active',
    apDeviceId: config?.apDeviceId ?? '',
    clientDeviceId: config?.clientDeviceId ?? '',
    expectedDistanceCategory: config?.expectedDistanceCategory ?? '',
    pingTargetIp: config?.pingTargetIp ?? '',
    notes: config?.notes ?? '',
  };
}

export function parseWifiConfigFormValues(
  values: WifiConfigFormValues,
  existingConfigs: ReadonlyArray<Pick<WifiConfig, 'id' | 'status'>>,
  editingConfigId?: string,
): {
  data?: z.infer<typeof WifiConfigEditorSchema>;
  errors: FormErrors<keyof WifiConfigFormValues>;
  formError?: string;
} {
  const channel = Number(values.channel);
  const channelWidthMHz = Number(values.channelWidthMHz);
  const candidate = {
    name: values.name.trim(),
    purpose: values.purpose,
    band: values.band,
    channel,
    channelWidthMHz,
    role: values.role,
    status: values.status,
    apDeviceId: normalizeOptionalString(values.apDeviceId),
    clientDeviceId: normalizeOptionalString(values.clientDeviceId),
    expectedDistanceCategory:
      values.expectedDistanceCategory.length > 0 ? values.expectedDistanceCategory : null,
    pingTargetIp: normalizeOptionalString(values.pingTargetIp),
    notes: normalizeOptionalString(values.notes),
  };

  const parsed = WifiConfigEditorSchema.safeParse(candidate);
  const errors: FormErrors<keyof WifiConfigFormValues> = {};

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && !(field in errors)) {
        errors[field as keyof WifiConfigFormValues] = issue.message;
      }
    }
    return { errors };
  }

  if (!isValidChannel(parsed.data.band, parsed.data.channel)) {
    errors.channel = `帯域 ${parsed.data.band} に対して無効なチャンネルです`;
  }
  if (!isValidChannelWidth(parsed.data.band, parsed.data.channelWidthMHz)) {
    errors.channelWidthMHz = `帯域 ${parsed.data.band} に対して無効なチャンネル幅です`;
  }
  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const formError =
    editingConfigId == null
      ? parsed.data.status !== 'disabled' && !canAddWifiConfig(existingConfigs)
        ? `WiFi 構成は最大 ${MAX_ACTIVE_WIFI_CONFIGS} 件までです`
        : undefined
      : !canActivateWifiConfig(existingConfigs, editingConfigId, parsed.data.status)
        ? `WiFi 構成は最大 ${MAX_ACTIVE_WIFI_CONFIGS} 件までです`
        : undefined;

  if (formError) {
    return { errors: {}, formError };
  }

  return { data: parsed.data, errors: {} };
}

export function buildDeviceSpecFormValues(spec?: DeviceSpecFormSource): DeviceSpecFormValues {
  return {
    vendor: spec?.vendor ?? '',
    model: spec?.model ?? '',
    kind: spec?.kind ?? 'ap',
    supportedBands: spec?.supportedBands ?? ['5GHz'],
    notes: spec?.notes ?? '',
    knownIssues: spec?.knownIssues ?? '',
  };
}

export function parseDeviceSpecFormValues(values: DeviceSpecFormValues): {
  data?: z.infer<typeof DeviceSpecEditorSchema>;
  errors: FormErrors<keyof DeviceSpecFormValues>;
} {
  const candidate = {
    vendor: normalizeOptionalString(values.vendor),
    model: values.model.trim(),
    kind: values.kind,
    supportedBands: values.supportedBands,
    notes: normalizeOptionalString(values.notes),
    knownIssues: normalizeOptionalString(values.knownIssues),
  };

  const parsed = DeviceSpecEditorSchema.safeParse(candidate);
  if (parsed.success) {
    return { data: parsed.data, errors: {} };
  }

  const errors: FormErrors<keyof DeviceSpecFormValues> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in errors)) {
      errors[field as keyof DeviceSpecFormValues] = issue.message;
    }
  }
  return { errors };
}

export function getBandOptions() {
  return [...BANDS];
}

export function getChannelWidthOptions() {
  return [...CHANNEL_WIDTHS];
}

export function countActiveWifiConfigs(configs: ReadonlyArray<Pick<WifiConfig, 'status'>>): number {
  return configs.filter((config) => config.status === 'active' || config.status === 'standby')
    .length;
}

const PURPOSE_PATTERNS: Record<Purpose, ReadonlyArray<RegExp>> = {
  control: [/\bcontrol\b/i, /control link/i, /uplink/i, /操縦/i, /制御/i],
  video: [/\bvideo\b/i, /stream/i, /映像/i, /配信/i],
  debug: [/\bdebug\b/i, /diagnostic/i, /telemetry/i, /検証/i, /デバッグ/i],
  other: [/\bother\b/i, /general/i, /misc/i, /その他/i],
};

export function inferBestPracticePurposes(
  practice: Pick<BestPractice, 'title' | 'body'>,
): Purpose[] {
  const source = `${practice.title}\n${practice.body}`;

  return PURPOSES.filter((purpose) =>
    PURPOSE_PATTERNS[purpose].some((pattern) => pattern.test(source)),
  );
}

export function findRelevantBestPractices(
  bestPractices: ReadonlyArray<BestPractice>,
  band: WifiConfigFormValues['band'],
  purpose: WifiConfigFormValues['purpose'],
  relatedModels: ReadonlyArray<string>,
): BestPractice[] {
  const modelSet = new Set(
    relatedModels.map((model) => model.trim().toLowerCase()).filter(Boolean),
  );
  return bestPractices.filter((practice) => {
    const purposes = inferBestPracticePurposes(practice);

    if (purposes.length > 0 && !purposes.includes(purpose)) {
      return false;
    }
    if (practice.scope === 'general' || practice.scope === 'tournament') {
      return true;
    }
    if (practice.scope === 'band') {
      return practice.targetBand === band;
    }
    return practice.targetModel != null && modelSet.has(practice.targetModel.trim().toLowerCase());
  });
}

type BestPracticeFilterOptions = {
  band?: string;
  purpose?: string;
  model?: string;
};

export function filterBestPractices(
  bestPractices: ReadonlyArray<BestPractice>,
  filters: BestPracticeFilterOptions,
): BestPractice[] {
  const band = filters.band?.trim();
  const purpose = filters.purpose?.trim().toLowerCase() ?? '';
  const model = filters.model?.trim().toLowerCase() ?? '';

  return bestPractices.filter((practice) => {
    if (band && practice.scope === 'band' && practice.targetBand !== band) {
      return false;
    }

    const inferredPurposes = inferBestPracticePurposes(practice);

    if (purpose && !inferredPurposes.includes(purpose as Purpose)) {
      return false;
    }

    const searchable = [practice.title, practice.body, practice.targetModel ?? '']
      .join(' ')
      .toLowerCase();

    if (model && !searchable.includes(model)) {
      return false;
    }

    return true;
  });
}

type ObservedWifiCsvRow = {
  row: number;
  message: string;
};

type ParsedObservedWifiCsv = {
  items: Array<z.infer<typeof CreateObservedWifiSchema>>;
  errors: ObservedWifiCsvRow[];
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      const nextCharacter = line[index + 1];

      if (quoted && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }

      quoted = !quoted;
      continue;
    }

    if (character === ',' && !quoted) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function normalizeCsvOptional(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseObservedWifiCsv(source: string): ParsedObservedWifiCsv {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return {
      items: [],
      errors: [{ row: 1, message: '1 行目: CSV が空です' }],
    };
  }

  const [headerLine = '', ...dataLines] = lines;
  const headers = parseCsvLine(headerLine).map((header) => header.trim());
  const requiredHeaders = ['band', 'channel', 'observedAt'];
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    return {
      items: [],
      errors: [
        {
          row: 1,
          message: `1 行目: 必須ヘッダーが不足しています (${missingHeaders.join(', ')})`,
        },
      ],
    };
  }

  const items: Array<z.infer<typeof CreateObservedWifiSchema>> = [];
  const errors: ObservedWifiCsvRow[] = [];

  for (const [lineIndex, line] of dataLines.entries()) {
    const row = lineIndex + 2;
    const values = parseCsvLine(line);
    const columns = Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? '']),
    );
    const sourceValue = columns.source?.trim() || 'analyzer_import';
    const bandValue = columns.band?.trim();
    const channelValue = Number(columns.channel);
    const widthValue = normalizeCsvOptional(columns.channelWidthMHz);

    if (!BANDS.includes(bandValue as (typeof BANDS)[number])) {
      errors.push({ row, message: `${row} 行目: 帯域 ${bandValue} は無効です` });
      continue;
    }

    if (!Number.isInteger(channelValue) || channelValue <= 0) {
      errors.push({ row, message: `${row} 行目: チャンネルは正の整数で入力してください` });
      continue;
    }

    if (!isValidChannel(bandValue as (typeof BANDS)[number], channelValue)) {
      errors.push({
        row,
        message: `${row} 行目: 帯域 ${bandValue} に対してチャンネル ${channelValue} は無効です`,
      });
      continue;
    }

    const channelWidthMHz = widthValue ? Number(widthValue) : null;
    if (channelWidthMHz != null) {
      if (!Number.isInteger(channelWidthMHz) || channelWidthMHz <= 0) {
        errors.push({ row, message: `${row} 行目: チャンネル幅は正の整数で入力してください` });
        continue;
      }

      if (
        !isValidChannelWidth(
          bandValue as (typeof BANDS)[number],
          channelWidthMHz as 20 | 40 | 80 | 160,
        )
      ) {
        errors.push({
          row,
          message: `${row} 行目: 帯域 ${bandValue} に対してチャンネル幅 ${channelWidthMHz}MHz は無効です`,
        });
        continue;
      }
    }

    const parsed = CreateObservedWifiSchema.safeParse({
      tournamentId: '00000000-0000-4000-8000-000000000000',
      source: sourceValue,
      ssid: normalizeCsvOptional(columns.ssid),
      bssid: normalizeCsvOptional(columns.bssid),
      band: bandValue,
      channel: channelValue,
      channelWidthMHz,
      rssi: normalizeCsvOptional(columns.rssi) ? Number(columns.rssi) : null,
      locationLabel: normalizeCsvOptional(columns.locationLabel),
      observedAt: columns.observedAt?.trim(),
      notes: normalizeCsvOptional(columns.notes),
    });

    if (!parsed.success) {
      errors.push({
        row,
        message: `${row} 行目: ${parsed.error.issues[0]?.message ?? '形式が不正です'}`,
      });
      continue;
    }

    items.push(parsed.data);
  }

  return { items, errors };
}
