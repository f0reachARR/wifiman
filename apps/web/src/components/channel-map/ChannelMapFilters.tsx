import { Checkbox, Chip, Group, MultiSelect, Stack, TextInput } from '@mantine/core';
import {
  type ChannelMapFilters as ChannelMapFilterState,
  getChannelMapSourceOptions,
  getChannelMapWidthOptions,
} from '../../lib/channelMap.js';

type ChannelMapFiltersProps = {
  filters: ChannelMapFilterState;
  availableModels: string[];
  onChange: (next: ChannelMapFilterState) => void;
};

export function ChannelMapFilters({ filters, availableModels, onChange }: ChannelMapFiltersProps) {
  return (
    <Stack gap='md'>
      <Chip.Group
        multiple
        value={filters.sourceTypes}
        onChange={(value) =>
          onChange({
            ...filters,
            sourceTypes: value as ChannelMapFilterState['sourceTypes'],
          })
        }
      >
        <Group>
          {getChannelMapSourceOptions().map((option) => (
            <Chip key={option.value} value={option.value} color='teal' variant='light'>
              {option.label}
            </Chip>
          ))}
        </Group>
      </Chip.Group>

      <Group grow align='flex-end'>
        <Checkbox
          label='制御用途のみ'
          checked={filters.controlOnly}
          onChange={(event) => onChange({ ...filters, controlOnly: event.currentTarget.checked })}
        />
        <Checkbox
          label='問題報告ありのみ'
          checked={filters.reportOnly}
          onChange={(event) => onChange({ ...filters, reportOnly: event.currentTarget.checked })}
        />
      </Group>

      <Group grow align='flex-end'>
        <MultiSelect
          label='帯域幅'
          placeholder='すべて'
          data={getChannelMapWidthOptions()}
          value={filters.widths.map(String)}
          onChange={(values) =>
            onChange({
              ...filters,
              widths: values.map((value) => Number(value)).filter((value) => !Number.isNaN(value)),
            })
          }
        />
        <TextInput
          label='型番フィルタ'
          placeholder='AP-9000 など'
          value={filters.modelQuery}
          list='channel-map-models'
          onChange={(event) => onChange({ ...filters, modelQuery: event.currentTarget.value })}
        />
      </Group>
      <datalist id='channel-map-models'>
        {availableModels.map((model) => (
          <option key={model} value={model} />
        ))}
      </datalist>
    </Stack>
  );
}
