export type WidgetKind = 'HERO'|'FEATURE_GRID'|'FEATURED_PROJECTS'|'PROMO_CAROUSEL'|'CUSTOM_HTML';
export type Visibility = 'PUBLIC'|'STAFF';

export type HomeWidget = {
  id: string;
  kind: WidgetKind;
  title: string | null;
  subtitle: string | null;
  payload: any; // kind-specific
  order_index: number;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
};

export function defaultPayload(kind: WidgetKind) {
  switch (kind) {
    case 'HERO':
      return {
        image_url: '',
        ctas: [
          { label: 'Browse Projects', href: '/projects' },
          { label: 'Availability', href: '/availability', variant: 'outline' },
        ]
      };
    case 'FEATURE_GRID':
      return {
        items: [
          { title: 'Project directory', desc: 'All current projects in one place.', icon: 'grid' },
          { title: 'Property search', desc: 'Filter by tower, size or RFO date.', icon: 'search' },
          { title: 'Talk to a consultant', desc: 'Promos and next steps—no pressure.', icon: 'chat' },
        ]
      };
    case 'FEATURED_PROJECTS':
      return {
        cards: [
          { title: 'Allegra Garden Place (AGP)', href: '/projects/AGP', tags: ['Pasig','Pre-selling','Near BGC'], image_url: '' },
          { title: 'Alder Residences (ALD)', href: '/projects/ALD', tags: ['Taguig','Mid-rise'], image_url: '' },
        ]
      };
    case 'PROMO_CAROUSEL':
      return { slides: [] }; // we’ll fill later
    case 'CUSTOM_HTML':
      return { html: '<div class="p-6">Custom block</div>' };
  }
}
