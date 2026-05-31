import { useState } from 'react';
import './accordion.css';

export interface AccordionItem {
  id: string;
  title: string;
}

export interface AccordionProps {
  items: AccordionItem[];
  renderBody: (id: string) => React.ReactNode;
  defaultOpenId?: string | null;
}

export function Accordion({ items, renderBody, defaultOpenId = null }: AccordionProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId);

  const handleHeaderClick = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="accordion">
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id} className="accordion__item">
            <button
              type="button"
              className={`accordion__header${isOpen ? ' accordion__header--open' : ''}`}
              aria-expanded={isOpen}
              onClick={() => handleHeaderClick(item.id)}
            >
              <span className="accordion__title">{item.title}</span>
              <span
                className={`accordion__chevron${isOpen ? ' accordion__chevron--open' : ''}`}
                aria-hidden="true"
              >
                ›
              </span>
            </button>
            {isOpen && <div className="accordion__body">{renderBody(item.id)}</div>}
          </div>
        );
      })}
    </div>
  );
}
