import { useEffect, useRef, useState } from 'react';
import { SETTINGS_SECTIONS } from './domain/settings-sections';
import { DUMMY_TEMPLATES } from './domain/dummy-templates';
import { SettingRow } from './controls/setting-row';
import { Toggle } from './controls/toggle';
import { SelectField } from './controls/select-field';
import { SliderField } from './controls/slider-field';
import { TextField } from './controls/text-field';
import { FilePickerField } from './controls/file-picker-field';
import { Accordion } from './controls/accordion';
import { MarkdownEditor } from '../../shared/markdown-editor';
import { FooterPortal } from '../../components/footer-portal';
import { FooterButton } from '../../components/footer-button';
import { ThemeSection } from './theme-section';
import type { Campaign } from '../../../types/global';
import './campaign-settings-modal.css';

export interface CampaignSettingsModalProps {
  campaignName: string;
  onClose: () => void;
  campaigns: Campaign[];
  activeCampaign: Campaign;
  rootDir: string;
}

export function CampaignSettingsModal({
  campaignName,
  onClose,
  campaigns,
  activeCampaign,
  rootDir,
}: CampaignSettingsModalProps) {
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [activeSection, setActiveSection] = useState<string>(SETTINGS_SECTIONS[0].id);

  // --- Timeline state ---
  const [showFutureEvents, setShowFutureEvents] = useState(false);
  const [defaultCalendar, setDefaultCalendar] = useState('gregorian');
  const [defaultZoom, setDefaultZoom] = useState(50);

  // --- Templates state ---
  const [templatesFolder, setTemplatesFolder] = useState('templates');
  const [defaultTemplate, setDefaultTemplate] = useState<string | null>(null);
  const [templates, setTemplates] = useState(DUMMY_TEMPLATES);

  const updateTemplate = (id: string, content: string) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, content } : t)));
  };

  // --- Keybindings state ---
  const [quickSearchShortcut, setQuickSearchShortcut] = useState('Ctrl+F');
  const [vimKeys, setVimKeys] = useState(false);

  // Escape closes the modal (capture phase wins over other handlers)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, { capture: true });
    return () => document.removeEventListener('keydown', onKey, { capture: true });
  }, [onClose]);

  // Track active section as user scrolls
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const handleScroll = () => {
      for (const section of [...SETTINGS_SECTIONS].reverse()) {
        const ref = sectionRefs.current[section.id];
        if (ref && ref.getBoundingClientRect().top <= el.getBoundingClientRect().top + 80) {
          setActiveSection(section.id);
          return;
        }
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSidebarClick = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  };

  return (
    <>
      <div
        className="campaign-settings-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="campaign-settings-modal">
          {/* Header */}
          <div className="campaign-settings-header">
            <div className="campaign-settings-header__titles">
              <h2 className="campaign-settings-header__title">Campaign Settings</h2>
              <p className="campaign-settings-header__subtitle">{campaignName}</p>
            </div>
            <button
              type="button"
              className="campaign-settings-close"
              aria-label="Close"
              onClick={onClose}
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div className="campaign-settings-body">
            {/* Sidebar */}
            <nav className="campaign-settings-sidebar" aria-label="Settings sections">
              {SETTINGS_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={`campaign-settings-sidebar__btn${activeSection === section.id ? ' campaign-settings-sidebar__btn--active' : ''}`}
                  onClick={() => handleSidebarClick(section.id)}
                >
                  {section.label}
                </button>
              ))}
            </nav>

            {/* Content */}
            <div className="campaign-settings-content" ref={contentRef}>
              {/* Timeline section */}
              <section
                id="timeline"
                className="campaign-settings-section"
                ref={(el) => {
                  sectionRefs.current['timeline'] = el;
                }}
              >
                <h3 className="campaign-settings-section__title">Timeline</h3>
                <SettingRow
                  label="Show future events as dotted"
                  description="Render events after today with a dashed border on the timeline."
                  htmlFor="timeline-future-events"
                >
                  <Toggle
                    id="timeline-future-events"
                    checked={showFutureEvents}
                    onChange={setShowFutureEvents}
                  />
                </SettingRow>
                <SettingRow
                  label="Default calendar"
                  description="The calendar system used for in-game dates."
                  htmlFor="timeline-calendar"
                >
                  <SelectField
                    id="timeline-calendar"
                    value={defaultCalendar}
                    options={[
                      { value: 'gregorian', label: 'Gregorian' },
                      { value: 'golarian', label: 'Golarian' },
                      { value: 'harptos', label: 'Harptos (Faerûn)' },
                    ]}
                    onChange={setDefaultCalendar}
                  />
                </SettingRow>
                <SettingRow
                  label="Default zoom level"
                  description="The initial zoom when opening a campaign (0 = zoomed out, 100 = zoomed in)."
                  htmlFor="timeline-zoom"
                >
                  <SliderField
                    id="timeline-zoom"
                    value={defaultZoom}
                    min={0}
                    max={100}
                    step={5}
                    onChange={setDefaultZoom}
                  />
                </SettingRow>
              </section>

              {/* Theme section */}
              <section
                id="theme"
                className="campaign-settings-section"
                ref={(el) => {
                  sectionRefs.current['theme'] = el;
                }}
              >
                <h3 className="campaign-settings-section__title">Theme</h3>
                <ThemeSection
                  campaigns={campaigns}
                  activeCampaign={activeCampaign}
                  rootDir={rootDir}
                />
              </section>

              {/* Templates section */}
              <section
                id="templates"
                className="campaign-settings-section"
                ref={(el) => {
                  sectionRefs.current['templates'] = el;
                }}
              >
                <h3 className="campaign-settings-section__title">Templates</h3>
                <SettingRow
                  label="Templates folder name"
                  description="The subfolder within the campaign directory where templates are stored."
                  htmlFor="templates-folder"
                >
                  <TextField
                    id="templates-folder"
                    value={templatesFolder}
                    onChange={setTemplatesFolder}
                    placeholder="templates"
                  />
                </SettingRow>
                <SettingRow
                  label="Default event template"
                  description="The template file used when creating a new event."
                  htmlFor="templates-default"
                >
                  <FilePickerField
                    id="templates-default"
                    value={defaultTemplate}
                    onChange={setDefaultTemplate}
                    buttonLabel="Choose template…"
                  />
                </SettingRow>
                <h4 className="campaign-settings-templates-subheading">Edit templates</h4>
                <Accordion
                  items={templates.map((t) => ({ id: t.id, title: t.name }))}
                  renderBody={(id) => {
                    const tpl = templates.find((t) => t.id === id)!;
                    return (
                      <div className="campaign-settings-template-editor">
                        <MarkdownEditor
                          content={tpl.content}
                          onChange={(s) => updateTemplate(id, s)}
                        />
                      </div>
                    );
                  }}
                />
              </section>

              {/* Keybindings section */}
              <section
                id="keybindings"
                className="campaign-settings-section"
                ref={(el) => {
                  sectionRefs.current['keybindings'] = el;
                }}
              >
                <h3 className="campaign-settings-section__title">Keybindings</h3>
                <SettingRow
                  label="Quick-search shortcut"
                  description="The keyboard shortcut that opens the quick-search panel."
                  htmlFor="keybindings-search"
                >
                  <TextField
                    id="keybindings-search"
                    value={quickSearchShortcut}
                    onChange={setQuickSearchShortcut}
                    placeholder="Ctrl+F"
                  />
                </SettingRow>
                <SettingRow
                  label="Enable Vim-style keys"
                  description="Use h/j/k/l navigation in lists and the timeline."
                  htmlFor="keybindings-vim"
                >
                  <Toggle id="keybindings-vim" checked={vimKeys} onChange={setVimKeys} />
                </SettingRow>
              </section>
            </div>
          </div>
        </div>
      </div>
      <FooterPortal slot="settings">
        <FooterButton onClick={onClose}>Close</FooterButton>
      </FooterPortal>
    </>
  );
}
