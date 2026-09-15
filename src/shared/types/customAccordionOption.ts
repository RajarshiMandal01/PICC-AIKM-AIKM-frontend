import { ComponentType } from "react";

export interface CustomAccordionConfig {
  title: string;
  options: customAccordionOption[];
}
export interface customAccordionOption<T = unknown> {
  id: string;
  link?: string;
  title: string;
  summary?: string;
  url?: string;
  additionalUrls?: string[];
  localhostUrl?: boolean;
  style?: CustomAccordionStyle;
  data?: unknown;
  additionalData?: unknown[];
  service?: string;
  additionalUrlService?: string;
  element?: ComponentType<{ id: string, data?: T, onRefresh?: (type?) => void }>;
  //  ComponentType<{ data: unknown }> | ComponentType<{ data: unknown[] }>;
}

interface CustomAccordionStyle {
  headerBg?: string;
  headerBgColor?: string;
  headerColor?: string;
  bodyBg?: string;
}
