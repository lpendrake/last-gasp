import MarkdownIt from 'markdown-it';
import { weekdayColor } from '../../theme.ts';
import type { DraftBuffer } from '../drafts.ts';
import { COLOR_PRESETS } from './view.ts';

export function getColor(colorPreset: HTMLSelectElement, colorCustom: HTMLInputElement): string {
  return colorPreset.value === '__custom__' ? colorCustom.value.trim() : colorPreset.value;
}

export function setColor(
  colorPreset: HTMLSelectElement,
  colorCustom: HTMLInputElement,
  raw: string,
): void {
  const isPreset = COLOR_PRESETS.some(p => p.value === raw);
  if (!raw || isPreset) {
    colorPreset.value = raw;
    colorCustom.hidden = true;
  } else {
    colorPreset.value = '__custom__';
    colorCustom.value = raw;
    colorCustom.hidden = false;
  }
}

export function readBuffer(
  titleInput: HTMLInputElement,
  dateInput: HTMLInputElement,
  tagsInput: HTMLInputElement,
  colorPreset: HTMLSelectElement,
  colorCustom: HTMLInputElement,
  bodyInput: HTMLTextAreaElement,
): DraftBuffer {
  return {
    title: titleInput.value,
    date: dateInput.value,
    tagsText: tagsInput.value,
    color: getColor(colorPreset, colorCustom),
    status: '',
    body: bodyInput.value,
  };
}

export function updatePreview(
  preview: HTMLDivElement,
  md: MarkdownIt,
  bodyInput: HTMLTextAreaElement,
): void {
  preview.innerHTML = md.render(bodyInput.value || '_(preview — start typing)_');
  for (const img of preview.querySelectorAll<HTMLImageElement>('img[src]')) {
    const src = img.getAttribute('src') ?? '';
    if (!src.startsWith('http') && !src.startsWith('/') && !src.startsWith('data:')) {
      img.setAttribute('src', `/api/file/events/${src}`);
    }
  }
}

export function updateColorSwatch(
  colorSwatch: HTMLSpanElement,
  dateInput: HTMLInputElement,
  colorPreset: HTMLSelectElement,
  colorCustom: HTMLInputElement,
): void {
  const raw = getColor(colorPreset, colorCustom);
  let resolved = raw;
  if (!raw && dateInput.value.trim()) {
    try { resolved = weekdayColor(dateInput.value.trim()); } catch { resolved = ''; }
  }
  colorSwatch.style.background = resolved || 'transparent';
  colorSwatch.title = raw ? `Override: ${raw}` : (resolved ? `Weekday default: ${resolved}` : '');
}
