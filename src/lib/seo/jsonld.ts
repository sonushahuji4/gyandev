/**
 * JSON-LD schema factories — typed builders for every schema.org type GyanDev
 * emits in Phase 1 (SEO spec §6). Consumed by `src/components/seo/JsonLd.astro`
 * which stringifies and renders `<script type="application/ld+json">` blocks.
 *
 * Types come from `schema-dts`; factories return minimal schemas that
 * `validate-schema.mjs` checks for required keys per `@type`.
 *
 * Factories:
 *   - `websiteSchema()`         WebSite + SearchAction (home only)
 *   - `techArticleSchema()`     TechArticle (chapter Full Notes)
 *   - `courseSchema()`          Course (course overview)
 *   - `courseListSchema()`      ItemList of courses (all-courses)
 *   - `breadcrumbSchema()`      BreadcrumbList (any page with nav)
 *   - `personSchema()`          Person (About page author)
 *   - `aboutPageSchema()`       AboutPage wrapper
 */

import type {
  AboutPage,
  BreadcrumbList,
  Course,
  ItemList,
  Person,
  TechArticle,
  WebSite,
  WithContext,
} from 'schema-dts';

import { SITE } from '../routes';

const SITE_NAME = 'GyanDev';
const DEFAULT_AUTHOR_NAME = 'Sonu Shahuji';
const DEFAULT_AUTHOR_URL = `${SITE}/about`;
const PUBLISHER_LOGO = `${SITE}/favicon.svg`;

/** WebSite + SearchAction — home page only (spec §6, first block). */
export function websiteSchema(): WithContext<WebSite> {
  // `query-input` is a valid schema.org property on SearchAction but is
  // unaliased in schema-dts's generated types (hyphenated keys don't survive
  // TS literal-key inference). Cast keeps the JSON-LD output correct while
  // emitting the ratified schema.org shape.
  const searchAction = {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE}/search?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  } as unknown as WebSite['potentialAction'];
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE,
    description: 'Deep notes for modern developers',
    inLanguage: 'en-US',
    potentialAction: searchAction,
  };
}

export interface TechArticleInput {
  title: string;
  description: string;
  /** Absolute canonical URL (Full Notes only). */
  url: string;
  /** Absolute OG image URL. */
  ogImage: string;
  /** ISO 8601. */
  datePublished: string;
  /** ISO 8601. */
  dateModified: string;
  /** Author display name. Defaults to Sonu Shahuji. */
  authorName?: string;
  /** Absolute author URL. Defaults to /about. */
  authorUrl?: string;
  /** Course/section label, e.g. `"Node.js"`. */
  section: string;
  tags: string[];
  /** e.g. `"Beginner" | "Intermediate" | "Advanced"`. */
  proficiencyLevel?: string;
  /** ISO 8601 duration, e.g. `"PT15M"`. */
  timeRequired?: string;
  /** Prose list of prerequisites. */
  dependencies?: string;
}

/** TechArticle — chapter Full Notes (spec §6, second block). */
export function techArticleSchema(input: TechArticleInput): WithContext<TechArticle> {
  const schema: WithContext<TechArticle> = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: input.title,
    description: input.description,
    author: {
      '@type': 'Person',
      name: input.authorName ?? DEFAULT_AUTHOR_NAME,
      url: input.authorUrl ?? DEFAULT_AUTHOR_URL,
    },
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: PUBLISHER_LOGO,
      },
    },
    image: input.ogImage,
    mainEntityOfPage: input.url,
    articleSection: input.section,
    keywords: input.tags.join(', '),
    inLanguage: 'en-US',
  };
  if (input.proficiencyLevel) schema.proficiencyLevel = input.proficiencyLevel;
  if (input.timeRequired) schema.timeRequired = input.timeRequired;
  if (input.dependencies) schema.dependencies = input.dependencies;
  return schema;
}

export interface CourseInput {
  /** Stable machine id, e.g. `"nodejs"`. */
  courseCode: string;
  /** Display name. */
  name: string;
  description: string;
  /** Absolute course overview URL. */
  url: string;
  /** e.g. `"Intermediate"`. */
  educationalLevel?: string;
  /** Prose topic label. */
  about: string;
  /** ISO 8601 duration, e.g. `"PT10H"`. */
  timeRequired?: string;
}

/** Course — course overview page (spec §6, third block). */
export function courseSchema(input: CourseInput): WithContext<Course> {
  const schema: WithContext<Course> = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: input.name,
    description: input.description,
    url: input.url,
    courseCode: input.courseCode,
    about: input.about,
    inLanguage: 'en-US',
    isAccessibleForFree: true,
    provider: {
      '@type': 'Organization',
      name: SITE_NAME,
      sameAs: SITE,
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      ...(input.timeRequired ? { courseWorkload: input.timeRequired } : {}),
    },
  };
  if (input.educationalLevel) schema.educationalLevel = input.educationalLevel;
  if (input.timeRequired) schema.timeRequired = input.timeRequired;
  return schema;
}

export interface CourseListItem {
  name: string;
  /** Absolute course overview URL. */
  url: string;
}

/** ItemList wrapping courses — all-courses page. */
export function courseListSchema(items: CourseListItem[]): WithContext<ItemList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

export interface BreadcrumbItem {
  name: string;
  /** Absolute URL. */
  url: string;
}

/** BreadcrumbList — any page with nav (spec §6, fourth block). */
export function breadcrumbSchema(items: BreadcrumbItem[]): WithContext<BreadcrumbList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface PersonInput {
  name: string;
  /** Absolute URL for the Person (usually the About page). */
  url: string;
  /** Short biography paragraph. */
  description?: string;
  /** Social profile URLs (Twitter, GitHub, LinkedIn, etc.). */
  sameAs?: string[];
  /** Absolute image URL (headshot). */
  image?: string;
  /** Job title, e.g. `"Software Engineer"`. */
  jobTitle?: string;
}

/** Person — About page author (spec §6 extended). */
export function personSchema(input: PersonInput): WithContext<Person> {
  const schema: WithContext<Person> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: input.name,
    url: input.url,
  };
  if (input.description) schema.description = input.description;
  if (input.sameAs && input.sameAs.length > 0) schema.sameAs = input.sameAs;
  if (input.image) schema.image = input.image;
  if (input.jobTitle) schema.jobTitle = input.jobTitle;
  return schema;
}

export interface AboutPageInput {
  /** Canonical About page URL. */
  url: string;
  name: string;
  description: string;
  /** Person schema for the primary author (built via `personSchema`). */
  about: Person;
}

/** AboutPage wrapper — About page. */
export function aboutPageSchema(input: AboutPageInput): WithContext<AboutPage> {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    url: input.url,
    name: input.name,
    description: input.description,
    about: input.about,
    inLanguage: 'en-US',
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE,
    },
  };
}
