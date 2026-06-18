// data/services.js
// Service catalog for Nails By Sally

export const SERVICES = [
  {
    id: 'gel-manicure',
    name: 'Gel Manicure',
    description: 'Long-lasting gel polish manicure that stays perfect for weeks',
    durationMin: 60,
    price: 40,
    category: 'Manicure'
  },
  {
    id: 'classic-manicure',
    name: 'Classic Manicure',
    description: 'Traditional nail care with regular polish',
    durationMin: 45,
    price: 30,
    category: 'Manicure'
  },
  {
    id: 'acrylic-full-set',
    name: 'Acrylic Full Set',
    description: 'Complete set of acrylic nail extensions',
    durationMin: 120,
    price: 60,
    category: 'Extensions'
  },
  {
    id: 'acrylic-fill',
    name: 'Acrylic Fill',
    description: 'Fill in grown-out acrylic nails to keep them looking fresh',
    durationMin: 60,
    price: 45,
    category: 'Extensions'
  },
  {
    id: 'classic-pedicure',
    name: 'Classic Pedicure',
    description: 'Traditional pedicure with regular polish',
    durationMin: 60,
    price: 50,
    category: 'Pedicure'
  },
  {
    id: 'spa-pedicure',
    name: 'Spa Pedicure',
    description: 'Relaxing spa pedicure with exfoliation and massage',
    durationMin: 75,
    price: 65,
    category: 'Pedicure'
  },
  {
    id: 'gel-pedicure',
    name: 'Gel Pedicure',
    description: 'Long-lasting gel polish pedicure',
    durationMin: 75,
    price: 60,
    category: 'Pedicure'
  },
  {
    id: 'nail-repair',
    name: 'Nail Repair',
    description: 'Fix broken or damaged nails',
    durationMin: 20,
    price: 10,
    category: 'Add-ons'
  }
];

// Helper function to get a service by ID
export function getService(id) {
  return SERVICES.find(service => service.id === id);
}

// Helper function to get services by category
export function getServicesByCategory(category) {
  return SERVICES.filter(service => service.category === category);
}

// Export service categories
export const CATEGORIES = [
  'Manicure',
  'Pedicure',
  'Extensions',
  'Add-ons'
];